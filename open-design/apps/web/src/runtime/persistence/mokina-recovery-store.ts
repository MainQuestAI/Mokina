import { getOpenDesignHost, type OpenDesignHostBridge } from '@open-design/host';

type HostRecoveryStore = NonNullable<OpenDesignHostBridge['recoveryStore']>;
export const MOKINA_DURABLE_MIRROR_PREFIXES = Object.freeze([
  'od:chat-composer', 'od:composer-draft', 'od:send-request',
  'od:revision', 'od:continuation', 'mokina:revision:',
  'mokina:context-snapshot:', 'mokina:recovery-import:',
] as const);
const tails = new Map<string, Promise<boolean>>();
const identities = new Map<string, string | undefined>();
let hydrationPromise: Promise<number> | null = null;
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
      identities.set(key, current.found ? current.record.recordId : undefined);
    }
    const recordId = crypto.randomUUID();
    const put = await store.put(key, { recordId, value: raw }, identities.get(key));
    if (!put.ok || put.result !== 'stored') return false;
    identities.set(key, recordId);
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
      identities.set(key, current.found ? current.record.recordId : undefined);
    }
    const expected = identities.get(key);
    if (!expected) return true;
    const deleted = await store.delete(key, expected);
    if (!deleted.ok || deleted.result !== 'deleted') return false;
    identities.set(key, undefined);
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
    for (const prefix of MOKINA_DURABLE_MIRROR_PREFIXES) {
      const listed = await store.list(prefix);
      if (!listed.ok) throw new Error('桌面恢复记录暂不可读，请重试。');
      for (const key of listed.keys) {
        const got = await store.get(key);
        if (!got.ok || !got.found || typeof got.record.value !== 'string') {
          throw new Error('桌面恢复记录损坏或读取失败，请保留数据后重试。');
        }
        identities.set(key, got.record.recordId);
        window.localStorage.setItem(key, got.record.value);
        hydrated++;
      }
      for (const key of Object.keys(window.localStorage)) {
        if (!key.startsWith(prefix) || listed.keys.includes(key)) continue;
        const raw = window.localStorage.getItem(key);
        if (raw != null && !await mirrorDurableRecord(key, raw)) {
          throw new Error('旧恢复记录未能安全迁移，请重试。');
        }
      }
    }
    return hydrated;
  })().catch(error => { hydrationPromise = null; throw error; });
  return hydrationPromise;
}
export function resetDurableRecoveryForTests(): void {
  hydrationPromise = null; tails.clear(); identities.clear();
}
