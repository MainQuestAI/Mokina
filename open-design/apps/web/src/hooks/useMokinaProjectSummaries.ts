import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import { summarizeMokinaProjectEntries, type MokinaEntryMetadata, type MokinaProjectSummary } from '../artifacts/mokina-project-entry';
import { fetchProjectFileVersions, fetchProjectFiles } from '../providers/registry';
import { workspaceAccountScopedCacheKey } from '../collab/workspace-identity';
import { MOKINA_ENTRY_SUMMARIES_CHANGED } from '../runtime/mokina-entry-events';
export { notifyMokinaEntriesChanged } from '../runtime/mokina-entry-events';

export type MokinaEntrySummaryStatus = 'loading' | 'ok' | 'failed' | 'unauthorized';
export type MokinaEntryCompleteness = 'complete' | 'partial' | 'truncated' | 'failed' | 'unauthorized';
export interface MokinaEntrySummaryRecord {
  readonly status: MokinaEntrySummaryStatus;
  readonly completeness: MokinaEntryCompleteness;
  readonly refreshing?: boolean;
  readonly summary: MokinaProjectSummary | null;
  readonly entries: readonly MokinaEntryMetadata[];
  /** 目录里 HTML 条目总数（含未读取细节的截断部分）；仅 status==='ok' 时有意义。 */
  readonly htmlCount?: number;
  /** 生成当前摘要所用的 legacy 入口提示；检测提示变化用。 */
  readonly legacyEntryHint?: string | null;
}
interface Subscription {
  ids: readonly string[]; authority: string; context: WorkspaceCollabContext | null; complete: boolean;
  /** 每项目的 legacy manifest.primary / metadata.entryFile 提示（Spec §5.1）。 */
  entryHints?: ReadonlyMap<string, string | null>;
}
interface ReadOwner { controller: AbortController; complete: boolean; }
interface QueuedRead { signal: AbortSignal; priority: boolean; start: () => void; cancel: () => void; }
const queue: QueuedRead[] = [];
const allReads = new Set<QueuedRead>();
let activeReads = 0;
const records = new Map<string, MokinaEntrySummaryRecord>();
const readers = new Map<string, ReadOwner>();
const subscriptions = new Set<Subscription>();
const listeners = new Set<() => void>();
let version = 0;
const keyOf = (authority: string, projectId: string) => JSON.stringify([authority, projectId]);
const abortError = () => new DOMException('Read abandoned', 'AbortError');
function emit(): void { version += 1; for (const listener of listeners) listener(); }
function pump(): void {
  while (activeReads < 2 && queue.length) {
    const read = queue.shift()!;
    if (read.signal.aborted) { read.cancel(); continue; }
    activeReads += 1; read.start();
  }
}
/** Cancellation settles both waiting and running readers, even if a test double
 * ignores AbortSignal. The underlying real fetch receives the same signal. */
export function enqueueMokinaMetadataRead<T>(task: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, priority: boolean): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let started = false;
    let settled = false;
    const finish = (result: T | undefined, error?: unknown) => {
      if (settled) return;
      settled = true; allReads.delete(read); signal.removeEventListener('abort', abort);
      const index = queue.indexOf(read); if (index >= 0) queue.splice(index, 1);
      if (started) activeReads -= 1;
      if (error) reject(error); else resolve(result as T);
      pump();
    };
    const abort = () => { controller.abort(); finish(undefined, abortError()); };
    const read: QueuedRead = { signal, priority, cancel: abort, start: () => {
      started = true; Promise.resolve().then(() => { if (signal.aborted || controller.signal.aborted) throw abortError(); return task(controller.signal); }).then(value => finish(value), error => finish(undefined, error));
    } };
    allReads.add(read);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    const index = priority ? queue.findIndex(item => !item.priority) : -1;
    if (index >= 0) queue.splice(index, 0, read); else queue.push(read);
    pump();
  });
}
function subscribers(key: string): Subscription[] {
  return [...subscriptions].filter(subscription => subscription.ids.some(id => keyOf(subscription.authority, id) === key));
}
function cancel(key: string): void {
  const owner = readers.get(key);
  readers.delete(key); owner?.controller.abort();
}
function write(key: string, owner: ReadOwner, record: MokinaEntrySummaryRecord): void {
  if (readers.get(key) !== owner || owner.controller.signal.aborted || !subscribers(key).length) return;
  // The full entries, not just the row headline, are the navigation authority.
  records.set(key, record); emit();
}
function requestRead(projectId: string, subscription: Subscription, fresh = false): void {
  const key = keyOf(subscription.authority, projectId);
  const covered = subscribers(key);
  if (!covered.length) return;
  const complete = covered.some(item => item.complete);
  const hint = subscription.entryHints?.get(projectId) ?? null;
  const previous = records.get(key);
  const hintChanged = previous !== undefined && (previous.legacyEntryHint ?? null) !== hint;
  const previousOwner = readers.get(key);
  if (previousOwner && !fresh && !hintChanged && (!complete || previousOwner.complete)) return;
  cancel(key);
  const owner: ReadOwner = { controller: new AbortController(), complete };
  readers.set(key, owner);
  records.set(key, previous ? { ...previous, refreshing: true } : {
    status: 'loading', completeness: 'partial', summary: null, entries: [],
  });
  emit();
  const { signal } = owner.controller;
  void (async () => {
    try {
      const files = await enqueueMokinaMetadataRead(readSignal => fetchProjectFiles(projectId, {
        workspaceContext: subscription.context, requireAuthoritative: true, fresh, signal: readSignal,
      }), signal, complete);
      if (signal.aborted) return;
      const all = files.filter(file => file.kind === 'html');
      const selected = complete ? all : all.slice(0, 8);
      const entries = await Promise.all(selected.map(async (file): Promise<MokinaEntryMetadata> => {
        try {
          const body = await enqueueMokinaMetadataRead(readSignal => fetchProjectFileVersions(projectId, file.name, subscription.context,
            { readOnly: true, requireAuthoritative: true, signal: readSignal }), signal, complete);
          if (!body || !Array.isArray(body.versions)) return { entry: file.name, readState: 'failed' };
          return { entry: file.name, readState: 'ok', versions: body.versions };
        } catch (error) {
          if (signal.aborted) throw error;
          const status = (error as { status?: number })?.status;
          return { entry: file.name, readState: status === 401 || status === 403 ? 'unauthorized' : 'failed' };
        }
      }));
      const unauthorized = entries.some(entry => entry.readState === 'unauthorized');
      const failed = entries.some(entry => entry.readState !== 'ok');
      const truncated = all.length > selected.length;
      const completeness: MokinaEntryCompleteness = unauthorized ? 'unauthorized'
        : failed ? (entries.every(entry => entry.readState === 'failed') ? 'failed' : 'partial')
        : truncated ? 'truncated' : 'complete';
      const status: MokinaEntrySummaryStatus = completeness === 'complete' ? 'ok' : unauthorized ? 'unauthorized' : 'failed';
      write(key, owner, { status, completeness, entries, htmlCount: all.length,
        legacyEntryHint: hint,
        summary: summarizeMokinaProjectEntries({
          projectId, entries, entriesReadState: status, legacyEntryHint: hint,
        }) });
    } catch (error) {
      if (signal.aborted) return;
      const unauthorized = /failed \((401|403)\)/.test(String(error));
      write(key, owner, { status: unauthorized ? 'unauthorized' : 'failed',
        completeness: unauthorized ? 'unauthorized' : 'failed', summary: null, entries: [] });
    } finally { if (readers.get(key) === owner) readers.delete(key); }
  })();
}
function refreshAll(): void {
  const refreshed = new Set<string>();
  for (const subscription of subscriptions) for (const id of subscription.ids) {
    const key = keyOf(subscription.authority, id);
    if (!refreshed.has(key)) { refreshed.add(key); requestRead(id, subscription, true); }
  }
}
function handleChange(event: Event): void {
  const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
  if (projectId) evictMokinaEntrySummary(projectId); else refreshAll();
}
function listen(): void {
  window.addEventListener(MOKINA_ENTRY_SUMMARIES_CHANGED, handleChange);
  window.addEventListener('focus', refreshAll);
}
function unlisten(): void {
  window.removeEventListener(MOKINA_ENTRY_SUMMARIES_CHANGED, handleChange);
  window.removeEventListener('focus', refreshAll);
}
export function evictMokinaEntrySummary(projectId: string): void {
  const refreshed = new Set<string>();
  for (const subscription of subscriptions) {
    if (!subscription.ids.includes(projectId)) continue;
    const key = keyOf(subscription.authority, projectId);
    if (refreshed.has(key)) continue;
    refreshed.add(key); cancel(key); records.delete(key); requestRead(projectId, subscription, true);
  }
  emit();
}
export function resetMokinaEntrySummaryStore(): void {
  for (const key of readers.keys()) cancel(key);
  for (const read of [...allReads]) read.cancel();
  records.clear(); emit();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getVersion = () => version;
const EMPTY: ReadonlyMap<string, MokinaEntrySummaryRecord> = new Map();
export interface UseMokinaProjectSummariesOptions {
  enabled?: boolean; workspaceContext?: WorkspaceCollabContext | null;
  /** Full metadata only for the foreground project's default-entry decision. */
  complete?: boolean;
  /** 每项目的 legacy manifest.primary / metadata.entryFile 提示；来自项目
   *  列表的 metadata，不需要额外请求。变化触发一次复核（走既有队列）。 */
  entryHints?: ReadonlyMap<string, string | null>;
}
function useSummaryMap(idsKey: string, options?: UseMokinaProjectSummariesOptions): ReadonlyMap<string, MokinaEntrySummaryRecord> {
  const enabled = options?.enabled !== false;
  const context = options?.workspaceContext ?? null;
  const authority = workspaceAccountScopedCacheKey(context);
  const complete = options?.complete === true;
  const entryHints = options?.entryHints;
  const hintsKey = entryHints ? JSON.stringify([...entryHints]) : '';
  const storeVersion = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    if (!enabled || !idsKey) return undefined;
    const subscription: Subscription = { ids: idsKey.split('\u0000'), authority, context, complete,
      ...(entryHints ? { entryHints } : {}) };
    if (!subscriptions.size) listen();
    subscriptions.add(subscription);
    for (const id of subscription.ids) requestRead(id, subscription);
    return () => {
      subscriptions.delete(subscription);
      for (const id of subscription.ids) {
        const key = keyOf(authority, id);
        if (!subscribers(key).length) { cancel(key); records.delete(key); }
      }
      if (!subscriptions.size) unlisten();
      emit();
    };
    // Authority includes all context fields carried on the wire; hintsKey
    // covers the per-project legacy-entry hints.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled, authority, complete, hintsKey]);
  return useMemo(() => {
    if (!enabled || !idsKey) return EMPTY;
    const map = new Map<string, MokinaEntrySummaryRecord>();
    for (const id of idsKey.split('\u0000')) {
      const record = records.get(keyOf(authority, id));
      if (record) map.set(id, record);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, enabled, authority, storeVersion]);
}
export function useMokinaProjectSummaries(ids: readonly string[], options?: UseMokinaProjectSummariesOptions): ReadonlyMap<string, MokinaEntrySummaryRecord> {
  const idsKey = useMemo(() => [...new Set(ids)].sort().join('\u0000'), [ids]);
  return useSummaryMap(idsKey, options);
}
export function useMokinaProjectSummary(id: string | null | undefined, options?: UseMokinaProjectSummariesOptions): MokinaEntrySummaryRecord | undefined {
  const map = useSummaryMap(id ?? '', { ...options, enabled: !!id && options?.enabled !== false });
  return id ? map.get(id) : undefined;
}
export type MokinaArtifactLineState = 'loading' | 'failed' | 'unauthorized' | 'empty' | 'artifacts' | 'truncated';
type SummaryKey = 'mokina.entrySummary.loading' | 'mokina.entrySummary.failed' | 'mokina.entrySummary.unauthorized' | 'mokina.entrySummary.empty' | 'mokina.entrySummary.legacy' | 'mokina.entrySummary.incomplete' | 'mokina.entrySummary.htmlCount' | 'mokina.entrySummary.candidates';
type TranslateFn = (key: SummaryKey, vars?: Record<string, string | number>) => string;
export function mokinaArtifactLineFromRecord(record: MokinaEntrySummaryRecord | undefined, translate: TranslateFn): { text: string; state: MokinaArtifactLineState } | null {
  if (!record) return null;
  if (record.completeness === 'truncated') {
    // 超过可见读取上限的正常大项目：中性计数，不用失败样式（P2-3）。
    return { text: translate('mokina.entrySummary.htmlCount', { count: record.htmlCount ?? record.entries.length }), state: 'truncated' };
  }
  if (record.completeness === 'partial' && record.status !== 'loading') return { text: translate('mokina.entrySummary.incomplete'), state: 'failed' };
  if (record.status === 'failed') return { text: translate('mokina.entrySummary.failed'), state: 'failed' };
  if (record.status === 'unauthorized') return { text: translate('mokina.entrySummary.unauthorized'), state: 'unauthorized' };
  if (record.status === 'loading' || !record.summary) return { text: translate('mokina.entrySummary.loading'), state: 'loading' };
  const { summary } = record;
  const candidateSuffix = summary.candidateCount > 0 ? ` ${translate('mokina.entrySummary.candidates', { count: summary.candidateCount })}` : '';
  if (summary.state === 'empty' || !summary.primary) return { text: (summary.legacy ? `${summary.legacy.entry} · ${translate('mokina.entrySummary.legacy')}` : translate('mokina.entrySummary.empty')) + candidateSuffix, state: 'empty' };
  const primary = summary.primary;
  const line = `${primary.entry} · v${primary.versionNumber}`;
  return { text: `${record.refreshing ? translate('mokina.entrySummary.loading') + ' · ' : ''}${line}${summary.formalCount > 1 ? ` +${summary.formalCount - 1}` : ''}${candidateSuffix}`, state: 'artifacts' };
}
