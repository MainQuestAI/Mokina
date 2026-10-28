import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MokinaWebCaptureReceipt, MokinaWebCaptureResult } from '@open-design/contracts';
import { runWebEvidenceCli } from '../src/mokina/web-evidence-cli.js';
import { parseFlags } from '../src/cli-shared.js';
import { renderWebEvidenceDocument, webEvidenceDigest } from '../src/mokina/web-evidence-document.js';
const originalExitCode = process.exitCode;
beforeEach(() => { process.exitCode = 0; });
afterEach(() => { process.exitCode = originalExitCode; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const deps = { parseFlags, cliDaemonUrl: async () => 'http://127.0.0.1:12345' };
const args = ['--project', 'p', '--url', 'https://example.com/page', '--operation-id', 'one'];
function captured(): MokinaWebCaptureResult {
  const text = 'A saved public statement.';
  const receipt: MokinaWebCaptureReceipt = { schema: 'mokina.web-evidence.v1', operationId: 'one',
    requestedUrl: 'https://example.com/page', resolvedUrl: 'https://example.com/page', retrievedAt: '2026-10-28T00:00:00.000Z',
    statusCode: 200, contentType: 'text/plain', bodyDigest: webEvidenceDigest(text), textDigest: webEvidenceDigest(text),
    parserVersion: 'mokina-public-web-v1', scope: 'plain-text', limitations: ['Static text only.'] };
  const content = renderWebEvidenceDocument(receipt, text), contentDigest = webEvidenceDigest(content);
  return { fileName: 'evidence/web-one.md', versionId: 'saved-one', contentDigest, content, receipt, workingFile: 'matched',
    material: { name: 'evidence/web-one.md', sourceVersionId: 'saved-one', webCapture: receipt, contentDigest,
      status: 'read', limitations: [], sections: [{ location: 'paragraph 1', text }] } };
}
it('sends one explicit capture and queries the same operation without a retry or a second POST', async () => {
  const fetchMock = vi.fn(async () => Response.json({ result: captured() })); vi.stubGlobal('fetch', fetchMock); vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await runWebEvidenceCli('capture', args, deps); await runWebEvidenceCli('read', args, deps);
  expect(fetchMock.mock.calls[0]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence', expect.objectContaining({ method: 'POST', body: JSON.stringify({ operationId: 'one', url: 'https://example.com/page' }) })]);
  expect(fetchMock.mock.calls[1]).toEqual(['http://127.0.0.1:12345/api/projects/p/mokina/web-evidence/one', {}]);
  expect(process.exitCode).toBe(0);
});
it('accepts a successful read with no saved result', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ result: null })));
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await runWebEvidenceCli('read', args, deps);
  expect(process.exitCode).toBe(0); expect(stdout).toHaveBeenCalledWith('{\n  "result": null\n}\n');
});
it.each([
  ['invalid JSON', () => new Response('{')],
  ['missing result', () => Response.json({})],
  ['null capture', () => Response.json({ result: null })],
  ['missing fields', () => Response.json({ result: { versionId: 'saved-one' } })],
  ['wrong operation', () => Response.json({ result: { ...captured(), receipt: { ...captured().receipt, operationId: 'other' } } })],
  ['wrong URL', () => Response.json({ result: { ...captured(), receipt: { ...captured().receipt, requestedUrl: 'https://example.com/other' } } })],
  ['wrong material version', () => Response.json({ result: { ...captured(), material: { ...captured().material, sourceVersionId: 'other' } } })],
  ['damaged receipt', () => Response.json({ result: { ...captured(), receipt: { ...captured().receipt, textDigest: 'bad' } } })],
  ['damaged content', () => Response.json({ result: { ...captured(), content: 'Changed after save' } })],
] as const)('reports an unknown capture result for a 2xx %s without retrying POST', async (_label, response) => {
  const fetchMock = vi.fn(async () => response()); vi.stubGlobal('fetch', fetchMock);
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  await runWebEvidenceCli('capture', args, deps);
  expect(process.exitCode).toBe(3); expect(stdout).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(stderr.mock.calls.join()).toContain('unknown');
  expect(stderr.mock.calls.join()).toContain("od research read --project 'p' --operation-id one");
});
it('treats a successful read with an invalid envelope as unavailable instead of an empty result', async () => {
  const fetchMock = vi.fn(async () => Response.json({})); vi.stubGlobal('fetch', fetchMock);
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true); vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  await runWebEvidenceCli('read', args, deps);
  expect(process.exitCode).toBe(3); expect(stdout).not.toHaveBeenCalled(); expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('reports usage errors with exit code 2 instead of a stack trace', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  await runWebEvidenceCli('capture', ['--project', 'p', '--operation-id', 'one', '--url', 'https://example.com/', '--unknown', 'x'], deps);
  expect(process.exitCode).toBe(2); expect(logged.mock.calls.join()).toContain('unknown flag: --unknown');
  process.exitCode = 0;
  await runWebEvidenceCli('capture', ['--project', 'p', '--operation-id', 'one', '--url'], deps);
  expect(process.exitCode).toBe(2); expect(logged.mock.calls.join()).toContain('flag --url requires a value');
  process.exitCode = 0;
  await runWebEvidenceCli('capture', ['--project', 'p', '--operation-id', 'one', '--url', 'http://127.0.0.1/'], deps);
  expect(process.exitCode).toBe(2); expect(logged.mock.calls.join()).toContain('Only public HTTP(S) pages');
  process.exitCode = 0;
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
