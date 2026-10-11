/** Immutable, version-bound inspection. Rule checks are not professional approval. */
export interface MokinaQualityIssue {
  code: string;
  sectionId?: string;
  sourceId?: string;
  message: string;
}
export interface MokinaEvidenceSource {
  id: string;
  path: string;
  sha256: string;
  kind: 'full-text' | 'summary' | 'data' | 'method';
  locator: string;
  limitation: string;
  sectionId: string;
  url?: string;
  accessedAt?: string;
  methodVersion?: string;
  excerpt?: string;
  csv?: { id: string; amount: string; unit: string };
}
export interface MokinaQualitySnapshot {
  schema: 'mokina.quality.v1';
  versionId: string;
  contentDigest: string;
  frozenBodyDigest?: string;
  status: 'unreviewed' | 'issues' | 'rules-clear' | 'incomplete';
  sources: Array<MokinaEvidenceSource & { text?: string; error?: string }>;
  issues: MokinaQualityIssue[];
  calculations: Array<{ sectionId: string; expression: string; result: string }>;
  /** Content-integrity checksum, not an authenticity signature. */
  fingerprint: string;
}
