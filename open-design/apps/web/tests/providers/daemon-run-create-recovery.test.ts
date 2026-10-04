// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import { streamViaDaemon, queryRunByClientRequest } from '../../src/providers/daemon';
const options = () => ({ agentId: 'codex', projectId: 'p', conversationId: 'c', prompt: 'hello', history: [], skillId: null, designSystemId: null,
  signal: new AbortController().signal, runCreateTimeoutMs: 30_000,
  handlers: { onAgentEvent: vi.fn(), onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() },
  onBeforeRunCreate: vi.fn(() => true), onRunCreateFailed: vi.fn(), onRunCreateAccepted: vi.fn() });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it('dispatch persistence refusal performs no POST and ends the busy/error surface', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch'); const input = options(); input.onBeforeRunCreate.mockReturnValue(false);
  await streamViaDaemon(input);
  expect(fetch).not.toHaveBeenCalled(); expect(input.onRunCreateFailed).toHaveBeenCalledWith({ definitive: true });
  expect(input.handlers.onError).toHaveBeenCalledOnce();
});
it('30 seconds aborts creation; timeout remains unknown and releases local preparation', async () => {
  vi.useFakeTimers(); const input = options();
  vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true });
  }));
  const pending = streamViaDaemon(input);
  await vi.advanceTimersByTimeAsync(29_999); expect(input.onRunCreateFailed).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); await pending;
  expect(input.onRunCreateFailed).toHaveBeenCalledWith({ definitive: false }); expect(input.handlers.onError).toHaveBeenCalledOnce();
});
it('an accepted receipt cannot regress to create failure when its stream fails', async () => {
  const input = options(); const controller = new AbortController(); input.signal = controller.signal;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/runs') return new Response(JSON.stringify({ runId: 'accepted' }));
    throw new Error('stream offline');
  });
  // Already abort the stream after the receipt, avoiding reconnect timers.
  input.onRunCreateAccepted.mockImplementation(() => controller.abort());
  await streamViaDaemon(input);
  expect(input.onRunCreateAccepted).toHaveBeenCalledOnce(); expect(input.onRunCreateFailed).not.toHaveBeenCalled();
});
it('unstructured gateway failure is unknown while structured refusal restores the draft', async () => {
  for (const [body, definitive] of [['gateway receipt lost', false], [JSON.stringify({ error: { code: 'WORKSPACE_AUTHORITY_UNAVAILABLE', message: 'refused' } }), true]] as const) {
    const input = options(); vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status: 503 }));
    await streamViaDaemon(input); expect(input.onRunCreateFailed).toHaveBeenCalledWith({ definitive });
  }
});
it('acceptance query carries original workspace identity and ignores runs from other scopes', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ runs: [
    { id: 'other', projectId: 'other', conversationId: 'c', clientRequestId: 'request' },
    { id: 'original', projectId: 'p', conversationId: 'c', clientRequestId: 'request', status: 'running' },
  ] })));
  const context = { workspaceId: 'ws-A', workspaceType: 'team', workspaceMemberId: 'member-A', role: 'owner', memberStatus: 'active', lifecycleState: 'active', permissions: {} } as WorkspaceCollabContext;
  expect(await queryRunByClientRequest('p', 'c', 'request', { workspaceContext: context })).toMatchObject({ id: 'original' });
  expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ 'x-od-workspace-id': 'ws-A', 'x-od-workspace-member-id': 'member-A' });
});
