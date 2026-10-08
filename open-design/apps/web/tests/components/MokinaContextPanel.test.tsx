// @vitest-environment jsdom
//
// T07：资料与背景面板——三层信息、服务端冻结、预算与来源变化拒绝、未纳入原因。

import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchProjectMaterialMock } = vi.hoisted(() => ({
  fetchProjectMaterialMock: vi.fn(),
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>('../../src/providers/registry');
  return { ...actual, fetchProjectMaterial: fetchProjectMaterialMock };
});

vi.mock('../../src/collab/collab-context', () => ({
  useProjectCollabContext: () => ({ workspaceContext: null }),
}));

import { MokinaContextPanel } from '../../src/components/mokina/MokinaContextPanel';
import { readPendingMokinaSnapshot } from '../../src/runtime/mokina/pending-context-snapshot';
import type { ProjectFile } from '../../src/types';

function materialFile(name: string): ProjectFile {
  return {
    name,
    path: name,
    type: 'file',
    size: 2048,
    mtime: 1710000000,
    kind: 'document',
    mime: 'text/markdown',
  } as ProjectFile;
}

function extraction(overrides: Record<string, unknown> = {}) {
  return {
    name: 'brief.md',
    contentDigest: 'a'.repeat(64),
    parserVersion: 'mokina-material/2',
    status: 'read',
    limitations: ['保留 CSV 原始字段与行号；不自动推断数值单位或日期。'],
    sections: [
      { fragmentId: 'fragment:1', location: '第 1 行', text: '晨光茶饮禁止投放短视频', groupId: 'heading:1', groupLabel: '品牌' },
      { fragmentId: 'fragment:2', location: '第 2 行 / 片段 1', text: '甲'.repeat(50), groupId: 'heading:1:part:1', groupLabel: '品牌 / 片段 1' },
      { fragmentId: 'fragment:3', location: '第 3 行', text: '总预算 50 万', groupId: 'heading:2', groupLabel: '预算' },
    ],
    ...overrides,
  };
}

describe('MokinaContextPanel', () => {
  it('freezes a selected SVG as an asset with role and actual source digest', async () => {
    vi.stubGlobal('crypto', webcrypto);
    let body: { selections: Array<{ mode: string; role: string; expectedSourceDigest: string }> } | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      if (!options?.method) return new Response('<svg>A</svg>');
      body = JSON.parse(options.body);
      return new Response(JSON.stringify({ snapshot: { items: [{ kind: 'asset', displayName: 'logo.svg' }] } }), { status: 201 });
    }));
    render(<MokinaContextPanel projectId="p1" files={[materialFile('logo.svg')]} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));
    const role = await screen.findByRole('combobox', { name: 'logo.svg 素材角色' });
    fireEvent.change(role, { target: { value: 'logo' } });
    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot/ }));
    await waitFor(() => expect(body?.selections[0]).toMatchObject({ mode: 'asset', role: 'logo', expectedSourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(fetchProjectMaterialMock).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    window.localStorage.clear();
    fetchProjectMaterialMock.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('freezes exactly the checked fragment, not the rest of its group', async () => {
    fetchProjectMaterialMock.mockResolvedValue(extraction());
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      expect(url).toBe('/api/projects/p1/mokina/context-snapshots');
      const body = JSON.parse(String(init?.body)) as { snapshotId: string; selections: Array<{ fragmentIds: string[]; expectedParserVersion: string; expectedSourceDigest: string }>; excluded: unknown[] };
      expect(typeof body.snapshotId).toBe('string');
      expect(body.selections[0]?.expectedSourceDigest).toBe('a'.repeat(64));
      expect(body.selections[0]?.fragmentIds).toEqual(['fragment:1']);
      expect(body.selections[0]?.expectedParserVersion).toBe('mokina-material/2');
      return new Response(JSON.stringify({
        snapshot: {
          items: [
            { displayName: 'brief.md · 2 个片段', kind: 'material-excerpt', text: '甲乙丙' },
          ],
        },
        reused: false,
      }), { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MokinaContextPanel projectId="p1" files={[materialFile('brief.md'), materialFile('logo.png')]} />);

    fireEvent.click(screen.getByRole('checkbox', { name: /brief\.md/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));
    await screen.findByText(/Readable/);
    expect(screen.getByText(/保留 CSV 原始字段/)).toBeTruthy();

    const groupBoxes = screen.getAllByRole('checkbox', { name: /品牌/ });
    fireEvent.click(groupBoxes[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot/ }));

    await screen.findByText(/Added to the task snapshot/);
    // N04 adds a catalog read on mount; the freeze itself is exactly one POST.
    expect(fetchMock.mock.calls.filter((call) => (call[1] as { method?: string } | undefined)?.method === 'POST')).toHaveLength(1);
    const pending = readPendingMokinaSnapshot('p1');
    expect(pending?.snapshotId).toBeTruthy();
    expect(pending?.itemCount).toBe(1);
  });

  it('keeps an unreadable file as an original with an explicit reason instead of blocking the flow', async () => {
    fetchProjectMaterialMock.mockResolvedValue({
      name: 'scan.pdf',
      contentDigest: 'b'.repeat(64),
      status: 'unreadable',
      limitations: ['PDF 文本提取失败；请检查 pdftotext，或提供文本版本。'],
      sections: [],
    });

    render(<MokinaContextPanel projectId="p1" files={[materialFile('scan.pdf')]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /scan\.pdf/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));

    await screen.findByText(/Unreadable \(original kept, not used as evidence\)/);
    expect(screen.getByText(/PDF 文本提取失败/)).toBeTruthy();
    // No readable group exists: freezing stays disabled and nothing is frozen.
    expect(screen.getByRole('button', { name: /Freeze as task snapshot/ })).toBeDisabled();
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
  });

  it('turns a source change into a re-preview request instead of freezing stale text', async () => {
    fetchProjectMaterialMock.mockResolvedValue(extraction());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'MOKINA_SOURCE_CHANGED', message: '资料在预览后已变化，请重新读取后再使用：brief.md' },
    }), { status: 409 })));

    render(<MokinaContextPanel projectId="p1" files={[materialFile('brief.md')]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /brief\.md/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));
    await screen.findByText(/Readable/);
    fireEvent.click(screen.getAllByRole('checkbox', { name: /品牌/ })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot/ }));

    await screen.findByText(/The material changed after the preview/);
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: /预算/ })).toBeNull();
    });
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
  });

  it('surfaces the server budget refusal without silently truncating', async () => {
    fetchProjectMaterialMock.mockResolvedValue(extraction());
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { code: 'MOKINA_CONTEXT_LIMIT', message: '摘录文本超过 24,000 字符上限，请缩小选择。' },
    }), { status: 413 })));

    render(<MokinaContextPanel projectId="p1" files={[materialFile('brief.md')]} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /brief\.md/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview readable range' }));
    await screen.findByText(/Readable/);
    fireEvent.click(screen.getAllByRole('checkbox', { name: /品牌/ })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot/ }));

    await screen.findByText(/超过 24,000 字符上限/);
    expect(readPendingMokinaSnapshot('p1')).toBeNull();
  });
});
