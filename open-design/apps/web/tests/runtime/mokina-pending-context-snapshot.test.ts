// @vitest-environment jsdom
//
// T07：资料快照的待发送状态（写入/读取/清理/挂载到发送 context）。

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearPendingMokinaSnapshot,
  pendingMokinaSnapshotKey,
  readPendingMokinaSnapshot,
  withPendingMokinaSnapshot,
  writePendingMokinaSnapshot,
} from '../../src/runtime/mokina/pending-context-snapshot';

describe('pending mokina context snapshot', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('round-trips a frozen snapshot record per project', async () => {
    await writePendingMokinaSnapshot({
      snapshotId: 'snap-1',
      projectId: 'p1',
      itemCount: 2,
      charCount: 1234,
      frozenAt: '2026-10-05T00:00:00.000Z',
      itemLabels: ['brief.md · 2 个片段'],
      excluded: [{ displayName: 'scan.pdf', reason: '无法读取' }],
    });
    const read = readPendingMokinaSnapshot('p1');
    expect(read).toMatchObject({ snapshotId: 'snap-1', itemCount: 2, charCount: 1234 });
    expect(readPendingMokinaSnapshot('p2')).toBeNull();
    await clearPendingMokinaSnapshot('p1');
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
  });

  it('rejects malformed or foreign records instead of trusting them', () => {
    window.localStorage.setItem(pendingMokinaSnapshotKey('p1'), '{ not json');
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
    window.localStorage.setItem(pendingMokinaSnapshotKey('p1'), JSON.stringify({
      snapshotId: 'snap-1',
      projectId: 'other-project',
      itemCount: 1,
    }));
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
    expect(readPendingMokinaSnapshot(null)).toBeNull();
  });

  it('attaches the snapshot id to a send context only when one is pending', async () => {
    const empty = withPendingMokinaSnapshot({}, 'p1');
    expect(empty).toEqual({});

    await writePendingMokinaSnapshot({
      snapshotId: 'snap-2',
      projectId: 'p1',
      itemCount: 1,
      charCount: 10,
      frozenAt: '',
      itemLabels: [],
      excluded: [],
    });
    expect(withPendingMokinaSnapshot({ skillIds: ['s1'] }, 'p1')).toEqual({
      skillIds: ['s1'],
      mokinaSnapshotId: 'snap-2',
    });
    expect(withPendingMokinaSnapshot({ skillIds: ['s1'] }, 'p2')).toEqual({ skillIds: ['s1'] });
  });
});

describe('clearPendingMokinaSnapshotIfCurrent (N03 review M1/M2)', () => {
  it('clears only while the pending record is still the referenced snapshot', async () => {
    const { writePendingMokinaSnapshot, readPendingMokinaSnapshot, clearPendingMokinaSnapshotIfCurrent } = await import('../../src/runtime/mokina/pending-context-snapshot');
    await writePendingMokinaSnapshot({
      snapshotId: 'snap-current', projectId: 'p1', itemCount: 1, charCount: 1,
      frozenAt: 'now', itemLabels: [], excluded: [],
    });
    // Same id -> consumed.
    expect(await clearPendingMokinaSnapshotIfCurrent('p1', 'snap-current')).toBe(true);
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
  });

  it('keeps a newer freeze made after the send was queued', async () => {
    const { writePendingMokinaSnapshot, readPendingMokinaSnapshot, clearPendingMokinaSnapshotIfCurrent } = await import('../../src/runtime/mokina/pending-context-snapshot');
    await writePendingMokinaSnapshot({
      snapshotId: 'snap-newer', projectId: 'p1', itemCount: 1, charCount: 1,
      frozenAt: 'now', itemLabels: [], excluded: [],
    });
    // A send referencing the OLD snapshot must not clear the NEW binding.
    expect(await clearPendingMokinaSnapshotIfCurrent('p1', 'snap-old')).toBe(false);
    expect(readPendingMokinaSnapshot('p1')?.snapshotId).toBe('snap-newer');
  });

  it('no-ops when nothing is pending', async () => {
    const { clearPendingMokinaSnapshotIfCurrent } = await import('../../src/runtime/mokina/pending-context-snapshot');
    expect(await clearPendingMokinaSnapshotIfCurrent('p-missing', 'snap-x')).toBe(false);
    expect(await clearPendingMokinaSnapshotIfCurrent('p-missing', null)).toBe(false);
  });
});
