// @vitest-environment jsdom
import { forwardRef, type ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { HomeHero } from '../../src/components/HomeHero';
import { HomeView } from '../../src/components/HomeView';
import { I18nProvider } from '../../src/i18n';
import { readHomeContextDraft } from '../../src/runtime/mokina/home-context-draft';

const hero = vi.hoisted(() => ({ props: null as ComponentProps<typeof HomeHero> | null }));
vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));
vi.mock('../../src/components/HomeHero', () => ({ HomeHero: forwardRef((props: ComponentProps<typeof HomeHero>, _ref) => { hero.props = props; return null; }) }));
vi.mock('../../src/collab/useWorkspaceContext', async original => ({
  ...await original<typeof import('../../src/collab/useWorkspaceContext')>(),
  useWorkspaceContext: () => ({ context: null, loading: false, failure: 'unsupported' }),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

it('restores real skill/plugin/MCP/connector and workspace bindings on settings return and refresh, without persisting secrets', async () => {
  const skill = { id: 'skill', name: 'Skill', description: '', triggers: [], mode: 'prototype', previewType: 'none', designSystemRequired: false, defaultFor: [], upstream: null, hasBody: true, aggregatesExamples: false, examplePrompt: '' };
  const plugin = { id: 'plugin', title: 'Plugin', manifest: { name: 'plugin', title: 'Plugin', version: '1', description: 'Reference', od: { kind: 'atom' } }, sourceKind: 'bundled', source: '/plugin', fsPath: '/plugin', capabilitiesGranted: [], installedAt: 0, updatedAt: 0, trust: 'bundled', version: '1' };
  const mcp = { id: 'mcp', label: 'MCP', enabled: true, transport: 'stdio', command: 'mcp', env: { SECRET: 'do-not-store' } };
  const connector = { id: 'connector', name: 'Connector', status: 'connected', provider: 'test', category: 'test', tools: [], credentials: 'do-not-store' };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    return new Response(JSON.stringify(url.includes('/mcp/servers') ? { servers: [mcp] }
      : url.includes('/plugins') ? { plugins: [plugin] } : {}), { headers: { 'content-type': 'application/json' } });
  }));
  const submit = vi.fn(async (_payload: unknown) => 'blocked' as const);
  const mount = () => render(<I18nProvider initial="en"><HomeView projects={[]} onOpenProject={() => {}}
    skills={[skill] as ComponentProps<typeof HomeView>['skills']} connectors={[connector] as unknown as ComponentProps<typeof HomeView>['connectors']}
    onSubmit={submit} /></I18nProvider>);
  let view = mount();
  await waitFor(() => expect(hero.props?.mcpLoading).toBe(false));
  await waitFor(() => expect(hero.props?.pluginsLoading).toBe(false));
  await act(async () => {
    hero.props!.onPickSkill!(skill as never, null);
    hero.props!.onPickPlugin!(plugin as never, null);
    hero.props!.onPickMcp!(mcp as never, '@Plugin @MCP retained prompt');
    hero.props!.onPickConnector!(connector as never, '@Plugin @MCP @Connector retained prompt');
    hero.props!.onAddWorkspaceContext!({ id: 'project:ref', kind: 'project', label: 'Reference', path: 'ref' });
    hero.props!.onAddWorkspaceContext!({ id: 'folder:ref', kind: 'folder', label: 'Folder', absolutePath: '/reference' });
  });
  await waitFor(() => expect(readHomeContextDraft('none')?.mcp).toHaveLength(1));
  expect(JSON.stringify(Object.values(sessionStorage))).not.toContain('do-not-store');
  for (let i = 0; i < 2; i++) {
    view.unmount(); view = mount();
    await waitFor(() => expect(hero.props?.activeSkillId).toBe('skill'));
    expect(hero.props?.selectedPluginContexts?.map(item => item.id)).toEqual(['plugin']);
    expect(hero.props?.selectedMcpContexts?.map(item => item.id)).toEqual(['mcp']);
    expect(hero.props?.selectedConnectorContexts?.map(item => item.id)).toEqual(['connector']);
    expect(hero.props?.contextWorkspaceItems).toHaveLength(2);
    expect(submit).not.toHaveBeenCalled();
  }
  await act(async () => { await hero.props!.onSubmit(); });
  expect(submit).toHaveBeenCalledTimes(1);
  const payload = submit.mock.calls[0]![0] as Parameters<NonNullable<ComponentProps<typeof HomeView>['onSubmit']>>[0];
  expect(payload.skillId).toBe('skill');
  expect(payload.contextPlugins?.map(item => item.id)).toEqual(['plugin']);
  expect(payload.contextMcpServers?.map(item => item.id)).toEqual(['mcp']);
  expect(payload.contextConnectors?.map(item => item.id)).toEqual(['connector']);
  expect(payload.initialRunContext?.workspaceItems).toEqual([
    { id: 'project:ref', kind: 'project', label: 'Reference', path: 'ref' },
    { id: 'folder:ref', kind: 'folder', label: 'Folder', absolutePath: '/reference' },
  ]);
});

it('retains unresolved safe references and blocks sending until they are explicitly discarded', async () => {
  sessionStorage.setItem('od:home-context:none', JSON.stringify({ skillId: 'missing-skill', plugins: [], mcp: [], connectors: [], workspaceItems: [] }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ plugins: [], servers: [] }), { headers: { 'content-type': 'application/json' } })));
  const submit = vi.fn(async (_payload: unknown) => 'blocked' as const);
  render(<I18nProvider initial="en"><HomeView projects={[]} onOpenProject={() => {}} onSubmit={submit} /></I18nProvider>);
  await waitFor(() => expect(hero.props?.mcpLoading).toBe(false));
  expect(screen.getByTestId('mokina-home-context-restore')).toHaveTextContent('missing-skill');
  await act(async () => { hero.props!.onPromptChange('Still retained'); });
  await act(async () => { await hero.props!.onSubmit(); });
  expect(submit).not.toHaveBeenCalled();
  expect(readHomeContextDraft('none')?.skillId).toBe('missing-skill');
  fireEvent.click(screen.getByRole('button', { name: 'Discard this receipt' }));
  await waitFor(() => expect(screen.queryByTestId('mokina-home-context-restore')).toBeNull());
  expect(hero.props?.prompt).toBe('Still retained');
});
