/**
 * Mokina context snapshot contracts (V0.0.2 Local Preview, T06).
 *
 * A snapshot is the immutable set of user-selected excerpts, brand rules,
 * assets and notes a single task preparation froze for one run. It is NOT a
 * knowledge base: no indexing, no sync, no cross-project recall. Fields mirror
 * the reviewed spec package (`contracts/mokina-local.ts` + JSON schemas).
 */

export type MokinaSha256 = string;
export type MokinaIsoTimestamp = string;

export type MokinaSourceVersionState = 'current' | 'historical' | 'candidate';

export type MokinaSourceRef =
  | {
      kind: 'project-file';
      projectId: string;
      fileName: string;
      versionId?: string;
      versionState?: MokinaSourceVersionState;
    }
  | { kind: 'design-system'; designSystemId: string }
  | { kind: 'user-note' };

export type MokinaAssetRole = 'logo' | 'hero' | 'supporting';

export type MokinaExclusionReason =
  | 'user-excluded'
  | 'unreadable'
  | 'unsupported'
  | 'budget'
  | 'permission'
  | 'unavailable';

export interface MokinaExcludedContextItem {
  displayName: string;
  reason: MokinaExclusionReason;
  explanation: string;
}

interface MokinaCommonSnapshotItem {
  itemId: string;
  displayName: string;
  sourceRef: MokinaSourceRef;
  /** Digest of the ORIGINAL source bytes, not of the frozen excerpt. */
  sourceDigest: MokinaSha256;
  limitations: string[];
}

export interface MokinaTextSnapshotItem extends MokinaCommonSnapshotItem {
  kind: 'material-excerpt' | 'brand-rule' | 'artifact-section' | 'user-note';
  locators: string[];
  text: string;
  /** Digest of the frozen excerpt UTF-8 bytes; never equal to sourceDigest. */
  textDigest: MokinaSha256;
}

export interface MokinaAssetSnapshotItem extends MokinaCommonSnapshotItem {
  kind: 'asset';
  blobId: MokinaSha256;
  mimeType: string;
  byteLength: number;
  role: MokinaAssetRole;
  usageNote: string;
}

export type MokinaSnapshotItem = MokinaTextSnapshotItem | MokinaAssetSnapshotItem;

export interface MokinaContextSnapshot {
  schemaVersion: 1;
  snapshotId: string;
  projectId: string;
  createdAt: MokinaIsoTimestamp;
  parserVersion: string;
  selectionFingerprint: MokinaSha256;
  items: MokinaSnapshotItem[];
  excluded: MokinaExcludedContextItem[];
  restoredFrom?: { snapshotId: string; projectId: string; fingerprint: MokinaSha256 };
  /** Canonical-JSON SHA-256 over every field except this one. */
  fingerprint: MokinaSha256;
}

type MokinaResourceSelection = {
  itemId: string;
  sourceRef: Exclude<MokinaSourceRef, { kind: 'user-note' }>;
  expectedSourceDigest: MokinaSha256;
};

export type MokinaContextSelection =
  | (MokinaResourceSelection & {
      mode: 'fragments';
      textKind: 'material-excerpt' | 'brand-rule';
      fragmentIds: string[];
      expectedParserVersion: string;
    })
  | (MokinaResourceSelection & {
      mode: 'groups';
      textKind: 'material-excerpt' | 'brand-rule';
      groupIds: string[];
    })
  | (MokinaResourceSelection & { mode: 'sections'; sectionIds: string[] })
  | (MokinaResourceSelection & { mode: 'asset'; role: MokinaAssetRole; usageNote: string })
  | { itemId: string; mode: 'note'; sourceRef: { kind: 'user-note' }; text: string };

export interface PrepareMokinaContextRequest {
  snapshotId: string;
  selections: MokinaContextSelection[];
  excluded: MokinaExcludedContextItem[];
}

export interface PrepareMokinaContextResponse {
  snapshot: MokinaContextSnapshot;
  reused: boolean;
}

export interface MokinaContextDeliveryReceipt {
  runId: string;
  snapshotId: string;
  fingerprint: MokinaSha256;
  includedItemIds: string[];
  itemDelivery: Array<{
    itemId: string;
    mode: 'inline-text' | 'staged-file' | 'multimodal';
  }>;
  status: 'prepared' | 'submitted' | 'not-submitted';
  submittedAt?: MokinaIsoTimestamp;
  reason?: string;
}

/**
 * Selective continuation payload written into a new project as
 * `MOKINA-CONTINUATION.json`. schemaVersion 1 files stay readable (they carry
 * only source/sections/background); v2 adds the stable operation identity, the
 * source content digest and the target-intent fields.
 */
export interface MokinaContinuationV2 {
  schemaVersion: 2;
  operationId: string;
  targetProjectId: string;
  source: {
    projectId: string;
    fileName: string;
    versionId: string;
    contentDigest?: MokinaSha256;
    versionState?: MokinaSourceVersionState;
  };
  sections: Array<{ id: string; text: string; textDigest?: MokinaSha256 }>;
  background?: string;
  productionIntent: 'discuss' | 'landing-page' | 'custom';
  /** Present once the continuation also froze a context snapshot (T06 UI). */
  contextSnapshotId?: string;
}

export const MOKINA_CONTEXT_ERROR_CODES = Object.freeze({
  SOURCE_CHANGED: 'MOKINA_SOURCE_CHANGED',
  CONTEXT_LIMIT: 'MOKINA_CONTEXT_LIMIT',
  SNAPSHOT_CONFLICT: 'MOKINA_SNAPSHOT_CONFLICT',
  SNAPSHOT_UNAVAILABLE: 'MOKINA_SNAPSHOT_UNAVAILABLE',
  OPERATION_CONFLICT: 'MOKINA_OPERATION_CONFLICT',
  CONTEXT_NOT_SUPPORTED: 'MOKINA_CONTEXT_NOT_SUPPORTED',
} as const);

export type MokinaContextErrorCode =
  (typeof MOKINA_CONTEXT_ERROR_CODES)[keyof typeof MOKINA_CONTEXT_ERROR_CODES];

/**
 * Product selection budgets. One snapshot: at most 20 items, 24,000 UTF-16
 * code units of excerpt text (JavaScript `string.length`, aligned with the
 * existing 24,000-char revision section check) and 30 MiB of frozen binary
 * assets. Never truncate silently.
 */
export const MOKINA_CONTEXT_BUDGETS = Object.freeze({
  maxItems: 20,
  maxExcerptCodeUnits: 24_000,
  maxAssetBytes: 30 * 1024 * 1024,
  /** Existing per-source parser limits that stay in force. */
  maxSourceBytes: 10 * 1024 * 1024,
  maxDeliveryRunsPerProject: 500,
} as const);

/** The exact text frozen inside one item; separators count toward its budget. */
export function joinMokinaExcerpt(fragments: readonly string[]): string {
  return fragments.join('\n\n');
}

/** Shared text segmentation used by the parser and plain-text brand budget preview. */
export function splitMokinaTextParts(text: string): Array<{ part: number; text: string }> {
  const parts: Array<{ part: number; text: string }> = [];
  for (let offset = 0, part = 1; offset < text.length; offset += 8_000, part++) {
    const fragment = text.slice(offset, offset + 8_000);
    if (fragment.trim()) parts.push({ part, text: fragment });
  }
  return parts;
}
export function mokinaContextBudgetExceeded(input: { itemCount: number; excerptUnits: number; assetBytes: number }): boolean {
  return input.itemCount > MOKINA_CONTEXT_BUDGETS.maxItems
    || input.excerptUnits > MOKINA_CONTEXT_BUDGETS.maxExcerptCodeUnits
    || input.assetBytes > MOKINA_CONTEXT_BUDGETS.maxAssetBytes;
}
