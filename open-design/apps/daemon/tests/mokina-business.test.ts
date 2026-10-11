import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SaveMokinaBusinessRequest } from '@open-design/contracts';
import { readBusinessDocument, saveBusinessDocument } from '../src/mokina/business-documents.js';
import { projectFileWriteTestHooks } from '../src/projects.js';
import { buildProjectRecoveryPackage, importProjectRecoveryPackage } from '../src/mokina/recovery-package.js';
import { listProjectFileVersions } from '../src/project-file-versions.js';

describe('M1 business facts and Brief', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'mokina-business-')); await mkdir(path.join(root, 'p1')); await mkdir(path.join(root, 'p2')); });
  afterEach(async () => { projectFileWriteTestHooks.afterCommit = null; await rm(root, { recursive: true, force: true }); });
  const background = (operationId = 'save1'): SaveMokinaBusinessRequest => ({ operationId, expectedRevision: null, body: {
    kind: 'background', value: { title: '茶品牌', preferences: '喜欢简洁排版', facts: [
      { id: 'fact1', text: '仅线上销售', source: '用户确认 2026-10-11', scope: '当前品牌', status: 'confirmed' },
      { id: 'suggestion1', text: '建议增加门店试饮', source: '营销建议', scope: '待讨论', status: 'proposed' },
    ] },
  } });
  const save = (projectId: string, request: SaveMokinaBusinessRequest) => saveBusinessDocument({ projectsRoot: root, projectId, request });
  it('keeps recommendations proposed and separates personal preferences', async () => {
    const saved = await save('p1', background());
    expect(saved.document.body).toEqual(background().body);
    expect(saved.versionId).toBeTruthy();
    expect(await readBusinessDocument({ projectsRoot: root, projectId: 'p1', kind: 'background' })).toEqual(saved);
  });
  it('reconciles the same operation without producing a second version; rejects changed semantics and stale edits', async () => {
    const first = await save('p1', background());
    expect(await save('p1', background())).toEqual(first);
    expect(await listProjectFileVersions(root, 'p1', first.fileName)).toHaveLength(1);
    const changed = background(); changed.body.value.title = 'Changed';
    await expect(save('p1', changed)).rejects.toMatchObject({ code: 'MOKINA_BUSINESS_CONFLICT' });
    await expect(save('p1', background('save2'))).rejects.toMatchObject({ code: 'MOKINA_BUSINESS_CONFLICT' });
  });
  it('requires confirmed source items, freezes the chosen version and does not reuse preferences as facts', async () => {
    const source = await save('p1', background());
    const request: SaveMokinaBusinessRequest = { operationId: 'brief1', expectedRevision: null, body: { kind: 'brief', value: {
      title: '线上活动', goal: '明确获客方案', audience: '新客', deliverables: [{ id: 'plan', title: '营销方案' }],
      kpi: '', budget: '不超过 3 万元', period: '', constraints: '禁止线下活动', missing: '人员、产能、报价、周期待确认',
    }, background: { projectId: 'p1', versionId: source.versionId!, revision: source.revision, factIds: ['suggestion1'] } } };
    await expect(save('p2', request)).rejects.toMatchObject({ code: 'MOKINA_BUSINESS_SOURCE_INVALID' });
    if (request.body.kind !== 'brief' || !request.body.background) throw new Error('fixture');
    request.body.background.factIds = ['fact1'];
    const brief = await save('p2', request);
    expect(brief.document.backgroundSnapshot?.facts.map(fact => fact.text)).toEqual(['仅线上销售']);
    const next = background('save2'); next.expectedRevision = source.revision; next.body.value.title = '修改后的品牌';
    await save('p1', next);
    expect(await readBusinessDocument({ projectsRoot: root, projectId: 'p2', kind: 'brief' })).toEqual(brief);
    expect(brief.document.body).toEqual(request.body);
  });
  it('treats unknown or externally modified HTML as a conflict instead of empty background', async () => {
    expect(await readBusinessDocument({ projectsRoot: root, projectId: 'p1', kind: 'brief' })).toBeNull();
    await writeFile(path.join(root, 'p1', 'business-background.html'), '<html>Legacy artifact</html>');
    await expect(save('p1', background())).rejects.toMatchObject({ code: 'MOKINA_BUSINESS_UNRECOGNIZED' });
    expect(await readFile(path.join(root, 'p1', 'business-background.html'), 'utf8')).toBe('<html>Legacy artifact</html>');
  });
  it('recovers an unknown file commit using the same operation after restart without duplicate history', async () => {
    projectFileWriteTestHooks.afterCommit = () => { throw new Error('simulated process interruption after file commit'); };
    await expect(save('p1', background())).rejects.toThrow('process interruption');
    projectFileWriteTestHooks.afterCommit = null;
    const uncertain = await readBusinessDocument({ projectsRoot: root, projectId: 'p1', kind: 'background' });
    expect(uncertain?.versionId).toBeNull();
    expect(uncertain?.document.operationId).toBe('save1');
    const reconciled = await save('p1', background());
    expect(reconciled.versionId).toBeTruthy();
    expect(await listProjectFileVersions(root, 'p1', reconciled.fileName)).toHaveLength(1);
  });
  it('does not apply an old operation again after another revision has been saved', async () => {
    const first = await save('p1', background());
    const second = background('save2'); second.expectedRevision = first.revision; second.body.value.title = 'Second';
    const saved = await save('p1', second);
    const old = background(); old.expectedRevision = saved.revision;
    await expect(save('p1', old)).rejects.toMatchObject({ code: 'MOKINA_BUSINESS_CONFLICT' });
    expect((await readBusinessDocument({ projectsRoot: root, projectId: 'p1', kind: 'background' }))?.revision).toBe(saved.revision);
  });
  it('preserves the canonical document and history through the existing recovery package', async () => {
    const saved = await save('p1', background());
    const archive = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'Business', exportId: 'export1' });
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: archive.buffer, operationId: 'restore1', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
    expect(imported.ok).toBe(true);
    const restored = await readBusinessDocument({ projectsRoot: root, projectId: 'restored', kind: 'background' });
    expect(restored?.document).toEqual(saved.document);
    expect(restored?.revision).toBe(saved.revision);
  });

  it('reconciles a committed Brief after its source project is gone, without re-reading or substituting the source', async () => {
    const source = await save('p1', background());
    const request: SaveMokinaBusinessRequest = { operationId: 'brief1', expectedRevision: null, body: { kind: 'brief', value: {
      title: 'Brief', goal: '', audience: '', deliverables: [], kpi: '', budget: '', period: '', constraints: '', missing: '',
    }, background: { projectId: 'p1', versionId: source.versionId!, revision: source.revision, factIds: ['fact1'] } } };
    projectFileWriteTestHooks.afterCommit = () => { throw new Error('lost acknowledgement'); };
    await expect(save('p2', request)).rejects.toThrow('lost acknowledgement');
    projectFileWriteTestHooks.afterCommit = null;
    await rm(path.join(root, 'p1'), { recursive: true });
    const reconciled = await save('p2', request);
    expect(reconciled.versionId).toBeTruthy();
    expect(reconciled.document.backgroundSnapshot?.facts[0]?.text).toBe('仅线上销售');
  });

  it('supports lazy managed roots but never treats an unavailable imported folder as an empty Brief', async () => {
    await rm(path.join(root, 'p1'), { recursive: true });
    expect(await readBusinessDocument({ projectsRoot: root, projectId: 'p1', kind: 'brief' })).toBeNull();
    expect((await save('p1', background())).versionId).toBeTruthy();
    const scope = { projectsRoot: root, projectId: 'p2', metadata: { baseDir: path.join(root, 'missing-import') } };
    await expect(readBusinessDocument({ ...scope, kind: 'brief' })).rejects.toThrow();
    await expect(saveBusinessDocument({ ...scope, request: background() })).rejects.toThrow();
  });

  it('serializes competing first saves and keeps the losing draft from overwriting the winner', async () => {
    const results = await Promise.allSettled([save('p1', background('first')), save('p1', background('second'))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected).toMatchObject({ status: 'rejected', reason: { code: 'MOKINA_BUSINESS_CONFLICT' } });
    expect(await listProjectFileVersions(root, 'p1', 'business-background.html')).toHaveLength(1);
  });

});
