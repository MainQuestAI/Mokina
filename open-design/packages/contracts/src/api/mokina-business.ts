/** Business documents have one writable source: their canonical HTML artifact. */
export type MokinaBusinessKind = 'background' | 'brief';
export type MokinaBusinessFact = {
  id: string; text: string; source: string; scope: string;
  status: 'proposed' | 'confirmed';
};
export type MokinaBackground = { title: string; facts: MokinaBusinessFact[]; preferences: string };
export type MokinaBackgroundSelection = { projectId: string; versionId: string; revision: string; factIds: string[] };
export type MokinaBackgroundSnapshot = MokinaBackgroundSelection & { title: string; facts: MokinaBusinessFact[] };
export type MokinaBrief = {
  title: string; goal: string; audience: string; deliverables: Array<{ id: string; title: string }>;
  kpi: string; budget: string; period: string; constraints: string; missing: string;
};
export type MokinaBusinessBody = { kind: 'background'; value: MokinaBackground }
  | { kind: 'brief'; value: MokinaBrief; background: MokinaBackgroundSelection | null };
export type SaveMokinaBusinessRequest = { operationId: string; expectedRevision: string | null; body: MokinaBusinessBody };
export type MokinaBusinessDocument = {
  schema: 'mokina.business.v1'; operationId: string; requestDigest: string;
  body: MokinaBusinessBody; backgroundSnapshot: MokinaBackgroundSnapshot | null;
};
export type MokinaBusinessReadResult = {
  document: MokinaBusinessDocument; revision: string; fileName: string; versionId: string | null;
};
export const MOKINA_BUSINESS_FILES = { background: 'business-background.html', brief: 'task-brief.html' } as const;

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const digestPattern = /^[a-f0-9]{64}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 4000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid or oversized text');
  return value;
}
function id(value: unknown): string {
  const result = text(value, 128); if (!idPattern.test(result)) throw new Error('Invalid identity'); return result;
}
function digest(value: unknown): string {
  const result = text(value, 64); if (!digestPattern.test(result)) throw new Error('Invalid revision'); return result;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('Expected at most 30 items');
  return value.map(parse);
}
function unique(values: string[]) { if (new Set(values).size !== values.length) throw new Error('Duplicate identities'); }
export function parseMokinaBackgroundSelection(value: unknown): MokinaBackgroundSelection {
  const row = record(value);
  const factIds = list(row.factIds, id); unique(factIds);
  if (!factIds.length) throw new Error('Select at least one confirmed fact');
  return { projectId: id(row.projectId), versionId: id(row.versionId), revision: digest(row.revision), factIds };
}
export function parseMokinaBusinessBody(value: unknown, allowIncomplete = false): MokinaBusinessBody {
  const row = record(value), body = record(row.value);
  const title = text(body.title, 200);
  if (!allowIncomplete && !title.trim()) throw new Error('Title is required');
  if (row.kind === 'background') {
    const facts = list(body.facts, item => {
      const fact = record(item);
      if (fact.status !== 'proposed' && fact.status !== 'confirmed') throw new Error('Invalid confirmation status');
      const parsed: MokinaBusinessFact = { id: id(fact.id), text: text(fact.text), source: text(fact.source, 1000), scope: text(fact.scope, 1000), status: fact.status };
      if (!allowIncomplete && (!parsed.text.trim() || (parsed.status === 'confirmed' && (!parsed.source.trim() || !parsed.scope.trim())))) throw new Error('Confirmed facts require text, source and scope');
      return parsed;
    });
    unique(facts.map(fact => fact.id));
    return { kind: 'background', value: { title, facts, preferences: text(body.preferences) } };
  }
  if (row.kind !== 'brief') throw new Error('Invalid document kind');
  const deliverables = list(body.deliverables, item => {
    const entry = record(item); const title = text(entry.title, 500);
    if (!allowIncomplete && !title.trim()) throw new Error('Deliverable title is required');
    return { id: id(entry.id), title };
  });
  unique(deliverables.map(entry => entry.id));
  return { kind: 'brief', value: { title, goal: text(body.goal), audience: text(body.audience), deliverables,
    kpi: text(body.kpi), budget: text(body.budget), period: text(body.period), constraints: text(body.constraints), missing: text(body.missing) },
    background: row.background === null ? null : parseMokinaBackgroundSelection(row.background) };
}
export function parseSaveMokinaBusinessRequest(value: unknown, allowIncomplete = false): SaveMokinaBusinessRequest {
  const row = record(value);
  return { operationId: id(row.operationId), expectedRevision: row.expectedRevision === null ? null : digest(row.expectedRevision), body: parseMokinaBusinessBody(row.body, allowIncomplete) };
}
