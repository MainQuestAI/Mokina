// @vitest-environment jsdom
//
// N04: 品牌套件源进入 Mokina 快照——面板选择品牌、冻结产生 brand-rule 选择项，
// 品牌单独可用（无项目文件时面板照常渲染）。

import { webcrypto } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { fetchDesignSystemsMock } = vi.hoisted(() => ({
  fetchDesignSystemsMock: vi.fn(),
}));

vi.mock('../../src/providers/registry', async () => {
  const actual = await vi.importActual<typeof import('../../src/providers/registry')>('../../src/providers/registry');
  return {
    ...actual,
    fetchDesignSystems: fetchDesignSystemsMock,
    fetchProjectMaterial: vi.fn(),
  };
});

vi.mock('../../src/collab/collab-context', () => ({
  useProjectCollabContext: () => ({ workspaceContext: null }),
}));

import { MokinaContextPanel } from '../../src/components/mokina/MokinaContextPanel';

const BRAND_MD = '# 山茶品牌规范\n\n主色 #B3392E。';

afterEach(() => {
  cleanup();
  fetchDesignSystemsMock.mockReset();
  vi.unstubAllGlobals();
});

describe('MokinaContextPanel — brand kit source (N04)', () => {
  it('renders for a brand-only project and freezes the brand as a brand-rule selection', async () => {
    vi.stubGlobal('crypto', webcrypto);
    fetchDesignSystemsMock.mockResolvedValue([
      { id: 'shancha', title: '山茶咖啡' },
      { id: 'apple', title: 'Apple' },
    ]);
    let posted: { selections: Array<Record<string, unknown>> } | undefined;
    vi.stubGlobal('fetch', vi.fn(async (url: string, options?: { method?: string; body?: string }) => {
      if (options?.method === 'POST') {
        posted = JSON.parse(options.body ?? '{}');
        return new Response(JSON.stringify({
          snapshot: {
            items: [{ displayName: '山茶咖啡 · 品牌规则', kind: 'brand-rule', text: BRAND_MD }],
          },
        }), { status: 201 });
      }
      if (url.includes('/api/design-systems/shancha')) {
        return new Response(JSON.stringify({ id: 'shancha', title: '山茶咖啡', body: BRAND_MD }), { status: 200 });
      }
      return new Response('[]', { status: 200 });
    }));

    render(<MokinaContextPanel projectId="p-brand" files={[]} projectDesignSystemId="shancha" />);

    // Project-bound brand preselects transparently once the catalog loads.
    const select = await screen.findByLabelText('品牌来源');
    await waitFor(() => expect(select).toHaveValue('shancha'));
    await screen.findByText(/已选品牌：山茶咖啡/);

    fireEvent.click(screen.getByRole('button', { name: /Freeze as task snapshot|冻结为任务快照/ }));

    await waitFor(() => expect(posted).toBeDefined());
    const brandSelections = posted!.selections.filter((selection) => selection.textKind === 'brand-rule');
    expect(brandSelections).toHaveLength(1);
    expect(brandSelections[0]).toMatchObject({
      mode: 'groups',
      sourceRef: { kind: 'design-system', designSystemId: 'shancha' },
    });
    expect(typeof brandSelections[0]!.expectedSourceDigest).toBe('string');
    expect((brandSelections[0]!.expectedSourceDigest as string).length).toBe(64);
  });

  it('does not render when there is neither material files nor any brand kit', async () => {
    fetchDesignSystemsMock.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })));
    const { container } = render(<MokinaContextPanel projectId="p-empty" files={[]} />);
    await waitFor(() => expect(fetchDesignSystemsMock).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('details.mokina-context-panel')).toBeNull());
    expect(container.querySelector('details.mokina-context-panel')).toBeNull();
  });
});
