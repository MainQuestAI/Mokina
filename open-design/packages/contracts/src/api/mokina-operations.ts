/** Controlled operations always produce a candidate of one immutable HTML version. */
export interface MokinaEditableField {
  id: string;
  sectionId: string;
  kind: 'strategy' | 'matrix' | 'quantity' | 'unit-price' | 'hours';
  label: string;
  value: string;
}
export interface MokinaOperationRequest {
  operationId: string;
  baseVersionId: string;
  contentDigest: string;
  edits: Array<{ id: string; value: string }>;
  combine?: { versionId: string; contentDigest: string; sections: string[] };
}
export function parseMokinaOperationRequest(value: unknown): MokinaOperationRequest {
  const fail = (): never => { throw new Error('Invalid controlled operation request'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const v = value as Record<string, unknown>;
  const id = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
  const digest = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  if (!id(v.operationId) || !id(v.baseVersionId) || !digest(v.contentDigest) || !Array.isArray(v.edits) || v.edits.length > 100) return fail();
  const edits = v.edits.map((item: unknown) => {
    if (!item || typeof item !== 'object') return fail();
    const row = item as Record<string, unknown>;
    if (!id(row.id) || typeof row.value !== 'string' || row.value.length > 8000) return fail();
    return { id: row.id, value: row.value };
  });
  if (new Set(edits.map(e => e.id)).size !== edits.length) return fail();
  let combine: MokinaOperationRequest['combine'];
  if (v.combine !== undefined) {
    const c = v.combine as Record<string, unknown>;
    if (!c || !id(c.versionId) || !digest(c.contentDigest) || !Array.isArray(c.sections) || !c.sections.length || c.sections.length > 30
      || !c.sections.every(id) || new Set(c.sections).size !== c.sections.length) return fail();
    combine = { versionId: c.versionId, contentDigest: c.contentDigest, sections: c.sections };
  }
  if (!edits.length && !combine) return fail();
  // Combining can reorder budget rows; edit the resulting candidate in a separate operation.
  if (edits.length && combine) return fail();
  return { operationId: v.operationId, baseVersionId: v.baseVersionId, contentDigest: v.contentDigest, edits, ...(combine ? { combine } : {}) };
}

export interface MokinaOperationInspection {
  operation?: MokinaOperationRequest;
  versionId: string;
  contentDigest: string;
  fields: MokinaEditableField[];
  sections: Array<{ id: string; text: string }>;
  editable: boolean;
  unsupportedReason: string | null;
  fieldWarnings: string[];
}
