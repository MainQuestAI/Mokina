import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProjectRecoveryPackage, importProjectRecoveryPackage } from '../src/mokina/recovery-package.js';
import { createProjectFileVersion } from '../src/project-file-versions.js';
import { prepareMokinaContextSnapshot } from '../src/mokina/context-store.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return { ...original, readFile: vi.fn(original.readFile) };
});

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

describe('M0 recovery package integrity', () => {
  let root: string;
  let versionRoot: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'mokina-integrity-'));
    await mkdir(path.join(root, 'p1'));
    await writeFile(path.join(root, 'p1', 'plan.html'), '<section id="a">Original</section>');
    versionRoot = path.join(root, 'p1', '.file-versions', digest('plan.html').slice(0, 24));
  });
  afterEach(async () => { vi.mocked(readFile).mockReset(); await rm(root, { recursive: true, force: true }); });
  const options = () => ({ projectsRoot: root, projectId: 'p1', projectName: 'Plan', exportId: 'export-1' });

  it('does not mistake an unreadable version directory for an empty history', async () => {
    await writeFile(path.join(root, 'p1', '.file-versions'), 'not a directory');
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
  });

  it('refuses a corrupt manifest instead of calling the remaining originals a complete backup', async () => {
    await mkdir(versionRoot, { recursive: true });
    await writeFile(path.join(versionRoot, 'manifest.json'), '{broken');
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
  });

  it('exports a new complete schema, while old v1 imports remain explicitly unproven', async () => {
    const built = await buildProjectRecoveryPackage(options());
    expect(built.manifest).toMatchObject({ schema: 'mokina.project-recovery.v2', integrity: { status: 'complete', issues: [] } });
    const zip = await JSZip.loadAsync(built.buffer);
    const legacy = { ...built.manifest, schema: 'mokina.project-recovery.v1' };
    delete (legacy as Record<string, unknown>).integrity;
    zip.file('mokina-recovery.json', JSON.stringify(legacy));
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: await zip.generateAsync({ type: 'nodebuffer' }),
      operationId: 'legacy', targetProjectId: 'legacy', readProject: () => null, registerProject: () => undefined });
    expect(imported).toMatchObject({ ok: true, integrity: { status: 'unknown' } });
  });

  it('requires explicit salvage and removes dependent versions without promoting an older version', async () => {
    const first = await createProjectFileVersion(root, 'p1', 'plan.html', '<section>first</section>');
    await createProjectFileVersion(root, 'p1', 'plan.html', '<section>second</section>', { source: 'manual', parentVersionId: first.id });
    const raw = JSON.parse(await readFile(path.join(versionRoot, 'manifest.json'), 'utf8'));
    await rm(path.join(versionRoot, raw.entries[0].contentPath));
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
    const built = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(built.manifest).toMatchObject({ schema: 'mokina.project-recovery.v2', integrity: { status: 'partial' } });
    expect(built.manifest.versions).toEqual([]);
    expect(built.manifest.integrity.issues.some(issue => issue.reason === 'dependency')).toBe(true);
    let row: { metadata: Record<string, unknown> } | null = null;
    const input = { projectsRoot: root, archive: built.buffer, operationId: 'salvage', targetProjectId: 'p2',
      readProject: () => row, registerProject: (next: { metadata: Record<string, unknown> }) => { row = next; } };
    const imported = await importProjectRecoveryPackage(input);
    expect(imported).toMatchObject({ ok: true, integrity: built.manifest.integrity });
    expect(await readFile(path.join(root, 'p2', 'plan.html'), 'utf8')).toContain('Original');
    const retry = await importProjectRecoveryPackage(input);
    expect(retry).toMatchObject({ ok: true, integrity: built.manifest.integrity });
    if (imported.ok && retry.ok) expect(retry.warnings).toEqual(imported.warnings);
  });

  it('never ships a snapshot without its frozen asset, including salvage packages', async () => {
    const bytes = Buffer.from('frozen image');
    const prepared = await prepareMokinaContextSnapshot({ projectsRoot: root, projectId: 'p1',
      source: { readProjectFile: async () => ({ bytes }) }, request: { snapshotId: 's1', excluded: [], selections: [{
        itemId: 'logo', mode: 'asset', sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'logo.png' },
        expectedSourceDigest: digest(bytes), role: 'logo', usageNote: '',
      }] } });
    expect(prepared.ok).toBe(true);
    await rm(path.join(root, 'p1', '.mokina', 'blobs', digest(bytes)));
    const built = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(built.manifest.contexts).toEqual([]);
    expect(built.manifest.integrity.status).toBe('partial');
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'salvage-assets', targetProjectId: 'p2', readProject: () => null, registerProject: () => undefined });
    expect(imported.ok).toBe(true);
  });
  it.each(['cycle', 'duplicate number'])('never labels a version graph with %s complete, and refuses it on import', async (fault) => {
    const first = await createProjectFileVersion(root, 'p1', 'plan.html', '<section>first</section>');
    await createProjectFileVersion(root, 'p1', 'plan.html', '<section>second</section>', { source: 'manual', parentVersionId: first.id });
    const valid = await buildProjectRecoveryPackage(options());
    const raw = JSON.parse(await readFile(path.join(versionRoot, 'manifest.json'), 'utf8'));
    if (fault === 'cycle') raw.entries[0].parentVersionId = raw.entries[1].id;
    else raw.entries[1].version = raw.entries[0].version;
    await writeFile(path.join(versionRoot, 'manifest.json'), JSON.stringify(raw));
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
    const salvage = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(salvage.manifest.versions).toEqual([]);
    expect(salvage.manifest.integrity.status).toBe('partial');
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: salvage.buffer,
      operationId: 'closed', targetProjectId: 'closed', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
    const zip = await JSZip.loadAsync(valid.buffer);
    const manifest = JSON.parse(await zip.file('mokina-recovery.json')!.async('string'));
    if (fault === 'cycle') manifest.versions[0].parentOriginalVersionId = manifest.versions[1].originalVersionId;
    else manifest.versions[1].versionNumber = manifest.versions[0].versionNumber;
    zip.file('mokina-recovery.json', JSON.stringify(manifest));
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: await zip.generateAsync({ type: 'nodebuffer' }),
      operationId: 'invalid-graph', targetProjectId: 'invalid-graph', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: false, status: 400 });
  });

  it('detects a same-size file change during export before calling it complete', async () => {
    const filename = path.join(root, 'p1', 'plan.html');
    const originalRead = (await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')).readFile;
    let replaced = false;
    vi.mocked(readFile).mockImplementation(async (...args: Parameters<typeof readFile>) => {
      const bytes = await originalRead(...args);
      if (args[0] === filename && !replaced) {
        replaced = true;
        await writeFile(filename, '<section id="a">Modified</section>');
      }
      return bytes;
    });
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({
      code: 'MOKINA_RECOVERY_INCOMPLETE', issues: expect.arrayContaining([expect.objectContaining({ path: 'plan.html', reason: 'changed' })]),
    });
  });

  it('reports the single-file capacity limit explicitly in a usable salvage package', async () => {
    const filename = path.join(root, 'p1', 'large.bin');
    await writeFile(filename, '');
    await truncate(filename, 64 * 1024 * 1024 + 1);
    const built = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(built.manifest.integrity.issues).toContainEqual(expect.objectContaining({ path: 'large.bin', reason: 'limit' }));
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'limit', targetProjectId: 'limit', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
  });

  it('reserves the manifest entry so a partial archive at the file count limit can be imported', async () => {
    for (let index = 0; index < 2000; index++) await writeFile(path.join(root, 'p1', `file-${index}.txt`), 'x');
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
    const built = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(built.manifest.files).toHaveLength(1999);
    expect(built.manifest.integrity.issues.some(issue => issue.reason === 'limit')).toBe(true);
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'count', targetProjectId: 'count', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
  }, 20_000);

  it.each(['unknown schema', 'invalid candidate'])('refuses %s instead of inventing version status', async (fault) => {
    await createProjectFileVersion(root, 'p1', 'plan.html', '<section>first</section>');
    const raw = JSON.parse(await readFile(path.join(versionRoot, 'manifest.json'), 'utf8'));
    if (fault === 'unknown schema') raw.schemaVersion = 99;
    else raw.entries[0].candidate = 'true';
    await writeFile(path.join(versionRoot, 'manifest.json'), JSON.stringify(raw));
    await expect(buildProjectRecoveryPackage(options())).rejects.toMatchObject({ code: 'MOKINA_RECOVERY_INCOMPLETE' });
    const salvage = await buildProjectRecoveryPackage({ ...options(), mode: 'partial' });
    expect(salvage.manifest.versions).toEqual([]);
    expect(salvage.manifest.integrity.status).toBe('partial');
  });

  it('includes managed versions and frozen context when originals live in an imported folder', async () => {
    const external = path.join(root, 'external-work');
    await mkdir(external);
    await writeFile(path.join(external, 'plan.html'), '<section>External original</section>');
    const version = await createProjectFileVersion(root, 'p1', 'plan.html', '<section>Managed history</section>', {}, { type: 'imported-folder', baseDir: external });
    const bytes = Buffer.from('frozen external logo');
    expect(await prepareMokinaContextSnapshot({ projectsRoot: root, projectId: 'p1',
      source: { readProjectFile: async () => ({ bytes }) }, request: { snapshotId: 'external-context', excluded: [], selections: [{
        itemId: 'logo', mode: 'asset', sourceRef: { kind: 'project-file', projectId: 'p1', fileName: 'logo.png' },
        expectedSourceDigest: digest(bytes), role: 'logo', usageNote: '',
      }] } })).toMatchObject({ ok: true });
    const built = await buildProjectRecoveryPackage({ ...options(), projectRoot: external });
    expect(built.manifest.integrity.status).toBe('complete');
    expect(built.manifest.versions.map(item => item.originalVersionId)).toEqual([version.id]);
    expect(built.manifest.contexts.map(item => item.originalSnapshotId)).toEqual(['external-context']);
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'external', targetProjectId: 'restored-external', readProject: () => null, registerProject: () => undefined });
    expect(imported).toMatchObject({ ok: true });
    expect(await readFile(path.join(root, 'restored-external', 'plan.html'), 'utf8')).toContain('External original');
    expect(await readFile(path.join(root, 'restored-external', built.manifest.versions[0]!.contentPath), 'utf8')).toContain('Managed history');
    expect(await readFile(path.join(root, 'restored-external', '.mokina/blobs', digest(bytes)))).toEqual(bytes);
    const reexported = await buildProjectRecoveryPackage({ ...options(), projectId: 'restored-external', exportId: 'external-again' });
    expect(reexported.manifest.integrity.status).toBe('complete');
    expect(reexported.manifest.versions).toHaveLength(1);
    expect(reexported.manifest.contexts).toHaveLength(1);
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: reexported.buffer,
      operationId: 'external-again', targetProjectId: 'restored-twice', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
    expect(await readFile(path.join(root, 'restored-twice', 'plan.html'), 'utf8')).toContain('External original');
    expect(await readFile(path.join(root, 'restored-twice', '.mokina/blobs', digest(bytes)))).toEqual(bytes);
  });

  it('exports a restored project again without treating the retained package manifest as user content', async () => {
    const built = await buildProjectRecoveryPackage(options());
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: built.buffer,
      operationId: 'first-restore', targetProjectId: 'p2', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
    const next = await buildProjectRecoveryPackage({ ...options(), projectId: 'p2', exportId: 'again' });
    expect(next.manifest.integrity.status).toBe('complete');
    expect(await importProjectRecoveryPackage({ projectsRoot: root, archive: next.buffer,
      operationId: 'second-restore', targetProjectId: 'p3', readProject: () => null, registerProject: () => undefined })).toMatchObject({ ok: true });
    expect(await readFile(path.join(root, 'p3', 'plan.html'), 'utf8')).toContain('Original');
  });

});
