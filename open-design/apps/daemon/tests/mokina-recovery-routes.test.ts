import type http from 'node:http';
import { randomUUID } from 'node:crypto';
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
    expect(response.status).toBe(200);
    projectsToClean.push(id);
    return id;
  }

  async function writeFile(projectId: string, name: string, content: string): Promise<void> {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/files`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    expect(response.status).toBe(200);
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
});
