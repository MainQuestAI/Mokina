import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it, vi } from 'vitest';
import { ensureProject, projectDir, writeProjectFile } from '../src/projects.js';
import { captureWebEvidence, readCapturedWebEvidence, webEvidenceFileName } from '../src/mokina/web-evidence.js';
import { renderWebEvidenceDocument, webEvidenceDigest } from '../src/mokina/web-evidence-document.js';
import { createProjectFileVersion, listProjectFileVersions, readProjectFileVersion } from '../src/project-file-versions.js';
import { buildProjectRecoveryPackage, importProjectRecoveryPackage } from '../src/mokina/recovery-package.js';
import type { CaptureMokinaWebEvidenceRequest, MokinaWebCaptureReceipt } from '@open-design/contracts';
const fault = vi.hoisted(() => ({ target: '', code: '', race: '' }));
vi.mock('node:fs/promises', async original => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, link: async (...args: Parameters<typeof actual.link>) => {
    if (fault.target && String(args[1]) === fault.target) {
      if (fault.race) {
        // A racing writer wins the exclusive create, then our link observes EEXIST.
        await actual.writeFile(String(args[1]), fault.race);
        throw Object.assign(new Error('file already exists'), { code: 'EEXIST' });
      }
      throw Object.assign(new Error(fault.code ? 'hard links are not supported here' : 'disk write unavailable'), fault.code ? { code: fault.code } : {});
    }
    return actual.link(...args);
  } };
});
const roots: string[] = [];
afterEach(async () => { fault.target = ''; fault.code = ''; fault.race = ''; await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function scope() { const projectsRoot = await mkdtemp(path.join(tmpdir(), 'mokina-web-')); roots.push(projectsRoot); await ensureProject(projectsRoot, 'p'); return { projectsRoot, projectId: 'p' }; }
const request = { operationId: 'capture-one', url: 'https://example.com/article' };
function page(input: CaptureMokinaWebEvidenceRequest) {
  const text = 'Actual selected text, with a supported excerpt.\n';
  const receipt: MokinaWebCaptureReceipt = { schema: 'mokina.web-evidence.v1', operationId: input.operationId, requestedUrl: input.url, resolvedUrl: input.url,
    retrievedAt: '2026-10-14T04:00:00Z', statusCode: 200, contentType: 'text/plain', bodyDigest: webEvidenceDigest(text), textDigest: webEvidenceDigest(text),
    parserVersion: 'mokina-web/1', scope: 'plain-text', limitations: ['Public test source; no factual assessment.'] };
  return { receipt, content: renderWebEvidenceDocument(receipt, text) };
}
it('serializes duplicate operations, preserves a fixed version, and rejects changed intent', async () => {
  const s = await scope(); const read = vi.fn(async (input: CaptureMokinaWebEvidenceRequest) => page(input));
  const results = await Promise.all([captureWebEvidence(s, request, undefined, read), captureWebEvidence(s, request, undefined, read)]);
  expect(results[0].material.sections.map(item => item.text).join('\n')).toBe('Actual selected text, with a supported excerpt.');
  expect(results[0].material.parserVersion).toBe('mokina-material/web-1');
  expect(results[0]).toEqual(results[1]); expect(read).toHaveBeenCalledTimes(1);
  await expect(captureWebEvidence(s, { ...request, url: 'https://example.com/changed' }, undefined, read)).rejects.toMatchObject({ status: 409 });
  const file = path.join(projectDir(s.projectsRoot, 'p'), results[0]!.fileName);
  await writeFile(file, 'A user edited the working source.');
  const saved = await captureWebEvidence(s, request, undefined, read);
  expect(saved.workingFile).toBe('changed'); expect(saved.content).toContain('Actual selected text');
  expect(await readFile(file, 'utf8')).toBe('A user edited the working source.'); expect(read).toHaveBeenCalledTimes(1);
  expect((await listProjectFileVersions(s.projectsRoot, 'p', saved.fileName)).length).toBe(1);
});
it('queries a saved version after partial failure and only repairs its working file', async () => {
  const s = await scope(); const read = vi.fn(async (input: CaptureMokinaWebEvidenceRequest) => page(input));
  fault.target = path.join(await realpath(projectDir(s.projectsRoot, 'p')), webEvidenceFileName(request.operationId));
  await expect(captureWebEvidence(s, request, undefined, read)).rejects.toThrow('disk write unavailable');
  const saved = await readCapturedWebEvidence(s, request.operationId);
  expect(saved?.workingFile).toBe('missing'); expect(saved?.receipt).toEqual(page(request).receipt);
  fault.target = '';
  const recovered = await captureWebEvidence(s, request, undefined, read);
  expect(recovered.workingFile).toBe('matched'); expect(recovered.versionId).toBe(saved?.versionId); expect(read).toHaveBeenCalledTimes(1);
});
it('reports a concurrently materialized working file as changed instead of unavailable', async () => {
  const s = await scope(); const read = vi.fn(async (input: CaptureMokinaWebEvidenceRequest) => page(input));
  fault.target = path.join(await realpath(projectDir(s.projectsRoot, 'p')), webEvidenceFileName(request.operationId));
  await expect(captureWebEvidence(s, request, undefined, read)).rejects.toThrow('disk write unavailable');
  fault.target = '';
  const file = path.join(projectDir(s.projectsRoot, 'p'), webEvidenceFileName(request.operationId));
  await writeFile(file, 'A concurrent writer changed the source.');
  const saved = await captureWebEvidence(s, request, undefined, read);
  expect(saved.workingFile).toBe('changed'); expect(saved.content).toContain('Actual selected text');
  expect(await readFile(file, 'utf8')).toBe('A concurrent writer changed the source.');
});
it('absorbs a racing exclusive-create failure and reports the changed working file', async () => {
  const s = await scope(); const read = vi.fn(async (input: CaptureMokinaWebEvidenceRequest) => page(input));
  const file = path.join(await realpath(projectDir(s.projectsRoot, 'p')), webEvidenceFileName(request.operationId));
  // First capture leaves the version saved but the working file missing.
  fault.target = file; await expect(captureWebEvidence(s, request, undefined, read)).rejects.toThrow('disk write unavailable');
  // The recovery write loses the exclusive create to a racing writer: link
  // materializes the rival bytes and reports EEXIST, which must not surface
  // as an unavailable capture.
  fault.race = 'A racing writer materialized this path.';
  const saved = await captureWebEvidence(s, request, undefined, read);
  expect(saved.workingFile).toBe('changed');
  expect(await readFile(file, 'utf8')).toBe('A racing writer materialized this path.');
  expect(read).toHaveBeenCalledTimes(1);
});
it('falls back to an exclusive write when the volume rejects hard links', async () => {
  const s = await scope(); const read = vi.fn(async (input: CaptureMokinaWebEvidenceRequest) => page(input));
  fault.target = path.join(await realpath(projectDir(s.projectsRoot, 'p')), webEvidenceFileName(request.operationId));
  fault.code = 'EPERM';
  const saved = await captureWebEvidence(s, request, undefined, read);
  expect(saved.workingFile).toBe('matched'); expect(read).toHaveBeenCalledTimes(1);
  fault.target = '';
  // Exclusive create survives the fallback: an existing file still refuses overwrite.
  await writeFile(path.join(projectDir(s.projectsRoot, 'p'), 'dup.md'), 'existing');
  await expect(writeProjectFile(s.projectsRoot, 'p', 'dup.md', 'x', { overwrite: false, atomic: true })).rejects.toMatchObject({ code: 'EEXIST' });
});
it('never publishes evidence after a read failure, abort, or conflicting user file', async () => {
  const s = await scope(); const failure = vi.fn(async () => { throw new Error('HTTP 403'); });
  await expect(captureWebEvidence(s, request, undefined, failure)).rejects.toThrow('HTTP 403');
  expect(await readCapturedWebEvidence(s, request.operationId)).toBeNull();
  const controller = new AbortController(); controller.abort();
  await expect(captureWebEvidence(s, request, controller.signal, async () => page(request))).rejects.toMatchObject({ code: 'WEB_READ_STOPPED' });
  expect(await readCapturedWebEvidence(s, request.operationId)).toBeNull();
  await writeFile(path.join(projectDir(s.projectsRoot, 'p'), 'existing.md'), 'Keep me');
  const fileName = webEvidenceFileName(request.operationId);
  const { mkdir } = await import('node:fs/promises'); await mkdir(path.dirname(path.join(projectDir(s.projectsRoot, 'p'), fileName)), { recursive: true });
  await writeFile(path.join(projectDir(s.projectsRoot, 'p'), fileName), 'Keep this too');
  await expect(captureWebEvidence(s, request, undefined, failure)).rejects.toMatchObject({ status: 409 });
  expect(failure).toHaveBeenCalledTimes(1);
});
it('binds retrieval receipts to report versions, keeps incorrect claims readable, and restores the source closure offline', async () => {
  const s = await scope(); const source = await captureWebEvidence(s, request, undefined, async () => page(request));
  const report = (url = source.receipt.requestedUrl) => `<section id="finding" data-mokina-id="finding">The claim cites page.</section><script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'page', path: source.fileName, versionId: source.versionId, sha256: source.contentDigest, kind: 'full-text', locator: 'captured plain text', limitation: 'No factual assessment', sectionId: 'finding', url, accessedAt: source.receipt.retrievedAt, excerpt: 'Actual selected text' }] })}</script>`;
  await writeFile(path.join(projectDir(s.projectsRoot, 'p'), 'report.html'), report());
  const version = await createProjectFileVersion(s.projectsRoot, 'p', 'report.html', report());
  const before = await readProjectFileVersion(s.projectsRoot, 'p', 'report.html', version.id);
  expect(before.quality.sources[0]?.webCapture).toEqual(source.receipt);
  await createProjectFileVersion(s.projectsRoot, 'p', source.fileName, source.content, { source: 'restore', restoreFromVersionId: source.versionId });
  expect((await readCapturedWebEvidence(s, request.operationId))?.versionId).toBe(source.versionId);
  const wrong = await createProjectFileVersion(s.projectsRoot, 'p', 'wrong.html', report('https://example.com/forged'));
  expect((await readProjectFileVersion(s.projectsRoot, 'p', 'wrong.html', wrong.id)).quality.status).toBe('incomplete');
  const archive = await buildProjectRecoveryPackage({ ...s, projectName: 'P', exportId: 'web-export' });
  const restored = await importProjectRecoveryPackage({ projectsRoot: s.projectsRoot, archive: archive.buffer, operationId: 'web-restore', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
  expect(restored.ok).toBe(true);
  const after = await readProjectFileVersion(s.projectsRoot, 'restored', 'report.html', version.id);
  expect(after.quality).toEqual(before.quality);
  expect((await readCapturedWebEvidence({ ...s, projectId: 'restored' }, request.operationId))?.receipt).toEqual(source.receipt);
  await rm(path.join(projectDir(s.projectsRoot, 'p'), source.fileName));
  await rm(path.join(s.projectsRoot, 'p', '.file-versions', createHash('sha256').update(source.fileName).digest('hex').slice(0, 24)), { recursive: true, force: true });
  const candidate = await createProjectFileVersion(s.projectsRoot, 'p', 'report.html', report().replace('The claim', 'A revised claim'), { candidate: true, baseVersionId: version.id });
  expect((await readProjectFileVersion(s.projectsRoot, 'p', 'report.html', candidate.id)).quality.sources[0]?.webCapture).toEqual(source.receipt);
  expect(await readCapturedWebEvidence({ ...s, projectId: 'other' }, request.operationId)).toBeNull();
});

it('retains captured bytes for incorrect declarations, then repairs offline from the frozen source', async () => {
  const s = await scope();
  const captured = page(request); captured.receipt.scope = 'static-html-text'; captured.receipt.contentType = 'text/html';
  captured.content = renderWebEvidenceDocument(captured.receipt, 'Actual selected text, with a supported excerpt.\n');
  const source = await captureWebEvidence(s, request, undefined, async () => captured);
  const report = (kind: string, url = source.receipt.requestedUrl) => `<section id="finding" data-mokina-id="finding">Claim</section><script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'page', path: source.fileName, versionId: source.versionId, sha256: source.contentDigest, kind, locator: 'text', limitation: 'static text', sectionId: 'finding', url, accessedAt: source.receipt.retrievedAt, excerpt: 'Actual selected text' }] })}</script>`;
  for (const [index, bad] of [report('full-text'), report('summary', 'https://example.com/wrong')].entries()) {
    const name = `bad-${index}.html`; const version = await createProjectFileVersion(s.projectsRoot, 'p', name, bad);
    const saved = await readProjectFileVersion(s.projectsRoot, 'p', name, version.id);
    expect(saved.quality.status).toBe('incomplete'); expect(saved.quality.sources[0]?.text, saved.quality.sources[0]?.error ?? JSON.stringify(saved.quality.issues)).toBe(source.content);
  }
  const archive = await buildProjectRecoveryPackage({ ...s, projectName: 'P', exportId: 'wrong-web-export' });
  await importProjectRecoveryPackage({ projectsRoot: s.projectsRoot, archive: archive.buffer, operationId: 'wrong-web-restore', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
  await rm(path.join(projectDir(s.projectsRoot, 'p'), source.fileName));
  await rm(path.join(s.projectsRoot, 'p', '.file-versions', createHash('sha256').update(source.fileName).digest('hex').slice(0, 24)), { recursive: true, force: true });
  for (const id of ['p', 'restored']) {
    const base = (await listProjectFileVersions(s.projectsRoot, id, 'bad-0.html'))[0]!;
    const candidate = await createProjectFileVersion(s.projectsRoot, id, 'bad-0.html', report('summary'), { candidate: true, baseVersionId: base.id });
    const fixed = await readProjectFileVersion(s.projectsRoot, id, 'bad-0.html', candidate.id);
    expect(fixed.quality.sources[0]?.error).toBeUndefined(); expect(fixed.quality.sources[0]?.text).toBe(source.content);
  }
});
