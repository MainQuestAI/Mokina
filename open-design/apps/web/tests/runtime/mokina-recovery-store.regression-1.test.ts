// @vitest-environment jsdom
// P2/F04/T11: a late cleanup must not erase the successor used by the next send.
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { OpenDesignHostBridge } from '@open-design/host';

const { host } = vi.hoisted(() => ({ host: vi.fn() }));
vi.mock('@open-design/host', async () => ({
  ...await vi.importActual<typeof import('@open-design/host')>('@open-design/host'), getOpenDesignHost: host,
}));
import { mutateDurableRecord, hydrateDurableRecoveryIntoLocalStorage, resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
import { pendingMokinaSnapshotKey, withPendingMokinaSnapshot, clearPendingMokinaSnapshotIfCurrent, settleSubmittedMokinaSnapshot } from '../../src/runtime/mokina/pending-context-snapshot';

type Row = { recordId: string; value: string };
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function storeFixture() {
  const rows = new Map<string, Row>();
  const store = {
    get: vi.fn(async (key: string) => {
      const record = rows.get(key);
      return record ? { ok: true as const, found: true as const, record: { ...record } }
        : { ok: true as const, found: false as const };
    }),
    list: vi.fn(async (prefix: string) => ({ ok: true as const, keys: [...rows.keys()].filter(key => key.startsWith(prefix)) })),
    put: vi.fn(async (key: string, row: Row, expected?: string) => {
      if (rows.get(key)?.recordId !== expected) return { ok: true as const, result: 'conflict' as const };
      rows.set(key, row); return { ok: true as const, result: 'stored' as const };
    }),
    delete: vi.fn(async (key: string, expected: string) => {
      if (rows.get(key)?.recordId !== expected) return { ok: true as const, result: 'conflict' as const };
      rows.delete(key); return { ok: true as const, result: 'deleted' as const };
    }),
  };
  host.mockReturnValue({ recoveryStore: store } as unknown as OpenDesignHostBridge);
  return { rows, store };
}
const scope = { conversationId: 'conversation', workspaceKey: 'workspace' };
const key = pendingMokinaSnapshotKey('project', scope);
const binding = (generation: string) => JSON.stringify({ schemaVersion: 2, projectId: 'project', ...scope,
  snapshotId: `snapshot-${generation}`, generation, itemCount: 1, charCount: 1, frozenAt: '', itemLabels: [], excluded: [] });
function assertSuccessor(rows: Map<string, Row>) {
  expect(rows.get(key)?.value).toBe(binding('B'));
  expect(localStorage.getItem(key)).toBe(binding('B'));
  expect(withPendingMokinaSnapshot({}, 'project', scope)).toEqual({ mokinaSnapshotId: 'snapshot-B', mokinaSnapshotGeneration: 'B' });
}
beforeEach(() => { resetDurableRecoveryForTests(); localStorage.clear(); host.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('late recovery cache publication', () => {
  it.each(['no-op', 'rejected', 'conditional-consume'] as const)('preserves B when a stale %s read arrives last', async branch => {
    const { rows, store } = storeFixture();
    // A has already been consumed; its old read sees no record. B is published
    // while that IPC response is still in flight (including legacy publishers).
    const entered = deferred(), release = deferred();
    store.get.mockImplementationOnce(async () => { entered.resolve(); await release.promise; return { ok: true, found: false }; });
    const task = branch === 'no-op' ? settleSubmittedMokinaSnapshot('project', 'snapshot-A', scope, 'A')
      : branch === 'rejected' ? clearPendingMokinaSnapshotIfCurrent('project', 'snapshot-A', scope, 'A')
      : mutateDurableRecord(key, raw => raw === binding('A') ? null : undefined);
    await entered.promise;
    rows.set(key, { recordId: 'B', value: binding('B') }); localStorage.setItem(key, binding('B'));
    release.resolve(); await task;
    assertSuccessor(rows); expect(store.put).not.toHaveBeenCalled(); expect(store.delete).not.toHaveBeenCalled();
  });

  it('does not republish a stale read-back after a successor has reached the cache', async () => {
    const { rows, store } = storeFixture();
    const entered = deferred(), release = deferred();
    const get = store.get.getMockImplementation()!;
    store.get.mockImplementationOnce(get).mockImplementationOnce(async candidate => {
      const captured = await get(candidate); entered.resolve(); await release.promise; return captured;
    });
    const task = mutateDurableRecord(key, () => binding('A'));
    await entered.promise;
    rows.set(key, { recordId: 'B', value: binding('B') }); localStorage.setItem(key, binding('B'));
    release.resolve(); await task; assertSuccessor(rows);
  });

  it('serializes independent renderer module queues with the same origin lock', async () => {
    const { rows, store } = storeFixture();
    const entered = deferred(), release = deferred();
    const get = store.get.getMockImplementation()!;
    store.get.mockImplementationOnce(async candidate => { const result = await get(candidate); entered.resolve(); await release.promise; return result; });
    const first = mutateDurableRecord(key, raw => raw);
    await entered.promise;
    vi.resetModules();
    const secondRenderer = await import('../../src/runtime/persistence/mokina-recovery-store');
    const second = secondRenderer.mutateDurableRecord(key, () => binding('B'));
    // Allow module B's microtasks to reach the lock; no elapsed-time guesses.
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    const readsBeforeRelease = store.get.mock.calls.length;
    release.resolve(); await Promise.all([first, second]); assertSuccessor(rows);
    secondRenderer.resetDurableRecoveryForTests();
    expect(readsBeforeRelease).toBe(1);
  });

  it.each([true, false])('fails closed without a shared lock (desktop=%s)', async desktop => {
    const { store } = storeFixture(); if (!desktop) host.mockReturnValue(null);
    const original = navigator.locks;
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    try {
      localStorage.setItem(key, binding('B'));
      expect(await mutateDurableRecord(key, () => binding('A'))).toBe(false);
      expect(localStorage.getItem(key)).toBe(binding('B')); expect(store.get).not.toHaveBeenCalled();
    } finally { Object.defineProperty(navigator, 'locks', { configurable: true, value: original }); }
  });

  it('recovers durable B at restart after cache publication fails', async () => {
    const { rows } = storeFixture();
    const publish = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('cache unavailable'); });
    expect(await mutateDurableRecord(key, () => binding('B'))).toBe(false);
    expect(rows.get(key)?.value).toBe(binding('B')); expect(localStorage.getItem(key)).toBeNull();
    publish.mockRestore(); resetDurableRecoveryForTests();
    await hydrateDurableRecoveryIntoLocalStorage(); assertSuccessor(rows);
  });

  it('hydration cannot overwrite a successor published during an old read', async () => {
    const { rows, store } = storeFixture(); rows.set(key, { recordId: 'A', value: binding('A') });
    const entered = deferred(), release = deferred(); const get = store.get.getMockImplementation()!;
    store.get.mockImplementationOnce(async candidate => { const captured = await get(candidate); entered.resolve(); await release.promise; return captured; });
    const task = hydrateDurableRecoveryIntoLocalStorage(); await entered.promise;
    rows.set(key, { recordId: 'B', value: binding('B') }); localStorage.setItem(key, binding('B'));
    release.resolve(); await task.catch(() => undefined); assertSuccessor(rows);
  });
});
