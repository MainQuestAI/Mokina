import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@open-design/components';
import { parseCaptureMokinaWebEvidenceRequest, type MokinaWebCaptureResult, type WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceIdentityCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { useT } from '../../i18n';
import { randomUUID } from '../../utils/uuid';
import { flushDurableRecord, mirrorDurableRecord, mutateDurableRecord, refreshDurableRecord, removeDurableRecord } from '../../runtime/persistence/mokina-recovery-store';
import { parseWebEvidenceDraft, persistWebEvidenceDraft, validateWebCaptureReply, webEvidenceDraftKey, WebEvidenceDraftError, type WebEvidenceDraft } from '../../runtime/mokina/web-evidence';
import styles from './MokinaWebEvidence.module.css';

type Props = { projectId: string; conversationId: string; workspaceContext: WorkspaceCollabContext | null; onCaptured: (result: MokinaWebCaptureResult) => void };
export function MokinaWebEvidence(props: Props) {
  const scope = JSON.stringify([workspaceIdentityCacheKey(props.workspaceContext), props.projectId, props.conversationId]);
  return <EvidenceEditor key={scope} {...props} scope={scope} />;
}
const QUERY_TIMEOUT_MS = 20_000;
const BACKUPS_KEPT = 3;
function EvidenceEditor({ projectId, workspaceContext, onCaptured, scope }: Props & { scope: string }) {
  const t = useT(); const key = webEvidenceDraftKey(scope);
  const [draft, setDraft] = useState<WebEvidenceDraft | null>(null);
  const [result, setResult] = useState<MokinaWebCaptureResult | null>(null);
  const [error, setError] = useState(''); const [corrupt, setCorrupt] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false); const writeSequence = useRef(0);
  const [busy, setBusy] = useState(false); const [canRetry, setCanRetry] = useState(false);
  const active = useRef(true); const current = useRef<WebEvidenceDraft | null>(null); const raw = useRef<string | null>(null);
  const readable = useRef(false); const backup = useRef<string | null>(null); const controller = useRef<AbortController | null>(null);
  const queryTimedOut = useRef(false); const statusRef = useRef<HTMLParagraphElement | null>(null);
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/mokina/web-evidence`;
  const headers = workspaceContext ? workspaceProjectHeaders(workspaceContext) : {};
  // Localized failure copy: draft/persistence/closure failures, cancellation
  // and timeout each get their own message; server details stay as diagnostics.
  // The fallback prefix names the failing operation, so a read-back conflict
  // never reads as a page-reading failure.
  function describeFailure(cause: unknown, fallback: 'read' | 'query' | 'draft' = 'read'): string {
    if (cause instanceof WebEvidenceDraftError) {
      if (cause.reason === 'cas-conflict') return t('mokina.web.conflict');
      if (cause.reason === 'not-durable') return t('mokina.web.persistFailed');
      return t('mokina.web.mismatch');
    }
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      return queryTimedOut.current ? t('mokina.web.queryTimeout') : t('mokina.web.stopped');
    }
    const prefix = fallback === 'query' ? t('mokina.web.queryFailed') : fallback === 'draft' ? t('mokina.web.draftFailed') : t('mokina.web.readFailed');
    return `${prefix} ${cause instanceof Error ? cause.message : t('mokina.web.unknown')}`;
  }
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
    } catch (cause) { readable.current = false; if (active.current) setError(describeFailure(cause, 'draft')); }
    finally { if (active.current) setBusy(false); }
  }
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; controller.current?.abort(); }; }, []);
  function persist(next: WebEvidenceDraft, optimistic = true) {
    const sequence = ++writeSequence.current;
    const task = persistWebEvidenceDraft(key, next, raw.current);
    // Retain this window's input if CAS fails; an explicit backup/read accepts the authority.
    try { if (localStorage.getItem(key) === JSON.stringify(next)) raw.current = JSON.stringify(next); } catch { /* task reports failure */ }
    // An optimistic:false caller (the pre-send persist) applies the state only
    // after the write succeeded, so a failed save never fakes an unknown state.
    if (optimistic) { current.current = next; if (active.current) setDraft(next); }
    return task.then(value => { if (active.current && sequence === writeSequence.current) setSaveFailed(false); return value; }, cause => {
      if (active.current && sequence === writeSequence.current) setSaveFailed(true);
      throw cause;
    });
  }
  function pruneBackups(kind: 'conflict' | 'unknown' | 'unreadable') {
    // Backup entries mirror into the shared desktop recovery store, so unbounded
    // growth would eventually crowd out every other feature's recovery records.
    // Keys embed a base36 timestamp, so keep the newest three by key order even
    // when hydration re-materializes old durable records out of order.
    const prefix = `${key}:${kind}:`;
    const stamp = (name: string) => name.slice(prefix.length).split('-')[0] ?? '';
    const names: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i); if (name && name.startsWith(prefix)) names.push(name);
    }
    names.sort((a, b) => stamp(a).localeCompare(stamp(b)));
    return Promise.all(names.slice(0, Math.max(0, names.length - BACKUPS_KEPT)).map(async name => {
      localStorage.removeItem(name);
      // Never swallow a failed durable delete silently: hydration would bring
      // the record back, so report it instead of pretending the bound holds.
      if (!await removeDurableRecord(name)) console.warn('[mokina] backup prune could not delete a durable record');
    }));
  }
  async function backUpInput(kind: 'conflict' | 'unknown') {
    const value = current.current; if (!value) throw new Error(t('mokina.web.draftFailed'));
    const backupKey = `${key}:${kind}:${Date.now().toString(36)}-${randomUUID()}`;
    const bytes = JSON.stringify(value);
    if (!await mirrorDurableRecord(backupKey, bytes) || !await flushDurableRecord(backupKey)) throw new Error(t('mokina.web.draftFailed'));
    localStorage.setItem(backupKey, bytes);
    await pruneBackups(kind);
  }
  async function recoverInput() {
    if (busy) return; setBusy(true); setError('');
    try { await backUpInput('conflict'); await load(true); }
    catch (cause) { if (active.current) setError(describeFailure(cause, 'draft')); }
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
    } catch (cause) { if (active.current) { setSaveFailed(true); setError(describeFailure(cause, 'draft')); } }
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
    setBusy(true); setError(''); setResult(null); setCanRetry(false); queryTimedOut.current = false; controller.current = new AbortController();
    try {
      // No request before the exact intent is recoverable, and the panel only
      // turns unknown once that persisted intent is about to be sent.
      await persist(sent, false);
      current.current = sent; if (active.current) setDraft(sent);
      const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(sent.request), signal: controller.current.signal });
      const body = await response.json();
      if (!response.ok) {
        // Reader failures happen before publication. Storage/transport failures stay unknown.
        const code = String(body.error?.code ?? '');
        if (['WEB_HTTP_ERROR', 'WEB_FORMAT_UNSUPPORTED', 'WEB_TOO_LARGE', 'WEB_ENCODING_UNSUPPORTED', 'WEB_EMPTY', 'WEB_READ_FAILED', 'WEB_READ_STOPPED', 'BAD_REQUEST'].includes(code)) await persist({ ...sent, state: 'draft' });
        throw new Error(body.error?.message ?? t('mokina.web.unknown'));
      }
      await accept(body.result, sent);
    } catch (cause) { if (active.current) setError(describeFailure(cause)); }
    finally { controller.current = null; if (active.current) setBusy(false); }
  }
  async function query() {
    const sent = current.current; if (!sent || busy) return;
    setBusy(true); setError(''); setCanRetry(false); queryTimedOut.current = false;
    controller.current = new AbortController();
    const timer = window.setTimeout(() => { queryTimedOut.current = true; controller.current?.abort(); }, QUERY_TIMEOUT_MS);
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(sent.request.operationId)}`, { headers, signal: controller.current.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? t('mokina.web.queryFailed'));
      if (!active.current) return;
      if (body.result === null) { setCanRetry(true); setError(t('mokina.web.notFound')); return; }
      await accept(body.result, sent);
    } catch (cause) { if (active.current) setError(describeFailure(cause, 'query')); }
    finally { window.clearTimeout(timer); controller.current = null; if (active.current) setBusy(false); }
  }
  async function rebuild() {
    if (corrupt === null || busy) return;
    setBusy(true); setError('');
    try {
      backup.current ??= `${key}:unreadable:${Date.now().toString(36)}-${randomUUID()}`;
      if (!await mirrorDurableRecord(backup.current, corrupt) || !await flushDurableRecord(backup.current)) throw new Error(t('mokina.web.draftFailed'));
      localStorage.setItem(backup.current, corrupt);
      await pruneBackups('unreadable');
      if (!await mutateDurableRecord(key, value => value === corrupt ? null : undefined)) throw new Error(t('mokina.web.draftFailed'));
      await load();
    } catch (cause) { if (active.current) setError(String(cause instanceof Error ? cause.message : cause)); }
    finally { if (active.current) setBusy(false); }
  }
  useEffect(() => {
    // Focus lands on the status line when the panel turns unknown; the button
    // group swap must not drop keyboard focus to <body>.
    if (draft?.state === 'unknown') statusRef.current?.focus();
  }, [draft?.state]);
  return <section className={styles.panel} data-testid="mokina-web-evidence">
    <h2>{t('mokina.web.title')}</h2><p>{t('mokina.web.description')}</p>
    {draft && readable.current ? <>
      <label>{t('mokina.web.url')}<Input aria-label={t('mokina.web.url')} maxLength={4096} value={draft.request.url} disabled={busy || draft.state === 'unknown'} onChange={event => {
        if (!current.current) return; setResult(null); setError(''); setCanRetry(false);
        void persist({ schema: 1, state: 'draft', request: { operationId: randomUUID(), url: event.target.value } }).catch(cause => { if (active.current) setError(describeFailure(cause, 'draft')); });
      }} /></label>
      <div className={styles.actions}>
        {draft.state !== 'unknown' ? <Button disabled={busy || saveFailed || !draft.request.url.trim()} onClick={() => void capture()}>{t(draft.state === 'saved' ? 'mokina.web.newRead' : 'mokina.web.capture')}</Button> : <>
          <Button disabled={busy || saveFailed} onClick={() => void query()}>{t('mokina.web.query')}</Button>
          {canRetry && !saveFailed ? <Button disabled={busy} onClick={() => void capture()}>{t(result?.workingFile === 'missing' ? 'mokina.web.completeSave' : 'mokina.web.retry')}</Button> : null}
        <Button variant="ghost" disabled={busy || saveFailed} onClick={() => void prepareNewRead()}>{t('mokina.web.prepareNew')}</Button>
        </>}
        {busy && controller.current ? <Button variant="ghost" onClick={() => controller.current?.abort()}>{t('mokina.web.stop')}</Button> : null}
      </div>
      {draft.state === 'unknown' ? <p ref={statusRef} tabIndex={-1} role="status">{t(busy ? 'mokina.web.reading' : 'mokina.web.unknown')}</p> : null}
      {draft.state === 'saved' && !result ? <Button variant="ghost" disabled={busy} onClick={() => void query()}>{t('mokina.web.query')}</Button> : null}
    </> : <Button disabled={busy} onClick={() => void load(true)}>{t('mokina.web.reloadDraft')}</Button>}
    {saveFailed ? <>
      <Button disabled={busy} onClick={() => void recoverInput()}>{t('mokina.web.recoverInput')}</Button>
      <Button variant="ghost" disabled={busy} onClick={() => void load(true)}>{t('mokina.web.reloadWithoutBackup')}</Button>
    </> : null}
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
