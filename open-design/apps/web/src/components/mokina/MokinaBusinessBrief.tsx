import { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, Textarea } from '@open-design/components';
import type { MokinaBusinessBody, MokinaBusinessReadResult, WorkspaceCollabContext } from '@open-design/contracts';
import { parseSaveMokinaBusinessRequest } from '@open-design/contracts';
import { useT } from '../../i18n';
import { workspaceIdentityCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { businessBriefHandoff, businessDraftKey, emptyBusinessBody, persistBusinessDraft, readBusinessDraft, type BusinessDraft } from '../../runtime/mokina/business-brief';
import { flushDurableRecord } from '../../runtime/persistence/mokina-recovery-store';
import { notifyMokinaEntriesChanged } from '../../runtime/mokina-entry-events';
import styles from './MokinaBusinessBrief.module.css';

type Props = { projectId: string; conversationId: string; workspaceContext: WorkspaceCollabContext | null; disabled?: boolean; onPrepare: (prompt: string) => void };
export function MokinaBusinessBrief(props: Props) {
  const t = useT();
  const scope = JSON.stringify([workspaceIdentityCacheKey(props.workspaceContext), props.projectId, props.conversationId]);
  return <details className={styles.panel} data-testid="mokina-business-brief"><summary>{t('mokina.business.open')}</summary>
    <p>{t('mokina.business.optional')}</p><BusinessEditor key={scope} {...props} scope={scope} />
  </details>;
}
function BusinessEditor(props: Props & { scope: string }) {
  const t = useT();
  const [kind, setKind] = useState<'background' | 'brief'>('brief');
  return <><div className={styles.actions}>
    <Button aria-pressed={kind === 'brief'} onClick={() => setKind('brief')}>{t('mokina.business.brief')}</Button>
    <Button aria-pressed={kind === 'background'} onClick={() => setKind('background')}>{t('mokina.business.background')}</Button>
  </div><DocumentEditor key={kind} {...props} kind={kind} /></>;
}
function DocumentEditor({ projectId, workspaceContext, scope, kind, disabled, onPrepare }: Props & { scope: string; kind: 'background' | 'brief' }) {
  const t = useT();
  const key = businessDraftKey(scope, kind);
  const [draft, setDraft] = useState<BusinessDraft | null>(null);
  const [saved, setSaved] = useState<MokinaBusinessReadResult | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceProject, setSourceProject] = useState(projectId);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [source, setSource] = useState<MokinaBusinessReadResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const raw = useRef<string | null>(null);
  const recoveryReadable = useRef(false);
  const current = useRef<BusinessDraft | null>(null);
  const active = useRef(true);
  const sourceSequence = useRef(0);
  const headers = workspaceContext ? workspaceProjectHeaders(workspaceContext) : {};
  const endpoint = (id: string, target: string) => `/api/projects/${encodeURIComponent(id)}/mokina/business/${target}`;
  async function request(url: string, init?: RequestInit): Promise<{ result: MokinaBusinessReadResult | null }> {
    const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers }, signal: AbortSignal.timeout(20_000) });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.error?.message ?? `${response.status}`), { status: response.status });
    return data;
  }
  useEffect(() => {
    active.current = true;
    void (async () => {
      try {
        if (!await flushDurableRecord(key)) throw new Error(t('mokina.business.draftFailed'));
        const restored = readBusinessDraft(key); recoveryReadable.current = true; raw.current = localStorage.getItem(key);
        if (restored && active.current) { current.current = restored; setDraft(restored); }
        const { result } = await request(endpoint(projectId, kind));
        if (!active.current) return;
        setSaved(result);
        if (!restored) {
          const next: BusinessDraft = { schema: 1, pending: false, request: { operationId: crypto.randomUUID(), expectedRevision: result?.revision ?? null,
            body: result?.document.body ?? emptyBusinessBody(kind) } };
          current.current = next; setDraft(next);
        }
      } catch (cause) { if (active.current) setError(String(cause instanceof Error ? cause.message : cause)); }
    })();
    return () => { active.current = false; sourceSequence.current++; };
  }, []);
  function persist(next: BusinessDraft): Promise<void> {
    current.current = next; setDraft(next);
    const task = persistBusinessDraft(key, next, raw.current);
    // The local cache is written synchronously; native serialization is owned
    // by the shared recovery store so remounts can flush all queued writes.
    try { if (localStorage.getItem(key) === JSON.stringify(next)) raw.current = JSON.stringify(next); } catch { /* The task reports storage failure. */ }
    return task.then(() => undefined).catch(cause => { if (active.current) setError(cause instanceof Error ? cause.message : t('mokina.business.draftFailed')); throw cause; });
  }
  function update(body: MokinaBusinessBody) {
    if (!current.current || busy || current.current.pending || disabled) return;
    setStatus(''); setSelected([]);
    const next = { ...current.current, request: { ...current.current.request, operationId: crypto.randomUUID(), body } };
    void persist(next).catch(() => undefined);
  }
  async function save() {
    if (!current.current || busy || disabled) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const captured = current.current;
      parseSaveMokinaBusinessRequest(captured.request);
      // Save the exact operation before dispatch, including across renderer restarts.
      await persist({ ...captured, pending: true });
      const { result } = await request(endpoint(projectId, kind), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(captured.request) });
      if (!result?.versionId) throw new Error(t('mokina.business.unknown'));
      const next: BusinessDraft = { schema: 1, pending: false, request: { operationId: crypto.randomUUID(), expectedRevision: result.revision, body: result.document.body } };
      // This write belongs to its captured scope even if the panel has closed.
      await persist(next);
      notifyMokinaEntriesChanged(projectId);
      if (active.current) { setSaved(result); setError(''); setStatus(t('mokina.business.saved')); }
    } catch (cause) {
      const status = (cause as { status?: number }).status;
      if (status && status >= 400 && status < 500 && current.current) {
        await persist({ ...current.current, pending: false }).catch(() => undefined);
      }
      if (active.current) setError(cause instanceof Error ? cause.message : t('mokina.business.unknown'));
    }
    finally { if (active.current) setBusy(false); }
  }
  async function inspectCurrent() {
    if (busy) return; setBusy(true); setError('');
    try {
      const { result } = await request(endpoint(projectId, kind));
      if (!active.current) return;
      setSaved(result);
      const value = current.current;
      if (!value && !recoveryReadable.current) throw new Error(t('mokina.business.draftFailed'));
      if (!value) { const next: BusinessDraft = { schema: 1, pending: false, request: { operationId: crypto.randomUUID(), expectedRevision: result?.revision ?? null, body: result?.document.body ?? emptyBusinessBody(kind) } }; current.current = next; setDraft(next); }
      if (value?.pending && result?.document.operationId === value.request.operationId && JSON.stringify(result.document.body) === JSON.stringify(value.request.body)) {
        if (result.versionId) {
          await persist({ schema: 1, pending: false, request: { operationId: crypto.randomUUID(), expectedRevision: result.revision, body: result.document.body } });
          if (active.current) { setError(''); setStatus(t('mokina.business.saved')); }
        } else {
          // Only an incomplete version needs an explicit repeat of the same operation.
          setStatus(t('mokina.business.reconcile'));
        }
      } else if (value?.pending) {
        setStatus(t('mokina.business.compare'));
      }
    } catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : t('mokina.business.unknown')); }
    finally { if (active.current) setBusy(false); }
  }
  async function loadSource() {
    const sequence = ++sourceSequence.current; setError(''); setSource(null);
    try {
      const { result } = await request(endpoint(sourceProject, 'background'));
      if (!active.current || sequence !== sourceSequence.current) return;
      if (!result?.versionId) throw new Error(t('mokina.business.noSource'));
      setSource(result);
    } catch (cause) { if (active.current && sequence === sourceSequence.current) setError(cause instanceof Error ? cause.message : t('mokina.business.noSource')); }
  }
  const body = draft?.request.body;
  const locked = busy || !!disabled || !!draft?.pending;
  const identical = saved && body && JSON.stringify(saved.document.body) === JSON.stringify(body);
  const field = (name: 'goal' | 'audience' | 'kpi' | 'budget' | 'period' | 'constraints' | 'missing') => body?.kind === 'brief'
    ? <label key={name}>{t(`mokina.business.${name}`)}<Textarea aria-label={t(`mokina.business.${name}`)} maxLength={4000} rows={2} value={body.value[name]} disabled={locked} onChange={event => update({ ...body, value: { ...body.value, [name]: event.target.value } })} /></label> : null;
  return <>
    {error ? <p role="alert">{error}</p> : null}{status ? <p role="status">{status}</p> : null}
    <div className={styles.editor}>
    {!body ? <><p>{t('mokina.business.loading')}</p><Button disabled={busy} onClick={() => void inspectCurrent()}>{t('mokina.business.inspect')}</Button></> : <>
      <label>{t('mokina.business.title')}<Input aria-label={t('mokina.business.title')} maxLength={200} value={body.value.title} disabled={locked} onChange={event => update(body.kind === 'background' ? { ...body, value: { ...body.value, title: event.target.value } } : { ...body, value: { ...body.value, title: event.target.value } })} /></label>
      {body.kind === 'background' ? <>
        <p>{t('mokina.business.confirmHint')}</p>
        {body.value.facts.map((fact, index) => <fieldset key={fact.id} className={styles.fact} disabled={locked}>
          <legend>{`${t('mokina.business.fact')} ${index + 1}`}</legend>
          {(['text', 'source', 'scope'] as const).map(name => <label key={name}>{t(`mokina.business.${name}`)}<Textarea aria-label={t(`mokina.business.${name}`)} maxLength={name === 'text' ? 4000 : 1000} rows={2} value={fact[name]} onChange={event => update({ ...body, value: { ...body.value, facts: body.value.facts.map(item => item.id === fact.id ? { ...item, [name]: event.target.value, status: 'proposed' } : item) } })} /></label>)}
          <label className={styles.check}><input type="checkbox" checked={fact.status === 'confirmed'} disabled={!fact.text.trim() || !fact.source.trim() || !fact.scope.trim()} onChange={event => update({ ...body, value: { ...body.value, facts: body.value.facts.map(item => item.id === fact.id ? { ...item, status: event.target.checked ? 'confirmed' : 'proposed' } : item) } })} />{t('mokina.business.confirm')}</label>
          <Button onClick={() => update({ ...body, value: { ...body.value, facts: body.value.facts.filter(item => item.id !== fact.id) } })}>{t('mokina.business.remove')}</Button>
        </fieldset>)}
        <Button disabled={locked || body.value.facts.length >= 30} onClick={() => update({ ...body, value: { ...body.value, facts: [...body.value.facts, { id: crypto.randomUUID(), text: '', source: '', scope: '', status: 'proposed' }] } })}>{t('mokina.business.addFact')}</Button>
        <label>{t('mokina.business.preferences')}<Textarea aria-label={t('mokina.business.preferences')} maxLength={4000} value={body.value.preferences} disabled={locked} onChange={event => update({ ...body, value: { ...body.value, preferences: event.target.value } })} /></label>
      </> : <>
        {field('goal')}{field('audience')}
        <fieldset className={styles.fact} disabled={locked}><legend>{t('mokina.business.deliverables')}</legend>
          {body.value.deliverables.map((item, index) => <div key={item.id}><label>{`${t('mokina.business.deliverables')} ${index + 1}`}<Input aria-label={`${t('mokina.business.deliverables')} ${index + 1}`} maxLength={500} value={item.title} onChange={event => update({ ...body, value: { ...body.value, deliverables: body.value.deliverables.map(entry => entry.id === item.id ? { ...entry, title: event.target.value } : entry) } })} /></label>
            <Button onClick={() => update({ ...body, value: { ...body.value, deliverables: body.value.deliverables.filter(entry => entry.id !== item.id) } })}>{t('mokina.business.remove')}</Button></div>)}
          <Button disabled={body.value.deliverables.length >= 30} onClick={() => update({ ...body, value: { ...body.value, deliverables: [...body.value.deliverables, { id: crypto.randomUUID(), title: '' }] } })}>{t('mokina.business.addDeliverable')}</Button>
        </fieldset>
        {field('kpi')}{field('budget')}{field('period')}{field('constraints')}{field('missing')}
        <details><summary>{t('mokina.business.reuse')}</summary>
          <Button disabled={locked} onClick={async () => {
            try { const url = workspaceContext ? `/api/workspaces/${encodeURIComponent(workspaceContext.workspaceId)}/projects` : '/api/projects';
              const response = await fetch(url, { headers }); const data = await response.json(); if (!response.ok || !Array.isArray(data.projects)) throw new Error(t('mokina.business.noSource'));
              if (active.current) setProjects(data.projects);
            } catch (cause) { if (active.current) setError(String(cause)); }
          }}>{t('mokina.business.projects')}</Button>
          <label>{t('mokina.business.sourceProject')}<Select value={sourceProject} disabled={locked} onChange={event => { sourceSequence.current++; setSourceProject(event.target.value); setSource(null); }}>
            <option value={projectId}>{t('mokina.business.thisProject')}</option>{projects.filter(item => item.id !== projectId).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select></label>
          <Button disabled={locked} onClick={() => void loadSource()}>{t('mokina.business.readSource')}</Button>
          {source?.document.body.kind === 'background' ? <><p>{source.document.body.value.title} · {source.versionId}</p>
            {source.document.body.value.facts.map(fact => <label className={styles.check} key={fact.id}><input type="checkbox" disabled={locked || fact.status !== 'confirmed'} checked={body.background?.projectId === sourceProject && body.background.versionId === source.versionId && body.background.factIds.includes(fact.id)} onChange={event => {
              const ids = body.background?.projectId === sourceProject && body.background.versionId === source.versionId ? body.background.factIds : [];
              const factIds = event.target.checked ? [...ids, fact.id] : ids.filter(id => id !== fact.id);
              update({ ...body, background: factIds.length ? { projectId: sourceProject, versionId: source.versionId!, revision: source.revision, factIds } : null });
            }} />{fact.text} · {fact.status === 'confirmed' ? t('mokina.business.confirmed') : t('mokina.business.proposed')}</label>)}
          </> : null}
        </details>
        <p>{body.background ? `${t('mokina.business.fixedSource')} ${body.background.projectId} / ${body.background.versionId} · ${body.background.factIds.length}` : t('mokina.business.noReuse')}</p>
        {body.background ? <Button disabled={locked} onClick={() => update({ ...body, background: null })}>{t('mokina.business.clearSource')}</Button> : null}
      </>}
      <div className={styles.actions}><Button variant="primary" disabled={busy || disabled || !!(identical && saved.versionId && !draft.pending && draft.request.expectedRevision === saved.revision)} onClick={() => void save()}>{draft.pending ? t('mokina.business.reconcile') : t('mokina.business.save')}</Button>
        <Button disabled={busy} onClick={() => void inspectCurrent()}>{t('mokina.business.inspect')}</Button></div>
      {draft.pending ? <p>{t('mokina.business.unknown')}</p> : null}
      {saved ? <BusinessCurrentContent saved={saved} /> : null}
      {saved ? <p>{t('mokina.business.current')} {saved.fileName} · {saved.versionId ?? t('mokina.business.unknown')}</p> : null}
      {saved && draft.request.expectedRevision !== saved.revision ? <Button disabled={busy || disabled} onClick={() => {
        setError(''); void persist({ ...draft, pending: false, request: { ...draft.request, operationId: crypto.randomUUID(), expectedRevision: saved.revision } }).catch(() => undefined);
      }}>{t('mokina.business.keepDraft')}</Button> : null}
      {body.kind === 'brief' && identical && saved.versionId ? <fieldset className={styles.fact} disabled={locked}>
        <legend>{t('mokina.business.execution')}</legend>
        {body.value.deliverables.map(item => <label key={item.id} className={styles.check}><input type="checkbox" checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} />{item.title}</label>)}
        <Button disabled={!selected.length} onClick={() => { try { onPrepare(businessBriefHandoff(saved, selected)); setStatus(t('mokina.business.prepared')); } catch (cause) { setError(String(cause)); } }}>{t('mokina.business.prepare')}</Button>
      </fieldset> : null}
    </>}
  </div></>;
}


function BusinessCurrentContent({ saved }: { saved: MokinaBusinessReadResult }) {
  const t = useT();
  const { body, backgroundSnapshot } = saved.document;
  const facts = body.kind === 'background' ? body.value.facts : backgroundSnapshot?.facts ?? [];
  const lines = body.kind === 'background' ? [body.value.title, `${t('mokina.business.preferences')}：${body.value.preferences}`]
    : [body.value.title, ...(['goal', 'audience', 'kpi', 'budget', 'period', 'constraints', 'missing'] as const).map(name => `${t(`mokina.business.${name}`)}：${body.value[name]}`),
      `${t('mokina.business.deliverables')}：${body.value.deliverables.map(item => item.title).join('、')}`,
      backgroundSnapshot ? `${t('mokina.business.fixedSource')} ${backgroundSnapshot.projectId} / ${backgroundSnapshot.versionId}` : t('mokina.business.noReuse')];
  lines.push(...facts.map(fact => `${fact.status === 'confirmed' ? t('mokina.business.confirmed') : t('mokina.business.proposed')}：${fact.text}\n${t('mokina.business.source')}：${fact.source}\n${t('mokina.business.scope')}：${fact.scope}`));
  return <details><summary>{t('mokina.business.currentContent')}</summary><pre className={styles.comparison}>{lines.join('\n\n')}</pre></details>;
}
