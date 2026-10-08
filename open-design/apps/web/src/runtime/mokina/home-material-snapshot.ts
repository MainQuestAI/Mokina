import {
  joinMokinaExcerpt, mokinaContextBudgetExceeded,
  type MokinaAssetRole, type MokinaContextSelection, type MokinaExcludedContextItem,
  type ProjectMaterialExtraction, type WorkspaceCollabContext,
} from '@open-design/contracts';
import { fetchProjectMaterial } from '../../providers/registry';
import { workspaceProjectHeaders, workspaceIdentityCacheKey } from '../../collab/workspace-identity';
import { randomUUID } from '../../utils/uuid';
import { mokinaBytesDigest } from './digest';
import { readPendingMokinaSnapshot, writePendingMokinaSnapshot } from './pending-context-snapshot';
import { mutateDurableRecord } from '../persistence/mokina-recovery-store';

export type HomeMokinaFileKind = 'material' | 'asset';
export interface HomeMokinaFilePlan {
  inputId?: string;
  uploadOrder?: number;
  name: string;
  size: number;
  path?: string;
  digest?: string;
  kind: HomeMokinaFileKind;
  role?: MokinaAssetRole;
  usageNote?: string;
}
export interface HomeMokinaMaterialRead { name: string; inputId?: string; extraction: ProjectMaterialExtraction }
export interface HomeMokinaAssetBytes { name: string; inputId?: string; byteLength: number; digest: string }

/** Exclusions require explicit acceptance before any run can be created. */
export function buildHomeMokinaSelections(input: {
  projectId: string; plans: HomeMokinaFilePlan[]; materials: HomeMokinaMaterialRead[];
  assets: HomeMokinaAssetBytes[]; failedUploadNames?: ReadonlySet<string> | null;
}): { selections: MokinaContextSelection[]; excluded: MokinaExcludedContextItem[] } {
  const selections: MokinaContextSelection[] = [];
  const excluded: MokinaExcludedContextItem[] = [];
  let excerptUnits = 0;
  let assetBytes = 0;
  for (const [index, plan] of input.plans.entries()) {
    const omit = (reason: MokinaExcludedContextItem['reason'], explanation: string) => {
      excluded.push({ displayName: plan.name, reason, explanation });
    };
    if (input.failedUploadNames?.has(plan.name)) { omit('unavailable', '文件上传失败，请重新选择文件或明确排除。'); continue; }
    if (plan.kind === 'material') {
      const material = input.materials.find(item => plan.inputId ? item.inputId === plan.inputId : item.name === plan.name)?.extraction;
      if (!material || material.status === 'unreadable') { omit('unreadable', material?.limitations.join('；') || '资料读取失败'); continue; }
      if (!material.parserVersion || material.sections.some(section => !section.fragmentId)) {
        omit('unavailable', '资料选择协议已更新，请重新读取。'); continue;
      }
      const text = joinMokinaExcerpt(material.sections.map(section => section.text));
      if (!text.trim()) { omit('unreadable', '没有可冻结的内容'); continue; }
      if (mokinaContextBudgetExceeded({ itemCount: selections.length + 1, excerptUnits: excerptUnits + text.length, assetBytes })) {
        omit('budget', '所选内容超过本次预算，请在资料面板精选或明确排除此文件。'); continue;
      }
      excerptUnits += text.length;
      selections.push({ itemId: plan.inputId ?? `S${index + 1}`, mode: 'fragments', textKind: 'material-excerpt',
        sourceRef: { kind: 'project-file', projectId: input.projectId, fileName: plan.path ?? plan.name },
        expectedSourceDigest: material.contentDigest, expectedParserVersion: material.parserVersion,
        fragmentIds: material.sections.map(section => section.fragmentId!) });
    } else {
      const asset = input.assets.find(item => plan.inputId ? item.inputId === plan.inputId : item.name === plan.name && item.byteLength === plan.size);
      if (!asset?.digest) { omit('unavailable', '素材字节缺失，请重新选择文件。'); continue; }
      if (mokinaContextBudgetExceeded({ itemCount: selections.length + 1, excerptUnits, assetBytes: assetBytes + asset.byteLength })) {
        omit('budget', '所选素材超过单次 30 MiB 或 20 项预算。'); continue;
      }
      assetBytes += asset.byteLength;
      selections.push({ itemId: plan.inputId ?? `A${index + 1}`, mode: 'asset',
        sourceRef: { kind: 'project-file', projectId: input.projectId, fileName: plan.path ?? plan.name },
        expectedSourceDigest: asset.digest, role: plan.role ?? 'supporting', usageNote: plan.usageNote ?? '' });
    }
  }
  return { selections, excluded };
}

export function mokinaResponseError(body: unknown, fallback: string): { code: string; message: string } {
  if (!body || typeof body !== 'object') return { code: '', message: fallback };
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return { code: '', message: error };
  if (!error || typeof error !== 'object') return { code: '', message: fallback };
  const value = error as { code?: unknown; message?: unknown };
  return { code: typeof value.code === 'string' ? value.code : '', message: typeof value.message === 'string' ? value.message : fallback };
}

export type HomeMokinaSnapshotPreparation =
  | { status: 'ready'; snapshotId: string | null; generation?: string; excluded: MokinaExcludedContextItem[] }
  | { status: 'needs-input'; snapshotId: null; message: string; excluded: MokinaExcludedContextItem[] };

export type HomeMokinaPreparationRecord = {
  schemaVersion: 1; projectId: string; conversationId: string; workspaceKey: string;
  revision?: number; recordVersion?: string;
  snapshotId: string; bindingSnapshotId?: string; bindingGeneration?: string; plans: HomeMokinaFilePlan[]; prompt: string;
  fixedSelection?: { selections: MokinaContextSelection[]; excluded: MokinaExcludedContextItem[] };
  status: 'preparing' | 'needs-input' | 'ready'; message?: string;
  excluded: MokinaExcludedContextItem[];
};
export const HOME_MOKINA_PREPARATION_CHANGED = 'mokina:home-preparation-changed';
function preparationKey(projectId: string, conversationId: string, workspaceKey: string) {
  return `od:composer-draft:mokina-home:${JSON.stringify([workspaceKey, projectId, conversationId])}`;
}
export function readHomeMokinaPreparation(projectId: string, conversationId: string, workspaceKey: string): HomeMokinaPreparationRecord | null {
  try {
    const row = JSON.parse(window.localStorage.getItem(preparationKey(projectId, conversationId, workspaceKey)) ?? 'null');
    return row?.schemaVersion === 1 && row.projectId === projectId && row.conversationId === conversationId
      && row.workspaceKey === workspaceKey && Array.isArray(row.plans) ? row : null;
  } catch { return null; }
}
export async function saveHomeMokinaPreparation(record: HomeMokinaPreparationRecord) {
  const key = preparationKey(record.projectId, record.conversationId, record.workspaceKey);
  let next = { ...record, revision: (record.revision ?? 0) + 1, recordVersion: randomUUID() };
  const raw = JSON.stringify(next);
  if (!await mutateDurableRecord(key, current => {
    if (current) {
      const previous = JSON.parse(current);
      // A failed acknowledgement may follow a successful initial write. Reuse
      // only that exact intent; a newer revision or changed input still conflicts.
      if (!record.revision && previous.revision === 1 && previous.recordVersion
        && JSON.stringify({ ...previous, revision: undefined, recordVersion: undefined })
          === JSON.stringify({ ...record, revision: undefined, recordVersion: undefined })) {
        next = previous;
        return current;
      }
      if (previous.snapshotId !== record.snapshotId || (previous.revision ?? 0) !== (record.revision ?? 0)) return undefined;
    } else if (record.revision) return undefined;
    return raw;
  })) throw new Error('资料准备记录保存失败，请重试。');
  window.dispatchEvent(new Event(HOME_MOKINA_PREPARATION_CHANGED));
  if (readHomeMokinaPreparation(record.projectId, record.conversationId, record.workspaceKey)?.recordVersion !== next.recordVersion) throw new Error('资料准备记录已由另一窗口更新，请核对后重试。');
  return next;
}
export async function clearHomeMokinaPreparation(record: HomeMokinaPreparationRecord) {
  const key = preparationKey(record.projectId, record.conversationId, record.workspaceKey);
  if (!await mutateDurableRecord(key, raw => {
    const current = raw ? JSON.parse(raw) : null;
    return current?.snapshotId === record.snapshotId && current?.recordVersion === record.recordVersion ? null : raw;
  })) throw new Error('资料准备记录清理失败，请重试。');
  window.dispatchEvent(new Event(HOME_MOKINA_PREPARATION_CHANGED));
}

export async function prepareHomeMokinaSnapshot(input: {
  projectId: string; conversationId?: string; snapshotId?: string; plans: HomeMokinaFilePlan[];
  stagedFiles?: File[]; workspaceContext?: WorkspaceCollabContext | null;
  failedUploadNames?: ReadonlySet<string> | null; acceptExclusions?: boolean;
  fixedSelection?: HomeMokinaPreparationRecord['fixedSelection'];
  onPrepared?: (selection: NonNullable<HomeMokinaPreparationRecord['fixedSelection']>) => Promise<void>;
}): Promise<HomeMokinaSnapshotPreparation> {
  if (!input.plans.length) return { status: 'ready', snapshotId: null, excluded: [] };
  const pendingScope = { conversationId: input.conversationId ?? 'draft:first', workspaceKey: workspaceIdentityCacheKey(input.workspaceContext ?? null) };
  const capturedGeneration = readPendingMokinaSnapshot(input.projectId, pendingScope)?.generation ?? null;
  try {
    const materials: HomeMokinaMaterialRead[] = [];
    const assets: HomeMokinaAssetBytes[] = [];
    for (const plan of input.fixedSelection ? [] : input.plans) {
      if (!plan.path) continue;
      if (plan.kind === 'material') {
        const result = await fetchProjectMaterial(input.projectId, plan.path, input.workspaceContext);
        if (!('error' in result)) materials.push({ name: plan.name, inputId: plan.inputId, extraction: result });
      } else {
        const file = input.stagedFiles?.[plan.uploadOrder ?? -1];
        const digest = plan.digest ?? (file ? await mokinaBytesDigest(await file.arrayBuffer()) : '');
        assets.push({ name: plan.name, inputId: plan.inputId, digest, byteLength: plan.size });
      }
    }
    const built = input.fixedSelection ?? buildHomeMokinaSelections({ ...input, materials, assets });
    if (built.excluded.length && !input.acceptExclusions) return { status: 'needs-input', snapshotId: null, excluded: built.excluded, message: '资料尚未准备完成，请重试、调整选择或明确排除失败项。' };
    if (!built.selections.length) {
      return input.acceptExclusions
        ? { status: 'ready', snapshotId: null, excluded: built.excluded }
        : { status: 'needs-input', snapshotId: null, excluded: built.excluded, message: '没有可用的资料，任务尚未发送。' };
    }
    const snapshotId = input.snapshotId ?? randomUUID();
    await input.onPrepared?.(built);
    const response = await fetch(`/api/projects/${encodeURIComponent(input.projectId)}/mokina/context-snapshots`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(input.workspaceContext ? workspaceProjectHeaders(input.workspaceContext) : {}) },
      body: JSON.stringify({ snapshotId, selections: built.selections, excluded: built.excluded }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.snapshot) throw new Error(mokinaResponseError(body, `资料冻结失败（${response.status}），任务尚未发送。`).message);
    const items: Array<{ displayName: string; text?: string }> = body.snapshot.items;
    const binding = await writePendingMokinaSnapshot({ snapshotId, projectId: input.projectId,
      conversationId: input.conversationId, workspaceKey: workspaceIdentityCacheKey(input.workspaceContext ?? null),
      itemCount: items.length, charCount: items.reduce((sum, item) => sum + (item.text?.length ?? 0), 0), frozenAt: new Date().toISOString(),
      itemLabels: items.map(item => item.displayName), excluded: built.excluded.map(entry => ({ displayName: entry.displayName, reason: entry.explanation })) }, { generation: capturedGeneration });
    return { status: 'ready', snapshotId, generation: binding.generation, excluded: built.excluded };
  } catch (cause) {
    return { status: 'needs-input', snapshotId: null, excluded: [], message: cause instanceof Error ? cause.message : '资料准备失败，任务尚未发送。' };
  }
}
