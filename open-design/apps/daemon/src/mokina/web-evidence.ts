import { parseCaptureMokinaWebEvidenceRequest, mokinaWebOperationId, type CaptureMokinaWebEvidenceRequest, type MokinaWebCaptureResult } from '@open-design/contracts';
import { listProjectFileVersions, readProjectFileVersion, withProjectFileVersionLock } from '../project-file-versions.js';
import { readProjectFile, writeProjectFile } from '../projects.js';
import { readMokinaMaterial } from './materials.js';
import { readPublicWebPage, WebEvidenceError } from './public-web-page.js';
import { readWebEvidenceDocument, webEvidenceDigest } from './web-evidence-document.js';

type Scope = { projectsRoot: string; projectId: string; metadata?: unknown };
export const webEvidenceFileName = (operationId: string) => `evidence/web-${mokinaWebOperationId(operationId)}.md`;

/** Lookup never fetches the URL or repairs files. It reads the saved source version. */
export async function readCapturedWebEvidence(scope: Scope, operationId: string): Promise<MokinaWebCaptureResult | null> {
  const fileName = webEvidenceFileName(operationId);
  const versions = await listProjectFileVersions(scope.projectsRoot, scope.projectId, fileName, scope.metadata, { immutableSource: true });
  const matching = versions.filter(version => version.webCapture?.operationId === operationId);
  if (!matching.length) {
    return null;
  }
  matching.sort((a, b) => a.version - b.version);
  if (matching.some(item => item.contentDigest !== matching[0]!.contentDigest || JSON.stringify(item.webCapture) !== JSON.stringify(matching[0]!.webCapture))) {
    throw new WebEvidenceError('WEB_CAPTURE_CONFLICT', 'Source versions disagree about the same capture operation.', 409);
  }
  let saved;
  try { saved = await readProjectFileVersion(scope.projectsRoot, scope.projectId, fileName, matching[0]!.id, scope.metadata, { immutableSource: true }); }
  catch (error) {
    if (['ENOENT', 'VERSION_CONTENT_MISMATCH'].includes((error as NodeJS.ErrnoException).code ?? '')) throw new WebEvidenceError('WEB_CAPTURE_INTEGRITY', 'The saved source version is missing or has changed; it will not be fetched again.', 409);
    throw error;
  }
  let receipt;
  try { receipt = readWebEvidenceDocument(saved.content, saved.version.webCapture!).receipt; }
  catch { throw new WebEvidenceError('WEB_CAPTURE_INTEGRITY', 'The source text and retrieval receipt do not agree.', 409); }
  let workingFile: MokinaWebCaptureResult['workingFile'] = 'missing';
  try { workingFile = webEvidenceDigest((await readProjectFile(scope.projectsRoot, scope.projectId, fileName, scope.metadata)).buffer) === saved.version.contentDigest ? 'matched' : 'changed'; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return { fileName, versionId: saved.version.id, contentDigest: webEvidenceDigest(saved.content), content: saved.content,
    receipt, workingFile, material: { ...await readMokinaMaterial(fileName, Buffer.from(saved.content)), sourceVersionId: saved.version.id, webCapture: receipt } };
}

export async function captureWebEvidence(scope: Scope, raw: CaptureMokinaWebEvidenceRequest, signal?: AbortSignal,
  readPage = readPublicWebPage): Promise<MokinaWebCaptureResult> {
  const request = parseCaptureMokinaWebEvidenceRequest(raw);
  const fileName = webEvidenceFileName(request.operationId);
  return withProjectFileVersionLock(scope.projectsRoot, scope.projectId, fileName, scope.metadata, async lock => {
    let saved = await readCapturedWebEvidence(scope, request.operationId);
    if (saved && saved.receipt.requestedUrl !== request.url) throw new WebEvidenceError('WEB_CAPTURE_CONFLICT', 'The same operation ID cannot read a different URL.', 409);
    if (!saved) {
      if ((await listProjectFileVersions(scope.projectsRoot, scope.projectId, fileName, scope.metadata, { immutableSource: true })).length) {
        throw new WebEvidenceError('WEB_CAPTURE_CONFLICT', 'This source path already has document history. It will not be overwritten.', 409);
      }
      // A user file without a capture version is not a disposable placeholder.
      try { await readProjectFile(scope.projectsRoot, scope.projectId, fileName, scope.metadata); throw new WebEvidenceError('WEB_CAPTURE_CONFLICT', 'This source file already exists. Choose a new operation ID.', 409); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      const page = await readPage(request, signal);
      readWebEvidenceDocument(page.content, page.receipt);
      if (signal?.aborted) throw new WebEvidenceError('WEB_READ_STOPPED', 'Reading was stopped before the source version was saved.');
      await lock.createVersion(page.content, { source: 'manual', promptSource: 'manual', operationId: request.operationId,
        label: 'Captured public page', webCapture: page.receipt });
      saved = await readCapturedWebEvidence(scope, request.operationId);
    }
    if (!saved) throw new Error('Saved web evidence could not be read back');
    if (saved.workingFile === 'missing') {
      // Recovery only materializes already-saved bytes. No second page request.
      await writeProjectFile(scope.projectsRoot, scope.projectId, fileName, saved.content, { overwrite: false, atomic: true }, scope.metadata);
      saved = await readCapturedWebEvidence(scope, request.operationId);
    }
    return saved!;
  });
}
