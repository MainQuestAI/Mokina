import { mutateDurableRecord } from '../persistence/mokina-recovery-store';
import { randomUUID } from '../../utils/uuid';

export type MokinaPendingScope = { conversationId: string; workspaceKey: string };
export type PendingMokinaContextSnapshot = {
  schemaVersion?: 2;
  snapshotId: string; projectId: string; conversationId?: string; workspaceKey?: string; generation?: string;
  itemCount: number; charCount: number; frozenAt: string; itemLabels: string[];
  excluded: Array<{ displayName: string; reason: string }>;
};
const DEFAULT_SCOPE: MokinaPendingScope = { conversationId: 'draft:first', workspaceKey: 'none' };
const KEY_PREFIX = 'mokina:context-snapshot:';
export const PENDING_MOKINA_SNAPSHOT_CHANGED_EVENT = 'mokina:context-snapshot-changed';
function notifyChanged() { window.dispatchEvent(new Event(PENDING_MOKINA_SNAPSHOT_CHANGED_EVENT)); }
export function pendingMokinaSnapshotKey(projectId: string, scope: MokinaPendingScope = DEFAULT_SCOPE): string {
  return `${KEY_PREFIX}v2:${JSON.stringify([scope.workspaceKey, projectId, scope.conversationId])}`;
}
function sanitize(raw: string | null): PendingMokinaContextSnapshot | null {
  try {
    const record = JSON.parse(raw ?? 'null');
    if (record?.schemaVersion !== 2 || typeof record.snapshotId !== 'string' || !record.snapshotId
      || typeof record.projectId !== 'string' || typeof record.generation !== 'string'
      || !Array.isArray(record.itemLabels) || !Array.isArray(record.excluded)) return null;
    return record;
  } catch { return null; }
}
export function readPendingMokinaSnapshot(projectId: string | null | undefined, scope: MokinaPendingScope = DEFAULT_SCOPE): PendingMokinaContextSnapshot | null {
  if (!projectId || typeof window === 'undefined') return null;
  const record = sanitize(window.localStorage.getItem(pendingMokinaSnapshotKey(projectId, scope)));
  return record?.projectId === projectId && record.conversationId === scope.conversationId && record.workspaceKey === scope.workspaceKey ? record : null;
}
export async function writePendingMokinaSnapshot(value: PendingMokinaContextSnapshot, expected?: { generation: string | null }): Promise<PendingMokinaContextSnapshot> {
  if (typeof window === 'undefined') throw new Error('资料绑定存储不可用。');
  const scope = { conversationId: value.conversationId ?? DEFAULT_SCOPE.conversationId, workspaceKey: value.workspaceKey ?? DEFAULT_SCOPE.workspaceKey };
  const record = { ...value, ...scope, schemaVersion: 2 as const, generation: value.generation ?? randomUUID() };
  const capturedGeneration = expected ? expected.generation : readPendingMokinaSnapshot(value.projectId, scope)?.generation ?? null;
  if (!await mutateDurableRecord(pendingMokinaSnapshotKey(value.projectId, scope), raw => {
    const current = sanitize(raw);
    if ((current?.generation ?? null) !== capturedGeneration || (raw !== null && !current)) return undefined;
    return JSON.stringify(record);
  })) {
    throw new Error('资料绑定未能安全保存，请重试。');
  }
  notifyChanged();
  if (readPendingMokinaSnapshot(value.projectId, scope)?.generation !== record.generation) throw new Error('资料已由另一窗口更新，请核对后重新准备。');
  return record;
}
export async function clearPendingMokinaSnapshot(projectId: string | null | undefined, scope: MokinaPendingScope = DEFAULT_SCOPE): Promise<boolean> {
  const current = readPendingMokinaSnapshot(projectId, scope);
  if (!current) return false;
  return clearPendingMokinaSnapshotIfCurrent(projectId, current.snapshotId, scope, current.generation);
}
export async function clearPendingMokinaSnapshotIfCurrent(
  projectId: string | null | undefined, snapshotId: string | null | undefined,
  scope: MokinaPendingScope = DEFAULT_SCOPE, generation?: string,
): Promise<boolean> {
  if (!projectId || !snapshotId) return false;
  const expectedGeneration = generation ?? readPendingMokinaSnapshot(projectId, scope)?.generation;
  if (!expectedGeneration) return false;
  const cleared = await mutateDurableRecord(pendingMokinaSnapshotKey(projectId, scope), raw => {
    const current = sanitize(raw);
    return current?.snapshotId === snapshotId && current.generation === expectedGeneration ? null : undefined;
  });
  if (cleared) notifyChanged();
  return cleared;
}
export function withPendingMokinaSnapshot<T extends object>(
  context: T, projectId: string | null | undefined, scope: MokinaPendingScope = DEFAULT_SCOPE,
): T | (T & { mokinaSnapshotId: string; mokinaSnapshotGeneration?: string }) {
  const pending = readPendingMokinaSnapshot(projectId, scope);
  return pending ? { ...context, mokinaSnapshotId: pending.snapshotId, mokinaSnapshotGeneration: pending.generation } : context;
}
/** An accepted send consumes only its captured generation. A successor is already settled. */
export async function settleSubmittedMokinaSnapshot(projectId: string, snapshotId: string, scope: MokinaPendingScope, generation?: string) {
  // Old receipts cannot prove ownership of a new scoped binding.
  if (!generation) return true;
  const settled = await mutateDurableRecord(pendingMokinaSnapshotKey(projectId, scope), raw => {
    const current = sanitize(raw);
    return current?.snapshotId === snapshotId && current.generation === generation ? null : raw;
  });
  if (settled) notifyChanged();
  return settled;
}
/** Legacy records have no provable conversation owner; keep until explicitly claimed. */
export function readLegacyPendingMokinaSnapshot(projectId: string): PendingMokinaContextSnapshot | null {
  try {
    const claim = JSON.parse(window.localStorage.getItem(`${KEY_PREFIX}legacy-claimed:${projectId}`) ?? 'null');
    if (claim && claim.status !== 'claiming') return null;
    const row = JSON.parse(window.localStorage.getItem(KEY_PREFIX + projectId) ?? 'null');
    return row?.projectId === projectId && typeof row.snapshotId === 'string' && Array.isArray(row.itemLabels) ? row : null;
  } catch { return null; }
}
export async function claimLegacyPendingMokinaSnapshot(projectId: string, scope: MokinaPendingScope) {
  const legacy = readLegacyPendingMokinaSnapshot(projectId);
  if (!legacy) return;
  const key = `${KEY_PREFIX}legacy-claimed:${projectId}`;
  const owns = (raw: string) => {
    const row = JSON.parse(raw);
    return row.conversationId === scope.conversationId && row.workspaceKey === scope.workspaceKey && row.snapshotId === legacy.snapshotId;
  };
  if (!await mutateDurableRecord(key, raw => raw ? owns(raw) ? raw : undefined : JSON.stringify({ ...scope, snapshotId: legacy.snapshotId, status: 'claiming' }))) {
    throw new Error('旧资料已由另一会话确认归属，原记录已保留。');
  }
  const pending = readPendingMokinaSnapshot(projectId, scope);
  if (pending && pending.snapshotId !== legacy.snapshotId) throw new Error('本会话已有其他资料，停止覆盖旧输入。');
  if (!pending) await writePendingMokinaSnapshot({ ...legacy, ...scope }, { generation: null });
  if (!await mutateDurableRecord(key, raw => raw && owns(raw) ? JSON.stringify({ ...scope, snapshotId: legacy.snapshotId, status: 'completed' }) : undefined)) {
    throw new Error('旧资料归属确认尚未保存，请重试。');
  }
  notifyChanged();
  // Keep the original as a backup, but do not offer to claim it repeatedly.
}
