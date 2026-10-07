import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@open-design/components';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceIdentityCacheKey } from '../../collab/workspace-identity';
import { HOME_MOKINA_PREPARATION_CHANGED, readHomeMokinaPreparation, saveHomeMokinaPreparation,
  prepareHomeMokinaSnapshot, type HomeMokinaPreparationRecord } from '../../runtime/mokina/home-material-snapshot';
import { readPendingMokinaSnapshot } from '../../runtime/mokina/pending-context-snapshot';
import { homeAttachmentUploadsPending, subscribeHomeAttachmentUploads } from '../../state/home-attachment-handoff';
import { useT } from '../../i18n';

export function MokinaHomePreparationNotice({ projectId, conversationId, workspaceContext, onRestorePrompt }: {
  projectId: string; conversationId: string; workspaceContext: WorkspaceCollabContext | null;
  onRestorePrompt: (prompt: string) => void;
}) {
  const t = useT();
  const workspaceKey = workspaceIdentityCacheKey(workspaceContext);
  const identity = JSON.stringify([projectId, conversationId, workspaceKey]);
  const identityRef = useRef(identity); identityRef.current = identity;
  const uploadsPending = useSyncExternalStore(subscribeHomeAttachmentUploads, () => homeAttachmentUploadsPending(projectId), () => false);
  const [record, setRecord] = useState<HomeMokinaPreparationRecord | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    identityRef.current = identity;
    const update = () => setRecord(readHomeMokinaPreparation(projectId, conversationId, workspaceKey));
    update();
    window.addEventListener(HOME_MOKINA_PREPARATION_CHANGED, update);
    window.addEventListener('storage', update);
    setBusy(false);
    return () => { identityRef.current = ''; window.removeEventListener(HOME_MOKINA_PREPARATION_CHANGED, update); window.removeEventListener('storage', update); };
  }, [projectId, conversationId, workspaceKey]);
  async function retry(acceptExclusions: boolean) {
    if (!record || busy) return;
    const issuedIdentity = identity;
    setBusy(true);
    try {
      let preparedRecord = record;
      const result = await prepareHomeMokinaSnapshot({ ...record, workspaceContext, acceptExclusions,
        onPrepared: async fixedSelection => { preparedRecord = await saveHomeMokinaPreparation({ ...preparedRecord, fixedSelection }); } });
      await saveHomeMokinaPreparation({ ...preparedRecord, status: result.status, excluded: result.excluded, bindingGeneration: result.status === 'ready' ? result.generation : undefined,
        message: result.status === 'needs-input' ? result.message : undefined });
    } catch (error) { if (identityRef.current === issuedIdentity) setRecord({ ...record, message: error instanceof Error ? error.message : t('mokina.pendingSend.saveFailed') }); }
    finally { if (identityRef.current === issuedIdentity) setBusy(false); }
  }
  if (!record || record.projectId !== projectId || record.conversationId !== conversationId || record.workspaceKey !== workspaceKey) return null;
  return <div role="status" data-testid="mokina-home-preparation">
    <p>{record.status === 'ready' ? t('mokina.repair.homeReady') : record.status === 'preparing' ? t('mokina.repair.homePreparing') : record.message}</p>
    {record.excluded.map((item, index) => <p key={index}>{item.displayName}：{item.explanation}</p>)}
    <Button disabled={busy || uploadsPending} onClick={() => onRestorePrompt(record.prompt)}>{t('mokina.repair.restorePrompt')}</Button>
    {record.status !== 'ready' ? <Button disabled={busy || uploadsPending} onClick={() => void retry(false)}>{t('mokina.repair.retryPreparation')}</Button> : null}
    {record.status !== 'ready' && record.excluded.length > 0 ? <Button disabled={busy || uploadsPending} onClick={() => void retry(true)}>{t('mokina.repair.excludeContinue')}</Button> : null}
    <Button disabled={busy || uploadsPending} onClick={async () => {
      const adjusted = readPendingMokinaSnapshot(projectId, { conversationId, workspaceKey });
      if (!adjusted) { setRecord({ ...record, message: t('mokina.repair.adjustFirst') }); return; }
      try { await saveHomeMokinaPreparation({ ...record, bindingSnapshotId: adjusted.snapshotId, bindingGeneration: adjusted.generation, status: 'ready', message: undefined }); }
      catch (cause) { setRecord({ ...record, message: cause instanceof Error ? cause.message : t('mokina.pendingSend.saveFailed') }); }
    }}>{t('mokina.repair.adoptAdjusted')}</Button>
  </div>;
}
