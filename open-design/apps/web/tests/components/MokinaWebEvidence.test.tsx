// @vitest-environment jsdom
import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MokinaWebEvidence } from '../../src/components/mokina/MokinaWebEvidence';
import { resetDurableRecoveryForTests } from '../../src/runtime/persistence/mokina-recovery-store';
import * as recovery from '../../src/runtime/persistence/mokina-recovery-store';
import type { CaptureMokinaWebEvidenceRequest } from '@open-design/contracts';
const props = { projectId: 'p', conversationId: 'c', workspaceContext: null, onCaptured: vi.fn() };
const key = 'od:composer-draft:mokina-web-evidence:["none","p","c"]';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
beforeEach(() => { vi.stubGlobal('crypto', webcrypto); vi.stubGlobal('TextEncoder', TextEncoder); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); resetDurableRecoveryForTests(); props.onCaptured.mockClear(); });
function reply(request: CaptureMokinaWebEvidenceRequest, workingFile = 'matched') {
  const content = 'Public text supporting the selected claim.'; const sha = digest(content); const name = `evidence/web-${request.operationId}.md`;
  const receipt = { schema: 'mokina.web-evidence.v1', operationId: request.operationId, requestedUrl: request.url, resolvedUrl: request.url,
    retrievedAt: '2026-10-14T04:00:00Z', statusCode: 200, contentType: 'text/plain', bodyDigest: sha, textDigest: sha,
    parserVersion: 'mokina-web/1', scope: 'plain-text', limitations: ['Not a factual assessment.'] };
  return { fileName: name, versionId: 'v1', contentDigest: sha, content, receipt, workingFile,
    material: { name, sourceVersionId: 'v1', contentDigest: sha, parserVersion: 'mokina-material/2', status: 'read', sections: [], limitations: [], webCapture: receipt } };
}
async function enter() { const input = await screen.findByRole('textbox', { name: 'Public page URL' }); fireEvent.change(input, { target: { value: 'https://example.com/page' } }); return input; }
it('recovers a committed but disconnected read without an automatic POST, and a new read is explicit', async () => {
  const posts: CaptureMokinaWebEvidenceRequest[] = []; let saved: unknown = null;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method !== 'POST') return Response.json({ result: saved });
    const request = JSON.parse(String(init.body)); posts.push(request); saved = reply(request);
    if (posts.length === 1) throw new Error('connection lost after commit');
    return Response.json({ result: saved });
  }));
  const first = render(<MokinaWebEvidence {...props} />); await enter();
  fireEvent.click(screen.getByRole('button', { name: 'Read public page' }));
  await screen.findByRole('alert'); expect(JSON.parse(localStorage.getItem(key)!).state).toBe('unknown'); first.unmount();
  render(<MokinaWebEvidence {...props} />); fireEvent.click(await screen.findByRole('button', { name: 'Read capture result' }));
  await screen.findByText(/Source version saved/); expect(posts).toHaveLength(1); expect(props.onCaptured).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Read page again as a new source' }));
  await waitFor(() => expect(posts).toHaveLength(2)); expect(posts[1]!.operationId).not.toBe(posts[0]!.operationId);
  await waitFor(() => expect(props.onCaptured).toHaveBeenCalledTimes(2));
});
it('queries an absent outcome before allowing an explicit retry of the same operation', async () => {
  const original = { operationId: 'unknown-one', url: 'https://example.com/page' };
  localStorage.setItem(key, JSON.stringify({ schema: 1, request: original, state: 'unknown' }));
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => Response.json({ result: init?.method === 'POST' ? reply(JSON.parse(String(init.body))) : null })); vi.stubGlobal('fetch', fetchMock);
  render(<MokinaWebEvidence {...props} />); const query = await screen.findByRole('button', { name: 'Read capture result' });
  expect(fetchMock).not.toHaveBeenCalled(); fireEvent.click(query); await screen.findByText(/No saved source version/);
  fireEvent.click(screen.getByRole('button', { name: 'Retry the same read' })); await screen.findByText(/Source version saved/);
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST'); expect(JSON.parse(String(post?.[1]?.body))).toEqual(original);
});
it('does not accept a mismatched receipt or lose the pending request', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: reply({ operationId: 'another-read', url: 'https://example.com/other' }) })));
  render(<MokinaWebEvidence {...props} />); await enter(); fireEvent.click(screen.getByRole('button', { name: 'Read public page' }));
  await screen.findByRole('alert'); expect(props.onCaptured).not.toHaveBeenCalled(); expect(JSON.parse(localStorage.getItem(key)!).state).toBe('unknown');
  const pending = localStorage.getItem(key)!;
  fireEvent.click(screen.getByRole('button', { name: 'Keep request backup and prepare a new read' }));
  await screen.findByRole('button', { name: 'Read public page' });
  const backup = Object.keys(localStorage).find(k => k.includes(':unknown:'));
  expect(localStorage.getItem(backup!)).toBe(pending);
  expect(JSON.parse(localStorage.getItem(key)!).request.operationId).not.toBe(JSON.parse(pending).request.operationId);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it('fences a delayed response when switching project or conversation', async () => {
  let resolve!: (value: Response) => void; let sent: CaptureMokinaWebEvidenceRequest | undefined;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => { sent = JSON.parse(String(init?.body)); return new Promise<Response>(r => { resolve = r; }); }));
  const view = render(<MokinaWebEvidence {...props} />); await enter(); fireEvent.click(screen.getByRole('button', { name: 'Read public page' }));
  await waitFor(() => expect(sent).toBeTruthy()); view.rerender(<MokinaWebEvidence {...props} projectId="other" conversationId="other-c" />);
  expect((await screen.findByRole('textbox', { name: 'Public page URL' }) as HTMLInputElement).value).toBe('');
  resolve(Response.json({ result: reply(sent!) })); await waitFor(() => expect(props.onCaptured).not.toHaveBeenCalled());
  expect((screen.getByRole('textbox', { name: 'Public page URL' }) as HTMLInputElement).value).toBe(''); expect(JSON.parse(localStorage.getItem(key)!).state).toBe('unknown');
});
it('recovers transient draft read failure and preserves corrupt bytes before explicit rebuilding', async () => {
  const record = JSON.stringify({ schema: 1, request: { operationId: 'kept', url: 'https://example.com/保留输入' }, state: 'draft' }); localStorage.setItem(key, record);
  vi.spyOn(recovery, 'flushDurableRecord').mockResolvedValueOnce(false);
  render(<MokinaWebEvidence {...props} />); await screen.findByRole('alert'); expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Read draft again' })); expect((await screen.findByRole('textbox'))).toHaveProperty('value', 'https://example.com/保留输入');
  cleanup(); localStorage.setItem(key, '{broken'); render(<MokinaWebEvidence {...props} />); await screen.findByRole('alert');
  expect(localStorage.getItem(key)).toBe('{broken'); fireEvent.click(screen.getByRole('button', { name: 'Back up damaged draft and rebuild' }));
  await screen.findByRole('textbox'); const backup = Object.keys(localStorage).find(k => k.startsWith(key + ':unreadable:'));
  expect(localStorage.getItem(backup!)).toBe('{broken'); expect(localStorage.getItem(key)).toBeNull();
});
it('keeps a known page failure editable, and retains composition text without normalization', async () => {
  const fetchMock = vi.fn(async () => Response.json({ error: { code: 'WEB_HTTP_ERROR', message: 'HTTP 403' } }, { status: 502 })); vi.stubGlobal('fetch', fetchMock);
  render(<MokinaWebEvidence {...props} />); const input = await enter();
  fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: 'https://example.com/中文资料' } }); fireEvent.compositionEnd(input);
  expect(input).toHaveProperty('value', 'https://example.com/中文资料'); expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Read public page' })); await screen.findByText(/HTTP 403/);
  expect(JSON.parse(localStorage.getItem(key)!).state).toBe('draft'); expect(screen.getByRole('button', { name: 'Read public page' })).not.toHaveProperty('disabled', true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('backs up local input and re-reads a competing draft after a running CAS conflict', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
  render(<MokinaWebEvidence {...props} />); const input = await enter();
  const other = JSON.stringify({ schema: 1, state: 'draft', request: { operationId: 'other-window', url: 'https://example.com/other' } });
  localStorage.setItem(key, other); fireEvent.change(input, { target: { value: 'https://example.com/my-input' } });
  await screen.findByRole('alert'); expect(input).toHaveProperty('value', 'https://example.com/my-input');
  expect(localStorage.getItem(key)).toBe(other);
  fireEvent.click(screen.getByRole('button', { name: 'Back up my input and read current draft' }));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveProperty('value', 'https://example.com/other'));
  const backup = Object.keys(localStorage).find(k => k.includes(':conflict:'));
  expect(JSON.parse(localStorage.getItem(backup!)!).request.url).toBe('https://example.com/my-input');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.com/accepted' } });
  await waitFor(() => expect(JSON.parse(localStorage.getItem(key)!).request.url).toBe('https://example.com/accepted'));
  expect(fetchMock).not.toHaveBeenCalled();
});
