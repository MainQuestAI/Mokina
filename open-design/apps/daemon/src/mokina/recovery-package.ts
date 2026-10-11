import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import JSZip from 'jszip';

import {
  MOKINA_RECOVERY_LIMITS,
  MOKINA_RECOVERY_MANIFEST_FILE,
  MOKINA_RECOVERY_MANIFEST_SCHEMA,
  MOKINA_RECOVERY_LEGACY_SCHEMA,
  readMokinaRecoveryIntegrity,
  mokinaRecoveryWarnings,
  type MokinaRecoveryIntegrity,
  type MokinaRecoveryManifest,
  type MokinaRecoveryManifestContext,
  type MokinaRecoveryManifestFile,
  type MokinaRecoveryManifestVersion,
} from '@open-design/contracts';

import { unwrapMokinaSnapshot, validateMokinaSnapshot } from './context-store.js';
import { isSafeRecoveryPath, recoveryVersionCycles } from './recovery-export.js';
export { buildProjectRecoveryPackage, isSafeRecoveryPath, RecoveryIncompleteError } from './recovery-export.js';
export type { BuildRecoveryPackageResult } from './recovery-export.js';
import { isSafeId, projectDir } from '../projects.js';

/**
 * Mokina project recovery package (T14): export a project's data (originals,
 * versions with frozen content, context snapshots, assets) into one ZIP with a
 * `mokina-recovery.json` manifest, and import such a ZIP into a NEW project.
 *
 * Security posture:
 * - export walks only the project root plus the two managed metadata trees
 *   (`.file-versions`, `.mokina`) and skips ignored directories and symlinks;
 * - import validates the manifest schema, every path (relative, no `..`, no
 *   backslash, no absolute/drive prefix), every size + SHA-256, rejects
 *   symlink entries and over-cap archives, and never overwrites an existing
 *   project it does not own.
 */

const VERSION_ID_RE = /^[A-Za-z0-9_-]+$/u;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const IMPORT_COMMIT_FILE = '.mokina-recovery-import.json';
const importTails = new Map<string, Promise<ImportRecoveryResult>>();
type ImportCommit = {
  schema: 'mokina.recovery-import-commit.v1';
  operationId: string;
  targetProjectId: string;
  archiveDigest: string;
  ownerToken: string;
  files: Array<{ path: string; sha256: string; byteLength: number }>;
};

export const MOKINA_RECOVERY_VERSION_ROOT = '.file-versions';
export const MOKINA_RECOVERY_CONTEXT_ROOT = '.mokina';

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export type ImportRecoveryResult =
  | { ok: true; projectId: string; warnings: string[]; integrity: MokinaRecoveryIntegrity; manifest: MokinaRecoveryManifest }
  | { ok: false; status: number; code: string; message: string };

function fail(status: number, code: string, message: string): ImportRecoveryResult {
  return { ok: false, status, code, message };
}

export function parseRecoveryManifest(value: unknown): MokinaRecoveryManifest | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const integrity = readMokinaRecoveryIntegrity(record);
  if (!integrity) return null;
  if (typeof record.exportId !== 'string' || typeof record.createdAt !== 'string') return null;
  const source = record.sourceProject as { id?: unknown; name?: unknown } | undefined;
  if (source == null || typeof source.id !== 'string' || typeof source.name !== 'string') return null;
  if (!Array.isArray(record.files) || !Array.isArray(record.versions) || !Array.isArray(record.contexts)) return null;
  const files: MokinaRecoveryManifestFile[] = [];
  for (const raw of record.files) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const file = raw as Record<string, unknown>;
    if (
      !isSafeRecoveryPath(file.path)
      || typeof file.kind !== 'string'
      || typeof file.byteLength !== 'number' || !Number.isInteger(file.byteLength) || file.byteLength < 0
      || typeof file.sha256 !== 'string' || !SHA256_RE.test(file.sha256)
    ) {
      return null;
    }
    files.push({
      path: file.path,
      kind: file.kind as MokinaRecoveryManifestFile['kind'],
      byteLength: file.byteLength,
      sha256: file.sha256,
    });
  }
  const versions: MokinaRecoveryManifestVersion[] = [];
  for (const raw of record.versions) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const version = raw as Record<string, unknown>;
    if (
      typeof version.entry !== 'string' || !isSafeRecoveryPath(version.entry)
      || typeof version.originalVersionId !== 'string' || !VERSION_ID_RE.test(version.originalVersionId)
      || typeof version.versionNumber !== 'number' || !Number.isSafeInteger(version.versionNumber) || version.versionNumber < 1
      || typeof version.current !== 'boolean' || typeof version.candidate !== 'boolean'
      || typeof version.contentPath !== 'string' || !isSafeRecoveryPath(version.contentPath)
      || typeof version.contentDigest !== 'string' || !SHA256_RE.test(version.contentDigest)
    ) {
      return null;
    }
    if (version.frozenContentPath != null && (typeof version.frozenContentPath !== 'string' || !isSafeRecoveryPath(version.frozenContentPath))) {
      return null;
    }
    if (['parentOriginalVersionId', 'baseOriginalVersionId'].some(key => version[key] !== undefined
      && (typeof version[key] !== 'string' || !VERSION_ID_RE.test(version[key] as string)))) return null;
    versions.push({
      entry: version.entry,
      originalVersionId: version.originalVersionId,
      versionNumber: version.versionNumber,
      current: version.current,
      candidate: version.candidate,
      contentPath: version.contentPath,
      contentDigest: version.contentDigest,
      ...(typeof version.frozenContentPath === 'string' ? { frozenContentPath: version.frozenContentPath } : {}),
      ...(typeof version.parentOriginalVersionId === 'string' ? { parentOriginalVersionId: version.parentOriginalVersionId } : {}),
      ...(typeof version.baseOriginalVersionId === 'string' ? { baseOriginalVersionId: version.baseOriginalVersionId } : {}),
    });
  }
  const contexts: MokinaRecoveryManifestContext[] = [];
  for (const raw of record.contexts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const context = raw as Record<string, unknown>;
    if (
      typeof context.originalSnapshotId !== 'string'
      || typeof context.payloadPath !== 'string' || !isSafeRecoveryPath(context.payloadPath)
      || typeof context.fingerprint !== 'string' || !SHA256_RE.test(context.fingerprint)
    ) {
      return null;
    }
    contexts.push({
      originalSnapshotId: context.originalSnapshotId,
      payloadPath: context.payloadPath,
      fingerprint: context.fingerprint,
    });
  }
  if (new Set(files.map(file => file.path)).size !== files.length
    || new Set(versions.map(version => `${version.entry}:${version.originalVersionId}`)).size !== versions.length
    || new Set(versions.map(version => `${version.entry}:${version.versionNumber}`)).size !== versions.length
    || new Set(contexts.map(context => context.originalSnapshotId)).size !== contexts.length) return null;
  return {
    ...(record.schema === MOKINA_RECOVERY_LEGACY_SCHEMA
      ? { schema: MOKINA_RECOVERY_LEGACY_SCHEMA }
      : { schema: MOKINA_RECOVERY_MANIFEST_SCHEMA, integrity: integrity as MokinaRecoveryIntegrity & { status: 'complete' | 'partial' } }),
    exportId: record.exportId,
    createdAt: record.createdAt,
    sourceProject: { id: source.id, name: source.name },
    files,
    versions,
    contexts,
  };
}

async function writeFileAtomic(target: string, buffer: Buffer): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temporary, buffer, { mode: 0o600 });
  await rename(temporary, target);
}

type RecoveryImportInput = {
  projectsRoot: string;
  archive: Buffer;
  operationId: string;
  targetProjectId: string;
  projectName?: string;
  /**
   * Existing projects lookup + registration are injected so this module stays
   * free of DB access. `readProject` returns the stored metadata when the id
   * exists (including the operation that owns it, if any).
   */
  readProject: (projectId: string) => { metadata?: Record<string, unknown> | null } | null;
  registerProject: (row: { id: string; name: string; metadata: Record<string, unknown> }) => void;
};

/** Validate before any registry or target access; serialize the entire import per managed target. */
export async function importProjectRecoveryPackage(input: RecoveryImportInput): Promise<ImportRecoveryResult> {
  if (!isSafeId(input.targetProjectId)) return fail(400, 'BAD_REQUEST', 'targetProjectId 不合法。');
  if (!isSafeId(input.operationId) || !VERSION_ID_RE.test(input.operationId)) {
    return fail(400, 'BAD_REQUEST', 'operationId 不合法。');
  }
  try {
    await mkdir(input.projectsRoot, { recursive: true });
    const projectsRoot = await realpath(input.projectsRoot);
    const key = projectDir(projectsRoot, input.targetProjectId);
    const previous = importTails.get(key) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => importRecoveryIntoOwnedTarget({ ...input, projectsRoot }));
    importTails.set(key, task);
    try { return await task; }
    finally { if (importTails.get(key) === task) importTails.delete(key); }
  } catch (error) {
    return fail(500, 'MOKINA_RECOVERY_IMPORT_FAILED', error instanceof Error ? error.message : String(error));
  }
}

async function inspectTarget(target: string): Promise<Awaited<ReturnType<typeof lstat>> | null> {
  try { return await lstat(target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}

async function readImportCommit(projectRoot: string): Promise<ImportCommit | null> {
  try {
    const target = path.join(projectRoot, IMPORT_COMMIT_FILE);
    const info = await lstat(target);
    if (!info.isFile() || info.isSymbolicLink()) return null;
    const record = JSON.parse(await readFile(target, 'utf8')) as ImportCommit;
    return record.schema === 'mokina.recovery-import-commit.v1' && typeof record.ownerToken === 'string'
      && Array.isArray(record.files) ? record : null;
  } catch { return null; }
}

async function verifyCommittedFiles(projectRoot: string, files: ImportCommit['files']): Promise<void> {
  for (const file of files) {
    if (!isSafeRecoveryPath(file.path) || !SHA256_RE.test(file.sha256)) throw new Error('已提交恢复内容清单不合法。');
    let current = projectRoot;
    for (const segment of file.path.split('/')) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink()) throw new Error('已提交恢复内容含符号链接。');
    }
    const bytes = await readFile(current);
    if (bytes.length !== file.byteLength || sha256(bytes) !== file.sha256) throw new Error('已提交恢复内容校验失败。');
  }
}

async function importRecoveryIntoOwnedTarget(input: RecoveryImportInput): Promise<ImportRecoveryResult> {
  const projectRoot = projectDir(input.projectsRoot, input.targetProjectId);
  const archiveDigest = sha256(input.archive);
  const target = await inspectTarget(projectRoot);
  const existing = input.readProject(input.targetProjectId);
  if (existing != null) {
    const owner = existing.metadata?.mokinaOperationId;
    if (owner === input.operationId && existing.metadata?.mokinaArchiveDigest === archiveDigest
      && target?.isDirectory() && !target.isSymbolicLink()) {
      const manifest = parseRecoveryManifest(existing.metadata.mokinaRecoveryManifest);
      if (!manifest) return fail(409, 'MOKINA_OPERATION_CONFLICT', '已导入项目的恢复清单不可读，不能确认本次恢复结果。');
      const integrity = readMokinaRecoveryIntegrity(manifest)!;
      return { ok: true, projectId: input.targetProjectId, warnings: recoveryWarnings(manifest), integrity, manifest };
    }
    return fail(409, 'MOKINA_OPERATION_CONFLICT', '目标项目 ID 已被其他项目占用。');
  }
  const committed = target?.isDirectory() && !target.isSymbolicLink() ? await readImportCommit(projectRoot) : null;
  if (target && (!committed || committed.operationId !== input.operationId
    || committed.targetProjectId !== input.targetProjectId || committed.archiveDigest !== archiveDigest)) {
    return fail(409, 'MOKINA_OPERATION_CONFLICT', '目标目录不属于本次恢复操作。');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.archive);
  } catch {
    return fail(400, 'BAD_REQUEST', '恢复包不是可读的 ZIP。');
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > MOKINA_RECOVERY_LIMITS.maxArchiveEntries) {
    return fail(413, 'MOKINA_CONTEXT_LIMIT', '恢复包条目数量超过上限。');
  }
  let totalUncompressed = 0;
  for (const entry of entries) {
    const size = (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (size > MOKINA_RECOVERY_LIMITS.maxEntryBytes || totalUncompressed + size > MOKINA_RECOVERY_LIMITS.maxUncompressedBytes) {
      return fail(413, 'MOKINA_CONTEXT_LIMIT', '恢复包解压总量超过上限。');
    }
    totalUncompressed += size;
    const permissions = entry.unixPermissions;
    if (permissions != null && (Number(permissions) & 0o170000) === 0o120000) {
      return fail(400, 'BAD_REQUEST', `恢复包包含符号链接，已拒绝：${entry.name}`);
    }
    if (!isSafeRecoveryPath(entry.name)) {
      return fail(400, 'BAD_REQUEST', `恢复包包含不安全路径，已拒绝：${entry.name}`);
    }
  }

  const manifestEntry = zip.file(MOKINA_RECOVERY_MANIFEST_FILE);
  if (manifestEntry == null) {
    return fail(400, 'BAD_REQUEST', '恢复包缺少 mokina-recovery.json。');
  }
  let manifest: MokinaRecoveryManifest | null = null;
  try {
    manifest = parseRecoveryManifest(JSON.parse(await manifestEntry.async('text')));
  } catch {
    manifest = null;
  }
  if (manifest == null) {
    return fail(400, 'BAD_REQUEST', '恢复包清单校验失败。');
  }

  const byPath = new Map(manifest.files.map((file) => [file.path, file]));
  const buffers = new Map<string, Buffer>();
  for (const file of manifest.files) {
    if (file.path === IMPORT_COMMIT_FILE) return fail(400, 'BAD_REQUEST', '恢复包包含保留的操作记录。');
    const entry = zip.file(file.path);
    if (entry == null) {
      return fail(400, 'BAD_REQUEST', `恢复包清单与内容不符，缺少：${file.path}`);
    }
    const buffer = await entry.async('nodebuffer');
    if (buffer.length !== file.byteLength || sha256(buffer) !== file.sha256) {
      return fail(400, 'BAD_REQUEST', `恢复包内容校验失败：${file.path}`);
    }
    buffers.set(file.path, buffer);
  }

  // Version graph invariants.
  const versionIds = new Set(manifest.versions.map((version) => `${version.entry}:${version.originalVersionId}`));
  if (recoveryVersionCycles(manifest.versions).size) return fail(400, 'BAD_REQUEST', '恢复包中的版本关系存在循环。');
  const currentCounts = new Map<string, number>();
  for (const version of manifest.versions) {
    if (!byPath.has(version.contentPath)) {
      return fail(400, 'BAD_REQUEST', `版本内容未包含在恢复包中：${version.entry}`);
    }
    if (sha256(buffers.get(version.contentPath)!) !== version.contentDigest) {
      return fail(400, 'BAD_REQUEST', `版本内容摘要校验失败：${version.entry}`);
    }
    if (version.frozenContentPath != null && !byPath.has(version.frozenContentPath)) {
      return fail(400, 'BAD_REQUEST', `冻结版本内容未包含在恢复包中：${version.entry}`);
    }
    if (version.current && version.candidate) {
      return fail(400, 'BAD_REQUEST', `候选版本不能同时是当前版本：${version.entry}`);
    }
    for (const relation of [version.parentOriginalVersionId, version.baseOriginalVersionId]) {
      if (relation != null && !versionIds.has(`${version.entry}:${relation}`)) {
        return fail(400, 'BAD_REQUEST', `版本关系引用了不存在的版本：${version.entry}`);
      }
    }
    if (version.current) {
      const next = (currentCounts.get(version.entry) ?? 0) + 1;
      if (next > 1) return fail(400, 'BAD_REQUEST', `同一文件存在多个当前版本：${version.entry}`);
      currentCounts.set(version.entry, next);
    }
  }
  for (const context of manifest.contexts) {
    const payload = buffers.get(context.payloadPath);
    if (payload == null) {
      return fail(400, 'BAD_REQUEST', `快照内容未包含在恢复包中：${context.payloadPath}`);
    }
    let inner: unknown;
    try {
      inner = unwrapMokinaSnapshot(JSON.parse(payload.toString('utf8')));
    } catch {
      return fail(400, 'BAD_REQUEST', `快照内容不可解析：${context.payloadPath}`);
    }
    if (!validateMokinaSnapshot(inner) || inner.fingerprint !== context.fingerprint || inner.snapshotId !== context.originalSnapshotId) {
      return fail(400, 'BAD_REQUEST', `快照指纹校验失败：${context.payloadPath}`);
    }
    for (const item of inner.items) {
      if (item.kind !== 'asset') continue;
      const bytes = buffers.get(`${MOKINA_RECOVERY_CONTEXT_ROOT}/blobs/${item.blobId}`);
      if (!bytes || sha256(bytes) !== item.blobId || bytes.length !== item.byteLength) {
        return fail(400, 'BAD_REQUEST', `快照素材校验失败：${item.displayName}`);
      }
    }
    buffers.set(context.payloadPath, Buffer.from(JSON.stringify({ schema: 'mokina.restored-context.v1',
      ownerProjectId: input.targetProjectId, originalSnapshot: inner })));

  }

  const integrity = readMokinaRecoveryIntegrity(manifest)!;
  const warnings = recoveryWarnings(manifest);
  let staging: string | undefined;
  try {
    // Rebuild the version store faithfully: same layout, id mapping preserved,
    // candidates stay candidates and never become current here.
    for (const [entryName, versions] of groupByEntry(manifest.versions)) {
      const key = createHash('sha256').update(entryName).digest('hex').slice(0, 24);
      const versionRoot = `${MOKINA_RECOVERY_VERSION_ROOT}/${key}`;
      const entries = versions.map((version) => ({
        id: version.originalVersionId,
        fileName: entryName,
        version: version.versionNumber,
        label: `恢复版本 ${version.versionNumber}`,
        createdAt: Date.parse(manifest.createdAt) || Date.now(),
        source: 'restore',
        prompt: null,
        size: buffers.get(version.contentPath)?.length ?? 0,
        mime: mimeForEntry(entryName),
        kind: kindForEntry(entryName),
        contentPath: path.basename(version.contentPath),
        ...(version.frozenContentPath ? { frozenContentPath: path.basename(version.frozenContentPath) } : {}),
        contentDigest: version.contentDigest,
        ...(version.candidate ? { candidate: true } : {}),
        ...(version.parentOriginalVersionId ? { parentVersionId: version.parentOriginalVersionId } : {}),
        ...(version.baseOriginalVersionId ? { baseVersionId: version.baseOriginalVersionId } : {}),
      }));
      const current = versions.find((version) => version.current)?.originalVersionId ?? null;
      buffers.set(
        `${versionRoot}/manifest.json`,
        Buffer.from(`${JSON.stringify({ schemaVersion: 2, fileName: entryName, entries, currentVersionId: current }, null, 2)}\n`, 'utf8'),
      );
    }
    const files = [...buffers].map(([relative, bytes]) => ({ path: relative, sha256: sha256(bytes), byteLength: bytes.length }));
    if (committed) {
      // A process may have committed the directory before SQLite registration.
      // Recover only this exact operation, and verify every byte again.
      if (JSON.stringify(committed.files) !== JSON.stringify(files)) throw new Error('恢复操作的已提交内容与归档不符。');
      await verifyCommittedFiles(projectRoot, files);
    } else {
      staging = await mkdtemp(path.join(input.projectsRoot, '.mokina-recovery-stage-'));
      for (const [relativePath, buffer] of buffers) await writeFileAtomic(path.join(staging, relativePath), buffer);
      const marker: ImportCommit = { schema: 'mokina.recovery-import-commit.v1', operationId: input.operationId,
        targetProjectId: input.targetProjectId, archiveDigest, ownerToken: randomUUID(), files };
      await writeFileAtomic(path.join(staging, IMPORT_COMMIT_FILE), Buffer.from(JSON.stringify(marker)));
      // Never rename onto an existing directory or follow a target symlink.
      if (await inspectTarget(projectRoot) || input.readProject(input.targetProjectId)) {
        return fail(409, 'MOKINA_OPERATION_CONFLICT', '提交前目标项目已被占用。');
      }
      await rename(staging, projectRoot);
      staging = undefined;
    }
    const name = (input.projectName ?? manifest.sourceProject.name).trim() || manifest.sourceProject.name;
    input.registerProject({
      id: input.targetProjectId,
      name,
      metadata: { mokinaArchiveDigest: archiveDigest, mokinaRecoveryManifest: manifest, mokinaOperationId: input.operationId, recoveredFrom: manifest.sourceProject.id, recoveredAt: new Date().toISOString() },
    });
  } catch (error) {
    return fail(500, 'MOKINA_RECOVERY_IMPORT_FAILED', error instanceof Error ? error.message : String(error));
  } finally {
    if (staging) await rm(staging, { force: true, recursive: true });
  }
  return { ok: true, projectId: input.targetProjectId, warnings, integrity, manifest };
}

function groupByEntry(versions: MokinaRecoveryManifestVersion[]): Map<string, MokinaRecoveryManifestVersion[]> {
  const grouped = new Map<string, MokinaRecoveryManifestVersion[]>();
  for (const version of versions) {
    const list = grouped.get(version.entry) ?? [];
    list.push(version);
    grouped.set(version.entry, list);
  }
  return grouped;
}

function kindForEntry(entry: string): string {
  const ext = path.extname(entry).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.md') return 'document';
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.gif' || ext === '.svg') return 'image';
  return 'file';
}

function mimeForEntry(entry: string): string {
  const ext = path.extname(entry).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'text/html';
  if (ext === '.md') return 'text/markdown';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function recoveryWarnings(manifest: MokinaRecoveryManifest): string[] {
  const warnings = mokinaRecoveryWarnings(readMokinaRecoveryIntegrity(manifest)!);
  if (manifest.contexts.length === 0 && manifest.versions.length === 0) warnings.push('恢复包不含版本或快照，仅恢复原件。');
  return warnings;
}
