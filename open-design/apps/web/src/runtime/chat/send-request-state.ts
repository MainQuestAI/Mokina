/** Request recovery belongs to the composer scope. A missing GET result is never
 * proof of rejection: a POST may still arrive after the GET. */
import type { ChatRunStatusResponse, WorkspaceCollabContext } from '@open-design/contracts';
import { queryRunByClientRequest } from '../../providers/daemon';
import { sanitizeComposerDraftExtras, type ComposerDraftExtras, DRAFT_MAX_EXTRAS_CHARS } from './composer-draft';
import { mirrorDurableRecord, removeDurableRecord } from '../persistence/mokina-recovery-store';

export interface SendRequestSnapshot {
  readonly prompt: string;
  readonly extras: ComposerDraftExtras;
  readonly requiresContextReselection?: boolean;
  readonly userMessageId?: string;
  readonly assistantMessageId?: string;
}
export interface SendRequestRecord {
  readonly clientRequestId: string;
  readonly projectId: string;
  readonly conversationId: string;
  readonly authorityKey?: string;
  readonly promptPreview: string;
  status: 'pending' | 'unknown' | 'draft';
  /** Absent on old records: conservatively treat them as dispatched. */
  phase?: 'prepared' | 'dispatched';
  snapshot?: SendRequestSnapshot;
  readonly createdAt: number;
}
export const SEND_REQUESTS_CHANGED = 'mokina:send-requests-changed';
const MAX_RECORDS = 8;
/** Per-scope soft ceiling across ALL statuses (pending + unknown + draft).
 * Reached → the send proceeds without a recoverable snapshot instead of being
 * refused; old records are never evicted. */
const SOFT_MAX_RECORDS = 24;
const MAX_PROMPT_CHARS = 64 * 1024;
/** Outcome of a save attempt. `failed` is ONLY a storage write error — that is
 * the single branch where the caller must refuse to POST (Spec §10). Everything
 * else sends; `skipped` just means no recoverable snapshot was kept. */
export type SavePendingSendResult = 'saved' | 'skipped' | 'failed';
const owners = new Set<string>();
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const legacyKey = (p: string, c: string) => `od:send-request:${p}:${c}`;
const prefix = (p: string, c: string, authorityKey = 'none') => `od:send-request:v2:${JSON.stringify([authorityKey, p, c])}:`;
const recordKey = (r: Pick<SendRequestRecord, 'projectId' | 'conversationId' | 'authorityKey' | 'clientRequestId'>) => `${prefix(r.projectId, r.conversationId, r.authorityKey)}${encodeURIComponent(r.clientRequestId)}`;
function changed(): void { window.dispatchEvent(new Event(SEND_REQUESTS_CHANGED)); }
function valid(r: unknown, p: string, c: string): r is SendRequestRecord {
  if (!r || typeof r !== 'object') return false;
  const row = r as SendRequestRecord;
  return row.projectId === p && row.conversationId === c && typeof row.clientRequestId === 'string'
    && ['pending', 'unknown', 'draft'].includes(row.status);
}
export function loadSendRequestRecords(p: string, c: string, authorityKey = 'none'): SendRequestRecord[] {
  if (typeof window === 'undefined') return [];
  const records = new Map<string, SendRequestRecord>();
  try {
    // Legacy records carry no authority; only the original local lane may read them.
    if (authorityKey === 'none') {
      const raw = window.localStorage.getItem(legacyKey(p, c));
      try {
        const old: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(old)) for (const r of old) if (valid(r, p, c)) records.set(r.clientRequestId, r);
      } catch { /* Keep unrelated valid per-request records readable. */ }
    }
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix(p, c, authorityKey))) continue;
      try {
        const row: unknown = JSON.parse(window.localStorage.getItem(key) ?? 'null');
        if (valid(row, p, c)) records.set(row.clientRequestId, row);
      } catch { /* A corrupt request must not hide its siblings. */ }
    }
  } catch { return []; }
  return [...records.values()].sort((a, b) => a.createdAt - b.createdAt);
}
function write(r: SendRequestRecord): boolean {
  try {
    const encoded = JSON.stringify(r);
    window.localStorage.setItem(recordKey(r), encoded);
    // Durable mirror under the desktop profile: a port/origin change must not
    // orphan a prepared or unknown send intent (T03).
    mirrorDurableRecord(recordKey(r), encoded);
    changed(); return true;
  }
  catch { return false; }
}
export function savePendingSendRequest(input: {
  clientRequestId: string; projectId: string; conversationId: string; prompt: string;
  authorityKey?: string; snapshot?: SendRequestSnapshot;
  /** Explicit resend of the SAME request identity: rewrite the record back to
   * pending/prepared (owner re-claimed) instead of refusing. Never counts
   * against capacity — it adds no record, and an in-flight cap must not block
   * the resend that drains it. */
  allowExisting?: boolean;
}): SavePendingSendResult {
  if (typeof window === 'undefined') return 'failed';
  try {
    const records = loadSendRequestRecords(input.projectId, input.conversationId, input.authorityKey);
    const existing = records.find(r => r.clientRequestId === input.clientRequestId);
    if (existing && !input.allowExisting) {
      // A receipt already covers this request identity; the send must proceed
      // (the server settles duplicate IDs idempotently) and the stored record
      // is left untouched.
      return 'skipped';
    }
    if (!existing) {
      // Only in-flight requests hold capacity: unknown/draft records are
      // settled outcomes and must never block a new send (P1-1).
      const inFlight = records.filter(r => r.status === 'pending').length;
      if (inFlight >= MAX_RECORDS || records.length >= SOFT_MAX_RECORDS) return 'skipped';
    }
    let snapshot: SendRequestSnapshot | undefined = existing?.snapshot;
    if (input.snapshot) {
      const extras = sanitizeComposerDraftExtras(input.snapshot.extras);
      // Unlike ordinary convenience drafts, a send receipt cannot silently shed payload.
      if (JSON.stringify(extras).length <= DRAFT_MAX_EXTRAS_CHARS
        && canonical(extras) === canonical(input.snapshot.extras)) {
        snapshot = { ...input.snapshot, extras, prompt: input.prompt };
      } else if (!existing) {
        // Oversized payload: keep the receipt identity (preview only) so a
        // lost response can still be reconciled by clientRequestId, but send
        // without a recoverable snapshot.
        snapshot = undefined;
      }
    }
    if (input.prompt.length > MAX_PROMPT_CHARS) snapshot = undefined;
    const record: SendRequestRecord = { clientRequestId: input.clientRequestId, projectId: input.projectId,
      conversationId: input.conversationId, authorityKey: input.authorityKey,
      promptPreview: input.prompt.slice(0, 120), status: 'pending', phase: 'prepared',
      ...(snapshot ? { snapshot } : {}), createdAt: Date.now() };
    // Claim preparation too: rerenders while BYOK resolves must not recover this live send.
    owners.add(recordKey(record));
    if (write(record)) return snapshot ? 'saved' : 'skipped';
    owners.delete(recordKey(record)); return 'failed';
  } catch { return 'failed'; }
}
/** Native cross-tab exclusion keeps the eight-receipt cap without a shared
 * read/modify/write array. Local secure browser/Electron carriers expose Web Locks. */
export async function persistPendingSendRequest(input: Parameters<typeof savePendingSendRequest>[0]): Promise<SavePendingSendResult> {
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return await navigator.locks.request(prefix(input.projectId, input.conversationId, input.authorityKey),
        { mode: 'exclusive' }, () => savePendingSendRequest(input));
    }
    return savePendingSendRequest(input);
  } catch { return 'failed'; }
}
function find(p: string, c: string, id: string, authorityKey?: string): SendRequestRecord | undefined {
  return loadSendRequestRecords(p, c, authorityKey).find(r => r.clientRequestId === id);
}
export function markSendRequestDispatched(p: string, c: string, id: string, authorityKey?: string): boolean {
  const r = find(p, c, id, authorityKey);
  if (!r || r.phase !== 'prepared' || r.status !== 'pending') return false;
  if (!write({ ...r, phase: 'dispatched' })) return false;
  owners.add(recordKey(r));
  return true;
}
export function markSendRequestUnknown(p: string, c: string, id: string, authorityKey?: string): void {
  const r = find(p, c, id, authorityKey);
  if (!r) return;
  owners.delete(recordKey(r));
  write({ ...r, status: 'unknown' });
}
export function markSendRequestDraft(p: string, c: string, id: string, authorityKey?: string): void {
  const r = find(p, c, id, authorityKey);
  if (!r) return;
  owners.delete(recordKey(r));
  write({ ...r, status: 'draft' });
}
export function releaseSendRequestOwnersForTests(): void { owners.clear(); }
export function recoverSendRequestRecords(p: string, c: string, authorityKey?: string): SendRequestRecord[] {
  for (const r of loadSendRequestRecords(p, c, authorityKey)) {
    if (r.status !== 'pending' || owners.has(recordKey(r))) continue;
    write({ ...r, status: r.phase === 'prepared' ? 'draft' : 'unknown' });
  }
  return loadSendRequestRecords(p, c, authorityKey);
}
export function clearSendRequestRecord(p: string, c: string, id: string, authorityKey?: string): boolean {
  if (typeof window === 'undefined') return false;
  const r = find(p, c, id, authorityKey);
  if (!r) return true;
  try {
    window.localStorage.removeItem(recordKey(r));
    removeDurableRecord(recordKey(r));
    if ((authorityKey ?? 'none') === 'none') {
      const raw = window.localStorage.getItem(legacyKey(p, c));
      if (raw) {
        const old: unknown = JSON.parse(raw);
        if (Array.isArray(old)) {
          const next = old.filter(row => !valid(row, p, c) || row.clientRequestId !== id);
          if (next.length) {
            const encodedNext = JSON.stringify(next);
            window.localStorage.setItem(legacyKey(p, c), encodedNext);
            mirrorDurableRecord(legacyKey(p, c), encodedNext);
          } else {
            window.localStorage.removeItem(legacyKey(p, c));
            removeDurableRecord(legacyKey(p, c));
          }
        }
      }
    }
    owners.delete(recordKey(r)); changed(); return true;
  } catch { return false; }
}
export type RunAcceptedQueryResult = ChatRunStatusResponse | null;
export async function queryRunAccepted(p: string, c: string, id: string, timeoutMs = 10_000,
  context?: WorkspaceCollabContext | null, signal?: AbortSignal): Promise<RunAcceptedQueryResult> {
  return queryRunByClientRequest(p, c, id, { timeoutMs, workspaceContext: context, signal });
}
export function resetSendRequestRecordsForTests(): void {
  owners.clear();
  if (typeof window === 'undefined') return;
  for (const key of Object.keys(window.localStorage)) if (key.startsWith('od:send-request:')) window.localStorage.removeItem(key);
}
