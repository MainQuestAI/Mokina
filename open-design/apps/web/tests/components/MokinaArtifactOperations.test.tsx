// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MokinaOperationRequest, ProjectFileVersion } from '@open-design/contracts';
import { MokinaArtifactOperations } from '../../src/components/mokina/MokinaArtifactOperations';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
const version = { id: 'v1', version: 1, current: true } as ProjectFileVersion;
const info = { versionId: 'v1', contentDigest: 'a'.repeat(64), fields: [{ id: 'strategy', sectionId: 'plan', kind: 'strategy', label: 'Strategy', value: '原方向' }], sections: [{ id: 'plan', text: '原方向' }] };
const props = { projectId: 'p1', fileName: 'plan.html', version, versions: [version], workspaceContext: null, onSaved: vi.fn() };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); resetDurableRecoveryForTests(); props.onSaved.mockClear(); });
function open() { render(<MokinaArtifactOperations {...props} />); fireEvent.click(screen.getByText('Edit items and combine directions')); }
it('restores a draft and reads an unknown save without automatically resending it', async () => {
  const posts: MokinaOperationRequest[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push(JSON.parse(String(init.body))); throw new Error('connection lost after commit'); }
    return Response.json(url.includes('/versions?') ? { versions: [{ ...version, id: 'candidate', candidate: true, operationId: posts[0]?.operationId }] } : url.includes('versionId=candidate') ? { ...info, versionId: 'candidate', operation: posts[0] } : info);
  }));
  open(); const field = await screen.findByRole('textbox', { name: 'Strategy' });
  fireEvent.change(field, { target: { value: '中文方向' } });
  await waitFor(() => expect(localStorage.getItem('od:revision:operations:["none","p1","plan.html","v1"]')).toContain('中文方向'));
  cleanup(); open(); expect((await screen.findByRole('textbox', { name: 'Strategy' }) as HTMLTextAreaElement).value).toBe('中文方向');
  fireEvent.click(screen.getByRole('button', { name: 'Save candidate' }));
  await screen.findByRole('alert'); expect(posts).toHaveLength(1);
  cleanup(); open(); await screen.findByRole('button', { name: 'Read save result' }); expect(posts).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Read save result' }));
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'candidate' })));
  expect(posts).toHaveLength(1);
});
it('preserves a damaged draft before explicit reset and distinguishes read failure from empty', async () => {
  const key = 'od:revision:operations:["none","p1","plan.html","v1"]'; localStorage.setItem(key, '{broken');
  const fetchMock = vi.fn(async () => Response.json(info)); vi.stubGlobal('fetch', fetchMock);
  open(); await screen.findByRole('alert'); expect(screen.queryByRole('textbox')).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep backup and reset draft' }));
  await screen.findByRole('textbox', { name: 'Strategy' });
  const backup = Object.keys(localStorage).find(k => k.startsWith(key + ':backup:'))!;
  expect(localStorage.getItem(backup)).toBe('{broken');
});
it('discards a late project response and does not share drafts between projects', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('/p1/') ? new Promise<Response>(resolve => { finish = resolve; }) : Promise.resolve(Response.json({ ...info, fields: [{ ...info.fields[0], value: '第二项目' }] }))));
  const view = render(<MokinaArtifactOperations {...props} />); fireEvent.click(screen.getByText('Edit items and combine directions'));
  await waitFor(() => expect(finish).toBeDefined());
  view.rerender(<MokinaArtifactOperations {...props} projectId="p2" />);
  await screen.findByDisplayValue('第二项目'); finish(Response.json(info));
  await waitFor(() => expect(screen.queryByDisplayValue('原方向')).toBeNull());
});
it('keeps a rejected input editable without sending it again', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ error: { message: 'Budget exceeded' } }, { status: 400 }) : Response.json(info)));
  open(); fireEvent.change(await screen.findByRole('textbox', { name: 'Strategy' }), { target: { value: 'bad' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save candidate' }));
  await screen.findByText('Error: Budget exceeded');
  expect((screen.getByRole('textbox', { name: 'Strategy' }) as HTMLTextAreaElement).disabled).toBe(false);
});
it('keeps rapid Chinese changes durable and sends at most once on repeated save clicks', async () => {
  let posts = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts++; throw new Error('offline'); }
    return Response.json(info);
  }));
  open(); const field = await screen.findByRole('textbox', { name: 'Strategy' });
  for (const value of ['中', '中文', '中文输入']) fireEvent.change(field, { target: { value } });
  await waitFor(() => expect(localStorage.getItem('od:revision:operations:["none","p1","plan.html","v1"]')).toContain('中文输入'));
  expect(screen.queryByRole('alert')).toBeNull();
  const save = screen.getByRole('button', { name: 'Save candidate' });
  fireEvent.click(save); fireEvent.click(save);
  await screen.findByRole('alert'); expect(posts).toBe(1);
});
it('returns definitive conflicts to editing, but never retries automatically', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => init?.method === 'POST' ? Response.json({ error: { message: 'Base missing' } }, { status: 409 }) : Response.json(info)));
  open(); fireEvent.change(await screen.findByRole('textbox', { name: 'Strategy' }), { target: { value: '保留草稿' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save candidate' })); await screen.findByText('Error: Base missing');
  expect((screen.getByRole('textbox', { name: 'Strategy' }) as HTMLTextAreaElement).disabled).toBe(false);
});
