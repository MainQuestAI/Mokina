import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const requests: Array<{ url: string; body: string; contentType: string }> = [];
const archiveBytes = Buffer.from('CLI transport fixture');
const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push({ url: req.url!, body: Buffer.concat(chunks).toString(), contentType: req.headers['content-type'] ?? '' });
  if (req.url?.endsWith('/mokina/recovery-export')) {
    res.setHeader('content-type', 'application/zip');
    res.end(archiveBytes);
  } else {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ projectId: 'cli-target', operationId: 'cli-operation' }));
  }
});
let endpoint: string;
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mokina-cli-recovery-'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
beforeEach(() => requests.splice(0));
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});
function invoke(args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/cli.ts', import.meta.url)), ...args, '--daemon-url', endpoint], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}
it('executes the documented recovery import and forwards the original operation/target/file', async () => {
  const archive = join(directory, 'source.zip');
  await writeFile(archive, archiveBytes);
  const result = await invoke(['mokina', 'recovery', 'import', '--file', archive, '--target-project', 'cli-target', '--operation-id', 'cli-operation', '--json']);
  expect(result.code, result.stderr + result.stdout).toBe(0);
  expect(JSON.parse(result.stdout)).toMatchObject({ projectId: 'cli-target', operationId: 'cli-operation' });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ url: '/api/mokina/recovery-import' });
  expect(requests[0]!.contentType).toContain('multipart/form-data');
  expect(requests[0]!.body).toContain('cli-target');
  expect(requests[0]!.body).toContain('cli-operation');
  expect(requests[0]!.body).toContain(archiveBytes.toString());
});
it('executes the documented recovery export and writes the server bytes', async () => {
  const output = join(directory, 'export.zip');
  const result = await invoke(['mokina', 'recovery', 'export', '--project', 'cli-project', '--out', output, '--operation-id', 'cli-operation', '--json']);
  expect(result.code, result.stderr + result.stdout).toBe(0);
  expect(await readFile(output)).toEqual(archiveBytes);
  expect(requests).toEqual([{ url: '/api/projects/cli-project/mokina/recovery-export', body: JSON.stringify({ operationId: 'cli-operation' }), contentType: 'application/json' }]);
});

it('mints an operation identity when recovery export omits the optional flag', async () => {
  const result = await invoke(['mokina', 'recovery', 'export', '--project', 'cli-project', '--out', join(directory, 'default-export.zip'), '--json']);
  expect(result.code, result.stderr + result.stdout).toBe(0);
  const output = JSON.parse(result.stdout);
  expect(output.operationId).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.parse(requests[0]!.body).operationId).toBe(output.operationId);
});
it('mints an operation identity when recovery import omits the optional flag', async () => {
  const archive = join(directory, 'default-import.zip');
  await writeFile(archive, archiveBytes);
  const result = await invoke(['mokina', 'recovery', 'import', '--file', archive, '--target-project', 'cli-target', '--json']);
  expect(result.code, result.stderr + result.stdout).toBe(0);
  expect(requests[0]!.body).toMatch(/name="operationId"\r\n\r\n[0-9a-f-]{36}\r\n/);
});
