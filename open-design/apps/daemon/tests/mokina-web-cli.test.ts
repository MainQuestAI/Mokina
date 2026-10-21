import { afterEach, expect, it, vi } from 'vitest';
import { runWebEvidenceCli } from '../src/mokina/web-evidence-cli.js';
import { parseFlags } from '../src/cli-shared.js';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const deps = { parseFlags, cliDaemonUrl: async () => 'http://127.0.0.1:12345' };
it('sends one explicit capture and queries the same operation without a retry or a second POST', async () => {
  const fetchMock = vi.fn(async () => Response.json({ result: null })); vi.stubGlobal('fetch', fetchMock); vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const args = ['--project', 'p', '--url', 'https://example.com/page', '--operation-id', 'one'];
  await runWebEvidenceCli('capture', args, deps); await runWebEvidenceCli('read', args, deps);
  expect(fetchMock.mock.calls[0]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence', expect.objectContaining({ method: 'POST', body: JSON.stringify({ operationId: 'one', url: 'https://example.com/page' }) })]);
  expect(fetchMock.mock.calls[1]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence/one', {}]);
});
it('rejects unknown flags and missing values through the real strict parser', async () => {
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await expect(runWebEvidenceCli('capture', ['--project', 'p', '--operation-id', 'one', '--url', 'https://example.com/', '--unknown', 'x'], deps)).rejects.toThrow('unknown flag: --unknown');
  await expect(runWebEvidenceCli('capture', ['--project', 'p', '--operation-id', 'one', '--url'], deps)).rejects.toThrow('flag --url requires a value');
});
it('exits 3 on transport failure and 4 on a daemon error body', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(async () => { throw Object.assign(new Error('connect refused'), { cause: { code: 'ECONNREFUSED' } }); }));
  await runWebEvidenceCli('read', ['--project', 'p', '--operation-id', 'one'], deps);
  expect(process.exitCode).toBe(3); expect(logged.mock.calls.join()).toContain('ECONNREFUSED');
  process.exitCode = 0;
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { code: 'WEB_CAPTURE_CONFLICT', message: 'conflict' } }, { status: 409 })));
  await runWebEvidenceCli('read', ['--project', 'p', '--operation-id', 'one'], deps);
  expect(process.exitCode).toBe(4); expect(stderr.mock.calls.join()).toContain('WEB_CAPTURE_CONFLICT');
  process.exitCode = 0;
});
