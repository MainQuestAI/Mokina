// N04 review: POST /api/projects/:id/mokina/context-snapshots freezes brand
// bytes into a project snapshot, so every referenced design system must pass
// the same read authorization as GET /api/design-systems/:id — project write
// access alone must not exfiltrate a brand the caller may not read. These
// tests pin the gate: denial short-circuits before any freeze read, approval
// routes the read through the injected detail-path reader.

import express from 'express';
import type http from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeDatabase, openDatabase } from '../src/db.js';
import { registerProjectFileRoutes } from '../src/routes/project/index.js';

let server: http.Server | null = null;
let root: string | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
  closeDatabase();
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function listen(app: express.Express): Promise<string> {
  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      resolve(`http://127.0.0.1:${(server?.address() as { port: number }).port}`);
    });
  });
}

function brandSelection(designSystemId: string, body: string) {
  return {
    itemId: 'B1',
    mode: 'groups',
    textKind: 'brand-rule',
    sourceRef: { kind: 'design-system', designSystemId },
    expectedSourceDigest: createHash('sha256').update(body, 'utf8').digest('hex'),
  };
}

async function startWith(options: {
  authorize: (id: string) => Promise<boolean> | boolean;
  readBody?: string | null;
}) {
  root = mkdtempSync(path.join(os.tmpdir(), 'od-mokina-brand-gate-'));
  const db = openDatabase(root, { dataDir: path.join(root, 'data') });
  const projectsRoot = path.join(root, 'projects');
  const authorizeDesignSystemRead = vi.fn(async (req: any, res: any, id: string) => {
    const allowed = await options.authorize(id);
    if (!allowed) {
      res.status(403).json({
        error: 'WORKSPACE_DESIGN_SYSTEM_PERMISSION_DENIED',
        message: 'workspace design_system read is not allowed',
      });
    }
    return allowed;
  });
  const readDesignSystemForFreeze = vi.fn(async (_req: any, id: string) => {
    const body = options.readBody === undefined ? `# ${id}` : options.readBody;
    return body === null ? null : { body, displayName: `Brand ${id}` };
  });

  const app = express();
  app.use(express.json());
  registerProjectFileRoutes(app, {
    appConfig: { readAppConfig: async () => ({}) } as never,
    db,
    http: {
      sendApiError: (res: any, status: number, code: string, message: string) => {
        res.status(status).json({ error: { code, message } });
      },
      sendMulterError: (res: any, err: unknown) => res.status(400).json({ error: String(err) }),
    } as never,
    paths: {
      PROJECTS_DIR: projectsRoot,
      DESIGN_SYSTEMS_DIR: path.join(root, 'design-systems'),
      USER_DESIGN_SYSTEMS_DIR: path.join(root, 'user-design-systems'),
    } as never,
    uploads: { upload: undefined, handleProjectUpload: async () => ({}) } as never,
    node: { fs: await import('node:fs'), path: await import('node:path') } as never,
    projectStore: {
      getProject: () => ({ id: 'project-1', metadata: undefined }),
      getWorkspaceProject: () => null,
      getWorkspaceProjectByProjectId: () => null,
    } as never,
    projectFiles: {} as never,
    documents: {} as never,
    artifacts: {} as never,
    projectPreviewScopes: {} as never,
    authorizeProjectRequest: async () => true,
    mokinaBrandDesignSystems: { authorizeDesignSystemRead, readDesignSystemForFreeze },
  });
  const baseUrl = await listen(app);
  return { baseUrl, authorizeDesignSystemRead, readDesignSystemForFreeze };
}

async function postSnapshot(baseUrl: string, selections: unknown[]) {
  const response = await fetch(`${baseUrl}/api/projects/project-1/mokina/context-snapshots`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshotId: 'snapshot-1', selections, excluded: [] }),
  });
  return { status: response.status, body: await response.json().catch(() => null) as any };
}

describe('mokina context snapshot brand gate', () => {
  it('freezes an authorized brand through the injected detail-path reader', async () => {
    const { baseUrl, authorizeDesignSystemRead, readDesignSystemForFreeze } = await startWith({
      authorize: () => true,
    });
    const result = await postSnapshot(baseUrl, [brandSelection('user:brand-a', '# user:brand-a')]);
    expect(result.status).toBe(201);
    expect(authorizeDesignSystemRead).toHaveBeenCalledTimes(1);
    expect(authorizeDesignSystemRead.mock.calls[0]![2]).toBe('user:brand-a');
    expect(readDesignSystemForFreeze).toHaveBeenCalledTimes(1);
    expect(result.body.snapshot.items[0].kind).toBe('brand-rule');
    expect(result.body.snapshot.items[0].displayName).toBe('Brand user:brand-a · 品牌规则');
  });

  it('denies the freeze with the authorization verdict before any brand read', async () => {
    const { baseUrl, readDesignSystemForFreeze } = await startWith({ authorize: () => false });
    const result = await postSnapshot(baseUrl, [brandSelection('user:secret-brand', '# user:secret-brand')]);
    expect(result.status).toBe(403);
    expect(result.body?.error).toBe('WORKSPACE_DESIGN_SYSTEM_PERMISSION_DENIED');
    expect(readDesignSystemForFreeze).not.toHaveBeenCalled();
  });

  it('authorizes each unique brand id exactly once', async () => {
    const { baseUrl, authorizeDesignSystemRead } = await startWith({ authorize: () => true });
    const duplicate = brandSelection('user:brand-b', '# user:brand-b');
    const result = await postSnapshot(baseUrl, [duplicate, { ...duplicate }]);
    // Duplicate itemIds are rejected after authorization; the point here is
    // that two references to one brand cost one authorization call.
    expect(authorizeDesignSystemRead).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(400);
  });

  it('leaves non-brand selections on the existing project-file-only path', async () => {
    const { baseUrl, authorizeDesignSystemRead } = await startWith({ authorize: () => true });
    const result = await postSnapshot(baseUrl, [{
      itemId: 'N1',
      mode: 'note',
      sourceRef: { kind: 'user-note' },
      text: '补充说明',
    }]);
    expect(result.status).toBe(201);
    expect(authorizeDesignSystemRead).not.toHaveBeenCalled();
  });
});
