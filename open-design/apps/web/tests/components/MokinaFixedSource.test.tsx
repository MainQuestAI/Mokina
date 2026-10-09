// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MokinaFixedSource } from '../../src/components/mokina/MokinaFixedSource';
import { I18nProvider } from '../../src/i18n';
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('../../src/router', () => ({ navigate }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('opens the receipt version and rejects a receipt belonging to another target', async () => {
  const source = { projectId: 'origin', fileName: 'nested/plan.html', versionId: 'historical' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 2, targetProjectId: 'target', source }), { status: 200 })));
  const { rerender } = render(<I18nProvider initial="en"><MokinaFixedSource projectId="target" /></I18nProvider>);
  fireEvent.click(await screen.findByRole('button'));
  expect(navigate).toHaveBeenCalledWith({ kind: 'project', ...source });
  rerender(<I18nProvider initial="en"><MokinaFixedSource projectId="other" /></I18nProvider>);
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull());
  expect(await screen.findByText('Read failed')).toBeVisible();
});
it('only a missing receipt is no fixed source; network failure stays a read error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
  const { rerender } = render(<I18nProvider initial="en"><MokinaFixedSource projectId="none" /></I18nProvider>);
  expect(await screen.findByText('No fixed source')).toBeVisible();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  rerender(<I18nProvider initial="en"><MokinaFixedSource projectId="offline" /></I18nProvider>);
  expect(await screen.findByText('Read failed')).toBeVisible();
});

it('does not restart receipt reads when the same workspace context is reconstructed', async () => {
  const context = { workspaceId: 'w', workspaceType: 'personal', workspaceMemberId: 'm', role: 'owner', lifecycleState: 'active', memberStatus: 'active', permissions: { canShareProjects: true, canWriteSyncedFiles: true } } as import('@open-design/contracts').WorkspaceCollabContext;
  const fetcher = vi.fn().mockImplementation(async () => new Response('', { status: 404 }));
  vi.stubGlobal('fetch', fetcher);
  const view = (ctx: typeof context) => <I18nProvider initial="en"><MokinaFixedSource projectId="same" workspaceContext={ctx} /></I18nProvider>;
  const { rerender } = render(view(context));
  await screen.findByText('No fixed source');
  await act(async () => { rerender(view({ ...context, permissions: { ...context.permissions } })); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async () => { rerender(view({ ...context, workspaceMemberId: 'other' })); });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
