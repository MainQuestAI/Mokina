// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MokinaBusinessReadResult, SaveMokinaBusinessRequest } from '@open-design/contracts';
import { MokinaBusinessBrief } from '../../src/components/mokina/MokinaBusinessBrief';
import * as recovery from '../../src/runtime/persistence/mokina-recovery-store';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
const props = { projectId: 'p1', conversationId: 'c1', workspaceContext: null, onPrepare: vi.fn() };
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); vi.unstubAllGlobals(); resetDurableRecoveryForTests(); props.onPrepare.mockClear(); });
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

const draftKey = 'od:composer-draft:mokina-business:["none","p1","c1"]:brief';
const restoredDraft = JSON.stringify({ schema: 1, pending: false, request: { operationId: 'kept-operation', expectedRevision: null,
  body: { kind: 'brief', value: { title: 'Brief', goal: '保留原输入', audience: '', deliverables: [], kpi: '', budget: '', period: '', constraints: '', missing: '' }, background: null } } });
it.each(['local read', 'native flush'])('recovers a temporary %s failure by rereading the original draft without POST', async mode => {
  localStorage.setItem(draftKey, restoredDraft);
  const fetchMock = vi.fn(async (_url?: string, _init?: RequestInit) => Response.json({ result: null })); vi.stubGlobal('fetch', fetchMock);
  if (mode === 'local read') vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => { throw new Error('storage unavailable'); });
  else vi.spyOn(recovery, 'flushDurableRecord').mockResolvedValue(false);
  open(); await screen.findByRole('alert');
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Read current artifact, keep draft' }));
  expect((await screen.findByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).value).toBe('保留原输入');
  expect(localStorage.getItem(draftKey)).toBe(restoredDraft);
  expect(fetchMock.mock.calls.every(args => args.length === 0 || !(args[1] as RequestInit | undefined)?.method)).toBe(true);
});
it('preserves corrupt bytes until explicit backup and rebuild, then restores editing without creating a run', async () => {
  const corrupt = '{broken business draft'; localStorage.setItem(draftKey, corrupt);
  const fetchMock = vi.fn(async (_url?: string, _init?: RequestInit) => Response.json({ result: null })); vi.stubGlobal('fetch', fetchMock);
  open(); await screen.findByRole('alert');
  expect(localStorage.getItem(draftKey)).toBe(corrupt);
  fireEvent.click(screen.getByRole('button', { name: 'Back up damaged draft and rebuild' }));
  await screen.findByRole('textbox', { name: 'Goal' });
  const backup = Object.keys(localStorage).find(key => key.startsWith(draftKey + ':unreadable:'));
  expect(backup).toBeTruthy(); expect(localStorage.getItem(backup!)).toBe(corrupt);
  expect(localStorage.getItem(draftKey)).toBeNull();
  expect(props.onPrepare).not.toHaveBeenCalled();
});
it('refuses to rebuild over a competing draft and can reread that recovered record', async () => {
  localStorage.setItem(draftKey, '{broken'); vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: null })));
  open(); await screen.findByRole('alert');
  localStorage.setItem(draftKey, restoredDraft);
  fireEvent.click(screen.getByRole('button', { name: 'Back up damaged draft and rebuild' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Draft changed'));
  expect(localStorage.getItem(draftKey)).toBe(restoredDraft);
  fireEvent.click(screen.getByRole('button', { name: 'Read current artifact, keep draft' }));
  expect((await screen.findByRole('textbox', { name: 'Goal' }) as HTMLTextAreaElement).value).toBe('保留原输入');
});

it('never deletes corrupt input when its backup cannot be mirrored', async () => {
  localStorage.setItem(draftKey, '{broken'); vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: null })));
  vi.spyOn(recovery, 'mirrorDurableRecord').mockResolvedValue(false);
  open(); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Back up damaged draft and rebuild' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Draft not safely saved'));
  expect(localStorage.getItem(draftKey)).toBe('{broken');
  expect(screen.queryByRole('textbox', { name: 'Goal' })).toBeNull();
});
