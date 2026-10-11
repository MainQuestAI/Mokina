import {
  MOKINA_BUSINESS_FILES, parseMokinaBusinessBody, parseSaveMokinaBusinessRequest,
  type MokinaBackgroundSnapshot, type MokinaBusinessDocument, type MokinaBusinessKind,
  type MokinaBusinessReadResult, type SaveMokinaBusinessRequest,
} from '@open-design/contracts';
import { readProjectFile, writeProjectFile } from '../projects.js';
import { readProjectFileVersion, withProjectFileVersionLock } from '../project-file-versions.js';
import { canonicalJson, sha256Hex } from './context-store.js';

type Scope = { projectsRoot: string; projectId: string; metadata?: unknown };
export class BusinessDocumentError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
const fail = (code: string, message: string): never => { throw new BusinessDocumentError(`MOKINA_BUSINESS_${code}`, message); };
const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const section = (id: string, title: string, text: string) => `<section id="${id}"><h2>${escape(title)}</h2><p>${escape(text || '未提供，待确认')}</p></section>`;
function factsHtml(facts: MokinaBackgroundSnapshot['facts']) {
  return facts.map(fact => section(`fact-${fact.id}`, fact.status === 'confirmed' ? '用户已确认' : '建议／待确认',
    `${fact.text}\n来源：${fact.source || '未提供'}\n适用范围：${fact.scope || '未提供'}`)).join('');
}
/** Embedded structure and visible content are written together. External edits fail closed. */
export function renderBusinessDocument(document: MokinaBusinessDocument): string {
  const { body, backgroundSnapshot } = document;
  const content = body.kind === 'background'
    ? factsHtml(body.value.facts) + section('preferences', '个人偏好（不是业务事实）', body.value.preferences)
    : section('goal', '目标', body.value.goal) + section('audience', '受众', body.value.audience)
      + section('deliverables', '交付项', body.value.deliverables.map(item => `${item.id}：${item.title}`).join('\n'))
      + section('kpi', 'KPI 与统计口径', body.value.kpi) + section('budget', '预算上限与口径', body.value.budget)
      + section('period', '周期', body.value.period) + section('constraints', '本次限制', body.value.constraints)
      + section('missing', '待补充条件／证据', body.value.missing)
      + (backgroundSnapshot ? section('source', '明确复用的背景版本', `${backgroundSnapshot.title}\n项目：${backgroundSnapshot.projectId}\n版本：${backgroundSnapshot.versionId}\n摘要：${backgroundSnapshot.revision}`)
        + factsHtml(backgroundSnapshot.facts) : section('source', '业务背景', '本次未选择背景，不自动沿用其他任务的事实或偏好。'));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(body.value.title)}</title><style>body{max-width:900px;margin:40px auto;padding:0 24px;color:#161616;background:#fff;font:16px/1.7 system-ui}p{white-space:pre-wrap;overflow-wrap:anywhere}section{border-top:1px solid #ddd;padding:12px 0}h2{font-size:18px}</style></head><body><h1>${escape(body.value.title)}</h1>${content}<script type="application/json" id="mokina-business-document">${canonicalJson(document).replace(/</g, '\\u003c')}</script></body></html>`;
}
function parseHtml(html: string): MokinaBusinessDocument {
  try {
    const match = /<script type="application\/json" id="mokina-business-document">([^]*?)<\/script>/.exec(html);
    if (!match) throw new Error('missing marker');
    const raw = JSON.parse(match[1]!);
    if (raw.schema !== 'mokina.business.v1' || !/^[a-f0-9]{64}$/.test(raw.requestDigest)) throw new Error('unknown schema');
    const request = parseSaveMokinaBusinessRequest({ operationId: raw.operationId, expectedRevision: null, body: raw.body });
    const document: MokinaBusinessDocument = { schema: raw.schema, operationId: request.operationId, requestDigest: raw.requestDigest,
      body: request.body, backgroundSnapshot: raw.backgroundSnapshot };
    if (document.body.kind === 'background' && document.backgroundSnapshot !== null) throw new Error('unexpected source');
    if (document.body.kind === 'brief') {
      const snapshot = document.backgroundSnapshot;
      if (document.body.background === null ? snapshot !== null : !snapshot) throw new Error('missing source');
      if (snapshot) {
        const parsed = parseMokinaBusinessBody({ kind: 'background', value: { title: snapshot.title, facts: snapshot.facts, preferences: '' } });
        if (parsed.kind !== 'background' || parsed.value.facts.some(fact => fact.status !== 'confirmed')
          || canonicalJson({ projectId: snapshot.projectId, versionId: snapshot.versionId, revision: snapshot.revision, factIds: snapshot.factIds }) !== canonicalJson(document.body.background)
          || canonicalJson(snapshot.facts.map(fact => fact.id)) !== canonicalJson(snapshot.factIds)) throw new Error('invalid source');
      }
    }
    if (renderBusinessDocument(document) !== html) throw new Error('external edit');
    return document;
  } catch { return fail('UNRECOGNIZED', '文件不是可安全编辑的业务文档，或已在其他编辑器修改。请保留原件并通过阅读／章节修订处理。'); }
}
async function currentHtml(scope: Scope, kind: MokinaBusinessKind): Promise<string | null> {
  try { return (await readProjectFile(scope.projectsRoot, scope.projectId, MOKINA_BUSINESS_FILES[kind], scope.metadata)).buffer.toString('utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export async function readBusinessDocument(scope: Scope & { kind: MokinaBusinessKind; versionId?: string }): Promise<MokinaBusinessReadResult | null> {
  const fileName = MOKINA_BUSINESS_FILES[scope.kind];
  if (scope.versionId) {
    const saved = await readProjectFileVersion(scope.projectsRoot, scope.projectId, fileName, scope.versionId, scope.metadata);
    if (saved.version.candidate) return fail('SOURCE_INVALID', '候选版本尚未采用，不能作为已确认背景');
    const document = parseHtml(saved.content);
    if (document.body.kind !== scope.kind) return fail('UNRECOGNIZED', '文档类型不匹配');
    if (saved.version.contentDigest && sha256Hex(saved.content) !== saved.version.contentDigest) return fail('UNRECOGNIZED', '版本内容摘要不匹配');
    return { document, revision: sha256Hex(saved.content), fileName, versionId: saved.version.id };
  }
  return withProjectFileVersionLock(scope.projectsRoot, scope.projectId, fileName, scope.metadata, async lock => {
    const html = await currentHtml(scope, scope.kind); if (html === null) return null;
    const document = parseHtml(html);
    if (document.body.kind !== scope.kind) return fail('UNRECOGNIZED', '文档类型不匹配');
    const matched = await lock.matchVersionContent(html);
    return { document, revision: sha256Hex(html), fileName, versionId: matched.status === 'matched' ? matched.version?.id ?? null : null };
  });
}
export async function saveBusinessDocument(input: Scope & { request: SaveMokinaBusinessRequest; sourceMetadata?: unknown }): Promise<MokinaBusinessReadResult> {
  const request = parseSaveMokinaBusinessRequest(input.request);
  const requestDigest = sha256Hex(canonicalJson(request));
  const fileName = MOKINA_BUSINESS_FILES[request.body.kind];
  return withProjectFileVersionLock(input.projectsRoot, input.projectId, fileName, input.metadata, async lock => {
    const current = await currentHtml(input, request.body.kind);
    const prior = current === null ? null : parseHtml(current);
    if (prior?.operationId === request.operationId) {
      if (prior.requestDigest !== requestDigest) return fail('CONFLICT', '同一保存请求的内容发生变化；请核对原操作');
      const version = await lock.ensureCurrentVersion(current!, { operationId: request.operationId, source: 'manual', promptSource: 'manual' });
      return { document: prior, revision: sha256Hex(current!), fileName, versionId: version?.id ?? null };
    }
    if (await lock.hasOperation(request.operationId)) return fail('CONFLICT', '该操作已保存为历史版本，请读取历史成果，不要重新提交');
    if ((current === null ? null : sha256Hex(current)) !== request.expectedRevision) return fail('CONFLICT', '文档已变更，请保留草稿并读取当前版本后比较');
    if (current !== null) await lock.ensureCurrentVersion(current, { operationId: prior!.operationId, source: 'manual', promptSource: 'manual' });
    // Source reads are needed only for a new copy, never to reconcile an already committed snapshot.
    let backgroundSnapshot: MokinaBackgroundSnapshot | null = null;
    if (request.body.kind === 'brief' && request.body.background) {
      const selection = request.body.background;
      const source = await readBusinessDocument({ projectsRoot: input.projectsRoot, projectId: selection.projectId,
        metadata: input.sourceMetadata, kind: 'background', versionId: selection.versionId });
      if (!source || source.revision !== selection.revision || source.document.body.kind !== 'background') return fail('SOURCE_INVALID', '所选背景版本或摘要不匹配');
      const facts = selection.factIds.map(id => source.document.body.kind === 'background' ? source.document.body.value.facts.find(fact => fact.id === id) : undefined);
      if (facts.some(fact => !fact || fact.status !== 'confirmed')) return fail('SOURCE_INVALID', '只能明确复用已确认的业务事实');
      backgroundSnapshot = { ...selection, title: source.document.body.value.title, facts: facts as MokinaBackgroundSnapshot['facts'] };
    }
    const document: MokinaBusinessDocument = { schema: 'mokina.business.v1', operationId: request.operationId, requestDigest, body: request.body, backgroundSnapshot };
    const html = renderBusinessDocument(document);
    await writeProjectFile(input.projectsRoot, input.projectId, fileName, html, { atomic: true }, input.metadata);
    // A failure after the atomic file commit is unknown, not success. Reconcile this operation before editing again.
    const version = await lock.createVersion(html, { operationId: request.operationId, source: 'manual', promptSource: 'manual' });
    return { document, revision: sha256Hex(html), fileName, versionId: version.id };
  });
}
