import { useEffect, useRef, useState } from 'react';
import { flushDurableRecord, mirrorDurableRecord, mutateDurableRecord } from '../persistence/mokina-recovery-store';

export type ContinuationDraftAsset = {
  name: string; role: 'logo' | 'hero' | 'supporting'; usageNote: string; digest?: string; byteLength?: number;
};
export type ContinuationDraftBrand = { id: string; title: string; chars: number; digest?: string };
export type ContinuationDraft = {
  schemaVersion: 1; scope: string; baseVersionId: string; contentDigest?: string;
  sections: string[]; background: string; intent: 'discuss' | 'research' | 'strategy' | 'landing-page';
  assets: ContinuationDraftAsset[]; brand: ContinuationDraftBrand | null;
};

/** Pre-creation input only. Execution remains owned by continuation-recovery's journal. */
export const continuationDraftKey = (scope: string) => `od:continuation:draft:${scope}`;

export function parseContinuationDraft(raw: string | null, scope: string): ContinuationDraft | null {
  try {
    const value = JSON.parse(raw ?? 'null') as ContinuationDraft | null;
    if (!value || value.schemaVersion !== 1 || value.scope !== scope || typeof value.baseVersionId !== 'string'
      || (value.contentDigest !== undefined && typeof value.contentDigest !== 'string')
      || typeof value.background !== 'string' || !['discuss', 'research', 'strategy', 'landing-page'].includes(value.intent)
      || !Array.isArray(value.sections) || !value.sections.every(id => typeof id === 'string')
      || new Set(value.sections).size !== value.sections.length
      || !Array.isArray(value.assets) || !value.assets.every(asset => asset && typeof asset.name === 'string'
        && ['logo', 'hero', 'supporting'].includes(asset.role) && typeof asset.usageNote === 'string'
        && (asset.digest === undefined || typeof asset.digest === 'string')
        && (asset.byteLength === undefined || (Number.isSafeInteger(asset.byteLength) && asset.byteLength >= 0)))
      || new Set(value.assets.map(asset => asset.name)).size !== value.assets.length
      || (value.brand !== null && (!value.brand || typeof value.brand.id !== 'string' || typeof value.brand.title !== 'string'
        || !Number.isSafeInteger(value.brand.chars) || value.brand.chars < 0
        || (value.brand.digest !== undefined && typeof value.brand.digest !== 'string')))) return null;
    return value;
  } catch { return null; }
}

const emptyDraft = (scope: string): ContinuationDraft => ({ schemaVersion: 1, scope, baseVersionId: '',
  sections: [], background: '', intent: 'discuss', assets: [], brand: null });

export function useContinuationDraft(scope: string) {
  const key = continuationDraftKey(scope);
  const [draft, setDraft] = useState(() => emptyDraft(scope));
  const [unreadable, setUnreadable] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const current = useRef(draft);
  const rawRef = useRef<string | null>(null);
  const active = useRef(false);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const writeSequence = useRef(0);
  const backupKey = useRef<string | null>(null);

  useEffect(() => {
    active.current = true;
    writeSequence.current++;
    backupKey.current = null;
    setSaving(false); setSaveFailed(false); setResetting(false); setReadFailed(false);
    const stop = () => { active.current = false; writeSequence.current++; };
    let raw: string | null;
    try { raw = localStorage.getItem(key); }
    catch {
      current.current = emptyDraft(scope); setDraft(current.current); setUnreadable(null);
      setReadFailed(true);
      return stop;
    }
    rawRef.current = raw;
    const restored = parseContinuationDraft(raw, scope);
    const next = restored ?? emptyDraft(scope);
    current.current = next; setDraft(next);
    setUnreadable(raw !== null && !restored ? raw : null);
    const sequence = writeSequence.current;
    void flushDurableRecord(key).then(saved => {
      if (!active.current || sequence !== writeSequence.current) return;
      setSaveFailed(!saved);
      // A previous panel may have closed while its write was still queued.
      // Read the final published generation rather than restoring an interim cache.
      let latestRaw: string | null;
      try { latestRaw = localStorage.getItem(key); }
      catch { setReadFailed(true); return; }
      if (latestRaw !== raw && saved) {
        rawRef.current = latestRaw;
        const latest = parseContinuationDraft(latestRaw, scope);
        current.current = latest ?? emptyDraft(scope); setDraft(current.current);
        setUnreadable(latestRaw !== null && !latest ? latestRaw : null);
      }
    }).catch(() => {
      if (active.current && sequence === writeSequence.current) setSaveFailed(true);
    });
    return stop;
  }, [key, scope, readAttempt]);

  function save(next: ContinuationDraft): void {
    if (readFailed || unreadable !== null || resetting || next.scope !== scopeRef.current) return;
    const sequence = ++writeSequence.current;
    current.current = next; setDraft(next);
    const raw = JSON.stringify(next);
    try {
      // Preserve a competing browser window's cache. The existing native CAS
      // separately rejects stale renderers across origins and process restarts.
      if (localStorage.getItem(key) !== rawRef.current) throw new Error('Draft changed');
      localStorage.setItem(key, raw);
      rawRef.current = raw;
    } catch { setSaveFailed(true); setSaving(false); return; }
    setSaving(true);
    void mirrorDurableRecord(key, raw).then(saved => {
      if (active.current && sequence === writeSequence.current) { setSaveFailed(!saved); setSaving(false); }
    }).catch(() => {
      if (active.current && sequence === writeSequence.current) { setSaveFailed(true); setSaving(false); }
    });
  }

  function update(changes: Partial<ContinuationDraft> | ((value: ContinuationDraft) => Partial<ContinuationDraft>),
    source?: { baseVersionId: string; contentDigest?: string }) {
    const value = current.current.scope === scope ? current.current : emptyDraft(scope);
    save({ ...value, ...(!value.baseVersionId && source ? source : {}),
      ...(typeof changes === 'function' ? changes(value) : changes), scope, schemaVersion: 1 });
  }

  async function resetUnreadable() {
    if (unreadable === null || resetting) return;
    const original = unreadable;
    const issuedScope = scope;
    const backup = backupKey.current ??= `${key}:unreadable:${crypto.randomUUID()}`;
    setResetting(true);
    try {
      if (!await mirrorDurableRecord(backup, original)) throw new Error('Backup failed');
      localStorage.setItem(backup, original);
      if (!await mutateDurableRecord(key, raw => raw === original ? null : undefined)) throw new Error('Draft changed');
      if (!active.current || issuedScope !== scopeRef.current) return;
      rawRef.current = null;
      current.current = emptyDraft(scope); setDraft(current.current);
      setUnreadable(null); setSaveFailed(false);
    } catch { if (active.current && issuedScope === scopeRef.current) setSaveFailed(true); }
    finally { if (active.current && issuedScope === scopeRef.current) setResetting(false); }
  }

  return { draft: draft.scope === scope ? draft : emptyDraft(scope), unreadable, readFailed, saveFailed, saving, resetting,
    update, retry: () => readFailed ? setReadAttempt(value => value + 1) : save(current.current), resetUnreadable,
    flush: () => flushDurableRecord(key) };
}
