import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@open-design/components';
import { parseCaptureMokinaWebEvidenceRequest, type MokinaWebCaptureResult, type WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceIdentityCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { useT } from '../../i18n';
import { randomUUID } from '../../utils/uuid';
import { flushDurableRecord, mirrorDurableRecord, mutateDurableRecord, refreshDurableRecord } from '../../runtime/persistence/mokina-recovery-store';
import { parseWebEvidenceDraft, persistWebEvidenceDraft, validateWebCaptureReply, webEvidenceDraftKey, type WebEvidenceDraft } from '../../runtime/mokina/web-evidence';
import styles from './MokinaWebEvidence.module.css';

type Props = { projectId: string; conversationId: string; workspaceContext: WorkspaceCollabContext | null; onCaptured: (result: MokinaWebCaptureResult) => void };
export function MokinaWebEvidence(props: Props) {
  const scope = JSON.stringify([workspaceIdentityCacheKey(props.workspaceContext), props.projectId, props.conversationId]);
  return <EvidenceEditor key={scope} {...props} scope={scope} />;
}
function EvidenceEditor({ projectId, workspaceContext, onCaptured, scope }: Props & { scope: string }) {
  const t = useT(); const key = webEvidenceDraftKey(scope);
  const [draft, setDraft] = useState<WebEvidenceDraft | null>(null);
  const [result, setResult] = useState<MokinaWebCaptureResult | null>(null);
  const [error, setError] = useState(''); const [corrupt, setCorrupt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false); const writeSequence = useRef(0);
  const [busy, setBusy] = useState(false); const [canRetry, setCanRetry] = useState(false);
  const active = useRef(true); const current = useRef<WebEvidenceDraft | null>(null); const raw = useRef<string | null>(null);
  const readable = useRef(false); const backup = useRef<string | null>(null); const controller = useRef<AbortController | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/mokina/web-evidence`;
  const headers = workspaceContext ? workspaceProjectHeaders(workspaceContext) : {};
  async function load(refresh = false) {
    setBusy(true); setError(''); setResult(null); setCanRetry(false);
    try {
      if (!await (refresh ? refreshDurableRecord(key) : flushDurableRecord(key))) throw new Error(t('mokina.web.draftFailed'));
      const value = localStorage.getItem(key); raw.current = value;
      let next;
      try { next = parseWebEvidenceDraft(value); }
      catch { if (active.current) setCorrupt(value); throw new Error(t('mokina.web.damaged')); }
      if (!active.current) return;
      next ??= { schema: 1 as const, state: 'draft' as const, request: { operationId: randomUUID(), url: '' } };
      readable.current = true; setSaveFailed(false); current.current = next; setDraft(next); setCorrupt(null);
    } catch (cause) { readable.current = false; if (active.current) setError(cause instanceof Error ? cause.message : t('mokina.web.draftFailed')); }
    finally { if (active.current) setBusy(false); }
  }
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; controller.current?.abort(); }; }, []);
  function persist(next: WebEvidenceDraft) {
    const sequence = ++writeSequence.current;
    const task = persistWebEvidenceDraft(key, next, raw.current);
    // Retain this window's input if CAS fails; an explicit backup/read accepts the authority.
    try { if (localStorage.getItem(key) === JSON.stringify(next)) raw.current = JSON.stringify(next); } catch { /* task reports failure */ }
    current.current = next; if (active.current) setDraft(next);
    return task.then(value => { if (active.current && sequence === writeSequence.current) setSaveFailed(false); return value; }, cause => {
      if (active.current && sequence === writeSequence.current) setSaveFailed(true);
      throw cause;
    });
  }
  async function backUpInput(kind: 'conflict' | 'unknown') {
    const value = current.current; if (!value) throw new Error(t('mokina.web.draftFailed'));
    const backupKey = `${key}:${kind}:${randomUUID()}`;
    const bytes = JSON.stringify(value);
    if (!await mirrorDurableRecord(backupKey, bytes) || !await flushDurableRecord(backupKey)) throw new Error(t('mokina.web.draftFailed'));
    localStorage.setItem(backupKey, bytes);
  }
  async function recoverInput() {
    if (busy) return; setBusy(true); setError('');
    try { await backUpInput('conflict'); await load(true); }
    catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : t('mokina.web.draftFailed')); }
    finally { if (active.current) setBusy(false); }
  }
  async function prepareNewRead() {
    const value = current.current; if (!value || busy) return; setBusy(true); setError('');
    try {
      await backUpInput('unknown');
      const expected = raw.current;
      const next: WebEvidenceDraft = { schema: 1, state: 'draft', request: { operationId: randomUUID(), url: value.request.url } };
      if (!await mutateDurableRecord(key, bytes => bytes === expected ? JSON.stringify(next) : undefined)) throw new Error(t('mokina.web.draftFailed'));
      if (!active.current) return;
      if (localStorage.getItem(key) !== JSON.stringify(next)) throw new Error(t('mokina.web.draftFailed'));
      raw.current = JSON.stringify(next); current.current = next; setDraft(next); setResult(null); setCanRetry(false); setSaveFailed(false);
    } catch (cause) { if (active.current) { setSaveFailed(true); setError(cause instanceof Error ? cause.message : t('mokina.web.draftFailed')); } }
    finally { if (active.current) setBusy(false); }
  }
  async function accept(value: unknown, sent: WebEvidenceDraft) {
    const saved = await validateWebCaptureReply(value, sent.request);
    if (!active.current || current.current?.request.operationId !== sent.request.operationId) return;
    await persist({ ...sent, state: saved.workingFile === 'missing' ? 'unknown' : 'saved' });
    if (!active.current) return;
    setResult(saved); setCanRetry(saved.workingFile === 'missing'); setError('');
    if (saved.workingFile !== 'missing') onCaptured(saved);
  }
  async function capture() {
    if (!current.current || !readable.current || busy || saveFailed) return;
    let sent: WebEvidenceDraft;
    try { sent = { ...current.current, request: parseCaptureMokinaWebEvidenceRequest({ ...current.current.request,
      ...(current.current.state === 'saved' ? { operationId: randomUUID() } : {}) }), state: 'unknown' }; }
    catch (cause) { setError(`${t('mokina.web.invalid')} ${cause instanceof Error ? cause.message : ''}`); return; }
    setBusy(true); setError(''); setResult(null); setCanRetry(false); controller.current = new AbortController();
    try {
      await persist(sent); // No request before the exact intent is recoverable.
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(sent.request), signal: controller.current.signal });
      const body = await response.json();
      if (!response.ok) {
        // Reader failures happen before publication. Storage/transport failures stay unknown.
        const code = String(body.error?.code ?? '');
        if (['WEB_HTTP_ERROR', 'WEB_FORMAT_UNSUPPORTED', 'WEB_TOO_LARGE', 'WEB_ENCODING_UNSUPPORTED', 'WEB_EMPTY', 'WEB_READ_FAILED', 'WEB_READ_STOPPED', 'BAD_REQUEST'].includes(code)) await persist({ ...sent, state: 'draft' });
        throw new Error(body.error?.message ?? t('mokina.web.unknown'));
      }
      await accept(body.result, sent);
    } catch (cause) { if (active.current) setError(`${t('mokina.web.readFailed')} ${cause instanceof Error ? cause.message : t('mokina.web.unknown')}`); }
    finally { controller.current = null; if (active.current) setBusy(false); }
  }
  async function query() {
    const sent = current.current; if (!sent || busy) return;
    setBusy(true); setError(''); setCanRetry(false);
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(sent.request.operationId)}`, { headers });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? t('mokina.web.queryFailed'));
      if (!active.current) return;
      if (body.result === null) { setCanRetry(true); setError(t('mokina.web.notFound')); return; }
      await accept(body.result, sent);
    } catch (cause) { if (active.current) setError(`${t('mokina.web.queryFailed')} ${cause instanceof Error ? cause.message : ''}`); }
    finally { if (active.current) setBusy(false); }
  }
  async function rebuild() {
    if (corrupt === null || busy) return;
    setBusy(true); setError('');
    try {
      backup.current ??= `${key}:unreadable:${randomUUID()}`;
      if (!await mirrorDurableRecord(backup.current, corrupt) || !await flushDurableRecord(backup.current)) throw new Error(t('mokina.web.draftFailed'));
      localStorage.setItem(backup.current, corrupt);
      if (!await mutateDurableRecord(key, value => value === corrupt ? null : undefined)) throw new Error(t('mokina.web.draftFailed'));
      await load();
    } catch (cause) { if (active.current) setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { if (active.current) setBusy(false); }
  }
  return <section className={styles.panel} data-testid="mokina-web-evidence">
    <h2>{t('mokina.web.title')}</h2><p>{t('mokina.web.description')}</p>
    {draft && readable.current ? <>
      <label>{t('mokina.web.url')}<Input aria-label={t('mokina.web.url')} maxLength={4096} value={draft.request.url} disabled={busy || draft.state === 'unknown'} onChange={event => {
        if (!current.current) return; setResult(null); setError(''); setCanRetry(false);
        void persist({ schema: 1, state: 'draft', request: { operationId: randomUUID(), url: event.target.value } }).catch(cause => { if (active.current) setError(String(cause instanceof Error ? cause.message : cause)); });
      }} /></label>
      <div className={styles.actions}>
        {draft.state !== 'unknown' ? <Button disabled={busy || saveFailed || !draft.request.url.trim()} onClick={() => void capture()}>{t(draft.state === 'saved' ? 'mokina.web.newRead' : 'mokina.web.capture')}</Button> : <>
          <Button disabled={busy} onClick={() => void query()}>{t('mokina.web.query')}</Button>
          {canRetry && !saveFailed ? <Button disabled={busy} onClick={() => void capture()}>{t(result?.workingFile === 'missing' ? 'mokina.web.completeSave' : 'mokina.web.retry')}</Button> : null}
        <Button variant="ghost" disabled={busy || saveFailed} onClick={() => void prepareNewRead()}>{t('mokina.web.prepareNew')}</Button>
        </>}
        {busy && controller.current ? <Button variant="ghost" onClick={() => controller.current?.abort()}>{t('mokina.web.stop')}</Button> : null}
      </div>
      {draft.state === 'unknown' ? <p role="status">{t(busy ? 'mokina.web.reading' : 'mokina.web.unknown')}</p> : null}
      {draft.state === 'saved' && !result ? <Button variant="ghost" disabled={busy} onClick={() => void query()}>{t('mokina.web.query')}</Button> : null}
    </> : <Button disabled={busy} onClick={() => void load(true)}>{t('mokina.web.reloadDraft')}</Button>}
    {saveFailed ? <Button disabled={busy} onClick={() => void recoverInput()}>{t('mokina.web.recoverInput')}</Button> : null}
    {corrupt !== null ? <Button disabled={busy} onClick={() => void rebuild()}>{t('mokina.web.rebuild')}</Button> : null}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div>
      <p role="status">{t(result.workingFile === 'missing' ? 'mokina.web.fileMissing' : 'mokina.web.saved')}</p>
      {result.workingFile === 'changed' ? <p>{t('mokina.web.fileChanged')}</p> : null}
      <code className={styles.identity}>{result.fileName} · {result.versionId} · {result.contentDigest}</code>
      <p>{result.receipt.resolvedUrl} · {result.receipt.retrievedAt}</p>
      <p>{t(result.receipt.scope === 'plain-text' ? 'mokina.web.plain' : 'mokina.web.static')}</p>
      {result.receipt.limitations.map(item => <p key={item}>{item}</p>)}
      <details><summary>{t('mokina.web.preview')}</summary><pre className={styles.preview} tabIndex={0} aria-label={t('mokina.web.preview')}>{result.content}</pre></details>
    </div> : null}
  </section>;
}
