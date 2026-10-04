import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import JSZip from 'jszip';

import {
  MOKINA_RECOVERY_LIMITS,
  MOKINA_RECOVERY_MANIFEST_FILE,
  MOKINA_RECOVERY_MANIFEST_SCHEMA,
  type MokinaRecoveryManifest,
  type MokinaRecoveryManifestContext,
  type MokinaRecoveryManifestFile,
  type MokinaRecoveryManifestVersion,
} from '@open-design/contracts';

import { IGNORED_PROJECT_DIR_NAMES } from '../project-ignored-dirs.js';

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

const MANAGED_DIR_NAMES = new Set(['.file-versions', '.mokina']);
const VERSION_ID_RE = /^[A-Za-z0-9_-]+$/u;
const SHA256_RE = /^[a-f0-9]{64}$/u;

export const MOKINA_RECOVERY_VERSION_ROOT = '.file-versions';
export const MOKINA_RECOVERY_CONTEXT_ROOT = '.mokina';

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function toPosix(relative: string): string {
  return relative.split(path.sep).join('/');
}

export function isSafeRecoveryPath(candidate: unknown): candidate is string {
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 400) return false;
  if (candidate.startsWith('/') || candidate.includes('\\')) return false;
  if (/^[A-Za-z]:/.test(candidate)) return false;
  const segments = candidate.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

type CollectedFile = { path: string; absolutePath: string; kind: MokinaRecoveryManifestFile['kind'] };

async function collectProjectFiles(projectRoot: string): Promise<CollectedFile[]> {
  const collected: CollectedFile[] = [];
  const walk = async (relativeDir: string): Promise<void> => {
    const absoluteDir = path.join(projectRoot, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(projectRoot, relative);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (relativeDir === '' && (MANAGED_DIR_NAMES.has(entry.name) || IGNORED_PROJECT_DIR_NAMES.has(entry.name))) continue;
        await walk(relative);
        continue;
      }
      if (!entry.isFile()) continue;
      collected.push({ path: toPosix(relative), absolutePath: absolute, kind: 'original' });
    }
  };
  await walk('');
  return collected;
}

async function collectVersionFiles(projectRoot: string): Promise<{
  files: CollectedFile[];
  versions: MokinaRecoveryManifestVersion[];
  warnings: string[];
}> {
  const versionRoot = path.join(projectRoot, MOKINA_RECOVERY_VERSION_ROOT);
  const files: CollectedFile[] = [];
  const versions: MokinaRecoveryManifestVersion[] = [];
  const warnings: string[] = [];
  let dirs: string[];
  try {
    dirs = await readdir(versionRoot);
  } catch {
    return { files, versions, warnings };
  }
  for (const dir of dirs) {
    const manifestPath = path.join(versionRoot, dir, 'manifest.json');
    let state: unknown;
    try {
      state = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
      warnings.push(`版本清单无法读取，已跳过：${dir}`);
      continue;
    }
    const record = state as { entries?: unknown; currentVersionId?: unknown };
    if (!Array.isArray(record.entries)) {
      warnings.push(`版本清单结构不符，已跳过：${dir}`);
      continue;
    }
    const currentVersionId = typeof record.currentVersionId === 'string' ? record.currentVersionId : null;
    for (const rawEntry of record.entries) {
      const entry = rawEntry as Record<string, unknown>;
      if (
        typeof entry.id !== 'string' || typeof entry.fileName !== 'string'
        || typeof entry.contentPath !== 'string' || typeof entry.version !== 'number'
      ) {
        warnings.push(`版本条目缺少必要字段，已跳过：${dir}`);
        continue;
      }
      const contentMembers: Array<{ relative: string; kind: MokinaRecoveryManifestFile['kind'] }> = [
        { relative: `${MOKINA_RECOVERY_VERSION_ROOT}/${dir}/${entry.contentPath}`, kind: 'version' },
      ];
      if (typeof entry.frozenContentPath === 'string') {
        contentMembers.push({
          relative: `${MOKINA_RECOVERY_VERSION_ROOT}/${dir}/${entry.frozenContentPath}`,
          kind: 'frozen-version',
        });
      }
      const contentId = typeof entry.contentDigest === 'string' && SHA256_RE.test(entry.contentDigest)
        ? entry.contentDigest
        : null;
      const absoluteContentPath = path.join(projectRoot, contentMembers[0]!.relative);
      const contentBuffer = await readFile(absoluteContentPath).catch(() => null);
      if (contentBuffer == null) {
        warnings.push(`版本内容缺失，已跳过：${entry.fileName} v${entry.version}`);
        continue;
      }
      const digest = contentId ?? sha256(contentBuffer);
      if (contentId != null && sha256(contentBuffer) !== contentId) {
        warnings.push(`版本内容摘要不符，已跳过：${entry.fileName} v${entry.version}`);
        continue;
      }
      for (const member of contentMembers) {
        files.push({
          path: member.relative,
          absolutePath: path.join(projectRoot, member.relative),
          kind: member.kind,
        });
      }
      versions.push({
        entry: entry.fileName,
        originalVersionId: entry.id,
        versionNumber: entry.version,
        current: currentVersionId === entry.id,
        candidate: entry.candidate === true,
        contentPath: contentMembers[0]!.relative,
        contentDigest: digest,
        ...(typeof entry.frozenContentPath === 'string'
          ? { frozenContentPath: contentMembers[1]!.relative }
          : {}),
        ...(typeof entry.parentVersionId === 'string' ? { parentOriginalVersionId: entry.parentVersionId } : {}),
        ...(typeof entry.baseVersionId === 'string' ? { baseOriginalVersionId: entry.baseVersionId } : {}),
      });
    }
  }
  return { files, versions, warnings };
}

async function collectContextFiles(projectRoot: string): Promise<{
  files: CollectedFile[];
  contexts: MokinaRecoveryManifestContext[];
  warnings: string[];
}> {
  const contextRoot = path.join(projectRoot, MOKINA_RECOVERY_CONTEXT_ROOT);
  const files: CollectedFile[] = [];
  const contexts: MokinaRecoveryManifestContext[] = [];
  const warnings: string[] = [];

  const contextsDir = path.join(contextRoot, 'contexts');
  let names: string[] = [];
  try {
    names = (await readdir(contextsDir)).filter((name) => name.endsWith('.json'));
  } catch {
    names = [];
  }
  for (const name of names) {
    const absolute = path.join(contextsDir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(absolute, 'utf8'));
    } catch {
      warnings.push(`快照记录损坏，已跳过：${name}`);
      continue;
    }
    const record = parsed as { snapshotId?: unknown; fingerprint?: unknown; items?: unknown };
    if (typeof record.snapshotId !== 'string' || typeof record.fingerprint !== 'string') {
      warnings.push(`快照记录结构不符，已跳过：${name}`);
      continue;
    }
    files.push({
      path: `${MOKINA_RECOVERY_CONTEXT_ROOT}/contexts/${name}`,
      absolutePath: absolute,
      kind: 'context-snapshot',
    });
    // Frozen asset bytes referenced by the snapshot travel with the package.
    if (Array.isArray(record.items)) {
      for (const item of record.items) {
        const blobId = (item as { blobId?: unknown }).blobId;
        if (typeof blobId !== 'string' || !SHA256_RE.test(blobId)) continue;
        const blobAbsolute = path.join(contextRoot, 'blobs', blobId);
        files.push({
          path: `${MOKINA_RECOVERY_CONTEXT_ROOT}/blobs/${blobId}`,
          absolutePath: blobAbsolute,
          kind: 'asset',
        });
      }
    }
    contexts.push({
      originalSnapshotId: record.snapshotId,
      payloadPath: `${MOKINA_RECOVERY_CONTEXT_ROOT}/contexts/${name}`,
      fingerprint: record.fingerprint,
    });
  }
  return { files, contexts, warnings };
}

export type BuildRecoveryPackageResult = {
  buffer: Buffer;
  manifest: MokinaRecoveryManifest;
  baseName: string;
  warnings: string[];
};

export async function buildProjectRecoveryPackage(input: {
  projectsRoot: string;
  projectId: string;
  projectName: string;
  exportId: string;
  now?: Date;
}): Promise<BuildRecoveryPackageResult> {
  const projectRoot = path.join(input.projectsRoot, input.projectId);
  const originals = await collectProjectFiles(projectRoot);
  const versioned = await collectVersionFiles(projectRoot);
  const contexts = await collectContextFiles(projectRoot);
  const warnings = [...versioned.warnings, ...contexts.warnings];

  const all = [...originals, ...versioned.files, ...contexts.files];
  if (all.length > MOKINA_RECOVERY_LIMITS.maxArchiveEntries) {
    throw new Error('项目文件数量超过恢复包上限。');
  }

  const zip = new JSZip();
  const manifestFiles: MokinaRecoveryManifestFile[] = [];
  let totalBytes = 0;
  for (const member of all) {
    if (!isSafeRecoveryPath(member.path)) {
      warnings.push(`跳过不安全的路径：${member.path}`);
      continue;
    }
    let buffer: Buffer;
    try {
      buffer = await readFile(member.absolutePath);
    } catch {
      throw new Error(`恢复包捕获期间文件不可读：${member.path}`);
    }
    const info = await stat(member.absolutePath).catch(() => null);
    if (info != null && info.size !== buffer.length) {
      throw new Error(`恢复包捕获期间文件发生变化：${member.path}`);
    }
    if (buffer.length > MOKINA_RECOVERY_LIMITS.maxEntryBytes) {
      throw new Error(`单个文件超过恢复包上限：${member.path}`);
    }
    totalBytes += buffer.length;
    if (totalBytes > MOKINA_RECOVERY_LIMITS.maxUncompressedBytes) {
      throw new Error('恢复包解压总量超过上限。');
    }
    zip.file(member.path, buffer);
    manifestFiles.push({ path: member.path, kind: member.kind, byteLength: buffer.length, sha256: sha256(buffer) });
  }

  const manifest: MokinaRecoveryManifest = {
    schema: MOKINA_RECOVERY_MANIFEST_SCHEMA,
    exportId: input.exportId,
    createdAt: (input.now ?? new Date()).toISOString(),
    sourceProject: { id: input.projectId, name: input.projectName },
    files: manifestFiles,
    versions: versioned.versions,
    contexts: contexts.contexts,
  };
  zip.file(MOKINA_RECOVERY_MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, manifest, baseName: `${input.projectName || 'project'}-recovery`, warnings };
}

export type ImportRecoveryResult =
  | { ok: true; projectId: string; warnings: string[]; manifest: MokinaRecoveryManifest }
  | { ok: false; status: number; code: string; message: string };

function fail(status: number, code: string, message: string): ImportRecoveryResult {
  return { ok: false, status, code, message };
}

export function parseRecoveryManifest(value: unknown): MokinaRecoveryManifest | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schema !== MOKINA_RECOVERY_MANIFEST_SCHEMA) return null;
  if (typeof record.exportId !== 'string' || typeof record.createdAt !== 'string') return null;
  const source = record.sourceProject as { id?: unknown; name?: unknown } | undefined;
  if (source == null || typeof source.id !== 'string' || typeof source.name !== 'string') return null;
  if (!Array.isArray(record.files) || !Array.isArray(record.versions) || !Array.isArray(record.contexts)) return null;
  const files: MokinaRecoveryManifestFile[] = [];
  for (const raw of record.files) {
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
    const version = raw as Record<string, unknown>;
    if (
      typeof version.entry !== 'string' || !isSafeRecoveryPath(version.entry)
      || typeof version.originalVersionId !== 'string' || !VERSION_ID_RE.test(version.originalVersionId)
      || typeof version.versionNumber !== 'number' || !Number.isInteger(version.versionNumber)
      || typeof version.current !== 'boolean' || typeof version.candidate !== 'boolean'
      || typeof version.contentPath !== 'string' || !isSafeRecoveryPath(version.contentPath)
      || typeof version.contentDigest !== 'string' || !SHA256_RE.test(version.contentDigest)
    ) {
      return null;
    }
    if (version.frozenContentPath != null && (typeof version.frozenContentPath !== 'string' || !isSafeRecoveryPath(version.frozenContentPath))) {
      return null;
    }
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
  return {
    schema: MOKINA_RECOVERY_MANIFEST_SCHEMA,
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

export async function importProjectRecoveryPackage(input: {
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
}): Promise<ImportRecoveryResult> {
  if (!VERSION_ID_RE.test(input.operationId)) {
    return fail(400, 'BAD_REQUEST', 'operationId 不合法。');
  }
  const existing = input.readProject(input.targetProjectId);
  if (existing != null) {
    const owner = existing.metadata?.mokinaOperationId;
    if (owner === input.operationId) {
      return fail(409, 'MOKINA_RECOVERY_ALREADY_IMPORTED', '该恢复操作已创建过目标项目，请在项目列表中打开。');
    }
    return fail(409, 'MOKINA_OPERATION_CONFLICT', '目标项目 ID 已被其他项目占用。');
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
  const versionIds = new Set(manifest.versions.map((version) => version.originalVersionId));
  const currentCounts = new Map<string, number>();
  for (const version of manifest.versions) {
    if (!byPath.has(version.contentPath)) {
      return fail(400, 'BAD_REQUEST', `版本内容未包含在恢复包中：${version.entry}`);
    }
    if (version.frozenContentPath != null && !byPath.has(version.frozenContentPath)) {
      return fail(400, 'BAD_REQUEST', `冻结版本内容未包含在恢复包中：${version.entry}`);
    }
    if (version.current && version.candidate) {
      return fail(400, 'BAD_REQUEST', `候选版本不能同时是当前版本：${version.entry}`);
    }
    for (const relation of [version.parentOriginalVersionId, version.baseOriginalVersionId]) {
      if (relation != null && !versionIds.has(relation)) {
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
    let inner: { fingerprint?: unknown };
    try {
      inner = JSON.parse(payload.toString('utf8')) as { fingerprint?: unknown };
    } catch {
      return fail(400, 'BAD_REQUEST', `快照内容不可解析：${context.payloadPath}`);
    }
    if (inner.fingerprint !== context.fingerprint) {
      return fail(400, 'BAD_REQUEST', `快照指纹校验失败：${context.payloadPath}`);
    }
    for (const item of (JSON.parse(payload.toString('utf8')) as { items?: unknown[] }).items ?? []) {
      const blobId = (item as { blobId?: unknown }).blobId;
      if (typeof blobId === 'string' && !byPath.has(`${MOKINA_RECOVERY_CONTEXT_ROOT}/blobs/${blobId}`)) {
        return fail(400, 'BAD_REQUEST', `快照素材未包含在恢复包中：${blobId}`);
      }
    }
  }

  const projectRoot = path.join(input.projectsRoot, input.targetProjectId);
  const warnings: string[] = [];
  try {
    await mkdir(projectRoot, { recursive: true });
    for (const [relativePath, buffer] of buffers) {
      await writeFileAtomic(path.join(projectRoot, relativePath), buffer);
    }
    // Rebuild the version store faithfully: same layout, id mapping preserved,
    // candidates stay candidates and never become current here.
    for (const [entryName, versions] of groupByEntry(manifest.versions)) {
      const key = createHash('sha256').update(entryName).digest('hex').slice(0, 24);
      const versionRoot = path.join(projectRoot, MOKINA_RECOVERY_VERSION_ROOT, key);
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
      await writeFileAtomic(
        path.join(versionRoot, 'manifest.json'),
        Buffer.from(`${JSON.stringify({ entries, currentVersionId: current }, null, 2)}\n`, 'utf8'),
      );
    }
    const name = (input.projectName ?? manifest.sourceProject.name).trim() || manifest.sourceProject.name;
    input.registerProject({
      id: input.targetProjectId,
      name,
      metadata: { mokinaOperationId: input.operationId, recoveredFrom: manifest.sourceProject.id, recoveredAt: new Date().toISOString() },
    });
  } catch (error) {
    await rm(projectRoot, { force: true, recursive: true }).catch(() => undefined);
    return fail(500, 'MOKINA_RECOVERY_IMPORT_FAILED', error instanceof Error ? error.message : String(error));
  }
  if (manifest.contexts.length === 0 && manifest.versions.length === 0) {
    warnings.push('恢复包不含版本或快照，仅恢复原件。');
  }
  return { ok: true, projectId: input.targetProjectId, warnings, manifest };
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
