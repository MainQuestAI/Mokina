import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildProjectRecoveryPackage,
  importProjectRecoveryPackage,
  isSafeRecoveryPath,
  parseRecoveryManifest,
} from '../src/mokina/recovery-package.js';

import { prepareMokinaContextSnapshot, readMokinaContextSnapshot } from '../src/mokina/context-store.js';
import { createProjectFileVersion, listProjectFileVersions } from '../src/project-file-versions.js';

function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function seedProject(root: string): Promise<void> {
  const projectRoot = path.join(root, 'p1');
  await mkdir(path.join(projectRoot, 'assets'), { recursive: true });
  await writeFile(path.join(projectRoot, 'plan.html'), '<section id="a" data-mokina-id="a">A</section>', 'utf8');
  await writeFile(path.join(projectRoot, 'assets', 'logo.svg'), '<svg/>', 'utf8');
  await writeFile(path.join(projectRoot, 'secret.txt'), 'kept because it is project data', 'utf8');
  // version store: one file, two versions, second is current
  const key = createHash('sha256').update('plan.html').digest('hex').slice(0, 24);
  const versionRoot = path.join(projectRoot, '.file-versions', key);
  await mkdir(versionRoot, { recursive: true });
  const v1 = '<section id="a" data-mokina-id="a">v1</section>';
  const v2 = '<section id="a" data-mokina-id="a">v2</section>';
  await writeFile(path.join(versionRoot, '0001-v1.html'), v1, 'utf8');
  await writeFile(path.join(versionRoot, '0002-v2.html'), v2, 'utf8');
  await writeFile(path.join(versionRoot, 'manifest.json'), JSON.stringify({
    entries: [
      { id: 'v1', fileName: 'plan.html', version: 1, label: 'first', createdAt: 1, source: 'manual', prompt: null, size: v1.length, mime: 'text/html', kind: 'html', contentPath: '0001-v1.html', contentDigest: sha256(Buffer.from(v1)) },
      { id: 'v2', fileName: 'plan.html', version: 2, label: 'second', createdAt: 2, source: 'ai', prompt: null, size: v2.length, mime: 'text/html', kind: 'html', contentPath: '0002-v2.html', contentDigest: sha256(Buffer.from(v2)), parentVersionId: 'v1' },
    ],
    currentVersionId: 'v2',
  }), 'utf8');
  const blob = Buffer.from('<svg id="logo"/>');
  const prepared = await prepareMokinaContextSnapshot({ projectsRoot: root, projectId: 'p1',
    source: { readProjectFile: async () => ({ bytes: blob }) },
    request: { snapshotId: 'snap-1', excluded: [], selections: [{ itemId: 'A1', mode: 'asset',
      sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'assets/logo.svg' },
      expectedSourceDigest: sha256(blob), role: 'logo', usageNote: '品牌标识' }] } });
  if (!prepared.ok) throw new Error(prepared.message);

}

async function registered(): Promise<{ readProject: (id: string) => null; registerProject: (row: { id: string; name: string; metadata: Record<string, unknown> }) => void }> {
  return { readProject: () => null, registerProject: () => undefined };
}

describe('mokina recovery package', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'mokina-recovery-'));
    await seedProject(root);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { force: true, recursive: true });
  });

  it.each(['../sentinel', '.', '..', 'sub\\file', 'x'.repeat(129), 'absolute'])('RR1 refuses unsafe target %s before consulting the registry', async target => {
    const managed = path.join(root, 'managed');
    const sentinel = path.join(root, 'sentinel');
    await mkdir(managed); await mkdir(sentinel);
    await writeFile(path.join(sentinel, 'keep.txt'), 'unchanged');
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'boundary' });
    const readProject = vi.fn(() => null); const registerProject = vi.fn();
    const result = await importProjectRecoveryPackage({ projectsRoot: managed, archive: built.buffer, operationId: 'boundary',
      targetProjectId: target === 'absolute' ? sentinel : target, readProject, registerProject });
    expect(result).toMatchObject({ ok: false, status: 400, code: 'BAD_REQUEST' });
    expect(readProject).not.toHaveBeenCalled(); expect(registerProject).not.toHaveBeenCalled();
    expect(await readFile(path.join(sentinel, 'keep.txt'), 'utf8')).toBe('unchanged');
    expect(await readdir(managed)).toEqual([]);
  });

  it.each(['directory', 'file', 'symlink'])('RR1 preserves an unowned target %s', async kind => {
    const target = path.join(root, 'occupied');
    if (kind === 'directory') { await mkdir(target); await writeFile(path.join(target, 'keep.txt'), 'unchanged'); }
    if (kind === 'file') await writeFile(target, 'unchanged');
    if (kind === 'symlink') await symlink(path.join(root, 'p1'), target);
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'occupied' });
    const result = await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer, operationId: 'occupied', targetProjectId: 'occupied', ...await registered() });
    expect(result).toMatchObject({ ok: false, status: 409, code: 'MOKINA_OPERATION_CONFLICT' });
    expect((await lstat(target)).isSymbolicLink()).toBe(kind === 'symlink');
    if (kind === 'file') expect(await readFile(target, 'utf8')).toBe('unchanged');
    if (kind === 'directory') expect(await readFile(path.join(target, 'keep.txt'), 'utf8')).toBe('unchanged');
    expect(await readMokinaContextSnapshot(root, 'p1', 'snap-1')).toMatchObject({ ok: true });
  });

  it.each([false, true])('RR2 serializes overlapping imports (different owner: %s) without deleting the winner', async differentOwner => {
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'overlap' });
    let release!: () => void; let entered!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { entered = resolve; });
    const load = JSZip.loadAsync.bind(JSZip);
    vi.spyOn(JSZip, 'loadAsync').mockImplementationOnce(async (...args) => { entered(); await blocked; return load(...args); });
    const rows = new Map<string, { metadata: Record<string, unknown> }>();
    const registerProject = vi.fn((row: { id: string; metadata: Record<string, unknown> }) => {
      if (rows.has(row.id)) throw new Error('duplicate registration'); rows.set(row.id, row);
    });
    const input = { projectsRoot: root, archive: built.buffer, operationId: 'overlap', targetProjectId: 'p2', readProject: (id: string) => rows.get(id) ?? null, registerProject };
    const first = importProjectRecoveryPackage(input); await reached;
    const second = importProjectRecoveryPackage({ ...input, operationId: differentOwner ? 'another' : input.operationId });
    release(); const results = await Promise.all([first, second]);
    expect(results[0]).toMatchObject({ ok: true, projectId: 'p2' });
    expect(results[1]).toMatchObject(differentOwner ? { ok: false, status: 409 } : { ok: true, projectId: 'p2' });
    expect(registerProject).toHaveBeenCalledTimes(1);
    expect(await readFile(path.join(root, 'p2', 'plan.html'), 'utf8')).toBe(await readFile(path.join(root, 'p1', 'plan.html'), 'utf8'));
    expect(await readMokinaContextSnapshot(root, 'p2', 'snap-1')).toMatchObject({ ok: true });
    expect(await listProjectFileVersions(root, 'p2', 'plan.html')).toHaveLength(2);
  });

  it('RR2 preserves a committed directory after registration failure and recovers it with the same identity', async () => {
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'commit-gap' });
    let row: { metadata: Record<string, unknown> } | null = null;
    const registerProject = vi.fn((next: { metadata: Record<string, unknown> }) => { row = next; });
    registerProject.mockImplementationOnce(() => { throw new Error('registration interrupted'); });
    const input = { projectsRoot: root, archive: built.buffer, operationId: 'commit-gap', targetProjectId: 'p2', readProject: () => row, registerProject };
    expect(await importProjectRecoveryPackage(input)).toMatchObject({ ok: false });
    expect(row).toBeNull();
    const before = await readFile(path.join(root, 'p2', 'plan.html'));
    expect(await importProjectRecoveryPackage({ ...input, operationId: 'intruder' })).toMatchObject({ ok: false, status: 409 });
    expect(await importProjectRecoveryPackage(input)).toMatchObject({ ok: true, projectId: 'p2' });
    expect(await readFile(path.join(root, 'p2', 'plan.html'))).toEqual(before);
    expect(await readMokinaContextSnapshot(root, 'p2', 'snap-1')).toMatchObject({ ok: true });
    expect(registerProject).toHaveBeenCalledTimes(2);
  });

  it('RR2 does not register a partially staged package after a file/directory collision', async () => {
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'stage-failure' });
    const zip = await JSZip.loadAsync(built.buffer);
    const manifest = JSON.parse(await zip.file('mokina-recovery.json')!.async('text'));
    for (const relative of ['blocked', 'blocked/file.txt']) {
      const bytes = Buffer.from(relative); zip.file(relative, bytes);
      manifest.files.push({ path: relative, kind: 'original', byteLength: bytes.length, sha256: sha256(bytes) });
    }
    zip.file('mokina-recovery.json', JSON.stringify(manifest));
    const registerProject = vi.fn();
    const result = await importProjectRecoveryPackage({ projectsRoot: root, archive: await zip.generateAsync({ type: 'nodebuffer' }),
      operationId: 'stage-failure', targetProjectId: 'p2', readProject: () => null, registerProject });
    expect(result).toMatchObject({ ok: false }); expect(registerProject).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual(['p1']);
  });

  it('reads imported snapshots with the production reader after source deletion and re-exports them', async () => {
    const original = await readMokinaContextSnapshot(root, 'p1', 'snap-1');
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'source', exportId: 'export-read' });
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'op-read', targetProjectId: 'p2', ...await registered() });
    expect(imported.ok).toBe(true);
    await rm(path.join(root, 'p1'), { recursive: true });
    const recovered = await readMokinaContextSnapshot(root, 'p2', 'snap-1');
    expect(recovered.ok).toBe(true);
    if (original.ok && recovered.ok) expect(recovered.snapshot.fingerprint).toBe(original.snapshot.fingerprint);
    const second = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p2', projectName: 'restored', exportId: 'export-again' });
    expect(second.manifest.contexts).toHaveLength(1);
  });

  it('keeps the adopted current version separate from a later candidate in the production reader after import', async () => {
    const content = await readFile(path.join(root, 'p1', 'plan.html'), 'utf8');
    const current = await createProjectFileVersion(root, 'p1', 'plan.html', content);
    const candidate = await createProjectFileVersion(root, 'p1', 'plan.html', `${content}<p>unadopted</p>`,
      { candidate: true, baseVersionId: current.id, operationId: 'unadopted-candidate' });
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'source', exportId: 'version-roundtrip' });
    expect(built.manifest.versions.find(version => version.current)?.originalVersionId).toBe(current.id);
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'import-versions', targetProjectId: 'p2', ...await registered() });
    expect(imported.ok).toBe(true);
    const versions = await listProjectFileVersions(root, 'p2', 'plan.html');
    expect(versions.find(version => version.current)?.id).toBe(current.id);
    expect(versions.find(version => version.id === candidate.id)).toMatchObject({ candidate: true, current: false, baseVersionId: current.id });
    expect(await readFile(path.join(root, 'p2', 'plan.html'), 'utf8')).toBe(content);
    const again = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p2', projectName: 'restored', exportId: 'versions-again' });
    expect(again.manifest.versions.find(version => version.current)?.originalVersionId).toBe(current.id);
    expect(again.manifest.versions.find(version => version.originalVersionId === candidate.id)).toMatchObject({ candidate: true, current: false });
  });

  it('validates recovery paths strictly', () => {
    expect(isSafeRecoveryPath('plan.html')).toBe(true);
    expect(isSafeRecoveryPath('a/b/c.png')).toBe(true);
    expect(isSafeRecoveryPath('/abs.png')).toBe(false);
    expect(isSafeRecoveryPath('../x.png')).toBe(false);
    expect(isSafeRecoveryPath('a/../../x.png')).toBe(false);
    expect(isSafeRecoveryPath('a\\b.png')).toBe(false);
    expect(isSafeRecoveryPath('C:/x.png')).toBe(false);
    expect(isSafeRecoveryPath('')).toBe(false);
  });

  it('exports originals, versions and contexts with a verifiable manifest', async () => {
    const built = await buildProjectRecoveryPackage({
      projectsRoot: root, projectId: 'p1', projectName: '方案项目', exportId: 'exp-1',
    });
    expect(built.manifest.schema).toBe('mokina.project-recovery.v1');
    expect(built.manifest.versions).toHaveLength(2);
    expect(built.manifest.versions.find((version) => version.current)?.originalVersionId).toBe('v2');
    expect(built.manifest.contexts).toEqual([
      { originalSnapshotId: 'snap-1', payloadPath: '.mokina/contexts/snap-1.json', fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
    ]);
    const parsed = parseRecoveryManifest(JSON.parse(await (await JSZip.loadAsync(built.buffer)).file('mokina-recovery.json')!.async('text')));
    expect(parsed).not.toBeNull();
    const zip = await JSZip.loadAsync(built.buffer);
    for (const file of parsed!.files) {
      const content = await zip.file(file.path)!.async('nodebuffer');
      expect(content.length).toBe(file.byteLength);
      expect(sha256(content)).toBe(file.sha256);
    }
  });

  it('round-trips a project into a new id without touching the source', async () => {
    const built = await buildProjectRecoveryPackage({
      projectsRoot: root, projectId: 'p1', projectName: '方案项目', exportId: 'exp-2',
    });
    let registeredRow: { id: string; name: string; metadata: Record<string, unknown> } | null = null;
    const result = await importProjectRecoveryPackage({
      projectsRoot: root,
      archive: built.buffer,
      operationId: 'op-1',
      targetProjectId: 'p2',
      readProject: () => null,
      registerProject: (row) => { registeredRow = row; },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projectId).toBe('p2');
    expect(registeredRow).toMatchObject({ id: 'p2', name: '方案项目' });
    expect(registeredRow!.metadata.mokinaOperationId).toBe('op-1');

    const restoredPlan = await readFile(path.join(root, 'p2', 'plan.html'), 'utf8');
    expect(restoredPlan).toContain('data-mokina-id="a"');
    const restoredManifest = JSON.parse(await readFile(
      path.join(root, 'p2', '.file-versions', createHash('sha256').update('plan.html').digest('hex').slice(0, 24), 'manifest.json'),
      'utf8',
    )) as { entries: Array<{ id: string; candidate?: boolean }>; currentVersionId: string };
    expect(restoredManifest.currentVersionId).toBe('v2');
    expect(restoredManifest.entries.map((entry) => entry.id).sort()).toEqual(['v1', 'v2']);
    // Source project untouched.
    expect(await readFile(path.join(root, 'p1', 'plan.html'), 'utf8')).toContain('data-mokina-id="a"');
  });

  it('rejects a tampered file hash and a path traversal entry', async () => {
    const built = await buildProjectRecoveryPackage({
      projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'exp-3',
    });
    const zip = await JSZip.loadAsync(built.buffer);
    const manifest = JSON.parse(await zip.file('mokina-recovery.json')!.async('text')) as {
      files: Array<{ path: string; sha256: string }>;
    };
    manifest.files[0]!.sha256 = sha256('tampered');
    zip.file('mokina-recovery.json', JSON.stringify(manifest));
    const tampered = await zip.generateAsync({ type: 'nodebuffer' });
    const bad = await importProjectRecoveryPackage({
      projectsRoot: root, archive: tampered, operationId: 'op-2', targetProjectId: 'p3',
      readProject: () => null, registerProject: () => undefined,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain('校验失败');

    // A manifest that points outside the archive root is rejected at parse
    // time (entry names themselves are additionally guarded per entry).
    const zip2 = await JSZip.loadAsync(built.buffer);
    const manifest2 = JSON.parse(await zip2.file('mokina-recovery.json')!.async('text')) as {
      files: Array<{ path: string }>;
    };
    manifest2.files[0]!.path = '../escape.txt';
    zip2.file('mokina-recovery.json', JSON.stringify(manifest2));
    const refused = await importProjectRecoveryPackage({
      projectsRoot: root, archive: await zip2.generateAsync({ type: 'nodebuffer' }),
      operationId: 'op-3', targetProjectId: 'p4',
      readProject: () => null, registerProject: () => undefined,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toContain('清单校验失败');
  });

  it('refuses to overwrite a project owned by another operation', async () => {
    const built = await buildProjectRecoveryPackage({
      projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'exp-4',
    });
    const conflict = await importProjectRecoveryPackage({
      projectsRoot: root, archive: built.buffer, operationId: 'op-other', targetProjectId: 'p1',
      readProject: () => ({ metadata: { mokinaOperationId: 'op-first' } }),
      registerProject: () => undefined,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe('MOKINA_OPERATION_CONFLICT');

    const same = await importProjectRecoveryPackage({
      projectsRoot: root, archive: built.buffer, operationId: 'op-first', targetProjectId: 'p1',
      readProject: () => ({ metadata: { mokinaOperationId: 'op-first', mokinaArchiveDigest: sha256(built.buffer), mokinaRecoveryManifest: built.manifest } }),
      registerProject: () => { throw new Error('must not register twice'); },
    });
    expect(same.ok).toBe(true);
    if (same.ok) expect(same.projectId).toBe('p1');
  });

  it('rejects tampered snapshot content even when ZIP and manifest checksums are updated', async () => {
    const built = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'tamper' });
    const zip = await JSZip.loadAsync(built.buffer);
    const manifest = JSON.parse(await zip.file('mokina-recovery.json')!.async('text'));
    const payloadPath = manifest.contexts[0].payloadPath;
    const snapshot = JSON.parse(await zip.file(payloadPath)!.async('text'));
    snapshot.items[0].usageNote = '篡改';
    const bytes = Buffer.from(JSON.stringify(snapshot));
    const record = manifest.files.find((file: { path: string }) => file.path === payloadPath);
    record.sha256 = sha256(bytes); record.byteLength = bytes.length;
    zip.file(payloadPath, bytes); zip.file('mokina-recovery.json', JSON.stringify(manifest));
    const result = await importProjectRecoveryPackage({ projectsRoot: root, archive: await zip.generateAsync({ type: 'nodebuffer' }),
      operationId: 'tamper', targetProjectId: 'p2', ...await registered() });
    expect(result.ok).toBe(false);
  });

  it('rejects a manifest whose version graph is inconsistent', async () => {
    const built = await buildProjectRecoveryPackage({
      projectsRoot: root, projectId: 'p1', projectName: 'P', exportId: 'exp-5',
    });
    const zip = await JSZip.loadAsync(built.buffer);
    const manifest = JSON.parse(await zip.file('mokina-recovery.json')!.async('text')) as {
      versions: Array<{ current: boolean; candidate: boolean }>;
    };
    manifest.versions[0]!.current = true; // v2 is already current → two currents
    zip.file('mokina-recovery.json', JSON.stringify(manifest));
    const bad = await importProjectRecoveryPackage({
      projectsRoot: root, archive: await zip.generateAsync({ type: 'nodebuffer' }),
      operationId: 'op-4', targetProjectId: 'p5',
      readProject: () => null, registerProject: () => undefined,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain('多个当前版本');
  });
});
