/**
 * Mokina project recovery package contracts (V0.0.2 Local Preview, T14).
 *
 * A recovery package is project DATA, not machine backup and not a SQLite
 * clone: originals, versions (with their frozen content), context snapshots
 * and assets, plus a manifest. It never carries credentials, app config,
 * caches, absolute paths, or replayable send intents.
 */

export const MOKINA_RECOVERY_MANIFEST_SCHEMA = 'mokina.project-recovery.v2' as const;
export const MOKINA_RECOVERY_LEGACY_SCHEMA = 'mokina.project-recovery.v1' as const;
export const MOKINA_RECOVERY_MANIFEST_FILE = 'mokina-recovery.json';

export type MokinaRecoveryFileKind =
  | 'original'
  | 'version'
  | 'frozen-version'
  | 'context-snapshot'
  | 'asset'
  | 'continuation'
  | 'read-only-transcript';

export interface MokinaRecoveryManifestFile {
  /** Forward-slash path relative to the archive root; never absolute. */
  path: string;
  kind: MokinaRecoveryFileKind;
  byteLength: number;
  sha256: string;
}

export interface MokinaRecoveryManifestVersion {
  /** Project-relative file name the version belongs to. */
  entry: string;
  originalVersionId: string;
  versionNumber: number;
  current: boolean;
  candidate: boolean;
  contentPath: string;
  contentDigest: string;
  frozenContentPath?: string;
  parentOriginalVersionId?: string;
  baseOriginalVersionId?: string;
}

export interface MokinaRecoveryManifestContext {
  originalSnapshotId: string;
  payloadPath: string;
  fingerprint: string;
}

export interface MokinaRecoveryIssue {
  /** Project-relative affected file/directory or the managed collection name. */
  path: string;
  reason: 'missing' | 'unreadable' | 'invalid' | 'changed' | 'dependency' | 'unsupported' | 'limit';
  message: string;
}

export interface MokinaRecoveryIntegrity {
  status: 'complete' | 'partial' | 'unknown';
  issues: MokinaRecoveryIssue[];
}

interface MokinaRecoveryManifestBase {
  exportId: string;
  createdAt: string;
  sourceProject: { id: string; name: string };
  files: MokinaRecoveryManifestFile[];
  versions: MokinaRecoveryManifestVersion[];
  contexts: MokinaRecoveryManifestContext[];
}

export type MokinaRecoveryManifest = MokinaRecoveryManifestBase & (
  | { schema: typeof MOKINA_RECOVERY_LEGACY_SCHEMA; integrity?: never }
  | { schema: typeof MOKINA_RECOVERY_MANIFEST_SCHEMA; integrity: MokinaRecoveryIntegrity & { status: 'complete' | 'partial' } }
);

/** Web/CLI read this report from the actual archive; v1 cannot prove completeness. */
export function readMokinaRecoveryIntegrity(value: unknown): MokinaRecoveryIntegrity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const manifest = value as Record<string, unknown>;
  if (!Array.isArray(manifest.files) || !Array.isArray(manifest.versions) || !Array.isArray(manifest.contexts)) return null;
  if (manifest.schema === MOKINA_RECOVERY_LEGACY_SCHEMA) return { status: 'unknown', issues: [] };
  if (manifest.schema !== MOKINA_RECOVERY_MANIFEST_SCHEMA) return null;
  const integrity = manifest.integrity as Record<string, unknown> | undefined;
  if (!integrity || !['complete', 'partial'].includes(String(integrity.status)) || !Array.isArray(integrity.issues)) return null;
  const issues: MokinaRecoveryIssue[] = [];
  for (const raw of integrity.issues) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const issue = raw as Record<string, unknown>;
    if (typeof issue.path !== 'string' || !issue.path || typeof issue.message !== 'string' || !issue.message
      || !['missing', 'unreadable', 'invalid', 'changed', 'dependency', 'unsupported', 'limit'].includes(String(issue.reason))) return null;
    issues.push({ path: issue.path, reason: issue.reason as MokinaRecoveryIssue['reason'], message: issue.message });
  }
  if ((integrity.status === 'complete') !== (issues.length === 0)) return null;
  return { status: integrity.status as 'complete' | 'partial', issues };
}

export function mokinaRecoveryWarnings(integrity: MokinaRecoveryIntegrity): string[] {
  if (integrity.status === 'unknown') return ['旧版恢复包未记录完整性；已校验包内文件，但不能证明没有遗漏。'];
  if (integrity.status === 'complete') return [];
  return ['这是部分抢救包，不是完整备份。', ...integrity.issues.map(issue => `${issue.path}：${issue.message}`)];
}

export const MOKINA_RECOVERY_LIMITS = Object.freeze({
  maxArchiveEntries: 2_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxUncompressedBytes: 512 * 1024 * 1024,
} as const);
