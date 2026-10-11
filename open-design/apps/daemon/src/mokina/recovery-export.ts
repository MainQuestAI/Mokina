import { readVersionEvidence } from './version-evidence.js';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {
  MOKINA_RECOVERY_LIMITS, MOKINA_RECOVERY_MANIFEST_FILE, MOKINA_RECOVERY_MANIFEST_SCHEMA,
  mokinaRecoveryWarnings, type MokinaRecoveryIntegrity, type MokinaRecoveryIssue,
  type MokinaRecoveryManifest, type MokinaRecoveryManifestContext,
  type MokinaRecoveryManifestFile, type MokinaRecoveryManifestVersion,
} from '@open-design/contracts';
import { IGNORED_PROJECT_DIR_NAMES } from '../project-ignored-dirs.js';
import { unwrapMokinaSnapshot } from './context-store.js';

const VERSION_ROOT = '.file-versions';
const CONTEXT_ROOT = '.mokina';
const IMPORT_COMMIT_FILE = '.mokina-recovery-import.json';
const SHA256_RE = /^[a-f0-9]{64}$/u;
const ID_RE = /^[A-Za-z0-9_-]+$/u;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export function isSafeRecoveryPath(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 400) return false;
  if (candidate.startsWith('/') || candidate.includes('\\') || /^[A-Za-z]:/.test(candidate)) return false;
  return candidate.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
}

export class RecoveryIncompleteError extends Error {
  readonly code = 'MOKINA_RECOVERY_INCOMPLETE';
  constructor(readonly issues: MokinaRecoveryIssue[]) {
    super('未生成完整恢复包：部分数据无法验证或已发生变化。请查看缺失清单，修复后重试，或明确选择部分抢救。');
  }
}

type CapturedFile = { bytes: Buffer; kind: MokinaRecoveryManifestFile['kind'] | 'guard' };

/** Read once for the archive, then verify the same files/directories before committing it. */
class RecoveryCapture {
  readonly files = new Map<string, CapturedFile>();
  readonly issues: MokinaRecoveryIssue[] = [];
  private readonly directories = new Map<string, string>();
  private readonly absentDirectories = new Set<string>();
  constructor(readonly root: string, readonly managedRoot: string = root) {}

  issue(relative: string, reason: MokinaRecoveryIssue['reason'], message: string): void {
    if (!this.issues.some(item => item.path === relative && item.reason === reason && item.message === message)) {
      this.issues.push({ path: relative || '(project)', reason, message });
    }
  }

  private async localPath(relative: string): Promise<string> {
    if (relative && !isSafeRecoveryPath(relative)) throw new Error('不安全的项目相对路径');
    // Imported-folder originals remain external; Mokina always stores versions
    // and frozen context under the managed project identity.
    const managed = relative === VERSION_ROOT || relative.startsWith(`${VERSION_ROOT}/`)
      || relative === CONTEXT_ROOT || relative.startsWith(`${CONTEXT_ROOT}/`);
    let absolute = managed ? this.managedRoot : this.root;
    for (const segment of relative.split('/').filter(Boolean)) {
      absolute = path.join(absolute, segment);
      if ((await lstat(absolute)).isSymbolicLink()) throw new Error('符号链接不属于可恢复的项目文件');
    }
    return absolute;
  }

  private readFailure(relative: string, error: unknown): void {
    const code = (error as NodeJS.ErrnoException).code;
    this.issue(relative, code === 'ENOENT' ? 'missing' : 'unreadable',
      code === 'ENOENT' ? '文件或目录缺失。' : `无法读取项目数据${code ? `（${code}）` : ''}。`);
  }

  async directory(relative: string, optional = false): Promise<Dirent[]> {
    try {
      const absolute = await this.localPath(relative);
      const entries = await readdir(absolute, { withFileTypes: true });
      this.directories.set(relative, entries.map(entry => `${entry.name}:${entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : 's'}`).sort().join('\n'));
      return entries;
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') this.absentDirectories.add(relative);
      else this.readFailure(relative, error);
      return [];
    }
  }

  async file(relative: string, kind: CapturedFile['kind']): Promise<Buffer | null> {
    const prior = this.files.get(relative);
    if (prior) return prior.bytes;
    try {
      const absolute = await this.localPath(relative);
      const info = await lstat(absolute);
      if (!info.isFile()) throw new Error('不是普通文件');
      if (info.size > MOKINA_RECOVERY_LIMITS.maxEntryBytes) {
        this.issue(relative, 'limit', '单个文件超过恢复包 64 MiB 上限。'); return null;
      }
      const bytes = await readFile(absolute);
      if (bytes.length > MOKINA_RECOVERY_LIMITS.maxEntryBytes) {
        this.issue(relative, 'limit', '单个文件超过恢复包 64 MiB 上限。'); return null;
      }
      this.files.set(relative, { bytes, kind });
      const archived = [...this.files.values()].filter(file => file.kind !== 'guard');
      if (archived.length >= MOKINA_RECOVERY_LIMITS.maxArchiveEntries
        || archived.reduce((size, file) => size + file.bytes.length, 0) > MOKINA_RECOVERY_LIMITS.maxUncompressedBytes) {
        this.files.delete(relative);
        this.issue(relative, 'limit', '项目超过恢复包 2000 条目（含清单）或 512 MiB 总量上限。');
        return null;
      }
      return bytes;
    } catch (error) {
      this.files.delete(relative);
      this.readFailure(relative, error);
      return null;
    }
  }

  private discardTree(relative: string): void {
    for (const name of this.files.keys()) {
      if (!relative || name === relative || name.startsWith(`${relative}/`)) this.files.delete(name);
    }
  }

  async verifyStable(): Promise<void> {
    for (const [relative, original] of this.directories) {
      try {
        const entries = await readdir(await this.localPath(relative), { withFileTypes: true });
        const current = entries.map(entry => `${entry.name}:${entry.isDirectory() ? 'd' : entry.isFile() ? 'f' : 's'}`).sort().join('\n');
        if (current === original) continue;
      } catch { /* Report this collection as changed, never an empty replacement. */ }
      this.issue(relative, 'changed', '导出期间目录发生变化或变得不可读，请停止写入后重试。');
      this.discardTree(relative);
    }
    for (const relative of this.absentDirectories) {
      try { await this.localPath(relative); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; }
      this.issue(relative, 'changed', '导出期间出现新的记录或目录状态变化，请停止写入后重试。');
    }
    for (const [relative, captured] of this.files) {
      try {
        if (digest(await readFile(await this.localPath(relative))) === digest(captured.bytes)) continue;
      } catch { /* A disappeared or unreadable file is also not a stable capture. */ }
      this.issue(relative, 'changed', '导出期间文件发生变化或变得不可读，请停止写入后重试。');
      this.discardTree(captured.kind === 'guard' ? path.posix.dirname(relative) : relative);
    }
  }
}

async function collectOriginals(capture: RecoveryCapture, relative = ''): Promise<void> {
  for (const entry of await capture.directory(relative)) {
    if (!relative && (entry.name === IMPORT_COMMIT_FILE || entry.name === VERSION_ROOT || entry.name === CONTEXT_ROOT
      || IGNORED_PROJECT_DIR_NAMES.has(entry.name))) continue;
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collectOriginals(capture, name);
    else if (entry.isFile()) await capture.file(name, name === 'MOKINA-CONTINUATION.json' ? 'continuation' : 'original');
    else capture.issue(name, 'unsupported', '符号链接或特殊文件未收录；不会读取项目外的目标。');
  }
}

async function collectVersions(capture: RecoveryCapture): Promise<MokinaRecoveryManifestVersion[]> {
  const versions: MokinaRecoveryManifestVersion[] = [];
  for (const dir of await capture.directory(VERSION_ROOT, true)) {
    const directory = `${VERSION_ROOT}/${dir.name}`;
    const manifestPath = `${directory}/manifest.json`;
    if (!dir.isDirectory()) { capture.issue(directory, 'invalid', '版本存储不是目录。'); continue; }
    const bytes = await capture.file(manifestPath, 'guard');
    if (!bytes) continue;
    let raw: { entries?: unknown; currentVersionId?: unknown; schemaVersion?: unknown } | null = null;
    try { raw = JSON.parse(bytes.toString('utf8')); } catch { /* Retain an explicit missing collection below. */ }
    if (!raw || !Array.isArray(raw.entries)) { capture.issue(manifestPath, 'invalid', '版本清单损坏，无法确认历史身份。'); continue; }
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1 && raw.schemaVersion !== 2) {
      capture.issue(manifestPath, 'invalid', '版本清单 schemaVersion 不受支持，无法确认其语义。'); continue;
    }
    const entries = raw.entries as Array<Record<string, unknown> | null>;
    const ids = entries.map(entry => entry?.id);
    const numbers = entries.map(entry => entry?.version);
    if (entries.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry)) || new Set(ids).size !== ids.length || new Set(numbers).size !== numbers.length) {
      capture.issue(manifestPath, 'invalid', '版本条目损坏或身份重复，未猜测版本关系。'); continue;
    }
    const currentId = raw.currentVersionId === undefined && Number(raw.schemaVersion ?? 1) < 2
      ? entries.at(-1)?.id ?? null : raw.currentVersionId;
    if (currentId !== null && (!ID_RE.test(String(currentId)) || !entries.some(entry => entry?.id === currentId && entry?.candidate !== true))) {
      capture.issue(manifestPath, 'invalid', '当前版本身份无效，未提升其他版本。'); continue;
    }
    for (const entry of entries) {
      if (!entry || typeof entry.fileName !== 'string' || !isSafeRecoveryPath(entry.fileName)
        || (entry.candidate !== undefined && typeof entry.candidate !== 'boolean')
        || typeof entry.id !== 'string' || !ID_RE.test(entry.id) || !Number.isSafeInteger(entry.version) || Number(entry.version) < 1
        || typeof entry.contentPath !== 'string' || !isSafeRecoveryPath(entry.contentPath) || entry.contentPath.includes('/')
        || (entry.frozenContentPath !== undefined && (typeof entry.frozenContentPath !== 'string'
          || !isSafeRecoveryPath(entry.frozenContentPath) || entry.frozenContentPath.includes('/')))
        || (entry.contentDigest !== undefined && (typeof entry.contentDigest !== 'string' || !SHA256_RE.test(entry.contentDigest)))
        || ['parentVersionId', 'baseVersionId'].some(key => entry[key] !== undefined && (typeof entry[key] !== 'string' || !ID_RE.test(entry[key] as string)))) {
        capture.issue(manifestPath, 'invalid', '版本条目的身份、路径或摘要无效。'); continue;
      }
      if (createHash('sha256').update(entry.fileName).digest('hex').slice(0, 24) !== dir.name) {
        capture.issue(manifestPath, 'invalid', '版本目录与成果身份不符。'); continue;
      }
      const contentPath = `${directory}/${entry.contentPath}`;
      const content = await capture.file(contentPath, 'version');
      if (!content) continue;
      if (entry.contentDigest !== undefined && digest(content) !== entry.contentDigest) {
        capture.issue(contentPath, 'invalid', '版本内容与已保存摘要不符。'); capture.files.delete(contentPath); continue;
      }
      const frozenContentPath = typeof entry.frozenContentPath === 'string' ? `${directory}/${entry.frozenContentPath}` : undefined;
      const frozen = frozenContentPath ? await capture.file(frozenContentPath, 'frozen-version') : undefined;
      if (frozenContentPath && !frozen) continue;
      try { readVersionEvidence(content.toString('utf8'), frozen?.toString('utf8'), entry.id, digest(content)); }
      catch { capture.issue(contentPath, 'invalid', '版本证据冻结记录缺失或摘要不符。'); continue; }
      versions.push({ entry: entry.fileName, originalVersionId: entry.id, versionNumber: Number(entry.version),
        current: entry.id === currentId, candidate: entry.candidate === true, contentPath, contentDigest: digest(content),
        ...(frozenContentPath ? { frozenContentPath } : {}),
        ...(typeof entry.parentVersionId === 'string' ? { parentOriginalVersionId: entry.parentVersionId } : {}),
        ...(typeof entry.baseVersionId === 'string' ? { baseOriginalVersionId: entry.baseVersionId } : {}) });
    }
  }
  return versions;
}

async function collectContexts(capture: RecoveryCapture, projectId: string): Promise<MokinaRecoveryManifestContext[]> {
  const contexts: MokinaRecoveryManifestContext[] = [];
  for (const file of await capture.directory(`${CONTEXT_ROOT}/contexts`, true)) {
    if (!file.name.endsWith('.json')) continue;
    const payloadPath = `${CONTEXT_ROOT}/contexts/${file.name}`;
    const bytes = await capture.file(payloadPath, 'context-snapshot');
    if (!bytes) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { /* Invalid snapshot handled below. */ }
    const snapshot = unwrapMokinaSnapshot(parsed);
    const wrapper = parsed as { schema?: string; ownerProjectId?: string } | undefined;
    const owner = wrapper?.schema === 'mokina.restored-context.v1' ? wrapper.ownerProjectId : snapshot?.projectId;
    if (!snapshot || owner !== projectId || `${snapshot.snapshotId}.json` !== file.name) {
      capture.issue(payloadPath, 'invalid', '固定来源的内容、摘要或归属无效。'); capture.files.delete(payloadPath); continue;
    }
    for (const item of snapshot.items) {
      if (item.kind !== 'asset') continue;
      const blobPath = `${CONTEXT_ROOT}/blobs/${item.blobId}`;
      const blob = await capture.file(blobPath, 'asset');
      if (blob && (digest(blob) !== item.blobId || blob.length !== item.byteLength)) {
        capture.issue(blobPath, 'invalid', '固定素材与来源摘要不符。'); capture.files.delete(blobPath);
      }
    }
    contexts.push({ originalSnapshotId: snapshot.snapshotId, payloadPath, fingerprint: snapshot.fingerprint });
  }
  return contexts;
}

/** Partial archives retain only intact reference closures, never invent parents or a current version. */
function retainClosedReferences(capture: RecoveryCapture, versions: MokinaRecoveryManifestVersion[], contexts: MokinaRecoveryManifestContext[]): void {
  const cycles = recoveryVersionCycles(versions);
  for (let index = versions.length - 1; index >= 0; index--) {
    const version = versions[index]!;
    if (!cycles.has(version)) continue;
    capture.issue(version.contentPath, 'invalid', '版本关系存在循环，无法确认来源顺序。');
    versions.splice(index, 1);
  }
  let removed: boolean;
  do {
    removed = false;
    for (let index = versions.length - 1; index >= 0; index--) {
      const version = versions[index]!;
      const valid = capture.files.has(version.contentPath) && (!version.frozenContentPath || capture.files.has(version.frozenContentPath))
        && [version.parentOriginalVersionId, version.baseOriginalVersionId].every(ref => !ref
          || versions.some(parent => parent.entry === version.entry && parent.originalVersionId === ref && parent !== version));
      if (valid) continue;
      capture.issue(version.contentPath, 'dependency', '版本或其 parent/base 依赖缺失，已排除该版本；不会改写来源或提升旧版本。');
      versions.splice(index, 1); removed = true;
    }
  } while (removed);
  for (let index = contexts.length - 1; index >= 0; index--) {
    const context = contexts[index]!;
    const bytes = capture.files.get(context.payloadPath)?.bytes;
    const snapshot = bytes ? unwrapMokinaSnapshot(JSON.parse(bytes.toString('utf8'))) : null;
    if (snapshot && snapshot.items.every(item => item.kind !== 'asset' || capture.files.has(`${CONTEXT_ROOT}/blobs/${item.blobId}`))) continue;
    capture.issue(context.payloadPath, 'dependency', '固定来源或其素材缺失，已排除整个快照；不会用当前资料替代。');
    contexts.splice(index, 1);
  }
  const continuationPath = 'MOKINA-CONTINUATION.json';
  const continuation = capture.files.get(continuationPath);
  if (continuation) {
    let value: { contextSnapshotId?: unknown } | null = null;
    try { value = JSON.parse(continuation.bytes.toString('utf8')); } catch { /* Not a valid continuation. */ }
    if (!value || (value.contextSnapshotId !== undefined && !contexts.some(context => context.originalSnapshotId === value?.contextSnapshotId))) {
      capture.issue(continuationPath, 'dependency', '接续记录损坏或其固定快照缺失，已排除接续记录。');
      capture.files.delete(continuationPath);
    }
  }
  const retained = new Set([...versions.flatMap(version => [version.contentPath, ...(version.frozenContentPath ? [version.frozenContentPath] : [])]),
    ...contexts.flatMap(context => {
      const snapshot = unwrapMokinaSnapshot(JSON.parse(capture.files.get(context.payloadPath)!.bytes.toString('utf8')))!;
      return [context.payloadPath, ...snapshot.items.flatMap(item => item.kind === 'asset' ? [`${CONTEXT_ROOT}/blobs/${item.blobId}`] : [])];
    })]);
  for (const [name, file] of capture.files) {
    if (!['original', 'continuation'].includes(file.kind) && !retained.has(name)) capture.files.delete(name);
  }
}

/** Shared by capture and import so a salvage archive cannot contain a cyclic lineage. */
export function recoveryVersionCycles(versions: MokinaRecoveryManifestVersion[]): Set<MokinaRecoveryManifestVersion> {
  const cyclic = new Set<MokinaRecoveryManifestVersion>();
  const visited = new Set<MokinaRecoveryManifestVersion>();
  const active: MokinaRecoveryManifestVersion[] = [];
  const visit = (version: MokinaRecoveryManifestVersion) => {
    const index = active.indexOf(version);
    if (index >= 0) { for (const member of active.slice(index)) cyclic.add(member); return; }
    if (visited.has(version)) return;
    active.push(version);
    for (const ref of [version.parentOriginalVersionId, version.baseOriginalVersionId]) {
      const parent = ref ? versions.find(candidate => candidate.entry === version.entry && candidate.originalVersionId === ref) : null;
      if (parent) visit(parent);
    }
    active.pop(); visited.add(version);
  };
  for (const version of versions) visit(version);
  return cyclic;
}

export type BuildRecoveryPackageResult = {
  buffer: Buffer;
  manifest: Extract<MokinaRecoveryManifest, { schema: typeof MOKINA_RECOVERY_MANIFEST_SCHEMA }>;
  baseName: string;
  warnings: string[];
};

export async function buildProjectRecoveryPackage(input: {
  projectsRoot: string; projectId: string; projectName: string; exportId: string; now?: Date;
  /** Only the authorized route resolves an imported-folder project's root. */
  projectRoot?: string;
  mode?: 'complete' | 'partial';
}): Promise<BuildRecoveryPackageResult> {
  const managedRoot = path.join(input.projectsRoot, input.projectId);
  const capture = new RecoveryCapture(input.projectRoot ?? managedRoot, managedRoot);
  await collectOriginals(capture);
  const versions = await collectVersions(capture);
  const contexts = await collectContexts(capture, input.projectId);
  await capture.verifyStable();
  retainClosedReferences(capture, versions, contexts);
  // The manifest is an archive entry too. Recalculate after exclusions because its
  // issue report is part of the same uncompressed-size limit checked on import.
  const makeManifest = (): BuildRecoveryPackageResult['manifest'] => ({
    schema: MOKINA_RECOVERY_MANIFEST_SCHEMA, exportId: input.exportId,
    createdAt: (input.now ?? new Date()).toISOString(), sourceProject: { id: input.projectId, name: input.projectName },
    files: [...capture.files].filter(([, file]) => file.kind !== 'guard').map(([name, file]) => ({
      path: name, kind: file.kind as MokinaRecoveryManifestFile['kind'], byteLength: file.bytes.length, sha256: digest(file.bytes),
    })), versions, contexts,
    integrity: { status: capture.issues.length ? 'partial' : 'complete', issues: capture.issues },
  });
  let manifest = makeManifest();
  let manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  while (manifest.files.reduce((total, file) => total + file.byteLength, manifestBytes.length) > MOKINA_RECOVERY_LIMITS.maxUncompressedBytes) {
    const omitted = manifest.files.at(-1);
    if (!omitted) break;
    capture.files.delete(omitted.path);
    capture.issue(omitted.path, 'limit', '文件与完整性清单合计超过恢复包 512 MiB 总量上限。');
    retainClosedReferences(capture, versions, contexts);
    manifest = makeManifest();
    manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2));
  }
  if (capture.issues.length && input.mode !== 'partial') throw new RecoveryIncompleteError(capture.issues);
  if (manifestBytes.length > MOKINA_RECOVERY_LIMITS.maxEntryBytes) throw new Error('完整性清单超过恢复包单文件上限，无法安全生成恢复包。');
  const zip = new JSZip();
  for (const file of manifest.files) zip.file(file.path, capture.files.get(file.path)!.bytes);
  zip.file(MOKINA_RECOVERY_MANIFEST_FILE, manifestBytes);
  return { buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), manifest,
    baseName: `${input.projectName || 'project'}-${manifest.integrity.status === 'partial' ? 'partial-rescue' : 'recovery'}`,
    warnings: mokinaRecoveryWarnings(manifest.integrity as MokinaRecoveryIntegrity) };
}
