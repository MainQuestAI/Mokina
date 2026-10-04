import { getOpenDesignHost, type OpenDesignHostBridge } from '@open-design/host';

/**
 * Renderer facade over the desktop profile recovery store (T03).
 *
 * The desktop host keeps draft / send-intent / journal records under the
 * Electron userData profile, which a web origin (dev port, packaged port,
 * app-version swap) cannot address. This module:
 *  - mirrors localStorage-shaped string records into that store (fire and
 *    forget; failures never block the caller),
 *  - hydrates missing localStorage keys from the store once per session so a
 *    new origin sees the drafts and unknown send intents again.
 *
 * Rules kept from the spec:
 *  - hydration never overwrites an existing localStorage value (a stale local
 *    copy must not clobber a newer draft that happens to be durable-only),
 *  - web/dev builds without the host bridge keep working on localStorage
 *    alone; every function here no-ops.
 */

type HostRecoveryStore = NonNullable<OpenDesignHostBridge['recoveryStore']>;

export const MOKINA_DURABLE_MIRROR_PREFIXES = Object.freeze([
  'od:chat-composer',
  'od:composer-draft',
  'od:send-request',
  'od:revision',
  'od:continuation',
] as const);

function hostRecoveryStore(): HostRecoveryStore | null {
  try {
    const store = getOpenDesignHost()?.recoveryStore;
    return store ?? null;
  } catch {
    return null;
  }
}

export function isDurableRecoveryAvailable(): boolean {
  return hostRecoveryStore() != null;
}

function newRecordId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function mirrorOnce(store: HostRecoveryStore, key: string, raw: string): Promise<'stored' | 'skipped'> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await store.get(key);
    if (!current.ok) return 'skipped';
    const recordId = newRecordId();
    if (current.found) {
      const put = await store.put(key, { recordId, value: raw }, current.record.recordId);
      if (put.ok && put.result === 'stored') return 'stored';
      // Conflict → the record changed between get and put; retry once with the
      // fresh record id, then give up (the next write will mirror again).
      continue;
    }
    const created = await store.put(key, { recordId, value: raw });
    if (created.ok && created.result === 'stored') return 'stored';
    continue;
  }
  return 'skipped';
}

/**
 * Mirror one localStorage-shaped record. Fire and forget by design: the
 * caller already committed to localStorage, and a mirror failure must never
 * surface as a send-path error.
 */
export function mirrorDurableRecord(key: string | undefined, raw: string): void {
  if (!key) return;
  const store = hostRecoveryStore();
  if (!store) return;
  void mirrorOnce(store, key, raw).catch(() => undefined);
}

/** Remove the durable copy; a missing/conflicting record is already gone. */
export function removeDurableRecord(key: string | undefined): void {
  if (!key) return;
  const store = hostRecoveryStore();
  if (!store) return;
  void (async () => {
    const current = await store.get(key);
    if (!current.ok || !current.found) return;
    await store.delete(key, current.record.recordId);
  })().catch(() => undefined);
}

let hydrationPromise: Promise<number> | null = null;

/**
 * Restore durable records that localStorage lost (new origin / cleared
 * profile) without touching keys that are already present. Returns the number
 * of hydrated keys; runs at most once per module lifetime.
 */
export function hydrateDurableRecoveryIntoLocalStorage(): Promise<number> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const store = hostRecoveryStore();
    if (!store || typeof window === 'undefined') return 0;
    let hydrated = 0;
    for (const prefix of MOKINA_DURABLE_MIRROR_PREFIXES) {
      const listed = await store.list(prefix);
      if (!listed.ok) continue;
      for (const key of listed.keys) {
        try {
          if (window.localStorage.getItem(key) != null) continue;
        } catch {
          continue;
        }
        const got = await store.get(key);
        if (!got.ok || !got.found) continue;
        const value = got.record.value;
        if (typeof value !== 'string') continue;
        try {
          window.localStorage.setItem(key, value);
          hydrated += 1;
        } catch {
          // Quota/private mode: keep going, the durable copy stays authoritative.
        }
      }
    }
    return hydrated;
  })();
  return hydrationPromise;
}

export function resetDurableRecoveryForTests(): void {
  hydrationPromise = null;
}
