import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  buildProjectRecoveryPackage,
  importProjectRecoveryPackage,
  isSafeRecoveryPath,
  parseRecoveryManifest,
} from '../src/mokina/recovery-package.js';

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
  // context snapshot + blob
  const contextDir = path.join(projectRoot, '.mokina', 'contexts');
  const blobDir = path.join(projectRoot, '.mokina', 'blobs');
  await mkdir(contextDir, { recursive: true });
  await mkdir(blobDir, { recursive: true });
  const blob = Buffer.from('<svg id="logo"/>');
  const blobId = sha256(blob);
  await writeFile(path.join(blobDir, blobId), blob);
  await writeFile(path.join(contextDir, 'snap-1.json'), JSON.stringify({
    schemaVersion: 1, snapshotId: 'snap-1', projectId: 'p1', createdAt: '2026-10-04T00:00:00.000Z',
    parserVersion: 'mokina-material/1', selectionFingerprint: sha256('sel'),
    items: [{ kind: 'asset', itemId: 'A1', blobId }], excluded: [], fingerprint: sha256('fp'),
  }), 'utf8');
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
    await rm(root, { force: true, recursive: true });
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
      { originalSnapshotId: 'snap-1', payloadPath: '.mokina/contexts/snap-1.json', fingerprint: sha256('fp') },
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
      readProject: () => ({ metadata: { mokinaOperationId: 'op-first' } }),
      registerProject: () => undefined,
    });
    expect(same.ok).toBe(false);
    if (!same.ok) expect(same.code).toBe('MOKINA_RECOVERY_ALREADY_IMPORTED');
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
