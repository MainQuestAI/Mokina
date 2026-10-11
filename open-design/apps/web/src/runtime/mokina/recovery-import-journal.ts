import { mirrorDurableRecord } from '../persistence/mokina-recovery-store';
import { importProjectRecoveryZip, mintRecoveryIdentity, type ImportedRecoveryProject } from './recovery-package-client';
import { mokinaBytesDigest } from './digest';
import type { MokinaRecoveryIntegrity, WorkspaceCollabContext } from '@open-design/contracts';
export interface MokinaImportJournal {
  operationId: string; targetProjectId: string; archiveDigest: string; workspace: string;
  fileName: string; byteLength: number; state: 'prepared' | 'imported';
  integrity?: MokinaRecoveryIntegrity;
  warnings?: string[];
}
const keyFor = (scope: string, digest: string) => `mokina:recovery-import:${scope}:${digest}`;
export async function prepareMokinaImport(file: File, workspace: string, copy = false): Promise<MokinaImportJournal> {
  const archiveDigest = await mokinaBytesDigest(await file.arrayBuffer());
  const key = keyFor(await mokinaBytesDigest(new TextEncoder().encode(workspace).buffer), archiveDigest);
  const raw = localStorage.getItem(key);
  if (raw && !copy) {
    const prior = JSON.parse(raw) as MokinaImportJournal;
    if (prior.workspace === workspace && prior.archiveDigest === archiveDigest) return prior;
    throw new Error('恢复包操作身份不一致，请重新选择文件。');
  }
  const journal: MokinaImportJournal = { ...mintRecoveryIdentity(), archiveDigest, workspace,
    fileName: file.name, byteLength: file.size, state: 'prepared' };
  await persistMokinaImport(journal);
  return journal;
}
export async function persistMokinaImport(journal: MokinaImportJournal): Promise<void> {
  const encoded = JSON.stringify(journal);
  const key = keyFor(await mokinaBytesDigest(new TextEncoder().encode(journal.workspace).buffer), journal.archiveDigest);
  if (!await mirrorDurableRecord(key, encoded)) throw new Error('恢复包导入身份保存失败。');
  localStorage.setItem(key, encoded);
}

/** Keep the durable operation and its upload bound to one captured workspace. */
export async function resumeMokinaRecoveryImport(file: File, options: {
  workspace: string; workspaceContext: WorkspaceCollabContext | null; copy?: boolean; isCurrent: () => boolean;
}): Promise<ImportedRecoveryProject | null> {
  const journal = await prepareMokinaImport(file, options.workspace, options.copy);
  if (!options.isCurrent()) return null;
  const result = journal.state === 'imported' && journal.integrity
    ? { projectId: journal.targetProjectId, warnings: journal.warnings ?? [], integrity: journal.integrity }
    : await importProjectRecoveryZip(file, { operationId: journal.operationId, targetProjectId: journal.targetProjectId,
      workspaceContext: options.workspaceContext });
  // A completed upload still belongs in its original journal after a scope switch.
  // The caller must not navigate or show that result in the new workspace.
  try {
    await persistMokinaImport({ ...journal, state: 'imported', integrity: result.integrity, warnings: result.warnings });
  } catch {
    throw new Error('项目已导入，恢复状态未保存；重新选择同一恢复包会核对并打开同一项目。');
  }
  return options.isCurrent() ? result : null;
}
