import { useEffect, useRef } from 'react';
import { Button, Dialog } from '@open-design/components';
import type { MokinaRecoveryIntegrity } from '@open-design/contracts';
import { useT } from '../../i18n';
import styles from './MokinaRecoveryReportDialog.module.css';

export interface MokinaRecoveryReport {
  stage: 'incomplete' | 'downloaded' | 'imported';
  integrity: MokinaRecoveryIntegrity;
  message?: string;
  filename?: string;
}

export function MokinaRecoveryReportDialog({ report, busy, onSalvage, onClose }: {
  report: MokinaRecoveryReport; busy: boolean; onSalvage?: () => void; onClose: () => void;
}) {
  const t = useT();
  const body = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const buttons = [...(body.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
      const first = buttons[0], last = buttons.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !body.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !body.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', trap, true);
    return () => { document.removeEventListener('keydown', trap, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  const title = report.stage === 'incomplete' ? t('mokina.recovery.incompleteTitle')
    : report.stage === 'downloaded' ? t('mokina.recovery.partialDownloaded') : t('mokina.recovery.importedTitle');
  return <Dialog onClose={onClose} closeOnEscape ariaLabel={title}
    className={styles.dialog} data-testid="mokina-recovery-report">
    <div ref={body} className={styles.content}>
      <h2 className={styles.title}>{title}</h2>
      <p>{report.integrity.status === 'unknown' ? t('mokina.recovery.unknown') : t('mokina.recovery.partial')}</p>
      {report.filename ? <p className={styles.filename}>{report.filename}</p> : null}
      {report.message ? <p role="alert">{report.message}</p> : null}
      {report.integrity.issues.length ? <ul className={styles.issues} aria-label={t('mokina.recovery.missing')}>
        {report.integrity.issues.map((issue, index) => <li key={`${issue.path}:${index}`}>
          <strong>{issue.path}</strong><span>{issue.message}</span>
        </li>)}
      </ul> : null}
      <div className={styles.actions}>
        <Button ref={closeButton} variant="secondary" onClick={onClose}>{t('common.close')}</Button>
        {report.stage === 'incomplete' && onSalvage ? <Button variant="primary" disabled={busy} onClick={onSalvage}>
          {busy ? t('mokina.recovery.working') : t('mokina.recovery.salvage')}
        </Button> : null}
      </div>
    </div>
  </Dialog>;
}
