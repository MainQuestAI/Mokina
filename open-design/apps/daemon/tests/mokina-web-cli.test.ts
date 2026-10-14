import { afterEach, expect, it, vi } from 'vitest';
import { runWebEvidenceCli } from '../src/mokina/web-evidence-cli.js';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('sends one explicit capture and queries the same operation without a retry or a second POST', async () => {
  const flags: Record<string, unknown> = { project: 'p', url: 'https://example.com/page', 'operation-id': 'one' };
  const fetchMock = vi.fn(async () => Response.json({ result: null })); vi.stubGlobal('fetch', fetchMock); vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const deps = { parseFlags: () => flags, cliDaemonUrl: async () => 'http://127.0.0.1:12345' };
  await runWebEvidenceCli('capture', [], deps); await runWebEvidenceCli('read', [], deps);
  expect(fetchMock.mock.calls[0]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence', expect.objectContaining({ method: 'POST', body: JSON.stringify({ operationId: 'one', url: 'https://example.com/page' }) })]);
  expect(fetchMock.mock.calls[1]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence/one', {}]);
});
