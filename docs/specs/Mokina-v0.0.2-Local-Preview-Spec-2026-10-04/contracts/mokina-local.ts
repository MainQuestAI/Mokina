/** Proposed additive development contracts, not an implementation.
 * Merge only the documented optional field into existing RunContextSelection.
 * Existing ProjectMaterialExtraction/ProjectFileVersion/ChatRequest stay intact.
 */
export type Sha256 = string;
export type IsoTimestamp = string;
export type SourceVersionState = 'current' | 'historical' | 'candidate';
export type SourceRef =
  | { kind: 'project-file'; projectId: string; fileName: string;
      versionId?: string; versionState?: SourceVersionState }
  | { kind: 'design-system'; designSystemId: string }
  | { kind: 'user-note' };
export type AssetRole = 'logo' | 'hero' | 'supporting';
export type ExclusionReason = 'user-excluded' | 'unreadable' | 'unsupported'
  | 'budget' | 'permission' | 'unavailable';
export interface ExcludedContextItem {
  displayName: string; reason: ExclusionReason; explanation: string;
}
interface CommonItem {
  itemId: string; displayName: string; sourceRef: SourceRef;
  sourceDigest: Sha256; limitations: string[];
}
export interface TextSnapshotItem extends CommonItem {
  kind: 'material-excerpt' | 'brand-rule' | 'artifact-section' | 'user-note';
  locators: string[]; text: string; textDigest: Sha256;
}
export interface AssetSnapshotItem extends CommonItem {
  kind: 'asset'; blobId: Sha256; mimeType: string; byteLength: number;
  role: AssetRole; usageNote: string;
}
export type SnapshotItem = TextSnapshotItem | AssetSnapshotItem;
export interface MokinaContextSnapshot {
  schemaVersion: 1; snapshotId: string; projectId: string;
  createdAt: IsoTimestamp; parserVersion: string;
  selectionFingerprint: Sha256; items: SnapshotItem[];
  excluded: ExcludedContextItem[];
  restoredFrom?: { snapshotId: string; projectId: string; fingerprint: Sha256 };
  fingerprint: Sha256;
}
interface ResourceSelection {
  itemId: string; sourceRef: Exclude<SourceRef, { kind: 'user-note' }>;
  expectedSourceDigest: Sha256;
}
export type ContextSelection =
  | (ResourceSelection & { mode: 'groups';
      textKind: 'material-excerpt' | 'brand-rule'; groupIds: string[] })
  | (ResourceSelection & { mode: 'sections'; sectionIds: string[] })
  | (ResourceSelection & { mode: 'asset'; role: AssetRole; usageNote: string })
  | { itemId: string; mode: 'note'; sourceRef: { kind: 'user-note' }; text: string };
export interface PrepareMokinaContextRequest {
  snapshotId: string; selections: ContextSelection[];
  excluded: ExcludedContextItem[];
}
export interface PrepareMokinaContextResponse {
  snapshot: MokinaContextSnapshot; reused: boolean;
}
/** Merge this optional field INTO the existing RunContextSelection.
 * Request location: ChatRequest.context.mokinaSnapshotId. No top-level alias.
 */
export interface MokinaRunContextExtension { mokinaSnapshotId?: string; }
export interface MokinaContextDeliveryReceipt {
  runId: string; snapshotId: string; fingerprint: Sha256;
  includedItemIds: string[];
  itemDelivery: Array<{ itemId: string;
    mode: 'inline-text' | 'staged-file' | 'multimodal' }>;
  status: 'prepared' | 'submitted' | 'not-submitted';
  submittedAt?: IsoTimestamp; reason?: string;
}
export interface ContinuationV2 {
  schemaVersion: 2; operationId: string; targetProjectId: string;
  source: { projectId: string; fileName: string; versionId: string;
    contentDigest: Sha256; versionState: SourceVersionState };
  sections: Array<{ id: string; text: string; textDigest: Sha256 }>;
  contextSnapshotId: string;
  productionIntent: 'discuss' | 'landing-page' | 'custom';
  initialDraft: string;
}
export interface HelperCreateJournal {
  schemaVersion: 2;
  operationId: string; kind: 'revision' | 'continuation';
  owner: { workspaceIdentity: string; projectId: string;
    entry: string; versionId: string };
  targetProjectId: string; selectionFingerprint: Sha256;
  checkpoint: 'prepared' | 'project-created' | 'snapshot-saved' | 'draft-ready';
  conversationId?: string; sendIntentId?: string;
}
/** A narrow storage transport for EXISTING draft/admission journals, not a new
 * operation system. Implement on existing host store or narrow validated IPC.
 * Undefined expectedRecordId means create-if-absent, NOT unconditional overwrite.
 */
export interface StoredRecoveryValue {
  recordId: string; value: unknown;
}
export interface DurableRecoveryStore {
  get(key: string): Promise<StoredRecoveryValue | null>;
  put(key: string, value: StoredRecoveryValue,
    expectedRecordId?: string): Promise<'stored' | 'conflict'>;
  delete(key: string, expectedRecordId: string): Promise<'deleted' | 'conflict'>;
}
export interface MokinaProductProfile {
  productId: 'mokina'; productName: 'Mokina'; productVersion: string;
  bundleIdentifier: 'ai.mainquest.mokina.preview';
  releaseKind: 'local-preview'; namespace: 'mokina-local';
  automaticUpdates: false; upstreamNews: false;
  defaultTelemetry: false; requiresUpstreamAccount: false;
  registersOdScheme: false;
}
export interface RecoveryManifest {
  schema: 'mokina.project-recovery.v1'; exportId: string; createdAt: IsoTimestamp;
  sourceProject: { id: string; name: string };
  files: Array<{ path: string; kind: 'original' | 'version' | 'frozen-version'
      | 'context-snapshot' | 'asset' | 'continuation' | 'read-only-transcript';
    byteLength: number; sha256: Sha256 }>;
  versions: Array<{ entry: string; originalVersionId: string; versionNumber: number;
    current: boolean; candidate: boolean; contentPath: string; contentDigest: Sha256;
    frozenContentPath?: string; parentOriginalVersionId?: string;
    baseOriginalVersionId?: string }>;
  contexts: Array<{ originalSnapshotId: string; payloadPath: string; fingerprint: Sha256 }>;
}
