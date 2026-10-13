import { useEffect, useRef, useState } from 'react';
import { Button } from '@open-design/components';
import { getOpenDesignHost, type OpenDesignHostRecoveryCapacity } from '@open-design/host';
import { useT } from '../../i18n';
import styles from './MokinaRecoveryCapacity.module.css';

/** Native profile maintenance; never sends, recreates or drops a live request. */
export function MokinaRecoveryCapacity() {
  const t = useT();
  const store = getOpenDesignHost()?.recoveryStore;
  const [capacity, setCapacity] = useState<OpenDesignHostRecoveryCapacity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const supported = !!store?.status && !!store?.compact;
  async function read(compact = false) {
    if (!store || pending.current) return;
    const request = ++generation.current;
    pending.current = true;
    setBusy(true); setError(null); setDone(false);
    try {
      const result = compact ? await store.compact!() : await store.status!();
      if (request !== generation.current) return;
      if (!result.ok) throw new Error(result.reason);
      setCapacity(result.result); setConfirm(false); setDone(compact);
    } catch (cause) {
      if (request === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (request === generation.current) { setBusy(false); pending.current = false; }
    }
  }
  useEffect(() => {
    if (supported) void read();
    return () => { generation.current++; pending.current = false; };
  }, [store]); // Host identity changes invalidate pending observations.
  return <div className={styles.root} data-testid="mokina-recovery-capacity">
    <h4>{t('mokina.capacity.title')}</h4>
    <p>{t('mokina.capacity.description')}</p>
    {!supported ? <p>{t('mokina.capacity.unsupported')}</p> : <>
      {capacity && <div role="status">
        <p>{t('mokina.capacity.usage', { active: capacity.active, limit: capacity.limit, reclaimable: capacity.reclaimable, archived: capacity.archived })}</p>
        {capacity.active + capacity.reclaimable >= capacity.limit && <p>{t('mokina.capacity.full')}</p>}
      </div>}
      {error && <p role="alert">{t('mokina.capacity.failed')} ({error})</p>}
      {done && <p role="status">{t('mokina.capacity.done')}</p>}
      {confirm && <p>{t('mokina.capacity.confirm')}</p>}
      <div className={styles.actions}>
        <Button disabled={busy} onClick={() => void read()}>{busy ? t('mokina.recovery.working') : t('mokina.capacity.refresh')}</Button>
        {confirm ? <>
          <Button disabled={busy} onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" disabled={busy} onClick={() => void read(true)}>{t('mokina.capacity.proceed')}</Button>
        </> : <Button disabled={busy || !capacity?.reclaimable || !!error} onClick={() => setConfirm(true)}>{t('mokina.capacity.compact')}</Button>}
      </div>
    </>}
  </div>;
}
