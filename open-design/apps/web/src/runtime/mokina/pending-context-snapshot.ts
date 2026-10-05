import { mirrorDurableRecord, removeDurableRecord } from '../persistence/mokina-recovery-store';

/**
 * The frozen context snapshot the NEXT send of a project should reference
 * (T07). Written by the material panel after the snapshot API accepted the
 * selection, read by the composer when it assembles `meta.context`, and
 * mirrored into the durable desktop profile so a port change does not detach
 * the user's prepared material from the conversation.
 */
export type PendingMokinaContextSnapshot = {
  snapshotId: string;
  projectId: string;
  itemCount: number;
  charCount: number;
  frozenAt: string;
  /** Display names shown in the "本次任务" layer of the panel. */
  itemLabels: string[];
  /** Files the user saw but deliberately kept out of the snapshot. */
  excluded: Array<{ displayName: string; reason: string }>;
};

const KEY_PREFIX = 'mokina:context-snapshot:';

export function pendingMokinaSnapshotKey(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`;
}

function sanitize(raw: unknown): PendingMokinaContextSnapshot | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.snapshotId !== 'string' || record.snapshotId.length === 0) return null;
  if (typeof record.projectId !== 'string' || record.projectId.length === 0) return null;
  return {
    snapshotId: record.snapshotId,
    projectId: record.projectId,
    itemCount: typeof record.itemCount === 'number' && Number.isFinite(record.itemCount) ? record.itemCount : 0,
    charCount: typeof record.charCount === 'number' && Number.isFinite(record.charCount) ? record.charCount : 0,
    frozenAt: typeof record.frozenAt === 'string' ? record.frozenAt : '',
    itemLabels: Array.isArray(record.itemLabels)
      ? record.itemLabels.filter((label): label is string => typeof label === 'string').slice(0, 20)
      : [],
    excluded: Array.isArray(record.excluded)
      ? record.excluded
        .filter((entry): entry is { displayName: string; reason: string } => (
          entry != null && typeof entry === 'object'
          && typeof (entry as { displayName?: unknown }).displayName === 'string'
          && typeof (entry as { reason?: unknown }).reason === 'string'
        ))
        .slice(0, 20)
      : [],
  };
}

export function readPendingMokinaSnapshot(projectId: string | null | undefined): PendingMokinaContextSnapshot | null {
  if (!projectId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(pendingMokinaSnapshotKey(projectId));
    if (!raw) return null;
    const parsed = sanitize(JSON.parse(raw));
    if (!parsed || parsed.projectId !== projectId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writePendingMokinaSnapshot(value: PendingMokinaContextSnapshot): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = pendingMokinaSnapshotKey(value.projectId);
  const encoded = JSON.stringify(value);
  if (!await mirrorDurableRecord(key, encoded)) throw new Error('资料绑定未能安全保存，请重试。');
  window.localStorage.setItem(key, encoded);
}

export function clearPendingMokinaSnapshot(projectId: string | null | undefined): void {
  if (!projectId || typeof window === 'undefined') return;
  const key = pendingMokinaSnapshotKey(projectId);
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  removeDurableRecord(key);
}

/**
 * Attach the pending snapshot to a run-context object. Pure except for the
 * storage read so the composer can call it inline while assembling send meta.
 */
export function withPendingMokinaSnapshot<T extends object>(
  context: T,
  projectId: string | null | undefined,
): T | (T & { mokinaSnapshotId: string }) {
  const pending = readPendingMokinaSnapshot(projectId);
  return pending ? { ...context, mokinaSnapshotId: pending.snapshotId } : context;
}
