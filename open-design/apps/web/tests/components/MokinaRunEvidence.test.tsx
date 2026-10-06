// @vitest-environment jsdom
//
// N03 运行依据：一轮带快照的 run 结束后，用户能核对实际注入了什么。
// 没有回执的 run 保持零噪音（不渲染任何内容）。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MokinaContextSnapshot } from '@open-design/contracts';

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
  it('renders nothing when the run has no delivery receipt', async () => {
    fetchChatRunStatus.mockResolvedValue({ id: RUN_ID, status: 'finished', agentId: 'codex', mokinaContext: null });
    const { container } = render(
      <MokinaRunEvidence projectId={PROJECT_ID} runId={RUN_ID} runActive={false} />,
    );
    await waitFor(() => expect(fetchChatRunStatus).toHaveBeenCalledWith(RUN_ID));
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
    const summary = await screen.findByText(/本次运行依据/);
    expect(summary.textContent).toContain('已提交');
    expect(summary.textContent).toContain('codex-cli');

    fireEvent.click(summary);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${PROJECT_ID}/mokina/context-snapshots/${SNAPSHOT.snapshotId}`,
    ));
    const s1 = await screen.findByTestId('mokina-run-evidence-item-S1');
    expect(s1.textContent).toContain('brief.md · 2 个片段');
    expect(s1.textContent).toContain('资料摘录');
    expect(s1.textContent).toContain('摘录内联');
    expect(s1.textContent).toContain('部分页码未提取');
    const a1 = await screen.findByTestId('mokina-run-evidence-item-A1');
    expect(a1.textContent).toContain('字节随附');
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
    fireEvent.click(await screen.findByText(/本次运行依据/));
    expect((await screen.findByText(/未提交原因：暂存失败/)).textContent).toContain('暂存失败');
  });
});
