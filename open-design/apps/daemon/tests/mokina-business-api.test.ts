import express from 'express';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { registerMokinaBusinessRoutes } from '../src/routes/project/mokina-business.js';
import type { MokinaBusinessReadResult } from '@open-design/contracts';
let root: string, server: Server, url: string;
const authorizations: string[] = [];
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'mokina-business-api-')); await mkdir(path.join(root, 'p1')); await mkdir(path.join(root, 'p2'));
  const app = express(); app.use(express.json()); authorizations.length = 0;
  registerMokinaBusinessRoutes(app, { projectsRoot: root, getProject: id => ['p1', 'p2'].includes(id) ? { id } : null,
    authorizeProjectRequest: async (req, res, id, options) => {
      authorizations.push(`${id}:${options.mode}`);
      if (req.headers['x-denied-project'] === id) { res.status(403).json({ error: { message: 'Denied' } }); return false; }
      return true;
    },
  });
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
const payload = { operationId: 'save1', expectedRevision: null, body: { kind: 'background', value: { title: 'Brand', preferences: '', facts: [
  { id: 'f1', text: '仅线上销售', source: '用户确认', scope: '品牌', status: 'confirmed' },
] } } };
function post(project: string, kind: string, body: unknown, denied?: string) {
  return fetch(`${url}/api/projects/${project}/mokina/business/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(denied ? { 'x-denied-project': denied } : {}) }, body: JSON.stringify(body) });
}
it('rejects invalid requests and stale edits without converting failure to an empty document', async () => {
  expect((await post('p1', 'background', {})).status).toBe(400);
  expect((await post('p1', 'brief', payload)).status).toBe(400);
  expect((await post('p1', 'background', payload)).status).toBe(200);
  expect((await post('p1', 'background', { ...payload, operationId: 'new' })).status).toBe(409);
  const read = await fetch(`${url}/api/projects/p1/mokina/business/background`);
  expect(((await read.json()) as { result: MokinaBusinessReadResult }).result.document.body.value.title).toBe('Brand');
  expect((await fetch(`${url}/api/projects/missing/mokina/business/brief`)).status).toBe(404);
});
it('requires independent source read authority before copying confirmed business facts', async () => {
  const source = ((await (await post('p1', 'background', payload)).json()) as { result: MokinaBusinessReadResult }).result;
  const brief = { operationId: 'brief1', expectedRevision: null, body: { kind: 'brief', value: { title: 'Brief', goal: '', audience: '', deliverables: [], kpi: '', budget: '', period: '', constraints: '', missing: '' },
    background: { projectId: 'p1', versionId: source.versionId, revision: source.revision, factIds: ['f1'] } } };
  expect((await post('p2', 'brief', brief, 'p1')).status).toBe(403);
  expect(authorizations.slice(-2)).toEqual(['p2:write', 'p1:read']);
  expect(((await (await fetch(`${url}/api/projects/p2/mokina/business/brief`)).json()) as { result: unknown }).result).toBeNull();
  expect((await post('p2', 'brief', brief)).status).toBe(200);
  expect((await post('p2', 'brief', brief, 'p2')).status).toBe(403);
});
