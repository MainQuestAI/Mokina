import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('[P1] actual Electron downloader does not share HTTP responses across authorization identities', async () => {
  const require = createRequire(import.meta.url);
  const owner = createRequire(require.resolve('app-builder-lib'));
  const get = createRequire(owner.resolve('@electron/get'));
  const { GotDownloader } = get('./GotDownloader.js');
  const scratch = await mkdtemp(join(tmpdir(), 'mokina-download-cache-'));
  const received: string[] = [];
  const server = createServer((request, response) => {
    const identity = request.headers.authorization ?? 'anonymous';
    received.push(identity);
    response.writeHead(200, { 'cache-control': 'public, max-age=3600', 'set-cookie': `session=${identity}` });
    response.end(`artifact-for-${identity}`);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('fixture address missing');
    const url = `http://127.0.0.1:${address.port}/artifact.zip`;
    const downloader = new GotDownloader();
    for (const identity of ['A', 'B', 'B']) {
      const target = join(scratch, `${identity}-${received.length}.zip`);
      await downloader.download(url, target, { quiet: true, timeout: { request: 3000 }, headers: { authorization: identity, 'cache-control': 'max-stale=999999' } });
      expect(await readFile(target, 'utf8')).toBe(`artifact-for-${identity}`);
    }
    expect(received).toEqual(['A', 'B', 'B']);
  } finally {
    if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(scratch, { recursive: true, force: true });
  }
});
