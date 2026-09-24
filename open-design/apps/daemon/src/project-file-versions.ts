import type {
  ArtifactOrigin,
  ArtifactOriginStatus,
  ProjectFileKind,
  ProjectFileVersion,
  ProjectFileVersionPromptSource,
  ProjectFileVersionSource,
} from '@open-design/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isSafeId, kindFor, mimeFor, readProjectFile, resolveProjectDir, resolveProjectFilePath, validateProjectPath } from './projects.js';
import { bundleStandaloneHtml } from './artifacts/standalone-html.js';

const VERSION_ROOT = '.file-versions';
const VERSION_MANIFEST = 'manifest.json';
const VERSION_ID_RE = /^[A-Za-z0-9_-]+$/u;
const CONTENT_DIGEST_RE = /^[a-f0-9]{64}$/u;
const ORIGIN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const EXTERNAL_PLUGIN_IDS = new Set(['open-design']);
const versionFileLocks = new Map<string, Promise<void>>();

type VersionPromptSource = ProjectFileVersionPromptSource;
type VersionSource = ProjectFileVersionSource;

interface VersionEntry {
  candidate?: boolean;
  baseVersionId?: string;
  operationId?: string;
  adoptionOperationId?: string;
  id: string;
  fileName: string;
  version: number;
  label: string;
  createdAt: number;
  source: VersionSource;
  prompt: string | null;
  promptSource?: VersionPromptSource;
  restoreFromVersionId?: string;
  size: number;
  mime: string;
  kind: ProjectFileKind;
  contentPath: string;
  frozenContentPath?: string;
  contentDigest?: string;
  parentVersionId?: string;
  origin?: ArtifactOrigin;
}

interface VersionManifestState {
  entries: VersionEntry[];
  currentVersionId: string | null;
  deletedAt?: number;
}

export interface CreateProjectFileVersionOptions {
  candidate?: boolean;
  baseVersionId?: string;
  operationId?: string;
  prompt?: string | null;
  promptSource?: VersionPromptSource;
  source?: VersionSource;
  label?: string | null;
  restoreFromVersionId?: string;
  parentVersionId?: string;
  origin?: ArtifactOrigin;
}

export interface ProjectFileVersionLockContext {
  safeName: string;
  createVersion: (content: string, options?: CreateProjectFileVersionOptions) => Promise<ProjectFileVersion>;
  ensureCurrentVersion: (content: string, options?: CreateProjectFileVersionOptions) => Promise<ProjectFileVersion | null>;
  matchVersionContent: (content: string, versionId?: string) => Promise<ProjectFileVersionContentMatch>;
}

export interface ProjectFileVersionContentMatch {
  status: Extract<ArtifactOriginStatus, 'matched' | 'missing_version' | 'digest_mismatch' | 'unknown'>;
  version: ProjectFileVersion | null;
}

function codedError(message: string, code: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function errorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code?: unknown }).code)
    : undefined;
}

function isExistingTargetError(err: unknown): boolean {
  const code = errorCode(err);
  return code === 'EEXIST' || code === 'ENOTEMPTY';
}

function fileVersionKey(fileName: string): string {
  return createHash('sha256').update(fileName).digest('hex').slice(0, 24);
}

function versionRootFor(projectsRoot: string, projectId: string, fileName: string): string {
  if (!isSafeId(projectId)) throw new Error('invalid project id');
  return path.join(projectsRoot, projectId, VERSION_ROOT, fileVersionKey(fileName));
}

function versionLockKey(projectsRoot: string, projectId: string, fileName: string): string {
  return `${path.resolve(projectsRoot)}\0${projectId}\0${fileName}`;
}

async function withVersionLockKey<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = versionFileLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current, () => current);
  versionFileLocks.set(key, chained);

  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (versionFileLocks.get(key) === chained) {
      versionFileLocks.delete(key);
    }
  }
}

async function withVersionFileLock<T>(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withVersionLockKey(versionLockKey(projectsRoot, projectId, fileName), async () => {
    await recoverCandidateAdoptionUnlocked(projectsRoot, projectId, fileName);
    return fn();
  });
}

async function withVersionFileLocks<T>(
  projectsRoot: string,
  projectId: string,
  fileNames: string[],
  fn: () => Promise<T>,
): Promise<T> {
  const keys = [...new Set(fileNames.map((fileName) => versionLockKey(projectsRoot, projectId, fileName)))]
    .sort();

  const acquire = (index: number): Promise<T> => {
    if (index >= keys.length) return fn();
    const key = keys[index];
    if (!key) return fn();
    return withVersionLockKey(key, () => acquire(index + 1));
  };

  return acquire(0);
}

export async function withProjectFileVersionLock<T>(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  metadata: unknown,
  fn: (context: ProjectFileVersionLockContext) => Promise<T>,
): Promise<T> {
  const safeName = validateUserFileName(fileName);
  assertProjectAvailable(projectsRoot, projectId, metadata);
  return withVersionFileLock(projectsRoot, projectId, safeName, () =>
    fn({
      safeName,
      createVersion: (content, options = {}) =>
        createProjectFileVersionUnlocked(projectsRoot, projectId, safeName, content, options, metadata),
      ensureCurrentVersion: (content, options = {}) =>
        ensureCurrentProjectFileVersionUnlocked(projectsRoot, projectId, safeName, content, options, metadata),
      matchVersionContent: (content, versionId) =>
        resolveProjectFileVersionContentMatchUnlocked(
          projectsRoot,
          projectId,
          safeName,
          content,
          versionId,
        ),
    }),
  );
}

function normalizePrompt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeContentPath(value: unknown, id: string): string {
  if (typeof value === 'string' && /^[A-Za-z0-9._-]+\.html$/u.test(value) && !value.includes('..')) {
    return value;
  }
  return `${id}.html`;
}

function normalizeVersionNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeVersionId(value: unknown): string | undefined {
  return typeof value === 'string' && VERSION_ID_RE.test(value) ? value : undefined;
}

function normalizeContentDigest(value: unknown): string | undefined {
  return typeof value === 'string' && CONTENT_DIGEST_RE.test(value) ? value : undefined;
}

function normalizeOriginId(value: unknown): string | undefined {
  return typeof value === 'string' && ORIGIN_ID_RE.test(value) ? value : undefined;
}

function normalizeArtifactOrigin(value: unknown): ArtifactOrigin | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const entrySurface = raw.entrySurface;
  if (
    entrySurface !== 'open_design_ui'
    && entrySurface !== 'od_cli'
    && entrySurface !== 'external_mcp'
    && entrySurface !== 'unknown'
  ) {
    return undefined;
  }
  if (entrySurface === 'unknown') return { entrySurface };

  const externalPluginId = raw.externalPluginId;
  if (
    externalPluginId !== undefined
    && (typeof externalPluginId !== 'string' || !EXTERNAL_PLUGIN_IDS.has(externalPluginId))
  ) {
    return undefined;
  }
  const pluginWorkflowId = raw.pluginWorkflowId === undefined
    ? undefined
    : normalizeOriginId(raw.pluginWorkflowId);
  const runId = raw.runId === undefined ? undefined : normalizeOriginId(raw.runId);
  if (raw.pluginWorkflowId !== undefined && !pluginWorkflowId) return undefined;
  if (raw.runId !== undefined && !runId) return undefined;

  const origin: ArtifactOrigin = { entrySurface };
  if (typeof externalPluginId === 'string') origin.externalPluginId = externalPluginId;
  if (pluginWorkflowId) origin.pluginWorkflowId = pluginWorkflowId;
  if (runId) origin.runId = runId;
  return origin;
}

function artifactOriginsEqual(
  left: ArtifactOrigin | undefined,
  right: ArtifactOrigin | undefined,
): boolean {
  return (
    left?.entrySurface === right?.entrySurface
    && left?.externalPluginId === right?.externalPluginId
    && left?.pluginWorkflowId === right?.pluginWorkflowId
    && left?.runId === right?.runId
  );
}

export function projectFileVersionContentDigest(content: string): string {
  return createHash('sha256').update(Buffer.from(String(content ?? ''), 'utf8')).digest('hex');
}

function normalizePromptSource(value: unknown): VersionPromptSource | undefined {
  return value === 'message' || value === 'project' || value === 'manual' || value === 'restore'
    ? value
    : undefined;
}

function normalizeVersionSource(value: unknown): VersionSource | undefined {
  return value === 'ai' || value === 'manual' || value === 'restore' ? value : undefined;
}

function inferVersionSource(
  value: unknown,
  promptSource?: VersionPromptSource,
  restoreFromVersionId?: string,
): VersionSource {
  const normalized = normalizeVersionSource(value);
  if (normalized) return normalized;
  if (restoreFromVersionId || promptSource === 'restore') return 'restore';
  if (promptSource === 'manual') return 'manual';
  return 'ai';
}

function normalizeManifestEntry(raw: Record<string, unknown>, fileName: string, index: number): VersionEntry | null {
  const id = raw.id;
  if (typeof id !== 'string' || !VERSION_ID_RE.test(id)) return null;
  const version = normalizeVersionNumber(raw.version, index + 1);
  const promptSource = normalizePromptSource(raw.promptSource);
  const restoreFromVersionId = normalizeVersionId(raw.restoreFromVersionId);
  const contentDigest = normalizeContentDigest(raw.contentDigest);
  const parentVersionId = normalizeVersionId(raw.parentVersionId);
  const origin = normalizeArtifactOrigin(raw.origin);
  const entry: VersionEntry = {
    id,
    fileName,
    version,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label : `Version ${version}`,
    createdAt: normalizeVersionNumber(raw.createdAt, Date.now()),
    source: inferVersionSource(raw.source, promptSource, restoreFromVersionId),
    prompt: normalizePrompt(raw.prompt),
    size: normalizeVersionNumber(raw.size, 0),
    mime: typeof raw.mime === 'string' ? raw.mime : mimeFor(fileName),
    kind: (typeof raw.kind === 'string' ? raw.kind : kindFor(fileName)) as ProjectFileKind,
    contentPath: normalizeContentPath(raw.contentPath, id),
  };
  if (typeof raw.frozenContentPath === 'string' && /^[A-Za-z0-9._-]+\.html$/u.test(raw.frozenContentPath) && !raw.frozenContentPath.includes('..')) {
    entry.frozenContentPath = raw.frozenContentPath;
  }
  if (promptSource) entry.promptSource = promptSource;
  if (restoreFromVersionId) {
    entry.restoreFromVersionId = restoreFromVersionId;
  }
  if (contentDigest) entry.contentDigest = contentDigest;
  if (parentVersionId) entry.parentVersionId = parentVersionId;
  if (origin) entry.origin = origin;
  if (raw.candidate === true) entry.candidate = true;
  if (normalizeVersionId(raw.baseVersionId)) entry.baseVersionId = String(raw.baseVersionId);
  if (normalizeVersionId(raw.operationId)) entry.operationId = String(raw.operationId);
  if (normalizeVersionId(raw.adoptionOperationId)) entry.adoptionOperationId = String(raw.adoptionOperationId);
  return entry;
}

function normalizeManifest(raw: unknown, fileName: string): VersionEntry[] {
  if (!raw || typeof raw !== 'object') return [];
  const entries = Array.isArray((raw as { entries?: unknown }).entries)
    ? (raw as { entries: unknown[] }).entries
    : [];
  return entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const normalized = normalizeManifestEntry(entry as Record<string, unknown>, fileName, index);
    return normalized ? [normalized] : [];
  });
}

function normalizeManifestState(raw: unknown, fileName: string): VersionManifestState {
  const entries = normalizeManifest(raw, fileName);
  const schemaVersion = raw && typeof raw === 'object'
    ? Number((raw as { schemaVersion?: unknown }).schemaVersion)
    : NaN;
  const persistedCurrentVersionId = raw && typeof raw === 'object'
    ? normalizeVersionId((raw as { currentVersionId?: unknown }).currentVersionId)
    : undefined;
  const currentVersionId = schemaVersion >= 2
    ? (persistedCurrentVersionId && entries.some((entry) => entry.id === persistedCurrentVersionId)
      ? persistedCurrentVersionId
      : null)
    : (entries.at(-1)?.id ?? null);
  const state: VersionManifestState = { entries, currentVersionId };
  const deletedAt = raw && typeof raw === 'object'
    ? Number((raw as { deletedAt?: unknown }).deletedAt)
    : NaN;
  if (Number.isFinite(deletedAt) && deletedAt > 0) {
    state.deletedAt = deletedAt;
  }
  return state;
}

function assertProjectAvailable(projectsRoot: string, projectId: string, metadata?: unknown): void {
  resolveProjectDir(projectsRoot, projectId, metadata);
}

async function readVersionManifestState(
  projectsRoot: string,
  projectId: string,
  fileName: string,
): Promise<VersionManifestState> {
  try {
    const raw = await readFile(path.join(versionRootFor(projectsRoot, projectId, fileName), VERSION_MANIFEST), 'utf8');
    return normalizeManifestState(JSON.parse(raw) as unknown, fileName);
  } catch (err) {
    if (errorCode(err) === 'ENOENT') return { entries: [], currentVersionId: null };
    throw err;
  }
}

async function writeVersionManifest(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  entries: VersionEntry[],
  options: { currentVersionId: string | null; deletedAt?: number },
): Promise<void> {
  const root = versionRootFor(projectsRoot, projectId, fileName);
  await mkdir(root, { recursive: true });
  const manifest: {
    schemaVersion: number;
    fileName: string;
    currentVersionId: string | null;
    entries: VersionEntry[];
    deletedAt?: number;
  } = {
    schemaVersion: 2,
    fileName,
    currentVersionId: options.currentVersionId,
    entries,
  };
  if (typeof options.deletedAt === 'number' && Number.isFinite(options.deletedAt)) {
    manifest.deletedAt = options.deletedAt;
  }
  await writeAtomic(path.join(root, VERSION_MANIFEST), JSON.stringify(manifest, null, 2));
}

async function writeAtomic(target: string, content: string): Promise<void> {
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

function publicVersion(entry: VersionEntry, currentId: string | null): ProjectFileVersion {
  const version: ProjectFileVersion = {
    id: entry.id,
    fileName: entry.fileName,
    version: entry.version,
    label: entry.label,
    createdAt: entry.createdAt,
    source: entry.source,
    prompt: entry.prompt,
    size: entry.size,
    mime: entry.mime,
    kind: entry.kind,
    current: currentId === entry.id,
  };
  if (entry.promptSource) version.promptSource = entry.promptSource;
  if (entry.restoreFromVersionId) version.restoreFromVersionId = entry.restoreFromVersionId;
  if (entry.contentDigest) version.contentDigest = entry.contentDigest;
  if (entry.parentVersionId) version.parentVersionId = entry.parentVersionId;
  if (entry.origin) version.origin = entry.origin;
  if (entry.candidate) version.candidate = true;
  if (entry.baseVersionId) version.baseVersionId = entry.baseVersionId;
  if (entry.operationId) version.operationId = entry.operationId;
  if (entry.adoptionOperationId) version.adoptionOperationId = entry.adoptionOperationId;
  return version;
}

function nextLabel(version: number, restoredFrom?: VersionEntry | null): string {
  if (!restoredFrom) return `Version ${version}`;
  return Number.isFinite(restoredFrom.version)
    ? `Version ${version} · restored from v${restoredFrom.version}`
    : `Version ${version}`;
}

function validateUserFileName(fileName: string): string {
  const safeName = validateProjectPath(fileName);
  if (isProjectFileVersionPath(safeName)) {
    throw codedError('file not found', 'ENOENT');
  }
  return safeName;
}

export function isProjectFileVersionPath(raw: unknown): boolean {
  const value = String(raw ?? '').replace(/\\/g, '/');
  return value.split('/').filter(Boolean).includes(VERSION_ROOT);
}

export async function listProjectFileVersions(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  metadata?: unknown,
): Promise<ProjectFileVersion[]> {
  const safeName = validateUserFileName(fileName);
  assertProjectAvailable(projectsRoot, projectId, metadata);
  await recoverCandidateAdoption(projectsRoot, projectId, safeName);
  const state = await readVersionManifestState(projectsRoot, projectId, safeName);
  return state.entries.map((entry) => publicVersion(entry, state.currentVersionId));
}

export async function readProjectFileVersion(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  versionId: string,
  metadata?: unknown,
): Promise<{ version: ProjectFileVersion; content: string; frozenContent?: string }> {
  const safeName = validateUserFileName(fileName);
  const safeVersionId = String(versionId || '').trim();
  if (!safeVersionId || !VERSION_ID_RE.test(safeVersionId)) {
    throw codedError('version id required', 'EINVAL');
  }
  assertProjectAvailable(projectsRoot, projectId, metadata);
  await recoverCandidateAdoption(projectsRoot, projectId, safeName);
  const state = await readVersionManifestState(projectsRoot, projectId, safeName);
  const entry = state.entries.find((item) => item.id === safeVersionId);
  if (!entry) {
    throw codedError('version not found', 'ENOENT');
  }
  const content = await readFile(path.join(versionRootFor(projectsRoot, projectId, safeName), entry.contentPath), 'utf8');
  const frozenContent = entry.frozenContentPath
    ? await readFile(path.join(versionRootFor(projectsRoot, projectId, safeName), entry.frozenContentPath), 'utf8')
    : undefined;
  return {
    version: publicVersion(entry, state.currentVersionId),
    content,
    ...(frozenContent ? { frozenContent } : {}),
  };
}

export async function createProjectFileVersion(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  content: string,
  options: CreateProjectFileVersionOptions = {},
  metadata?: unknown,
): Promise<ProjectFileVersion> {
  const safeName = validateUserFileName(fileName);
  assertProjectAvailable(projectsRoot, projectId, metadata);
  return withVersionFileLock(projectsRoot, projectId, safeName, () =>
    createProjectFileVersionUnlocked(projectsRoot, projectId, safeName, content, options, metadata),
  );
}

async function createProjectFileVersionUnlocked(
  projectsRoot: string,
  projectId: string,
  safeName: string,
  content: string,
  options: CreateProjectFileVersionOptions,
  metadata?: unknown,
): Promise<ProjectFileVersion> {
  const root = versionRootFor(projectsRoot, projectId, safeName);
  await mkdir(root, { recursive: true });
  const state = await readVersionManifestState(projectsRoot, projectId, safeName);
  if (options.operationId) {
    if (!VERSION_ID_RE.test(options.operationId)) throw codedError('invalid operation id', 'EINVAL');
    const saved = state.entries.find((entry) => entry.operationId === options.operationId);
    if (saved) {
      if (saved.contentDigest !== projectFileVersionContentDigest(content)
        || saved.baseVersionId !== options.baseVersionId) {
        throw codedError('operation already saved with different content or base', 'VERSION_OPERATION_CONFLICT');
      }
      return publicVersion(saved, state.currentVersionId);
    }
  }
  if (options.candidate && (!options.baseVersionId
    || !state.entries.some((entry) => entry.id === options.baseVersionId))) {
    throw codedError('candidate requires a fixed base version', 'VERSION_BASE_MISSING');
  }
  const preserveDeletedHistory =
    typeof options.restoreFromVersionId === 'string' &&
    state.entries.some((entry) => entry.id === options.restoreFromVersionId);
  let entries = state.entries;
  let priorCurrentVersionId = state.currentVersionId;
  if (state.deletedAt && !preserveDeletedHistory) {
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
    entries = [];
    priorCurrentVersionId = null;
  }
  const restoredFrom = typeof options.restoreFromVersionId === 'string'
    ? entries.find((entry) => entry.id === options.restoreFromVersionId) ?? null
    : null;
  const requestedParentVersionId = normalizeVersionId(options.parentVersionId);
  const explicitCurrentParent = requestedParentVersionId && requestedParentVersionId === priorCurrentVersionId
    ? entries.find((entry) => entry.id === requestedParentVersionId) ?? null
    : null;
  const now = Date.now();
  const version = entries.reduce((max, entry) => Math.max(max, Number(entry.version) || 0), 0) + 1;
  const id = randomUUID();
  const contentPath = `${String(version).padStart(4, '0')}-${id}.html`;
  const text = String(content ?? '');
  const source = inferVersionSource(options.source, options.promptSource, options.restoreFromVersionId);
  const entry: VersionEntry = {
    id,
    fileName: safeName,
    version,
    label: typeof options.label === 'string' && options.label.trim()
      ? options.label.trim()
      : nextLabel(version, restoredFrom),
    createdAt: now,
    source,
    prompt: normalizePrompt(options.prompt),
    size: Buffer.byteLength(text),
    mime: mimeFor(safeName),
    kind: kindFor(safeName) as ProjectFileKind,
    contentPath,
    contentDigest: projectFileVersionContentDigest(text),
  };
  if (options.promptSource) entry.promptSource = options.promptSource;
  if (typeof options.restoreFromVersionId === 'string' && VERSION_ID_RE.test(options.restoreFromVersionId)) {
    entry.restoreFromVersionId = options.restoreFromVersionId;
  }
  if (source === 'restore' && restoredFrom?.contentDigest) {
    entry.parentVersionId = restoredFrom.id;
    if (restoredFrom.origin) entry.origin = restoredFrom.origin;
  } else if (source === 'manual' && explicitCurrentParent?.contentDigest) {
    entry.parentVersionId = explicitCurrentParent.id;
    if (explicitCurrentParent.origin) entry.origin = explicitCurrentParent.origin;
  } else if (source === 'ai') {
    const origin = normalizeArtifactOrigin(options.origin);
    if (origin) entry.origin = origin;
  }
  if (options.candidate) entry.candidate = true;
  if (options.baseVersionId) entry.baseVersionId = options.baseVersionId;
  if (options.operationId) entry.operationId = options.operationId;
  await writeFile(path.join(root, contentPath), text);
  // Freeze local HTML resources while the version is captured. A failed or
  // incomplete bundle leaves the source version intact; historical export
  // will reject it instead of silently reading today's project resources.
  if (entry.mime.startsWith('text/html')) {
    try {
      const bundled = await bundleStandaloneHtml({
        entryPath: safeName,
        html: text,
        readAsset: async (projectPath) => {
          let file;
          try {
            file = await resolveProjectFilePath(projectsRoot, projectId, projectPath, metadata);
          } catch (error) {
            if (errorCode(error) === 'ENOENT') return null;
            throw error;
          }
          return {
            mime: file.mime,
            size: file.size,
            read: async () => (await readProjectFile(projectsRoot, projectId, projectPath, metadata)).buffer,
          };
        },
      });
      if (bundled.externalDependencies.length === 0) {
        entry.frozenContentPath = `${String(version).padStart(4, '0')}-${id}-frozen.html`;
        await writeFile(path.join(root, entry.frozenContentPath), bundled.html);
      }
    } catch {
      // Keep the source version; export validates unresolved resources.
    }
  }
  const nextEntries = [...entries, entry];
  await writeVersionManifest(projectsRoot, projectId, safeName, nextEntries, {
    currentVersionId: options.candidate ? priorCurrentVersionId : id,
  });
  return publicVersion(entry, options.candidate ? priorCurrentVersionId : id);
}

export async function markProjectFileVersionStoreDeleted(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  metadata?: unknown,
): Promise<void> {
  const safeName = validateUserFileName(fileName);
  if (!/\.html?$/i.test(safeName)) return;
  assertProjectAvailable(projectsRoot, projectId, metadata);
  await withVersionFileLock(projectsRoot, projectId, safeName, async () => {
    const state = await readVersionManifestState(projectsRoot, projectId, safeName);
    if (state.entries.length === 0) return;
    await writeVersionManifest(projectsRoot, projectId, safeName, state.entries, {
      currentVersionId: state.currentVersionId,
      deletedAt: Date.now(),
    });
  });
}

export async function renameProjectFileVersionStore(
  projectsRoot: string,
  projectId: string,
  fromName: string,
  toName: string,
  metadata?: unknown,
): Promise<void> {
  const safeFrom = validateUserFileName(fromName);
  const safeTo = validateUserFileName(toName);
  if (safeFrom === safeTo) return;
  if (!/\.html?$/i.test(safeFrom) || !/\.html?$/i.test(safeTo)) return;

  assertProjectAvailable(projectsRoot, projectId, metadata);
  await withVersionFileLocks(projectsRoot, projectId, [safeFrom, safeTo], async () => {
    const oldRoot = versionRootFor(projectsRoot, projectId, safeFrom);
    const newRoot = versionRootFor(projectsRoot, projectId, safeTo);
    try {
      await stat(oldRoot);
    } catch (err) {
      if (errorCode(err) === 'ENOENT') return;
      throw err;
    }

    const fromState = await readVersionManifestState(projectsRoot, projectId, safeFrom);
    if (fromState.deletedAt) {
      await rm(oldRoot, { recursive: true, force: true });
      const toState = await readVersionManifestState(projectsRoot, projectId, safeTo);
      if (toState.deletedAt) {
        await rm(newRoot, { recursive: true, force: true });
      }
      return;
    }

    const renamedEntries = fromState.entries.map((entry) => ({ ...entry, fileName: safeTo }));

    try {
      await rename(oldRoot, newRoot);
      await writeVersionManifest(projectsRoot, projectId, safeTo, renamedEntries, {
        currentVersionId: fromState.currentVersionId,
      });
      return;
    } catch (err) {
      if (!isExistingTargetError(err)) throw err;
    }

    const existingState = await readVersionManifestState(projectsRoot, projectId, safeTo);
    if (existingState.deletedAt) {
      await rm(newRoot, { recursive: true, force: true });
      await rename(oldRoot, newRoot);
      await writeVersionManifest(projectsRoot, projectId, safeTo, renamedEntries, {
        currentVersionId: fromState.currentVersionId,
      });
      return;
    }

    await mkdir(newRoot, { recursive: true });
    const existingEntries = existingState.entries;
    const existingIds = new Set(existingEntries.map((entry) => entry.id));
    for (const entry of renamedEntries) {
      if (existingIds.has(entry.id)) continue;
      try {
        await rename(path.join(oldRoot, entry.contentPath), path.join(newRoot, entry.contentPath));
      } catch (err) {
        if (errorCode(err) !== 'ENOENT' && errorCode(err) !== 'EEXIST') throw err;
      }
      if (entry.frozenContentPath) {
        try {
          await rename(path.join(oldRoot, entry.frozenContentPath), path.join(newRoot, entry.frozenContentPath));
        } catch (err) {
          if (errorCode(err) !== 'ENOENT' && errorCode(err) !== 'EEXIST') throw err;
        }
      }
    }
    await writeVersionManifest(
      projectsRoot,
      projectId,
      safeTo,
      [
        ...existingEntries,
        ...renamedEntries.filter((entry) => !existingIds.has(entry.id)),
      ],
      {
        currentVersionId: fromState.currentVersionId ?? existingState.currentVersionId,
      },
    );
    await rm(oldRoot, { recursive: true, force: true });
  });
}

export async function ensureCurrentProjectFileVersion(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  content: string,
  options: CreateProjectFileVersionOptions = {},
  metadata?: unknown,
): Promise<ProjectFileVersion | null> {
  const safeName = validateUserFileName(fileName);
  if (!/\.html?$/i.test(safeName)) return null;
  assertProjectAvailable(projectsRoot, projectId, metadata);
  return withVersionFileLock(projectsRoot, projectId, safeName, () =>
    ensureCurrentProjectFileVersionUnlocked(projectsRoot, projectId, safeName, content, options, metadata),
  );
}

async function ensureCurrentProjectFileVersionUnlocked(
  projectsRoot: string,
  projectId: string,
  safeName: string,
  content: string,
  options: CreateProjectFileVersionOptions,
  metadata?: unknown,
): Promise<ProjectFileVersion | null> {
  if (!/\.html?$/i.test(safeName)) return null;
  const text = String(content ?? '');
  const state = await readVersionManifestState(projectsRoot, projectId, safeName);
  if (!state.deletedAt) {
    const current = state.currentVersionId
      ? state.entries.find((entry) => entry.id === state.currentVersionId)
      : null;
    if (current?.contentPath) {
      try {
        const prior = await readFile(path.join(versionRootFor(projectsRoot, projectId, safeName), current.contentPath), 'utf8');
        if (prior === text) {
          const source = inferVersionSource(
            options.source,
            options.promptSource,
            options.restoreFromVersionId,
          );
          if (
            source !== 'ai'
            || artifactOriginsEqual(
              current.origin,
              normalizeArtifactOrigin(options.origin),
            )
          ) {
            return publicVersion(current, state.currentVersionId);
          }
        }
      } catch (err) {
        if (errorCode(err) !== 'ENOENT') throw err;
      }
    }
  }
  return createProjectFileVersionUnlocked(projectsRoot, projectId, safeName, text, options, metadata);
}

export async function resolveProjectFileVersionContentMatch(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  content: string,
  versionId?: string,
  metadata?: unknown,
): Promise<ProjectFileVersionContentMatch> {
  const safeName = validateUserFileName(fileName);
  if (!/\.html?$/i.test(safeName)) {
    return { status: 'missing_version', version: null };
  }
  assertProjectAvailable(projectsRoot, projectId, metadata);
  return withVersionFileLock(projectsRoot, projectId, safeName, () =>
    resolveProjectFileVersionContentMatchUnlocked(
      projectsRoot,
      projectId,
      safeName,
      content,
      versionId,
    ),
  );
}

async function resolveProjectFileVersionContentMatchUnlocked(
  projectsRoot: string,
  projectId: string,
  safeName: string,
  content: string,
  versionId?: string,
): Promise<ProjectFileVersionContentMatch> {
  const state = await readVersionManifestState(projectsRoot, projectId, safeName);
  const requestedVersionId = versionId === undefined
    ? state.currentVersionId
    : normalizeVersionId(versionId);
  if (!requestedVersionId) return { status: 'missing_version', version: null };
  const entry = state.entries.find((candidate) => candidate.id === requestedVersionId);
  if (!entry) return { status: 'missing_version', version: null };
  const version = publicVersion(entry, state.currentVersionId);
  if (!entry.contentDigest) return { status: 'unknown', version };
  return {
    status: projectFileVersionContentDigest(content) === entry.contentDigest
      ? 'matched'
      : 'digest_mismatch',
    version,
  };
}

export async function getProjectFileVersionRootStats(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  metadata?: unknown,
): Promise<{ root: string; entries: string[]; mtime: number }> {
  const safeName = validateUserFileName(fileName);
  assertProjectAvailable(projectsRoot, projectId, metadata);
  const root = versionRootFor(projectsRoot, projectId, safeName);
  const entries = await readdir(root).catch(() => []);
  const st = await stat(root).catch(() => null);
  return { root, entries, mtime: st?.mtimeMs ?? 0 };
}

interface CandidateAdoptionJournal {
  operationId: string;
  versionId: string;
  expectedCurrentVersionId: string;
  targetFile: string;
}

function candidateAdoptionJournalPath(projectsRoot: string, projectId: string, fileName: string): string {
  return path.join(versionRootFor(projectsRoot, projectId, fileName), 'candidate-adoption.json');
}

async function recoverCandidateAdoptionUnlocked(
  projectsRoot: string,
  projectId: string,
  fileName: string,
): Promise<void> {
  const journalPath = candidateAdoptionJournalPath(projectsRoot, projectId, fileName);
  let journal: CandidateAdoptionJournal;
  try {
    journal = JSON.parse(await readFile(journalPath, 'utf8')) as CandidateAdoptionJournal;
  } catch (error) {
    // A blocked version root cannot contain a journal. Let the guarded file
    // write proceed so version capture can report its own typed warning.
    if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') return;
    throw error;
  }
  const state = await readVersionManifestState(projectsRoot, projectId, fileName);
  const chosen = state.entries.find((entry) => entry.id === journal.versionId);
  const prior = state.entries.find((entry) => entry.id === journal.expectedCurrentVersionId);
  // A process may stop after the manifest commits but before removing the journal.
  // That state is already complete; clearing the journal must be repeatable.
  if (chosen?.adoptionOperationId === journal.operationId && state.currentVersionId === chosen.id) {
    await rm(journalPath, { force: true });
    return;
  }
  if (!chosen?.contentDigest || !prior?.contentDigest || !chosen.candidate
    || chosen.baseVersionId !== prior.id || !VERSION_ID_RE.test(journal.operationId)
    || !path.isAbsolute(journal.targetFile)) {
    throw codedError('candidate adoption journal is invalid', 'VERSION_JOURNAL_INVALID');
  }
  if (state.currentVersionId !== prior.id && state.currentVersionId !== chosen.id) {
    throw codedError('candidate adoption conflicts with current version', 'VERSION_STALE');
  }
  const desired = await readFile(path.join(versionRootFor(projectsRoot, projectId, fileName), chosen.contentPath), 'utf8');
  if (projectFileVersionContentDigest(desired) !== chosen.contentDigest) {
    throw codedError('candidate snapshot changed', 'VERSION_DIGEST_MISMATCH');
  }
  const working = await readFile(journal.targetFile, 'utf8');
  const workingDigest = projectFileVersionContentDigest(working);
  if (workingDigest !== chosen.contentDigest && workingDigest !== prior.contentDigest) {
    throw codedError('working file changed during adoption', 'VERSION_EXTERNAL_CHANGE');
  }
  if (workingDigest !== chosen.contentDigest) await writeAtomic(journal.targetFile, desired);
  chosen.candidate = false;
  chosen.adoptionOperationId = journal.operationId;
  await writeVersionManifest(projectsRoot, projectId, fileName, state.entries, { currentVersionId: chosen.id });
  await rm(journalPath, { force: true });
}

export async function recoverCandidateAdoption(
  projectsRoot: string,
  projectId: string,
  fileName: string,
): Promise<void> {
  const safeName = validateUserFileName(fileName);
  await withVersionLockKey(versionLockKey(projectsRoot, projectId, safeName), () =>
    recoverCandidateAdoptionUnlocked(projectsRoot, projectId, safeName));
}

/** Adopt a fixed candidate using the same file lock and version store as normal edits. */
export async function adoptCandidateVersion(
  projectsRoot: string,
  projectId: string,
  fileName: string,
  versionId: string,
  expectedCurrentVersionId: string,
  operationId: string,
  targetFile: string,
  metadata?: unknown,
): Promise<ProjectFileVersion> {
  const safeName = validateUserFileName(fileName);
  assertProjectAvailable(projectsRoot, projectId, metadata);
  if (![versionId, expectedCurrentVersionId, operationId].every((value) => VERSION_ID_RE.test(value))) {
    throw codedError('valid version and operation ids are required', 'EINVAL');
  }
  return withVersionFileLock(projectsRoot, projectId, safeName, async () => {
    const state = await readVersionManifestState(projectsRoot, projectId, safeName);
    const chosen = state.entries.find((entry) => entry.id === versionId);
    if (!chosen) throw codedError('candidate not found', 'ENOENT');
    if (chosen.adoptionOperationId === operationId) return publicVersion(chosen, state.currentVersionId);
    if (!chosen.candidate) throw codedError('version is not an unadopted candidate', 'VERSION_NOT_CANDIDATE');
    if (state.currentVersionId !== expectedCurrentVersionId || chosen.baseVersionId !== expectedCurrentVersionId) {
      throw codedError('current version changed; compare again', 'VERSION_STALE');
    }
    const prior = state.entries.find((entry) => entry.id === expectedCurrentVersionId);
    if (!prior?.contentDigest) throw codedError('current version has no verifiable snapshot', 'VERSION_BASE_MISSING');
    const working = await readFile(targetFile, 'utf8');
    if (projectFileVersionContentDigest(working) !== prior.contentDigest) {
      throw codedError('working file differs from current version', 'VERSION_EXTERNAL_CHANGE');
    }
    const journal: CandidateAdoptionJournal = { operationId, versionId, expectedCurrentVersionId, targetFile };
    await writeAtomic(candidateAdoptionJournalPath(projectsRoot, projectId, safeName), JSON.stringify(journal));
    await recoverCandidateAdoptionUnlocked(projectsRoot, projectId, safeName);
    chosen.candidate = false;
    chosen.adoptionOperationId = operationId;
    return publicVersion(chosen, chosen.id);
  });
}
