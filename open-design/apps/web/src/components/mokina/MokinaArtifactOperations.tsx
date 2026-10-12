import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from '@open-design/components';
import type { MokinaOperationInspection, MokinaOperationRequest, ProjectFileVersion, WorkspaceCollabContext } from '@open-design/contracts';
import { parseMokinaOperationRequest } from '@open-design/contracts';
import { workspaceIdentityCacheKey, workspaceProjectHeaders } from '../../collab/workspace-identity';
import { flushDurableRecord, mutateDurableRecord } from '../../runtime/persistence/mokina-recovery-store';
import { useT } from '../../i18n';
import styles from './MokinaArtifactOperations.module.css';

type Inspection = MokinaOperationInspection;
type Draft = { edits: Record<string, string>; donor: string; sections: string[]; pending: MokinaOperationRequest | null };
const empty = (): Draft => ({ edits: {}, donor: '', sections: [], pending: null });
function parse(raw: string | null): Draft {
  if (!raw) return empty();
  const d = JSON.parse(raw) as Draft;
  if (!d || !d.edits || typeof d.edits !== 'object' || Array.isArray(d.edits) || Object.values(d.edits).some(v => typeof v !== 'string')
    || typeof d.donor !== 'string' || !Array.isArray(d.sections) || d.sections.some(s => typeof s !== 'string')) throw new Error('Draft is damaged; preserve it before resetting');
  if (d.pending) parseMokinaOperationRequest(d.pending);
  return d;
}
export function MokinaArtifactOperations(props: { projectId: string; fileName: string; version: ProjectFileVersion; versions: ProjectFileVersion[];
  workspaceContext: WorkspaceCollabContext | null; disabled?: boolean; onSaved: (version: ProjectFileVersion) => void }) {
  const scope = JSON.stringify([workspaceIdentityCacheKey(props.workspaceContext), props.projectId, props.fileName, props.version.id]);
  const [opened, setOpened] = useState(false);
  const t = useT();
  return <><Button data-testid="mokina-artifact-operations-open" onClick={() => setOpened(true)}>{t('mokina.operations.title')}</Button>
    {opened ? <Dialog data-mokina-operations-dialog="true" className={styles.dialog} ariaLabel={t('mokina.operations.title')} onClose={() => setOpened(false)} closeOnBackdrop={false}>
      <Editor key={scope} {...props} scope={scope} onClose={() => setOpened(false)} />
    </Dialog> : null}</>;
}
function Editor({ projectId, fileName, version, versions, workspaceContext, disabled, onSaved, scope, onClose }: Parameters<typeof MokinaArtifactOperations>[0] & { scope: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const nodes = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled), input:not(:disabled)') ?? []);
    nodes()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const list = nodes(); const first = list[0], last = list.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); if (origin?.isConnected) origin.focus(); };
  }, []);
  const t = useT(); const key = `od:revision:operations:${scope}`;
  const endpoint = `/api/projects/${encodeURIComponent(projectId)}/files/${fileName.split('/').map(encodeURIComponent).join('/')}`;
  const [data, setData] = useState<Inspection | null>(null), [draft, setDraft] = useState<Draft>(empty);
  const [donorData, setDonorData] = useState<Inspection | null>(null);
  const [donorError, setDonorError] = useState('');
  const [backupText, setBackupText] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false), [absent, setAbsent] = useState(false), [damaged, setDamaged] = useState(false);
  const raw = useRef<string | null>(null), current = useRef(draft), active = useRef(true), sequence = useRef(0), submitting = useRef(false);
  async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, { ...init, headers: { ...(workspaceContext ? workspaceProjectHeaders(workspaceContext) : {}), ...init?.headers }, signal: AbortSignal.timeout(20_000) });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error?.message || String(response.status)), { status: response.status });
    return result;
  }
  async function load(explicitRetry = false) {
    const generation = ++sequence.current; setReady(false); setError('');
    try {
      if (!await flushDurableRecord(key) && !explicitRetry) throw new Error(t('mokina.business.draftFailed'));
      const backups = Object.keys(localStorage).filter(name => name.startsWith(`${key}:backup:`));
      if (backups.length) setBackupText(localStorage.getItem(backups.at(-1)!) ?? '');
      const captured = localStorage.getItem(key); raw.current = captured;
      let restored: Draft;
      try { restored = parse(captured); } catch (e) { if (active.current) setDamaged(true); throw e; }
      const info = await request(`${endpoint}/operations?versionId=${encodeURIComponent(version.id)}`) as Inspection;
      if (!active.current || generation !== sequence.current) return;
      if (!Array.isArray(info.fields) || !Array.isArray(info.sections) || info.versionId !== version.id || (restored.pending && (restored.pending.baseVersionId !== version.id || restored.pending.contentDigest !== info.contentDigest))) throw new Error('Version identity mismatch');
      current.current = restored; setDraft(restored); setData(info); setReady(true); setDamaged(false);
    } catch (e) { if (active.current && generation === sequence.current) setError(String(e)); }
  }
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; sequence.current++; }; }, []);
  useEffect(() => {
    let live = true; setDonorData(null); setDonorError('');
    if (draft.donor) void request(`${endpoint}/operations?versionId=${encodeURIComponent(draft.donor)}`).then(value => {
      if (live && value.versionId === draft.donor) setDonorData(value);
    }).catch(e => { if (live) setDonorError(String(e)); });
    return () => { live = false; };
  }, [draft.donor]);
  async function persist(next: Draft, optimistic = true): Promise<boolean> {
    if (optimistic) { current.current = next; setDraft(next); }
    const text = JSON.stringify(next);
    const ok = await mutateDurableRecord(key, value => value === raw.current ? text : undefined);
    if (ok) { raw.current = text; if (!optimistic && active.current) { current.current = next; setDraft(next); } }
    if (active.current) setSaveFailed(!ok);
    return ok;
  }
  function update(patch: Partial<Draft>) { void persist({ ...current.current, ...patch }); }
  async function complete(saved: ProjectFileVersion) {
    if (await persist(empty(), false) && active.current) onSaved(saved);
  }
  async function reconcile() {
    setBusy(true); setError(''); setAbsent(false);
    try {
      const result = await request(`${endpoint}/versions?readOnly=true`);
      const found = (result.versions as ProjectFileVersion[]).find(v => v.operationId === current.current.pending?.operationId);
      if (!active.current) return;
      if (found) {
        const receipt = await request(`${endpoint}/operations?versionId=${encodeURIComponent(found.id)}`) as Inspection;
        if (!active.current) return;
        if (!receipt.operation || JSON.stringify(parseMokinaOperationRequest(receipt.operation)) !== JSON.stringify(parseMokinaOperationRequest(current.current.pending))) throw new Error('Saved operation differs from this draft; preserve and inspect the version');
        await complete(found);
      } else { setAbsent(true); setError(t('mokina.operations.absent')); }
    } catch (e) { if (active.current) setError(String(e)); }
    finally { if (active.current) setBusy(false); }
  }
  async function save(retry = false) {
    if (!data || submitting.current) return; submitting.current = true; setBusy(true); setError('');
    try {
      let pending = current.current.pending;
      if (!retry) {
        const donor = draft.donor ? donorData : null;
        if (draft.donor && (!donor || donor.versionId !== draft.donor)) throw new Error('Source version is not ready');
        if (!active.current) return;
        pending = parseMokinaOperationRequest({ operationId: crypto.randomUUID(), baseVersionId: version.id, contentDigest: data.contentDigest,
          edits: Object.entries(current.current.edits).filter(([id, value]) => data.fields.find(f => f.id === id)?.value !== value).map(([id, value]) => ({ id, value })),
          ...(donor ? { combine: { versionId: donor.versionId, contentDigest: donor.contentDigest, sections: current.current.sections } } : {}) });
        if (!await persist({ ...current.current, pending })) return;
      }
      if (!pending) return;
      const result = await request(`${endpoint}/operations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      if (active.current) await complete(result.version);
    } catch (e) { if (active.current) {
      if ([400, 404, 409].includes((e as { status?: number }).status ?? 0)) await persist({ ...current.current, pending: null });
      setError(String(e)); setAbsent(false);
    } }
    finally { submitting.current = false; if (active.current) setBusy(false); }
  }
  const hasEdits = Boolean(data && Object.entries(draft.edits).some(([id, value]) => data.fields.find(f => f.id === id)?.value !== value));
  const locked = disabled || busy || saveFailed || !ready || data?.editable === false || Boolean(draft.pending);
  return <div ref={panelRef} className={styles.panel} data-testid="mokina-artifact-operations"><header><div><h2>{t('mokina.operations.title')}</h2><p>{fileName} · v{version.version} · {t(version.candidate ? 'mokina.operations.candidate' : version.current ? 'mokina.compare.currentDraft' : 'mokina.compare.historicalDraft')}</p></div><Button onClick={onClose}>{t('mokina.compare.close')}</Button></header>
    <p>{t('mokina.operations.help')}</p>
    {error ? <p role="alert">{error}</p> : null}
    {backupText ? <details><summary>{t('mokina.operations.backupRead')}</summary><textarea readOnly aria-label={t('mokina.operations.backupRead')} value={backupText} /><a download="mokina-operation-draft.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(backupText)}`}>JSON ↓</a></details> : null}
    {saveFailed ? <div><p role="alert">{t('mokina.business.draftFailed')}</p><Button onClick={async () => {
      const backup = `${key}:backup:${crypto.randomUUID()}`; const text = JSON.stringify(current.current);
      if (await mutateDurableRecord(backup, old => old === null ? text : undefined)) { setSaveFailed(false); void load(true); }
    }}>{t('mokina.operations.backupRead')}</Button></div> : null}
    {!ready ? <Button onClick={() => void load(true)} disabled={busy}>{t('preview.retry')}</Button> : null}
    {damaged ? <Button onClick={async () => {
      const captured = raw.current; if (!captured) return;
      const backup = `${key}:backup:${crypto.randomUUID()}`;
      if (await mutateDurableRecord(backup, old => old === null ? captured : undefined)
        && await mutateDurableRecord(key, old => old === captured ? null : undefined)) void load();
    }}>{t('mokina.operations.backup')}</Button> : null}
    {ready && (!data?.fields.length || data.editable === false) ? <div><p>{t('mokina.operations.legacy')}</p>{data?.unsupportedReason ? <p role="status">{data.unsupportedReason}</p> : null}</div> : null}
    {data?.fieldWarnings?.length ? <div role="status"><p>{t('mokina.operations.legacy')}</p><ul>{data.fieldWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div> : null}
    {data?.fields.map(field => <label key={field.id}>{field.label}<span>{field.kind}</span>
      <textarea aria-label={field.label} disabled={locked || Boolean(draft.donor)} value={Object.hasOwn(draft.edits, field.id) ? draft.edits[field.id] : field.value} onChange={e => update({ edits: { ...current.current.edits, [field.id]: e.target.value } })} />
    </label>)}
    <label>{t('mokina.operations.donor')}<select aria-label={t('mokina.operations.donor')} disabled={locked || hasEdits} value={draft.donor} onChange={e => update({ donor: e.target.value, sections: [] })}>
      <option value="">{t('mokina.operations.none')}</option>{versions.filter(v => v.id !== version.id).map(v => <option key={v.id} value={v.id}>v{v.version} · {v.label}</option>)}
    </select></label>
    {donorError ? <p role="alert">{donorError}</p> : null}
    {draft.donor && !donorData && !donorError ? <p role="status">{t('common.loading')}</p> : null}
    {draft.donor ? data?.sections.map(s => <label className={styles.choice} key={s.id}><input type="checkbox" disabled={locked} checked={draft.sections.includes(s.id)} onChange={e => update({ sections: e.target.checked ? [...draft.sections, s.id] : draft.sections.filter(id => id !== s.id) })} /><span>{s.id}<br />{s.text.slice(0, 100)}<br />→ {donorData?.sections.find(source => source.id === s.id)?.text ?? '—'}</span></label>) : null}
    {draft.pending ? <div><p role="status">{t(busy ? 'common.loading' : 'mokina.operations.pending')}</p><Button disabled={busy || disabled} onClick={() => void reconcile()}>{t('mokina.operations.check')}</Button>
      {absent ? <><Button disabled={busy || disabled} onClick={() => void save(true)}>{t('mokina.operations.retrySame')}</Button></> : null}
    </div> : <Button variant="primary" disabled={locked || saveFailed || Boolean(draft.donor && !donorData) || (draft.donor ? !draft.sections.length : !hasEdits)} onClick={() => void save()}>{t('mokina.operations.save')}</Button>}
  </div>;
}
