import type http from 'node:http';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startServer } from '../src/server.js';

describe('mokina context snapshot routes', () => {
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
    const id = `mokina-context-${randomUUID()}`;
    const response = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, name: 'Mokina context snapshot project' }),
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

  async function readMaterial(projectId: string, name: string) {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/files/${encodeURIComponent(name)}/material`);
    expect(response.status).toBe(200);
    return response.json() as Promise<{
      contentDigest: string;
      parserVersion?: string;
      sections: Array<{ groupId?: string; text: string }>;
    }>;
  }

  async function prepareSnapshot(projectId: string, body: unknown) {
    const response = await fetch(`${baseUrl}/api/projects/${projectId}/mokina/context-snapshots`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json().catch(() => null) as any };
  }

  it('freezes a selected material group, reuses an identical preparation and conflicts on a different one', async () => {
    const projectId = await createProject();
    const brief = ['# 品牌', '晨光茶饮禁止投放短视频', '', '# 预算', '总预算 50 万'].join('\n');
    await writeFile(projectId, 'brief.md', brief);
    const material = await readMaterial(projectId, 'brief.md');
    expect(material.parserVersion).toBeTruthy();
    const brandGroup = material.sections.find((section) => section.text.includes('禁止投放短视频'))?.groupId;
    expect(brandGroup).toBeTruthy();

    const snapshotId = randomUUID();
    const selection = {
      itemId: 'S1',
      mode: 'groups',
      textKind: 'material-excerpt',
      sourceRef: { kind: 'project-file', projectId, fileName: 'brief.md' },
      expectedSourceDigest: material.contentDigest,
      groupIds: [brandGroup],
    };
    const first = await prepareSnapshot(projectId, { snapshotId, selections: [selection], excluded: [] });
    expect(first.status).toBe(201);
    expect(first.body.snapshot.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.body.snapshot.items[0].text).toContain('禁止投放短视频');

    const again = await prepareSnapshot(projectId, { snapshotId, selections: [selection], excluded: [] });
    expect(again.status).toBe(200);
    expect(again.body.reused).toBe(true);

    const conflicting = await prepareSnapshot(projectId, {
      snapshotId,
      selections: [{ ...selection, groupIds: ['heading:2'] }],
      excluded: [],
    });
    expect(conflicting.status).toBe(409);
    expect(conflicting.body?.error?.code).toBe('MOKINA_SNAPSHOT_CONFLICT');

    const read = await fetch(`${baseUrl}/api/projects/${projectId}/mokina/context-snapshots/${snapshotId}`);
    expect(read.status).toBe(200);
    const readBody = await read.json() as any;
    expect(readBody.snapshot.fingerprint).toBe(first.body.snapshot.fingerprint);
  });

  it('rejects a source that changed after the preview digest', async () => {
    const projectId = await createProject();
    await writeFile(projectId, 'brief.md', '旧预算 50 万');
    const material = await readMaterial(projectId, 'brief.md');
    await writeFile(projectId, 'brief.md', '新预算 30 万');

    const result = await prepareSnapshot(projectId, {
      snapshotId: randomUUID(),
      selections: [{
        itemId: 'S1',
        mode: 'groups',
        textKind: 'material-excerpt',
        sourceRef: { kind: 'project-file', projectId, fileName: 'brief.md' },
        expectedSourceDigest: material.contentDigest,
        groupIds: ['lines:0'],
      }],
      excluded: [],
    });
    expect(result.status).toBe(409);
    expect(result.body?.error?.code).toBe('MOKINA_SOURCE_CHANGED');
  });

  it('freezes a brand source through the detail-route read path (server wiring)', async () => {
    // N04 review: the snapshot route must resolve brand bytes via the same
    // read path as GET /api/design-systems/:id. Freezing a built-in brand
    // end-to-end proves the injected services are wired in server.ts.
    const projectId = await createProject();
    const detail = await fetch(`${baseUrl}/api/design-systems/default`);
    expect(detail.status).toBe(200);
    const detailBody = await detail.json() as { body: string };
    const digest = createHash('sha256').update(detailBody.body, 'utf8').digest('hex');
    const result = await prepareSnapshot(projectId, {
      snapshotId: randomUUID(),
      selections: [{
        itemId: 'B1',
        mode: 'groups',
        textKind: 'brand-rule',
        sourceRef: { kind: 'design-system', designSystemId: 'default' },
        expectedSourceDigest: digest,
      }],
      excluded: [],
    });
    expect(result.status).toBe(201);
    expect(result.body.snapshot.items[0].kind).toBe('brand-rule');
    expect(result.body.snapshot.items[0].sourceRef).toEqual({ kind: 'design-system', designSystemId: 'default' });
  });

  it('publishes a missing snapshot as 404 and enforces the excerpt budget', async () => {
    const projectId = await createProject();
    const missing = await fetch(`${baseUrl}/api/projects/${projectId}/mokina/context-snapshots/does-not-exist`);
    expect(missing.status).toBe(404);

    const oversized = await prepareSnapshot(projectId, {
      snapshotId: randomUUID(),
      selections: [{ itemId: 'S1', mode: 'note', sourceRef: { kind: 'user-note' }, text: '甲'.repeat(24_001) }],
      excluded: [],
    });
    expect(oversized.status).toBe(413);
    expect(oversized.body?.error?.code).toBe('MOKINA_CONTEXT_LIMIT');
  });
});
