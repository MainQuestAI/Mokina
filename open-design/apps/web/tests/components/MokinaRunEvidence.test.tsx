// @vitest-environment jsdom
//
// N03 运行依据：一轮带快照的 run 结束后，用户能核对实际注入了什么。
// 没有回执的 run 保持零噪音（不渲染任何内容）。

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MokinaContextSnapshot, WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceProjectHeaders } from '../../src/collab/workspace-identity';

// The web vitest config opts the Mokina edition out globally; this suite
// exercises Mokina-only UI, so pin the edition module on directly.
const fetchChatRunStatus = vi.fn();

vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));
vi.mock('../../src/providers/daemon', () => ({
  fetchChatRunStatus: (...args: unknown[]) => fetchChatRunStatus(...args),
}));

import { MokinaRunEvidence } from '../../src/components/mokina/MokinaRunEvidence';

const PROJECT_ID = 'project-evidence';
const RUN_ID = 'run-evidence-1';

const SNAPSHOT: MokinaContextSnapshot = {
  schemaVersion: 1,
  snapshotId: 'snap-1',
  projectId: PROJECT_ID,
  createdAt: '2026-10-06T00:00:00.000Z',
  parserVersion: 'test',
  selectionFingerprint: 'fp',
  items: [
    {
      itemId: 'S1',
      displayName: 'brief.md · 2 个片段',
      kind: 'material-excerpt',
      sourceRef: { kind: 'project-file', projectId: PROJECT_ID, fileName: 'brief.md' },
      sourceDigest: 'd1',
      limitations: ['部分页码未提取'],
      locators: ['brief.md#1'],
      text: '正文',
      textDigest: 't1',
    },
    {
      itemId: 'A1',
      displayName: 'logo.png',
      kind: 'asset',
      sourceRef: { kind: 'project-file', projectId: PROJECT_ID, fileName: 'logo.png' },
      sourceDigest: 'd2',
      limitations: [],
      blobId: 'd2',
      mimeType: 'image/png',
      byteLength: 70,
      role: 'logo',
      usageNote: '页头',
    },
  ],
  excluded: [{ displayName: 'big.pdf', reason: 'unreadable', explanation: '损坏文件不可读取' }],
  fingerprint: 'fp',
};

afterEach(() => {
  cleanup();
  fetchChatRunStatus.mockReset();
  vi.unstubAllGlobals();
});

describe('MokinaRunEvidence', () => {
  const receipt = (runId: string, snapshotId: string) => ({ id: runId, status: 'finished', mokinaContext: { runId, snapshotId, fingerprint: 'fp', includedItemIds: ['S1'], itemDelivery: [], status: 'submitted' } });
  const workspace = (id: string) => ({ workspaceId: id, workspaceType: 'team', workspaceMemberId: `${id}-member`, role: 'owner', lifecycleState: 'active', memberStatus: 'active', permissions: { canShareProjects: true, canWriteSyncedFiles: true } }) as WorkspaceCollabContext;
  it('T32 scopes both queries and rejects a late snapshot from the previous workspace', async () => {
    fetchChatRunStatus.mockImplementation(async (id: string) => receipt(id, id === 'run-a' ? 'snap-a' : 'snap-b'));
    let resolveOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>(resolve => { resolveOld = resolve; });
    const network = vi.fn((url: string) => url.endsWith('snap-a') ? oldResponse : Promise.resolve(new Response(JSON.stringify({ snapshot: { ...SNAPSHOT, snapshotId: 'snap-b', items: [{ ...SNAPSHOT.items[0], text: 'B fixed body' }] } }))));
    vi.stubGlobal('fetch', network);
    const a = workspace('a'), b = workspace('b');
    const view = render(<MokinaRunEvidence projectId={PROJECT_ID} runId="run-a" runActive={false} workspaceContext={a} />);
    fireEvent.click(await screen.findByText(/Run evidence|本次运行依据/));
    await waitFor(() => expect(network).toHaveBeenCalledWith(`/api/projects/${PROJECT_ID}/mokina/context-snapshots/snap-a`, { headers: workspaceProjectHeaders(a) }));
    view.rerender(<MokinaRunEvidence projectId={PROJECT_ID} runId="run-b" runActive={false} workspaceContext={b} />);
    await waitFor(() => expect(fetchChatRunStatus).toHaveBeenCalledWith('run-b', b));
    await act(async () => { resolveOld(new Response(JSON.stringify({ snapshot: { ...SNAPSHOT, snapshotId: 'snap-a', items: [{ ...SNAPSHOT.items[0], text: 'A private body' }] } }))); });
    expect(screen.queryByText('A private body')).toBeNull();
    fireEvent.click(await screen.findByText(/Run evidence|本次运行依据/));
    expect(await screen.findByText('B fixed body')).toBeTruthy();
    expect(network).toHaveBeenLastCalledWith(`/api/projects/${PROJECT_ID}/mokina/context-snapshots/snap-b`, { headers: workspaceProjectHeaders(b) });
    expect(fetchChatRunStatus).toHaveBeenCalledWith('run-a', a);
    expect(screen.getByText(/transmission only|只证明资料已传输/)).toBeTruthy();
  });
  it('T32 retries a failed receipt and does not label it as no receipt', async () => {
    fetchChatRunStatus.mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce(receipt(RUN_ID, 'snap-1'));
    render(<MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />);
    expect(await screen.findByText(/Failed to read the run receipt|运行依据读取失败/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Retry|重试/ }));
    expect(await screen.findByText(/Run evidence|本次运行依据/)).toBeTruthy();
    expect(fetchChatRunStatus).toHaveBeenCalledTimes(2);
  });
  it('shows fixed continuation source identity without calling a candidate approved', async () => {
    fetchChatRunStatus.mockResolvedValue(receipt(RUN_ID, 'snap-1'));
    const fixed: MokinaContextSnapshot = { ...SNAPSHOT, items: [{ itemId: 'S1', kind: 'user-note', displayName: 'plan.html · budget',
      sourceRef: { kind: 'user-note' }, sourceDigest: 'fixed-note-digest', text: '预算 100', textDigest: 'text-digest',
      locators: ['plan.html · candidate · source-version · budget'], limitations: ['未重新读取或批准源版本。'],
      continuationOrigin: { source: { projectId: 'deleted-source', fileName: 'plan.html', versionId: 'source-version',
        versionState: 'candidate', contentDigest: 'original-source-digest' }, sectionId: 'budget' } }] };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ snapshot: fixed }))));
    render(<MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />);
    fireEvent.click(await screen.findByText(/Run evidence|本次运行依据/));
    expect(await screen.findByText('预算 100')).toBeTruthy();
    const entry = screen.getByTestId('mokina-run-evidence-item-S1');
    expect(entry.textContent).toContain('candidate');
    expect(entry.textContent).toContain('source-version');
    expect(entry.textContent).toContain('original-source-digest');
    expect(entry.textContent).toContain('未重新读取或批准');
  });
  it('renders nothing when the run has no delivery receipt', async () => {
    fetchChatRunStatus.mockResolvedValue({ id: RUN_ID, status: 'finished', agentId: 'codex', mokinaContext: null });
    const { container } = render(
      <MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />,
    );
    await waitFor(() => expect(fetchChatRunStatus).toHaveBeenCalledWith(RUN_ID, undefined));
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('mokina-run-evidence')).toBeNull();
  });

  it('waits for the run to finish before reading the receipt', () => {
    render(<MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive />);
    expect(fetchChatRunStatus).not.toHaveBeenCalled();
  });

  it('shows receipt status, agent identity, items with delivery mode, and excluded reasons', async () => {
    fetchChatRunStatus.mockResolvedValue({
      id: RUN_ID,
      status: 'finished',
      agentId: 'codex-cli',
      mokinaContext: {
        runId: RUN_ID,
        snapshotId: SNAPSHOT.snapshotId,
        fingerprint: 'fp',
        includedItemIds: ['S1', 'A1'],
        itemDelivery: [
          { itemId: 'S1', mode: 'inline-text' },
          { itemId: 'A1', mode: 'staged-file' },
        ],
        status: 'submitted',
        submittedAt: '2026-10-06T05:05:16.192Z',
      },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ snapshot: SNAPSHOT }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />);
    const summary = await screen.findByText(/本次运行依据|Run evidence/);
    expect(summary.textContent).toMatch(/已提交|Submitted/);
    expect(summary.textContent).toContain('codex-cli');

    fireEvent.click(summary);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/mokina/context-snapshots/${SNAPSHOT.snapshotId}`,
    ));
    const s1 = await screen.findByTestId('mokina-run-evidence-item-S1');
    expect(s1.textContent).toContain('brief.md · 2 个片段');
    expect(s1.textContent).toMatch(/资料摘录|Material excerpt/);
    expect(s1.textContent).toMatch(/摘录内联|Inline text/);
    expect(s1.textContent).toContain('部分页码未提取');
    const a1 = await screen.findByTestId('mokina-run-evidence-item-A1');
    expect(a1.textContent).toMatch(/字节随附|Staged file/);
    expect(screen.getByText(/损坏文件不可读取/)).toBeTruthy();
  });

  it('shows the not-submitted reason from the receipt', async () => {
    fetchChatRunStatus.mockResolvedValue({
      id: RUN_ID,
      status: 'failed',
      agentId: null,
      mokinaContext: {
        runId: RUN_ID,
        snapshotId: 'snap-1',
        fingerprint: 'fp',
        includedItemIds: [],
        itemDelivery: [],
        status: 'not-submitted',
        reason: '暂存失败',
      },
    });
    render(<MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />);
    fireEvent.click(await screen.findByText(/本次运行依据|Run evidence/));
    expect((await screen.findByText(/未提交原因：暂存失败|Not submitted: 暂存失败/)).textContent).toContain('暂存失败');
  });
});
