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
  const next = (tails.get(key) ?? Promise.resolve(true)).then(work, work).catch(() => false);
  tails.set(key, next);
  return next;
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
        const got = await store.get(key);
        if (!got.ok || !got.found || typeof got.record.value !== 'string') {
          throw new Error('桌面恢复记录损坏或读取失败，请保留数据后重试。');
        }
        identities.set(key, got.record.recordId);
        deletedKeys.delete(key);
        window.localStorage.setItem(key, got.record.value);
        hydrated++;
      }
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith(prefix) || listed.keys.includes(key) || seen.has(key)) continue;
        seen.add(key);
        const raw = window.localStorage.getItem(key);
        if (raw == null) continue;
        const current = await store.get(key);
        if (!current.ok) throw new Error('桌面恢复记录读取失败，请保留数据后重试。');
        if (current.found) {
          if (typeof current.record.value !== 'string') throw new Error('桌面恢复记录损坏，请保留数据后重试。');
          identities.set(key, current.record.recordId);
          deletedKeys.delete(key);
          window.localStorage.setItem(key, current.record.value);
          hydrated++;
          continue;
        }
        identities.set(key, current.deletedRecordId);
        if (current.deletedRecordId) {
          deletedKeys.add(key);
          window.localStorage.removeItem(key);
          continue;
        }
        if (current.legacyMigration === 'confirm') {
          legacyRecords.set(key, raw);
          continue;
        }
        if (!await mirrorDurableRecord(key, raw)) {
          throw new Error('旧恢复记录未能安全迁移，请重试。');
        }
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
