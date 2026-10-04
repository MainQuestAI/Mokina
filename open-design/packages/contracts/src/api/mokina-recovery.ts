/**
 * Mokina project recovery package contracts (V0.0.2 Local Preview, T14).
 *
 * A recovery package is project DATA, not machine backup and not a SQLite
 * clone: originals, versions (with their frozen content), context snapshots
 * and assets, plus a manifest. It never carries credentials, app config,
 * caches, absolute paths, or replayable send intents.
 */

export const MOKINA_RECOVERY_MANIFEST_SCHEMA = 'mokina.project-recovery.v1' as const;
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

export interface MokinaRecoveryManifest {
  schema: typeof MOKINA_RECOVERY_MANIFEST_SCHEMA;
  exportId: string;
  createdAt: string;
  sourceProject: { id: string; name: string };
  files: MokinaRecoveryManifestFile[];
  versions: MokinaRecoveryManifestVersion[];
  contexts: MokinaRecoveryManifestContext[];
}

export const MOKINA_RECOVERY_LIMITS = Object.freeze({
  maxArchiveEntries: 2_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxUncompressedBytes: 512 * 1024 * 1024,
} as const);
