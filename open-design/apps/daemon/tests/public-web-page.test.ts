import { afterEach, expect, it, vi } from 'vitest';
import { readPublicWebPage } from '../src/mokina/public-web-page.js';
import { fetchExternalBrandAsset } from '../src/brands/safe-fetch.js';
import { readWebEvidenceDocument } from '../src/mokina/web-evidence-document.js';
vi.mock('../src/brands/safe-fetch.js', () => ({ fetchExternalBrandAsset: vi.fn() }));
afterEach(() => { vi.mocked(fetchExternalBrandAsset).mockReset(); vi.useRealTimers(); });
const request = { operationId: 'one', url: 'https://example.com/article' };
it('captures real response bytes separately from limited static text and never executes markup', async () => {
  vi.mocked(fetchExternalBrandAsset).mockResolvedValue(new Response('<html><body><h1>公开研究</h1><p>支持摘录</p><script>danger()</script><div hidden>hidden claim</div></body></html>', { headers: { 'content-type': 'text/html;charset=utf-8' } }));
  const saved = await readPublicWebPage(request); const parsed = readWebEvidenceDocument(saved.content, saved.receipt);
  expect(parsed.text).toContain('支持摘录'); expect(parsed.text).not.toContain('danger'); expect(parsed.text).not.toContain('hidden claim');
  expect(saved.receipt.scope).toBe('static-html-text'); expect(saved.receipt.bodyDigest).not.toBe(saved.receipt.textDigest); expect(saved.receipt.limitations.join(' ')).toContain('scripts');
});
it.each([
  [403, 'text/html', '<p>Denied</p>', 'WEB_HTTP_ERROR'],
  [200, 'application/pdf', 'PDF', 'WEB_FORMAT_UNSUPPORTED'],
  [200, 'text/html;charset=gb2312', '<p>legacy</p>', 'WEB_FORMAT_UNSUPPORTED'],
  [200, 'text/html', '<script>not a body</script>', 'WEB_EMPTY'],
  [200, 'text/plain', new Uint8Array([0xff]), 'WEB_ENCODING_UNSUPPORTED'],
  [200, 'text/plain', 'x'.repeat(2 * 1024 * 1024 + 1), 'WEB_TOO_LARGE'],
  [200, 'text/plain', 'x'.repeat(512 * 1024), 'WEB_TOO_LARGE'],
])('refuses unsupported or failed response %s %s', async (status, type, body, code) => {
  vi.mocked(fetchExternalBrandAsset).mockResolvedValue(new Response(body, { status, headers: { 'content-type': type } }));
  await expect(readPublicWebPage(request)).rejects.toMatchObject({ code });
});
it('bounds pending DNS/request work and accepts cancellation without retry', async () => {
  vi.useFakeTimers(); vi.mocked(fetchExternalBrandAsset).mockReturnValue(new Promise(() => {}));
  const pending = readPublicWebPage(request); const assertion = expect(pending).rejects.toMatchObject({ code: 'WEB_READ_STOPPED' });
  await vi.advanceTimersByTimeAsync(30_000); await assertion; expect(fetchExternalBrandAsset).toHaveBeenCalledTimes(1);
});
it.each(['http://127.0.0.1/a', 'http://169.254.169.254/', 'http://[::1]/', 'https://user:pass@example.com/', 'file:///tmp/a'])('rejects unsafe inputs before any request: %s', async url => {
  await expect(readPublicWebPage({ ...request, url })).rejects.toThrow(); expect(fetchExternalBrandAsset).not.toHaveBeenCalled();
});
