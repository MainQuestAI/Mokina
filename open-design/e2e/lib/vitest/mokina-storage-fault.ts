import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { chmod, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Lock one actual, already-persisted record in a test profile. A synchronous
 * test-side handshake arms the filesystem fault before the next real IPC CAS.
 * This endpoint is an ephemeral fixture, never mounted on the product daemon.
 */
export async function createMokinaStorageFault(recoveryRoot: string) {
  const locked = new Set<string>();
  const evidence: unknown[] = [];
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const key = new URL(request.url!, 'http://fixture').searchParams.get('key') ?? '';
      if (!key.startsWith('od:continuation:') && !key.startsWith('mokina:context-snapshot:')) throw new Error('fixture only locks continuation or binding records');
      const file = join(recoveryRoot, `${createHash('sha256').update(key).digest('hex').slice(0, 40)}.json`);
      const raw = JSON.parse(await readFile(file, 'utf8'));
      if (raw.key !== key || raw.deleted) throw new Error('actual live record identity mismatch');
      await execFileAsync('/usr/bin/chflags', ['uchg', file]);
      locked.add(file); evidence.push({ key, record: raw });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ armed: true }));
    } catch (error) {
      response.writeHead(500); response.end(String(error));
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing fixture listener');
  return {
    url: `http://127.0.0.1:${address.port}/lock`, evidence,
    async unlock() {
      for (const file of locked) await execFileAsync('/usr/bin/chflags', ['nouchg', file]);
      locked.clear();
    },
    async close() {
      for (const file of locked) await execFileAsync('/usr/bin/chflags', ['nouchg', file]);
      locked.clear();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

/** A real readdir failure, restricted to UUID project directories in the
 * opt-in test namespace. Restore permissions before persistence or restart. */
export async function createMokinaDirectoryReadFault(projectsRoot: string) {
  if (!/^\/private\/tmp\/.+\/runtime\/mac\/namespaces\/mokina-local-[^/]+\/data\/projects$/.test(projectsRoot)) {
    throw new Error('directory fault requires an isolated tools-pack project root');
  }
  const modes = new Map<string, number>();
  const evidence: unknown[] = [];
  async function restore() {
    for (const [directory, mode] of modes) await chmod(directory, mode);
    modes.clear();
  }
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const url = new URL(request.url!, 'http://fixture');
      if (url.pathname === '/restore') await restore();
      else {
        const projectId = url.searchParams.get('projectId') ?? '';
        if (!/^[0-9a-f-]{36}$/u.test(projectId)) throw new Error('invalid actual target identity');
        const directory = join(projectsRoot, projectId);
        const info = await stat(directory);
        if (!info.isDirectory()) throw new Error('target is not an actual project directory');
        const mode = info.mode & 0o777;
        modes.set(directory, mode);
        await chmod(directory, 0);
        evidence.push({ projectId, directory, originalMode: mode, injectedMode: 0 });
      }
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ armed: modes.size > 0 }));
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('missing directory fixture listener');
  return {
    url: `http://127.0.0.1:${address.port}`, evidence, unlock: restore,
    async close() { await restore(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
