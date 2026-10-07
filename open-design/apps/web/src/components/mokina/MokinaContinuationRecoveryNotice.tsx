import { useEffect, useRef, useState } from 'react';
import { Button } from '@open-design/components';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceIdentityCacheKey } from '../../collab/workspace-identity';
import { MOKINA_CONTINUATION_CHANGED, readMokinaContinuationJournal, resumeMokinaContinuation, type MokinaContinuationJournal } from '../../runtime/mokina/continuation-recovery';
import { useT } from '../../i18n';

export function MokinaContinuationRecoveryNotice({ projectId, workspaceContext, onOpen }: {
  projectId: string; workspaceContext: WorkspaceCollabContext | null;
  onOpen: (projectId: string, conversationId?: string) => void;
}) {
  const t = useT();
  const [records, setRecords] = useState<Array<{ key: string; journal: MokinaContinuationJournal }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const workspaceKey = workspaceIdentityCacheKey(workspaceContext);
  const identity = JSON.stringify([workspaceKey, projectId]);
  const identityRef = useRef(identity); identityRef.current = identity;
  const refresh = () => setRecords(Object.keys(window.localStorage).filter(key => key.startsWith('od:continuation:')).flatMap(key => {
    const journal = readMokinaContinuationJournal(window.localStorage.getItem(key));
    return journal?.intent?.source.projectId === projectId && journal.intent.workspaceKey === workspaceKey ? [{ key, journal }] : [];
  }));
  useEffect(() => {
    identityRef.current = identity; setBusy(false); setError(''); refresh();
    window.addEventListener(MOKINA_CONTINUATION_CHANGED, refresh); window.addEventListener('storage', refresh);
    return () => { identityRef.current = ''; window.removeEventListener(MOKINA_CONTINUATION_CHANGED, refresh); window.removeEventListener('storage', refresh); };
  }, [projectId, workspaceKey]);
  const visible = records.filter(({ journal }) => journal.intent?.source.projectId === projectId && journal.intent.workspaceKey === workspaceKey);
  if (!visible.length) return null;
  return <div role="status" data-testid="mokina-continuation-recovery">
    {visible.map(({ key, journal }) => <div key={key}>
      <span>{journal.intent?.source.fileName} · {t(journal.checkpoint === 'draft-ready' ? 'mokina.repair.continuationSaved' : 'mokina.repair.continuationPending')} {journal.lastError}</span>
      <Button disabled={busy} onClick={async () => {
        const issuedIdentity = identity;
        setBusy(true); setError('');
        try {
          const current = readMokinaContinuationJournal(window.localStorage.getItem(key));
          if (!current) throw new Error(t('mokina.repair.recordChanged'));
          const ready = await resumeMokinaContinuation(key, current, workspaceContext);
          if (identityRef.current === issuedIdentity) onOpen(ready.targetProjectId, ready.conversationId);
        } catch (cause) { if (identityRef.current === issuedIdentity) setError(cause instanceof Error ? cause.message : t('mokina.repair.continuationFailed')); }
        finally { if (identityRef.current === issuedIdentity) { setBusy(false); refresh(); } }
      }}>{t('mokina.repair.resumeOriginal')}</Button>
    </div>)}
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
