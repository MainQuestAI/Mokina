import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { WorkspaceCollabContext } from '@open-design/contracts';

import {
  summarizeMokinaProjectEntries,
  type MokinaEntryMetadata,
  type MokinaEntryReadState,
  type MokinaProjectSummary,
} from '../artifacts/mokina-project-entry';
import {
  fetchProjectFileVersions,
  fetchProjectFiles,
} from '../providers/registry';
import { MOKINA_ENTRY_SUMMARIES_CHANGED } from '../runtime/mokina-entry-events';

export { notifyMokinaEntriesChanged } from '../runtime/mokina-entry-events';

/**
 * 成果元数据的共享读取层（Spec B1 §7）：每个可见项目一次 files 读取 +
 * 每个 HTML 条目一次 versions 读取。全局并发 ≤2，同 scope+target 的请求
 * 经 registry 的 sharedCancellableGet 合并；订阅消失即停止排队，身份重置
 * 后进行中的读取作废。缓存不设过期：由采用/删除/重命名的显式事件
 * （MOKINA_ENTRY_SUMMARIES_CHANGED）与订阅时的复核保持新鲜。
 */

export type MokinaEntrySummaryStatus = 'loading' | 'ok' | 'failed' | 'unauthorized';

export interface MokinaEntrySummaryRecord {
  readonly status: MokinaEntrySummaryStatus;
  readonly summary: MokinaProjectSummary | null;
  /** 条目级元数据；ProjectView 打开回退用同一份做 §5.2 intent 解析。 */
  readonly entries: readonly MokinaEntryMetadata[];
}

/** 只读小元数据：单项目封顶的条目数，防止异常目录拖垮行读取。 */
const MAX_METADATA_ENTRIES_PER_PROJECT = 8;
const MAX_CONCURRENT_READS = 2;

interface MokinaSummarySubscription {
  readonly ids: readonly string[];
  readonly contextRef: { readonly current: WorkspaceCollabContext | null };
}

// ---------------------------------------------------------------------------
// Read queue (global, ≤2 concurrent)
// ---------------------------------------------------------------------------

const readQueue: Array<() => void> = [];
let activeReads = 0;

function pumpQueue(): void {
  while (activeReads < MAX_CONCURRENT_READS && readQueue.length > 0) {
    const task = readQueue.shift();
    if (!task) break;
    activeReads += 1;
    task();
  }
}

function enqueueRead<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    readQueue.push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          activeReads -= 1;
          pumpQueue();
        });
    });
    pumpQueue();
  });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const records = new Map<string, MokinaEntrySummaryRecord>();
const inFlightProjects = new Set<string>();
/** 订阅级取消：最后一个订阅者离开即中止在途 files 读取（Spec §7「卸载取消」）。 */
const readControllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
const subscriptions = new Set<MokinaSummarySubscription>();
let version = 0;
/** Bumped by reset so reads started before an identity switch never write. */
let generation = 0;
let listeningForChanges = false;

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function subscribeToStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion(): number {
  return version;
}

function writeRecord(projectId: string, record: MokinaEntrySummaryRecord): void {
  const previous = records.get(projectId);
  if (
    previous
    && previous.status === record.status
    && previous.summary?.state === record.summary?.state
    && previous.summary?.formalCount === record.summary?.formalCount
    && previous.summary?.primary?.versionId === record.summary?.primary?.versionId
    && previous.summary?.candidateCount === record.summary?.candidateCount
  ) {
    return;
  }
  records.set(projectId, record);
  emit();
}

function unauthorizedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed \((40[13])\)/.test(message);
}

async function readEntry(
  projectId: string,
  entryName: string,
  context: WorkspaceCollabContext | null,
): Promise<MokinaEntryMetadata> {
  try {
    const body = await enqueueRead(() =>
      fetchProjectFileVersions(projectId, entryName, context),
    );
    if (!body || !Array.isArray(body.versions)) {
      return { entry: entryName, readState: 'failed' };
    }
    return { entry: entryName, readState: 'ok', versions: body.versions };
  } catch {
    return { entry: entryName, readState: 'failed' };
  }
}

async function readProject(
  projectId: string,
  context: WorkspaceCollabContext | null,
): Promise<void> {
  const startedGeneration = generation;
  let files;
  const controller = new AbortController();
  readControllers.set(projectId, controller);
  try {
    // requireAuthoritative：行五态必须区分「确认空目录」与「读取失败」，
    // 不能走 broad caller 的空数组兜底（见该函数的 catch 注释）。
    files = await fetchProjectFiles(projectId, {
      workspaceContext: context,
      requireAuthoritative: true,
      signal: controller.signal,
    });
  } catch (error) {
    readControllers.delete(projectId);
    inFlightProjects.delete(projectId);
    // 订阅消失的主动取消不是读取失败：不写记录，等下次订阅重读。
    if (controller.signal.aborted || startedGeneration !== generation) return;
    writeRecord(projectId, {
      status: unauthorizedError(error) ? 'unauthorized' : 'failed',
      summary: null,
      entries: [],
    });
    return;
  }
  if (startedGeneration !== generation) return;

  const htmlEntries = files
    .filter((file) => file.kind === 'html')
    .slice(0, MAX_METADATA_ENTRIES_PER_PROJECT);

  let entries: MokinaEntryMetadata[];
  if (htmlEntries.length === 0) {
    entries = [];
  } else {
    entries = await Promise.all(
      htmlEntries.map((file) => readEntry(projectId, file.name, context)),
    );
  }
  readControllers.delete(projectId);
  inFlightProjects.delete(projectId);
  // fetchProjectFiles 把「订阅取消的 abort」吞成空数组返回（见其 catch）。
  // 取消不是目录为空：过期/被中止的读取不得落记录，等重订阅重读。
  if (controller.signal.aborted || startedGeneration !== generation) return;

  // 每个条目独立失败时行摘要仍显示已知的部分；全部失败才算行失败。
  const entriesReadState: MokinaEntryReadState
    = entries.length > 0 && entries.every((e) => e.readState === 'failed')
      ? 'failed'
      : 'ok';
  // 更新的读取已在途（重订阅重读）：旧读让位，避免旧结果覆盖新结果。
  if (readControllers.has(projectId)) return;
  writeRecord(projectId, {
    status: 'ok',
    summary: summarizeMokinaProjectEntries({
      projectId,
      entries,
      entriesReadState,
    }),
    entries,
  });
  inFlightProjects.delete(projectId);
}

function requestRead(
  projectId: string,
  context: WorkspaceCollabContext | null,
  options?: { fresh?: boolean },
): void {
  if (options?.fresh) {
    // 复核读：绕过 registry 的一秒合流窗口，直连 daemon。
    void fetchProjectFiles(projectId, { workspaceContext: context, fresh: true }).catch(() => {});
  }
  if (inFlightProjects.has(projectId)) return;
  inFlightProjects.add(projectId);
  if (records.get(projectId) === undefined) {
    writeRecord(projectId, { status: 'loading', summary: null, entries: [] });
  }
  void readProject(projectId, context);
}

function contextForSubscribed(projectId: string): WorkspaceCollabContext | null {
  for (const subscription of subscriptions) {
    if (subscription.ids.includes(projectId)) return subscription.contextRef.current;
  }
  return null;
}

function refresh(ids: Iterable<string>, options?: { fresh?: boolean }): void {
  for (const projectId of ids) {
    if (!projectId) continue;
    requestRead(projectId, contextForSubscribed(projectId), options);
  }
}

function addSubscription(subscription: MokinaSummarySubscription): void {
  subscriptions.add(subscription);
  // 订阅即复核（返回目录/滚动到新可见行都会重新订阅）。
  refresh(subscription.ids);
  startChangeFeed();
}

function removeSubscription(subscription: MokinaSummarySubscription): void {
  subscriptions.delete(subscription);
  // 该项目再无任何订阅：中止在途 files 读取并释放（可取消读者身份，
  // 不 pin 共享请求——否则会拖住封面扫描等表面的废弃中止语义）。
  const covered = new Set<string>();
  for (const remaining of subscriptions) {
    for (const id of remaining.ids) covered.add(id);
  }
  const previouslyRequested = new Set<string>([
    ...subscription.ids,
  ]);
  for (const id of previouslyRequested) {
    if (!covered.has(id)) {
      readControllers.get(id)?.abort();
      readControllers.delete(id);
      // 立即释放 in-flight 标记：重订阅（StrictMode 重挂载是常态）可以
      // 马上发起新读，不必等被中止的旧 promise 恢复。
      inFlightProjects.delete(id);
    }
  }
  if (subscriptions.size === 0) stopChangeFeed();
}

function startChangeFeed(): void {
  if (typeof window === 'undefined' || listeningForChanges) return;
  listeningForChanges = true;
  window.addEventListener(MOKINA_ENTRY_SUMMARIES_CHANGED, handleChangeEvent);
}

function stopChangeFeed(): void {
  if (typeof window === 'undefined' || !listeningForChanges) return;
  listeningForChanges = false;
  window.removeEventListener(MOKINA_ENTRY_SUMMARIES_CHANGED, handleChangeEvent);
}

function handleChangeEvent(event: Event): void {
  const detail = (event as CustomEvent<{ projectId?: string }>).detail;
  const projectId = typeof detail?.projectId === 'string' ? detail.projectId : null;
  if (projectId) {
    evictMokinaEntrySummary(projectId);
  } else {
    resetMokinaEntrySummaryStore();
  }
}

/**
 * 采用/删除/重命名后调用：丢掉该项目的缓存并在仍有订阅时立即复核，
 * 行摘要不会继续展示已被替换的正式稿。
 */
export function evictMokinaEntrySummary(projectId: string): void {
  records.delete(projectId);
  emit();
  if (subscriptions.size > 0) {
    refresh([projectId], { fresh: true });
  }
}

/** 测试与身份切换用：模块级缓存必须有显式清理（同 resetCoalescedGet）。 */
export function resetMokinaEntrySummaryStore(): void {
  generation += 1;
  records.clear();
  inFlightProjects.clear();
  readQueue.length = 0;
  emit();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

const EMPTY_RECORDS: ReadonlyMap<string, MokinaEntrySummaryRecord> = new Map();

export interface UseMokinaProjectSummariesOptions {
  enabled?: boolean;
  workspaceContext?: WorkspaceCollabContext | null;
}

function useSummaryMap(idsKey: string, enabled: boolean, context: WorkspaceCollabContext | null): ReadonlyMap<string, MokinaEntrySummaryRecord> {
  const contextRef = useRef<WorkspaceCollabContext | null>(context);
  contextRef.current = context;
  const storeVersion = useSyncExternalStore(subscribeToStore, getVersion, getVersion);
  useEffect(() => {
    if (!enabled || !idsKey) return undefined;
    const subscription: MokinaSummarySubscription = {
      ids: idsKey.split('\u0000'),
      contextRef,
    };
    addSubscription(subscription);
    return () => removeSubscription(subscription);
  }, [idsKey, enabled]);
  return useMemo(() => {
    if (!enabled || !idsKey) return EMPTY_RECORDS;
    const result = new Map<string, MokinaEntrySummaryRecord>();
    for (const projectId of idsKey.split('\u0000')) {
      const record = records.get(projectId);
      if (record) result.set(projectId, record);
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storeVersion 计入重建
  }, [idsKey, enabled, storeVersion]);
}

/** 一次订阅一组可见行（rail recent 的可见窗口与目录页共用）。 */
export function useMokinaProjectSummaries(
  projectIds: readonly string[],
  options?: UseMokinaProjectSummariesOptions,
): ReadonlyMap<string, MokinaEntrySummaryRecord> {
  const enabled = options?.enabled !== false;
  const idsKey = useMemo(
    () => [...projectIds].sort().join('\u0000'),
    [projectIds],
  );
  return useSummaryMap(idsKey, enabled, options?.workspaceContext ?? null);
}

/** 单项目订阅（按需/懒加载卡片的 in-view 门控）。 */
export function useMokinaProjectSummary(
  projectId: string | null | undefined,
  options?: UseMokinaProjectSummariesOptions,
): MokinaEntrySummaryRecord | undefined {
  const idsKey = useMemo(() => projectId ?? '', [projectId]);
  const map = useSummaryMap(idsKey, options?.enabled !== false && !!projectId, options?.workspaceContext ?? null);
  return projectId ? map.get(projectId) : undefined;
}

// ---------------------------------------------------------------------------
// 行摘要文案
// ---------------------------------------------------------------------------

export type MokinaArtifactLineState = 'loading' | 'failed' | 'unauthorized' | 'empty' | 'artifacts';

type MokinaEntrySummaryKey =
  | 'mokina.entrySummary.loading'
  | 'mokina.entrySummary.failed'
  | 'mokina.entrySummary.unauthorized'
  | 'mokina.entrySummary.empty'
  | 'mokina.entrySummary.legacy';

/**
 * 行摘要一行文本（Spec B1 FR-04）：正式稿 `entry · vN`，多成果附 `+k`；
 * 五态各占固定文案。读取未知不写「无成果」——loading 显示读取中。
 */
export function mokinaArtifactLineFromRecord(
  record: MokinaEntrySummaryRecord | undefined,
  translate: (key: MokinaEntrySummaryKey) => string,
): { text: string; state: MokinaArtifactLineState } | null {
  if (!record) return null;
  if (record.status === 'failed') {
    return { text: translate('mokina.entrySummary.failed'), state: 'failed' };
  }
  if (record.status === 'unauthorized') {
    return { text: translate('mokina.entrySummary.unauthorized'), state: 'unauthorized' };
  }
  if (record.status === 'loading' || !record.summary) {
    return { text: translate('mokina.entrySummary.loading'), state: 'loading' };
  }
  const summary = record.summary;
  if (summary.state === 'empty' || !summary.primary) {
    if (summary.legacy) {
      return {
        text: `${summary.legacy.entry} · ${translate('mokina.entrySummary.legacy')}`,
        state: 'empty',
      };
    }
    return { text: translate('mokina.entrySummary.empty'), state: 'empty' };
  }
  const primary = summary.primary;
  const base = `${primary.entry} · v${primary.versionNumber}`;
  return {
    text: summary.formalCount > 1 ? `${base} +${summary.formalCount - 1}` : base,
    state: 'artifacts',
  };
}
