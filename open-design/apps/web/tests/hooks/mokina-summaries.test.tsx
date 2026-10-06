// @vitest-environment jsdom
import { StrictMode } from 'react';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMokinaProjectSummary, resetMokinaEntrySummaryStore, evictMokinaEntrySummary, enqueueMokinaMetadataRead, mokinaArtifactLineFromRecord, type MokinaEntrySummaryRecord } from '../../src/hooks/useMokinaProjectSummaries';
import { resolveMokinaProjectEntry, type MokinaProjectSummary } from '../../src/artifacts/mokina-project-entry';
import { en } from '../../src/i18n/locales/en';

const mocks = vi.hoisted(() => ({ files: vi.fn(), versions: vi.fn() }));
vi.mock('../../src/providers/registry', () => ({ fetchProjectFiles: mocks.files, fetchProjectFileVersions: mocks.versions }));
const current = (id = 'v1') => ({ id, version: 1, createdAt: 1, current: true, candidate: false });
const files = (count: number) => Array.from({ length: count }, (_, i) => ({ name: `${i}.html`, kind: 'html' }));
beforeEach(() => { resetMokinaEntrySummaryStore(); mocks.files.mockReset(); mocks.versions.mockReset(); });
afterEach(() => { cleanup(); resetMokinaEntrySummaryStore(); });

it('mixed version failure never decides that the one readable entry is the only formal', async () => {
  mocks.files.mockResolvedValue(files(2));
  mocks.versions.mockImplementation(async (_id, name) => name === '0.html' ? { versions: [current()] } : null);
  const { result } = renderHook(() => useMokinaProjectSummary('p1'));
  await waitFor(() => expect(result.current?.status).not.toBe('loading'));
  const record = result.current!;
  expect(resolveMokinaProjectEntry({ projectId: 'p1', entries: record.entries, entriesReadState: record.status })).toMatchObject({ kind: 'unresolvable' });
});

it('invalidation during a pending versions read forces a new read and old v1 cannot win', async () => {
  mocks.files.mockResolvedValue(files(1));
  let release!: (value: unknown) => void;
  mocks.versions.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValue({ versions: [current('v2')] });
  const { result } = renderHook(() => useMokinaProjectSummary('p1'));
  await waitFor(() => expect(mocks.versions).toHaveBeenCalledTimes(1));
  act(() => evictMokinaEntrySummary('p1'));
  await act(async () => { release({ versions: [current('v1')] }); });
  await waitFor(() => expect(result.current?.summary?.primary?.versionId).toBe('v2'));
});

for (const count of [0, 1, 2, 9, 12, 120]) it(`foreground resolves all ${count} entries; lightweight rows never infer uniqueness from truncation`, async () => {
  mocks.files.mockResolvedValue(files(count)); mocks.versions.mockResolvedValue({ versions: [current()] });
  const light = renderHook(() => useMokinaProjectSummary('p1'));
  await waitFor(() => expect(light.result.current?.status).not.toBe('loading'));
  expect(light.result.current?.entries).toHaveLength(Math.min(8, count));
  expect(light.result.current?.completeness).toBe(count > 8 ? 'truncated' : 'complete');
  const full = renderHook(() => useMokinaProjectSummary('p1', { complete: true }));
  await waitFor(() => expect(full.result.current?.completeness).toBe('complete'));
  expect(full.result.current?.summary?.formalCount).toBe(count);
  const record = full.result.current!;
  expect(resolveMokinaProjectEntry({ projectId: 'p1', entries: record.entries, entriesReadState: record.status }).kind)
    .toBe(count === 0 ? 'workspace' : count === 1 ? 'open' : 'chooser');
});
it('all failures retry, secondary entries update, and focus revalidates the subscribed project', async () => {
  mocks.files.mockResolvedValue(files(2)); mocks.versions.mockRejectedValue(new Error('offline'));
  const { result } = renderHook(() => useMokinaProjectSummary('p1', { complete: true }));
  await waitFor(() => expect(result.current?.completeness).toBe('failed'));
  mocks.versions.mockImplementation(async (_id, name) => ({ versions: [{ ...current(name === '0.html' ? 'primary' : 'secondary-v1'), createdAt: name === '0.html' ? 10 : 1 }] }));
  act(() => evictMokinaEntrySummary('p1'));
  await waitFor(() => expect(result.current?.completeness).toBe('complete'));
  mocks.versions.mockImplementation(async (_id, name) => ({ versions: [{ ...current(name === '0.html' ? 'primary' : 'secondary-v2'), createdAt: name === '0.html' ? 10 : 1 }] }));
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current?.entries[1]?.versions?.[0]?.id).toBe('secondary-v2'));
});
it('files and versions share two slots and cancellation releases them under StrictMode', async () => {
  let active = 0; let peak = 0; const releases: Array<() => void> = [];
  const delayed = (value: unknown, signal: AbortSignal) => new Promise(resolve => {
    active += 1; peak = Math.max(peak, active);
    let done = false; const finish = () => { if (done) return; done = true; active -= 1; resolve(value); };
    signal.addEventListener('abort', finish, { once: true }); releases.push(finish);
  });
  mocks.files.mockImplementation((_id, options) => delayed(files(12), options.signal));
  mocks.versions.mockImplementation((_id, _name, _context, options) => delayed({ versions: [current()] }, options.signal));
  const first = renderHook(() => useMokinaProjectSummary('A', { complete: true }), { wrapper: StrictMode });
  const second = renderHook(() => useMokinaProjectSummary('B', { complete: true }));
  await waitFor(() => expect(active).toBe(2));
  await act(async () => { releases.splice(0).forEach(release => release()); });
  await waitFor(() => expect(mocks.versions).toHaveBeenCalled());
  first.unmount(); second.unmount();
  expect(active).toBe(0); expect(peak).toBeLessThanOrEqual(2);
  mocks.files.mockResolvedValue(files(0));
  const reopened = renderHook(() => useMokinaProjectSummary('A'));
  await waitFor(() => expect(reopened.result.current?.completeness).toBe('complete'));
});

it('late metadata from the original workspace cannot overwrite the newly selected identity', async () => {
  const context = (workspaceId: string) => ({ workspaceId, workspaceType: 'team', workspaceMemberId: 'member', role: 'owner', lifecycleState: 'active', memberStatus: 'active', permissions: {} }) as WorkspaceCollabContext;
  mocks.files.mockResolvedValue(files(1));
  let release!: (value: unknown) => void;
  mocks.versions.mockImplementation((_p, _name, ctx) => ctx.workspaceId === 'A'
    ? new Promise(resolve => { release = resolve; }) : Promise.resolve({ versions: [current('workspace-B')] }));
  const view = renderHook(({ workspaceContext }) => useMokinaProjectSummary('same-project', { complete: true, workspaceContext }), { initialProps: { workspaceContext: context('A') } });
  await waitFor(() => expect(mocks.versions).toHaveBeenCalledTimes(1));
  view.rerender({ workspaceContext: context('B') });
  await waitFor(() => expect(view.result.current?.summary?.primary?.versionId).toBe('workspace-B'));
  await act(async () => { release({ versions: [current('workspace-A')] }); });
  expect(view.result.current?.summary?.primary?.versionId).toBe('workspace-B');
  expect(mocks.versions.mock.calls.at(-1)?.[2]?.workspaceId).toBe('B');
  expect(mocks.versions.mock.calls.at(-1)?.[3]?.readOnly).toBe(true);
});
it('reset settles queued and active metadata promises, aborts physical reads and frees every slot', async () => {
  const external = new AbortController(); const signals: AbortSignal[] = [];
  const pending = [0, 1, 2].map(() => enqueueMokinaMetadataRead(signal => {
    signals.push(signal); return new Promise<never>(() => {});
  }, external.signal, false).catch(error => error.name));
  await waitFor(() => expect(signals).toHaveLength(2));
  act(() => resetMokinaEntrySummaryStore());
  expect(await Promise.all(pending)).toEqual(['AbortError', 'AbortError', 'AbortError']);
  expect(signals).toHaveLength(2); // A cancelled queued task never dispatches.
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(await enqueueMokinaMetadataRead(async () => 'fresh', external.signal, true)).toBe('fresh');
});

const translate = (key: string, vars?: Record<string, string | number>): string => {
  const raw = en[key as keyof typeof en] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    return value == null ? `{${name}}` : String(value);
  });
};
const summaryRecord = (summary: MokinaProjectSummary): MokinaEntrySummaryRecord => ({
  status: 'ok', completeness: 'complete', summary, entries: [],
});

it('artifact row appends a non-interruptive hint while candidates await adoption', () => {
  const line = mokinaArtifactLineFromRecord(summaryRecord({
    state: 'artifacts', formalCount: 2,
    primary: { entry: 'index.html', versionId: 'v2', versionNumber: 2, adoptedAt: null, createdAt: 2, adoptionOperationId: null },
    candidateCount: 3, legacy: null,
  }), translate);
  expect(line).toEqual({ text: 'index.html · v2 +1 · 3 candidate(s) awaiting adoption', state: 'artifacts' });
});

it('artifact row omits the candidate hint when nothing awaits adoption', () => {
  const line = mokinaArtifactLineFromRecord(summaryRecord({
    state: 'artifacts', formalCount: 1,
    primary: { entry: 'index.html', versionId: 'v1', versionNumber: 1, adoptedAt: null, createdAt: 1, adoptionOperationId: null },
    candidateCount: 0, legacy: null,
  }), translate);
  expect(line).toEqual({ text: 'index.html · v1', state: 'artifacts' });
});

it('empty row still surfaces awaiting candidates without claiming a formal artifact', () => {
  const line = mokinaArtifactLineFromRecord(summaryRecord({
    state: 'empty', formalCount: 0, primary: null, candidateCount: 2, legacy: null,
  }), translate);
  expect(line).toEqual({ text: 'No formal artifacts yet · 2 candidate(s) awaiting adoption', state: 'empty' });
});
