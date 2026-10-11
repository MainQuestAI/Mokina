// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MokinaBusinessReadResult, SaveMokinaBusinessRequest } from '@open-design/contracts';
import { MokinaBusinessBrief } from '../../src/components/mokina/MokinaBusinessBrief';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
const props = { projectId: 'p1', conversationId: 'c1', workspaceContext: null, onPrepare: vi.fn() };
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); resetDurableRecoveryForTests(); props.onPrepare.mockClear(); });
function open() { render(<MokinaBusinessBrief {...props} />); fireEvent.click(screen.getByText('Business facts & task Brief')); }
it('keeps an unknown operation across remount, does not auto resend, and reconciles its exact original request', async () => {
  const posts: SaveMokinaBusinessRequest[] = [];
  let saved: MokinaBusinessReadResult | null = null;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ result: saved });
    const request = JSON.parse(String(init.body)) as SaveMokinaBusinessRequest; posts.push(request);
    saved = { fileName: 'task-brief.html', revision: 'a'.repeat(64), versionId: posts.length === 1 ? null : 'v1', document: { schema: 'mokina.business.v1', operationId: request.operationId, requestDigest: 'b'.repeat(64), body: request.body, backgroundSnapshot: null } };
    if (posts.length === 1) throw new Error('connection lost after commit');
    return Response.json({ result: saved });
  }));
  open();
  const goal = await screen.findByRole('textbox', { name: 'Goal' });
  fireEvent.change(goal, { target: { value: '禁止线下活动的线上获客方案' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save artifact (does not start production)' }));
  await screen.findByRole('alert');
  expect((screen.getByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).disabled).toBe(true);
  cleanup(); open();
  await screen.findByRole('button', { name: 'Reconcile the same save' });
  expect(posts).toHaveLength(1);
  expect(props.onPrepare).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Read current artifact, keep draft' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Reconcile the same save' }) as HTMLButtonElement).disabled).toBe(false));
  expect(posts).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Reconcile the same save' }));
  await screen.findByText('Saved as an HTML artifact and fixed version. Production has not started.');
  expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
  expect((screen.getByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).value).toBe('禁止线下活动的线上获客方案');
});
it('keeps a failed read distinct from an empty Brief and permits an explicit successful reread', async () => {
  let broken = true;
  const fetchMock = vi.fn(async () => broken ? Response.json({ error: { message: 'read unavailable' } }, { status: 500 }) : Response.json({ result: null }));
  vi.stubGlobal('fetch', fetchMock); open();
  await screen.findByText('read unavailable');
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Save artifact (does not start production)' })).toBeNull();
  broken = false; fireEvent.click(screen.getByRole('button', { name: 'Read current artifact, keep draft' }));
  expect((await screen.findByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).value).toBe('');
  expect(fetchMock.mock.calls).toHaveLength(2);
});
it('does not acknowledge a same-id receipt whose business content differs from the pending draft', async () => {
  const body = { kind: 'brief' as const, value: { title: 'Brief', goal: '我的待保存要求', audience: '', deliverables: [], kpi: '', budget: '', period: '', constraints: '', missing: '' }, background: null };
  localStorage.setItem('od:composer-draft:mokina-business:["none","p1","c1"]:brief', JSON.stringify({ schema: 1, pending: true, request: { operationId: 'save1', expectedRevision: null, body } }));
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: { fileName: 'task-brief.html', revision: 'a'.repeat(64), versionId: 'v1', document: {
    schema: 'mokina.business.v1', operationId: 'save1', requestDigest: 'b'.repeat(64), body: { ...body, value: { ...body.value, goal: '另一个窗口的内容' } }, backgroundSnapshot: null,
  } } })));
  open(); await screen.findByRole('button', { name: 'Reconcile the same save' });
  fireEvent.click(screen.getByRole('button', { name: 'Read current artifact, keep draft' }));
  await screen.findByText('Current artifact differs from the pending request. Compare before continuing with the draft.');
  expect((screen.getByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).value).toBe('我的待保存要求');
});
