import { getOpenDesignHost, type OpenDesignHostBridge } from '@open-design/host';

type HostRecoveryStore = NonNullable<OpenDesignHostBridge['recoveryStore']>;
export const MOKINA_DURABLE_MIRROR_PREFIXES = Object.freeze([
  'od:chat-composer', 'od:composer-draft', 'od:send-request',
  'od:revision', 'od:continuation', 'mokina:revision:',
  'mokina:context-snapshot:', 'mokina:recovery-import:',
] as const);
const tails = new Map<string, Promise<boolean>>();
const identities = new Map<string, string | undefined>();
const deletedKeys = new Set<string>();
const legacyRecords = new Map<string, string>();
let hydrationPromise: Promise<number> | null = null;
export class LegacyRecoveryConfirmationRequired extends Error {
  constructor(public readonly count: number) {
    super(`发现 ${count} 条待确认旧记录，可能包含曾经删除的草稿。请选择恢复，或保留备份后继续。`);
  }
}
function hostRecoveryStore(): HostRecoveryStore | null {
  try { return getOpenDesignHost()?.recoveryStore ?? null; } catch { return null; }
}
export function isDurableRecoveryAvailable(): boolean { return hostRecoveryStore() != null; }
function enqueue(key: string, work: () => Promise<boolean>): Promise<boolean> {
  // Module queues cannot coordinate independent renderer windows. Keep the
  // authority read, conditional mutation and cache publication under one lock.
  // CAS remains the final guard across origins / non-renderer store writers.
  const coordinated = async (): Promise<boolean> => navigator.locks
    ? await navigator.locks.request(`mokina-recovery:${key}`, work)
    : false;
  const next = (tails.get(key) ?? Promise.resolve(true)).then(coordinated, coordinated).catch(() => false);
  tails.set(key, next);
  return next;
}
function publishCache(key: string, captured: string | null, raw: string | null): boolean {
  // A legacy publisher or an already in-flight hydration may not hold our lock.
  // Never publish an old IPC observation over a newer cache generation.
  if (window.localStorage.getItem(key) !== captured) return false;
  if (raw === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, raw);
  return true;
}
/** Read, validate, CAS and publish one business mutation without changing its expected identity. */
export function mutateDurableRecord(key: string, update: (raw: string | null) => string | null | undefined): Promise<boolean> {
  return enqueue(key, async () => {
    const store = hostRecoveryStore();
    const mutate = async () => {
      const capturedCache = window.localStorage.getItem(key);
      const current = store ? await store.get(key) : null;
      if (current && !current.ok) return false;
      const raw = current?.ok && current.found ? current.record.value as string : store ? null : window.localStorage.getItem(key);
      const next = update(raw);
      if (next === undefined || next === raw) {
        const latest = store ? await store.get(key) : null;
        if (latest && !latest.ok) return false;
        const latestRaw = latest?.ok ? latest.found ? latest.record.value as string : null : raw;
        const published = publishCache(key, capturedCache, latestRaw);
        return next !== undefined && published;
      }
      if (store && current?.ok) {
        const expected = current.found ? current.record.recordId : current.deletedRecordId;
        if (next === null) {
          if (!current.found) return false;
          const deleted = await store.delete(key, current.record.recordId);
          if (!deleted.ok || deleted.result !== 'deleted') return false;
          deletedKeys.add(key);
        } else {
          const recordId = crypto.randomUUID();
          const put = await store.put(key, { recordId, value: next }, expected);
          if (!put.ok || put.result !== 'stored') return false;
          identities.set(key, recordId); deletedKeys.delete(key);
        }
        // Another window may have advanced the record immediately after CAS.
        // Publish the authoritative generation, never our superseded value.
        const readBack = await store.get(key);
        if (!readBack.ok) return false;
        if (!publishCache(key, capturedCache, readBack.found ? readBack.record.value as string : null)) return false;
        identities.set(key, readBack.found ? readBack.record.recordId : readBack.deletedRecordId);
        if (readBack.found) {
          deletedKeys.delete(key);
        } else {
          deletedKeys.add(key);
        }
        return true;
      }
      // Publication is part of this queue, never a delayed callback outside it.
      return publishCache(key, capturedCache, next);
    };
    return mutate();
  });
}
/** Serialize the whole read/CAS/write. A conflict never authorizes an overwrite. */
export function mirrorDurableRecord(key: string | undefined, raw: string): Promise<boolean> {
  if (!key) return Promise.resolve(false);
  const store = hostRecoveryStore();
  if (!store) return Promise.resolve(true);
  return enqueue(key, async () => {
    if (!identities.has(key)) {
      const current = await store.get(key);
      if (!current.ok) return false;
      identities.set(key, current.found ? current.record.recordId : current.deletedRecordId);
    }
    const recordId = crypto.randomUUID();
    const put = await store.put(key, { recordId, value: raw }, identities.get(key));
    if (!put.ok || put.result !== 'stored') return false;
    identities.set(key, recordId);
    deletedKeys.delete(key);
    return true;
  });
}
export function removeDurableRecord(key: string | undefined): Promise<boolean> {
  if (!key) return Promise.resolve(false);
  const store = hostRecoveryStore();
  if (!store) return Promise.resolve(true);
  return enqueue(key, async () => {
    if (!identities.has(key)) {
      const current = await store.get(key);
      if (!current.ok) return false;
      identities.set(key, current.found ? current.record.recordId : current.deletedRecordId);
      if (!current.found && current.deletedRecordId) deletedKeys.add(key);
    }
    if (deletedKeys.has(key)) return true;
    const expected = identities.get(key);
    if (!expected) return true;
    const deleted = await store.delete(key, expected);
    if (!deleted.ok || deleted.result !== 'deleted') return false;
    const current = await store.get(key);
    if (!current.ok || current.found) return false;
    identities.set(key, current.deletedRecordId);
    deletedKeys.add(key);
    return true;
  });
}
/** Await the latest queued mutation, including failures, before a critical side effect. */
export function flushDurableRecord(key: string): Promise<boolean> {
  return tails.get(key) ?? Promise.resolve(true);
}
/** Desktop records are authoritative; migrate local-only legacy records before mounting callers. */
export function hydrateDurableRecoveryIntoLocalStorage(): Promise<number> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const store = hostRecoveryStore();
    if (!store || typeof window === 'undefined') return 0;
    let hydrated = 0;
    legacyRecords.clear();
    const seen = new Set<string>();
    for (const prefix of MOKINA_DURABLE_MIRROR_PREFIXES) {
      const listed = await store.list(prefix);
      if (!listed.ok) throw new Error('桌面恢复记录暂不可读，请重试。');
      for (const key of listed.keys) {
        if (!await enqueue(key, async () => {
          const captured = window.localStorage.getItem(key);
          const got = await store.get(key);
          if (!got.ok || (got.found && typeof got.record.value !== 'string')) return false;
          if (!publishCache(key, captured, got.found ? got.record.value as string : null)) return false;
          identities.set(key, got.found ? got.record.recordId : got.deletedRecordId);
          if (got.found) { deletedKeys.delete(key); hydrated++; }
          else deletedKeys.add(key);
          return true;
        })) throw new Error('桌面恢复记录损坏、发生并发更新或读取失败，请保留数据后重试。');
      }
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith(prefix) || listed.keys.includes(key) || seen.has(key)) continue;
        seen.add(key);
        if (!await enqueue(key, async () => {
          const raw = window.localStorage.getItem(key);
          if (raw == null) return true;
          const current = await store.get(key);
          if (!current.ok) return false;
          if (current.found) {
            if (typeof current.record.value !== 'string' || !publishCache(key, raw, current.record.value)) return false;
            identities.set(key, current.record.recordId); deletedKeys.delete(key); hydrated++;
            return true;
          }
          if (window.localStorage.getItem(key) !== raw) return false;
          identities.set(key, current.deletedRecordId);
          if (current.deletedRecordId) {
            deletedKeys.add(key);
            return publishCache(key, raw, null);
          }
          if (current.legacyMigration === 'confirm') { legacyRecords.set(key, raw); return true; }
          // Already inside the shared key lock; do not recursively enqueue.
          const recordId = crypto.randomUUID();
          const put = await store.put(key, { recordId, value: raw }, current.deletedRecordId);
          if (!put.ok || put.result !== 'stored') return false;
          identities.set(key, recordId); deletedKeys.delete(key);
          return true;
        })) throw new Error('旧恢复记录未能安全迁移或发生并发更新，请保留数据后重试。');
      }
    }
    if (legacyRecords.size) throw new LegacyRecoveryConfirmationRequired(legacyRecords.size);
    return hydrated;
  })().catch(error => { hydrationPromise = null; throw error; });
  return hydrationPromise;
}
/** Only an explicit choice may bring ambiguous pre-v2 records back into the active namespace. */
export async function resolveLegacyRecoveryRecords(choice: 'restore' | 'keep-backup'): Promise<number> {
  for (const [key, raw] of legacyRecords) {
    if (choice === 'restore') {
      if (!await mirrorDurableRecord(key, raw)) throw new Error('旧记录恢复发生冲突，请保留数据后重试。');
    } else {
      window.localStorage.setItem(`mokina:legacy-recovery:${encodeURIComponent(key)}`, raw);
      window.localStorage.removeItem(key);
    }
  }
  legacyRecords.clear();
  hydrationPromise = null;
  return hydrateDurableRecoveryIntoLocalStorage();
}
export function resetDurableRecoveryForTests(): void {
  hydrationPromise = null; tails.clear(); identities.clear(); deletedKeys.clear(); legacyRecords.clear();
}
