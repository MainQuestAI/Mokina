import { mirrorDurableRecord } from '../persistence/mokina-recovery-store';
import { mintRecoveryIdentity } from './recovery-package-client';
import { mokinaBytesDigest } from './digest';
export interface MokinaImportJournal {
  operationId: string; targetProjectId: string; archiveDigest: string; workspace: string;
  fileName: string; byteLength: number; state: 'prepared' | 'imported';
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
  if (!await mirrorDurableRecord(key, encoded)) throw new Error('恢复包导入身份保存失败，尚未提交。');
  localStorage.setItem(key, encoded);
}
