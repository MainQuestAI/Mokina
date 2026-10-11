import type { MokinaBusinessBody, MokinaBusinessReadResult, SaveMokinaBusinessRequest } from '@open-design/contracts';
import { parseSaveMokinaBusinessRequest } from '@open-design/contracts';
import { flushDurableRecord, mirrorDurableRecord } from '../persistence/mokina-recovery-store';
export type BusinessDraft = { schema: 1; request: SaveMokinaBusinessRequest; pending: boolean };
export const businessDraftKey = (scope: string, kind: string) => `od:composer-draft:mokina-business:${scope}:${kind}`;
export class BusinessDraftCorruptError extends Error {
  constructor(public readonly raw: string) { super('业务草稿损坏，请先备份原记录再明确重建'); }
}
export function readBusinessDraft(key: string): BusinessDraft | null {
  return parseBusinessDraft(localStorage.getItem(key));
}
export function parseBusinessDraft(raw: string | null): BusinessDraft | null {
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.schema !== 1 || typeof parsed.pending !== 'boolean') throw new Error('Invalid draft');
    return { schema: 1, request: parseSaveMokinaBusinessRequest(parsed.request, true), pending: parsed.pending };
  } catch { throw new BusinessDraftCorruptError(raw); }
}
export async function persistBusinessDraft(key: string, value: BusinessDraft, expectedRaw: string | null): Promise<string> {
  const raw = JSON.stringify(value);
  if (localStorage.getItem(key) !== expectedRaw) throw new Error('另一窗口已修改草稿，请先核对');
  localStorage.setItem(key, raw);
  if (!await mirrorDurableRecord(key, raw) || !await flushDurableRecord(key)) throw new Error('草稿尚未安全保存，请保留当前输入并重试');
  return raw;
}
export function emptyBusinessBody(kind: 'background' | 'brief'): MokinaBusinessBody {
  return kind === 'background' ? { kind, value: { title: '业务背景', facts: [], preferences: '' } }
    : { kind, value: { title: '任务 Brief', goal: '', audience: '', deliverables: [], kpi: '', budget: '', period: '', constraints: '', missing: '' }, background: null };
}
/** User-visible request only; shared across runtimes through the existing explicit composer send. */
export function businessBriefHandoff(saved: MokinaBusinessReadResult, selectedIds: string[]): string {
  if (saved.document.body.kind !== 'brief' || !saved.versionId) throw new Error('请先完成 Brief 版本保存');
  const brief = saved.document.body.value;
  const selected = brief.deliverables.filter(item => selectedIds.includes(item.id));
  if (!selected.length || new Set(selectedIds).size !== selected.length) throw new Error('请选择当前 Brief 的交付项');
  return [
    `依据固定 Brief 制作；文件 ${saved.fileName}，版本 ${saved.versionId}，摘要 ${saved.revision}。`,
    '本次只制作以下选定交付项，其他交付项不在本次执行范围。不要修改背景与 Brief 原件。',
    `选定交付项：${JSON.stringify(selected)}`,
    `目标：${brief.goal || '待确认'}\n受众：${brief.audience || '待确认'}`,
    `KPI 与口径：${brief.kpi || '待确认'}\n预算：${brief.budget || '待确认'}\n周期：${brief.period || '待确认'}`,
    `本次限制（预算、步骤及对外文案均须遵守，不得改名规避）：${brief.constraints || '未提供'}`,
    `待补充条件／证据：${brief.missing || '请检查人员、产能、报价及周期；没有依据的数值不得标成已核验事实'}`,
    `明确复用的已确认背景快照：${JSON.stringify(saved.document.backgroundSnapshot)}`,
    '建议、假设、个人偏好与业务事实分开表达；要求预览不代表确认建议。缺失条件请明确指出，不能编造已批准的预算、活动或优惠承诺。',
  ].join('\n\n');
}
