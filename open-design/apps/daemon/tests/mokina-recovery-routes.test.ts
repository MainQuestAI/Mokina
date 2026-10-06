import type http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile as writeLocalFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

describe('mokina recovery recovery routes', () => {
  let server: http.Server;
  let baseUrl: string;
  const projectsToClean: string[] = [];

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(async () => {
    for (const id of projectsToClean.splice(0)) {
      await fetch(`${baseUrl}/api/projects/${id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function createProject(): Promise<string> {
    const id = `mokina-recovery-${randomUUID()}`;
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, name: '恢复包测试项目' }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    projectsToClean.push(id);
    return id;
  }

  async function writeFile(projectId: string, name: string, content: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/files`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
  }

  async function createVersion(projectId: string, name: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/files/${encodeURIComponent(name)}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'manual', label: 'checkpoint' }),
    });
    expect(response.status).toBe(200);
  }

  async function exportRecovery(projectId: string, operationId: string): Promise<Response> {
    return fetch(`${baseUrl}/api/projects/${projectId}/mokina/recovery-export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operationId }),
    });
  }

  async function importRecovery(
    archive: Buffer,
    body: { operationId: string; targetProjectId: string; projectName?: string },
  ): Promise<{ status: number; body: any }> {
    const form = new FormData();
    form.append('operationId', body.operationId);
    form.append('targetProjectId', body.targetProjectId);
    if (body.projectName) form.append('projectName', body.projectName);
    form.append('file', new Blob([archive], { type: 'application/zip' }), 'recovery.zip');
    const response = await fetch(`${baseUrl}/api/mokina/recovery-import`, { method: 'POST', body: form });
    return { status: response.status, body: await response.json().catch(() => null) };
  }

  it('round-trips a project (originals + versions) into a new project id', async () => {
    const projectId = await createProject();
    await writeFile(projectId, 'plan.html', '<section id="a" data-mokina-id="a">第一版</section>');
    await createVersion(projectId, 'plan.html');
    await writeFile(projectId, 'plan.html', '<section id="a" data-mokina-id="a">第二版</section>');
    await createVersion(projectId, 'plan.html');

    const exported = await exportRecovery(projectId, randomUUID());
    expect(exported.status).toBe(200);
    expect(exported.headers.get('content-type')).toContain('application/zip');
    const archive = Buffer.from(await exported.arrayBuffer());
    expect(archive.length).toBeGreaterThan(0);

    const targetProjectId = `mokina-restored-${randomUUID()}`;
    projectsToClean.push(targetProjectId);
    const imported = await importRecovery(archive, {
      operationId: randomUUID(),
      targetProjectId,
      projectName: '恢复后的项目',
    });
    expect(imported.status).toBe(200);
    expect(imported.body.projectId).toBe(targetProjectId);

    const restoredFile = await fetch(`${baseUrl}/api/projects/${targetProjectId}/files/plan.html`);
    expect(restoredFile.status).toBe(200);
    expect(await restoredFile.text()).toContain('第二版');

    const versionsResponse = await fetch(`${baseUrl}/api/projects/${targetProjectId}/files/plan.html/versions`);
    expect(versionsResponse.status).toBe(200);
    const versionsBody = await versionsResponse.json() as { versions: Array<{ current?: boolean }>; file: unknown };
    expect(versionsBody.versions.length).toBeGreaterThanOrEqual(2);
    expect(versionsBody.versions.filter((version) => version.current).length).toBe(1);

    const project = await fetch(`${baseUrl}/api/projects/${targetProjectId}`);
    const projectBody = await project.json() as { project: { name: string } };
    expect(projectBody.project.name).toBe('恢复后的项目');
  });

  it('reuses the completed import identity and rejects another owner or corrupted archive', async () => {
    const projectId = await createProject();
    await writeFile(projectId, 'plan.html', '<section id="a" data-mokina-id="a">x</section>');
    const exported = await exportRecovery(projectId, randomUUID());
    const archive = Buffer.from(await exported.arrayBuffer());

    const targetProjectId = `mokina-restored-${randomUUID()}`;
    projectsToClean.push(targetProjectId);
    const operationId = randomUUID();
    const first = await importRecovery(archive, { operationId, targetProjectId });
    expect(first.status).toBe(200);

    const again = await importRecovery(archive, { operationId, targetProjectId });
    expect(again.status).toBe(200);
    expect(again.body.projectId).toBe(targetProjectId);

    const otherOwner = await importRecovery(archive, { operationId: randomUUID(), targetProjectId });
    expect(otherOwner.status).toBe(409);
    expect(otherOwner.body?.error?.code).toBe('MOKINA_OPERATION_CONFLICT');

    const corrupted = await importRecovery(Buffer.from('not a zip'), {
      operationId: randomUUID(),
      targetProjectId: `mokina-restored-${randomUUID()}`,
    });
    expect(corrupted.status).toBe(400);
  });

  it('refuses an export without an operationId and a non-project id', async () => {
    const projectId = await createProject();
    const missingOperation = await fetch(`${baseUrl}/api/projects/${projectId}/mokina/recovery-export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingOperation.status).toBe(400);

    const unknownProject = await exportRecovery('no-such-project', randomUUID());
    expect([403, 404]).toContain(unknownProject.status);
  });

  it('RR1 refuses unsafe targets through the actual HTTP import endpoint', async () => {
    const source = await createProject(); await writeFile(source, 'plan.html', 'boundary');
    const archive = Buffer.from(await (await exportRecovery(source, randomUUID())).arrayBuffer());
    for (const targetProjectId of ['../sibling', '.', '..', '/absolute', 'a\\b', 'x'.repeat(129)]) {
      const result = await importRecovery(archive, { operationId: randomUUID(), targetProjectId });
      expect(result.status).toBe(400); expect(result.body?.error?.code).toBe('BAD_REQUEST');
    }
    expect(await (await fetch(`${baseUrl}/api/projects/${source}/files/plan.html`)).text()).toContain('boundary');
  });

  it('RR2 overlapping HTTP retries register one intact project and refuse another owner', async () => {
    const source = await createProject(); await writeFile(source, 'plan.html', 'overlap'); await createVersion(source, 'plan.html');
    const archive = Buffer.from(await (await exportRecovery(source, randomUUID())).arrayBuffer());
    const targetProjectId = `mokina-overlap-${randomUUID()}`; projectsToClean.push(targetProjectId);
    const operationId = randomUUID();
    const results = await Promise.all(Array.from({ length: 4 }, () => importRecovery(archive, { operationId, targetProjectId })));
    expect(results.map(result => result.status)).toEqual([200, 200, 200, 200]);
    expect(results.every(result => result.body.projectId === targetProjectId)).toBe(true);
    expect((await importRecovery(archive, { operationId: randomUUID(), targetProjectId })).status).toBe(409);
    expect(await (await fetch(`${baseUrl}/api/projects/${targetProjectId}/files/plan.html`)).text()).toContain('overlap');
    const versions = await (await fetch(`${baseUrl}/api/projects/${targetProjectId}/files/plan.html/versions`)).json() as { versions: unknown[] };
    const original = await (await fetch(`${baseUrl}/api/projects/${source}/files/plan.html/versions`)).json() as { versions: unknown[] };
    expect(versions.versions).toHaveLength(original.versions.length);
  });

  it('RR1 actual CLI rejects an unsafe target through the daemon', async () => {
    const source = await createProject(); await writeFile(source, 'plan.html', 'cli boundary');
    const archive = Buffer.from(await (await exportRecovery(source, randomUUID())).arrayBuffer());
    const temporary = await mkdtemp(join(tmpdir(), 'mokina-rr-cli-'));
    try {
      const file = join(temporary, 'recovery.zip'); await writeLocalFile(file, archive);
      const result = await new Promise<{ code: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
          'mokina', 'recovery', 'import', '--file', file, '--target-project', '../sibling', '--operation-id', randomUUID(), '--daemon-url', baseUrl, '--json']);
        let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', reject); child.on('close', code => resolve({ code, output }));
      });
      expect(result.code).not.toBe(0); expect(result.output).toContain('targetProjectId');
    } finally { await rm(temporary, { recursive: true, force: true }); }
  });
});
