import { randomUUID } from '../../utils/uuid';
import { mutateDurableRecord } from '../persistence/mokina-recovery-store';
import type { HomeMokinaFilePlan } from './home-material-snapshot';

export type StagedInputMetadata = { inputId: string; name: string; size: number; plan: HomeMokinaFilePlan | null };
export type StagedInputDraft = { schemaVersion: 1; draftId: string; generation: string; inputs: StagedInputMetadata[] };
const fileIdentities = new WeakMap<File, string>();
export function homeInputIdentity(file: File, restoredId?: string) {
  const id = restoredId ?? fileIdentities.get(file) ?? randomUUID();
  fileIdentities.set(file, id); return id;
}
const key = (workspaceKey: string) => `od:composer-draft:mokina-staged:${workspaceKey}`;
export function readStagedInputDraft(workspaceKey: string): StagedInputDraft | null {
  try {
    const row = JSON.parse(localStorage.getItem(key(workspaceKey)) ?? 'null');
    return row?.schemaVersion === 1 && typeof row.draftId === 'string' && typeof row.generation === 'string'
      && Array.isArray(row.inputs) && row.inputs.every((item: StagedInputMetadata) => typeof item?.inputId === 'string'
        && typeof item.name === 'string' && Number.isFinite(item.size)) ? row : null;
  } catch { return null; }
}
/** File bytes are never serialized. Missing handles remain visible as re-selection requirements. */
export async function saveStagedInputDraft(workspaceKey: string, inputs: StagedInputMetadata[], previous: StagedInputDraft | null) {
  const record: StagedInputDraft = { schemaVersion: 1, draftId: previous?.draftId ?? randomUUID(), generation: randomUUID(), inputs };
  const saved = await mutateDurableRecord(key(workspaceKey), raw => {
    const current = raw ? JSON.parse(raw) : null;
    return (current?.generation ?? null) === (previous?.generation ?? null) ? JSON.stringify(record) : undefined;
  });
  if (!saved) throw new Error('输入条目未能安全保存；请核对另一窗口的草稿后重试。');
  return record;
}
export async function clearStagedInputDraft(workspaceKey: string, captured: StagedInputDraft | null) {
  if (!captured) return;
  if (!await mutateDurableRecord(key(workspaceKey), raw => raw && JSON.parse(raw).generation === captured.generation ? null : raw)) {
    throw new Error('已交接的输入条目状态尚未同步，请核对原项目。');
  }
}
