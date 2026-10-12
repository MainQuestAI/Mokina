import { parseMokinaOperationRequest, type MokinaOperationInspection, type MokinaEditableField } from '@open-design/contracts';
import { readProjectFileVersion, withProjectFileVersionLock } from '../project-file-versions.js';
import { sha256Hex, canonicalJson } from './context-store.js';
import { inspectOperationSupport, applyOperationEdits, combineOperationSections, combineOperationEvidence } from './operations.js';
import { unsupportedControlledContent, validateCombinedNavigation } from './controlled-content.js';
import { readHtmlSections } from './sections.js';

type Scope = { projectsRoot: string; projectId: string; fileName: string; metadata?: unknown };
export async function readArtifactOperations(scope: Scope, versionId: string): Promise<MokinaOperationInspection> {
  const base = await readProjectFileVersion(scope.projectsRoot, scope.projectId, scope.fileName, versionId, scope.metadata);
  const receipt = /<!-- mokina-operation ([A-Za-z0-9+/=]+) -->\s*$/.exec(base.content);
  let operation;
  try { operation = receipt ? parseMokinaOperationRequest(JSON.parse(Buffer.from(receipt[1]!, 'base64').toString('utf8'))) : undefined; } catch { /* An artifact comment is not authoritative operation metadata. */ }
  let fields: MokinaEditableField[] = [];
  let fieldWarnings: string[] = [];
  let unsupportedReason = unsupportedControlledContent(base.content);
  let sections: MokinaOperationInspection['sections'] = [];
  try {
    sections = readHtmlSections(base.content).map(s => ({ id: s.id, text: s.text.slice(0, 600) }));
    if (!unsupportedReason) ({ fields, warnings: fieldWarnings } = inspectOperationSupport(base.content));
  } catch (error) { fields = []; sections = []; unsupportedReason = String((error as Error).message); }
  return { ...(operation && operation.operationId === base.version.operationId ? { operation } : {}), versionId, contentDigest: sha256Hex(base.content), fields,
    editable: !unsupportedReason, unsupportedReason, fieldWarnings,
    sections };
}

export async function saveArtifactOperation(scope: Scope, value: unknown) {
  let request;
  try { request = parseMokinaOperationRequest(value); } catch (error) { throw Object.assign(error as Error, { code: 'MOKINA_OPERATION_INPUT' }); }
  const read = (id: string) => readProjectFileVersion(scope.projectsRoot, scope.projectId, scope.fileName, id, scope.metadata);
  const conflict = (): never => { throw Object.assign(new Error('Fixed version digest changed; re-read before editing'), { code: 'VERSION_OPERATION_CONFLICT' }); };
  const base = await read(request.baseVersionId);
  if (base.version.candidate && !base.version.baseVersionId) throw Object.assign(new Error('Candidate base is missing; restore a version before editing'), { code: 'VERSION_BASE_MISSING' });
  if (sha256Hex(base.content) !== request.contentDigest) conflict();
  let html = base.content;
  try {
  const unsupported = unsupportedControlledContent(html);
  if (unsupported) throw new Error(unsupported);
  if (request.combine) {
    const donor = await read(request.combine.versionId);
    if (sha256Hex(donor.content) !== request.combine.contentDigest) conflict();
    // This first semantic slice combines text/tables, not resources or executable widgets.
    const chapters = readHtmlSections(donor.content);
    for (const id of request.combine.sections) {
      const chapter = chapters.find(section => section.id === id);
      if (!chapter) throw new Error(`Missing source chapter: ${id}`);
      const reason = unsupportedControlledContent(chapter.html, 'chapter');
      if (reason) throw new Error(reason);
    }
    html = combineOperationSections(html, donor.content, request.combine.sections);
    html = combineOperationEvidence(html, donor.content, request.combine.sections);
    validateCombinedNavigation(base.content, html, request.combine.sections);
  }
  html = applyOperationEdits(html, request.edits, request.combine?.sections);
  if (html === base.content) throw new Error('No content changes selected');
  } catch (error) { if (!(error as { code?: string }).code) Object.assign(error as Error, { code: 'MOKINA_OPERATION_INPUT' }); throw error; }
  // An inert provenance comment survives ordinary version export and recovery without a second store.
  html += `\n<!-- mokina-operation ${Buffer.from(canonicalJson(request)).toString('base64')} -->`;
  return withProjectFileVersionLock(scope.projectsRoot, scope.projectId, scope.fileName, scope.metadata, async lock => {
    try { return await lock.createVersion(html, {
    candidate: true, baseVersionId: base.version.candidate ? base.version.baseVersionId! : request.baseVersionId, operationId: request.operationId,
    evidenceVersionIds: [request.baseVersionId, ...(request.combine ? [request.combine.versionId] : [])], source: 'manual', promptSource: 'manual',
    label: '候选：成果编辑', prompt: `固定版本 ${request.baseVersionId}；修改 ${request.edits.map(e => e.id).join('、') || '无'}；组合章节 ${request.combine?.sections.join('、') || '无'}；修改或组合涉及预算表时重算标记合计，未标记的文字与跨成果一致性需审阅。`,
    }); } catch (error) {
      // This write has finished under the same lock. Only an authoritative absence
      // permits the editor to return to editing; a failed read remains unknown.
      let absent = false;
      try { absent = !await lock.hasOperation(request.operationId); } catch { /* retain unknown outcome */ }
      if (absent) Object.assign(error as Error, { code: 'MOKINA_OPERATION_NOT_SAVED' });
      throw error;
    }
  });
}
