// @vitest-environment jsdom
//
// T03 桌面 profile 持久恢复存储的渲染层 facade：镜像、CAS 重试、hydration 不覆盖本地较新副本。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenDesignHostBridge } from '@open-design/host';

const getOpenDesignHost = vi.fn<() => OpenDesignHostBridge | null>(() => null);

vi.mock('@open-design/host', async () => {
  const actual = await vi.importActual<typeof import('@open-design/host')>('@open-design/host');
  return { ...actual, getOpenDesignHost: () => getOpenDesignHost() };
});

import {
  hydrateDurableRecoveryIntoLocalStorage,
  isDurableRecoveryAvailable,
  mirrorDurableRecord,
  removeDurableRecord,
  resetDurableRecoveryForTests,
} from '../../src/runtime/persistence/mokina-recovery-store';

type FakeRecord = { recordId: string; value: string };

function makeFakeStore(initial: Record<string, FakeRecord> = {}) {
  const records = new Map(Object.entries(initial));
  return {
    records,
    delete: vi.fn(async (key: string, expectedRecordId: string) => {
      const current = records.get(key);
      if (!current || current.recordId !== expectedRecordId) return { ok: true as const, result: 'conflict' as const };
      records.delete(key);
      return { ok: true as const, result: 'deleted' as const };
    }),
    get: vi.fn(async (key: string) => {
      const current = records.get(key);
      return current
        ? { ok: true as const, found: true as const, record: current }
        : { ok: true as const, found: false as const };
    }),
    list: vi.fn(async (prefix?: string) => ({
      ok: true as const,
      keys: [...records.keys()].filter((key) => prefix == null || key.startsWith(prefix)),
    })),
    put: vi.fn(async (key: string, record: FakeRecord, expectedRecordId?: string) => {
      const current = records.get(key);
      if (expectedRecordId === undefined) {
        if (current) return { ok: true as const, result: 'conflict' as const };
      } else if (!current || current.recordId !== expectedRecordId) {
        return { ok: true as const, result: 'conflict' as const };
      }
      records.set(key, record);
      return { ok: true as const, result: 'stored' as const };
    }),
  };
}

type FakeStore = ReturnType<typeof makeFakeStore>;

function installHost(store: FakeStore | null): void {
  getOpenDesignHost.mockReturnValue(
    store == null ? null : ({ recoveryStore: store } as unknown as OpenDesignHostBridge),
  );
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('mokina durable recovery facade (web)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetDurableRecoveryForTests();
    getOpenDesignHost.mockReset();
    getOpenDesignHost.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops without the desktop host bridge", async () => {
    expect(isDurableRecoveryAvailable()).toBe(false);
    mirrorDurableRecord('od:revision:a', 'v');
    removeDurableRecord('od:revision:a');
    await expect(hydrateDurableRecoveryIntoLocalStorage()).resolves.toBe(0);
  });

  it("mirrors a new record via create-if-absent and updates it via CAS", async () => {
    const store = makeFakeStore();
    installHost(store);

    mirrorDurableRecord('od:revision:a', 'first');
    await flush();
    expect(store.records.get('od:revision:a')?.value).toBe('first');

    mirrorDurableRecord('od:revision:a', 'second');
    await flush();
    expect(store.records.get('od:revision:a')?.value).toBe('second');
  });

  it("removes the durable copy only when the record exists", async () => {
    const store = makeFakeStore({ 'od:revision:a': { recordId: 'r1', value: 'x' } });
    installHost(store);
    removeDurableRecord('od:revision:a');
    await flush();
    expect(store.records.has('od:revision:a')).toBe(false);
    expect(store.delete).toHaveBeenCalledWith('od:revision:a', 'r1');
  });

  it("hydrates missing localStorage keys but never overwrites existing ones", async () => {
    const store = makeFakeStore({
      'od:revision:missing': { recordId: 'r1', value: 'durable-only' },
      'od:revision:present': { recordId: 'r2', value: 'durable-newer' },
    });
    installHost(store);
    window.localStorage.setItem('od:revision:present', 'local-copy');

    const hydrated = await hydrateDurableRecoveryIntoLocalStorage();

    expect(hydrated).toBe(1);
    expect(window.localStorage.getItem('od:revision:missing')).toBe('durable-only');
    expect(window.localStorage.getItem('od:revision:present')).toBe('local-copy');
  });

  it("hydrates at most once per session", async () => {
    const store = makeFakeStore({ 'od:send-request:v2:x': { recordId: 'r1', value: 'v' } });
    installHost(store);
    await hydrateDurableRecoveryIntoLocalStorage();
    const callsAfterFirst = store.list.mock.calls.length;
    await hydrateDurableRecoveryIntoLocalStorage();
    expect(store.list).toHaveBeenCalledTimes(callsAfterFirst); // second call is a no-op
    expect(callsAfterFirst).toBeGreaterThan(0);
  });
});
