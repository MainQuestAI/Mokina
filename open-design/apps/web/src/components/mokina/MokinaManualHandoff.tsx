import { useRef, useState } from 'react';
import { Button, Textarea } from '@open-design/components';
import type { ChatAttachment } from '@open-design/contracts';
import { useT } from '../../i18n';
import styles from './MokinaManualHandoff.module.css';

/** Oversized Home payloads stay at their source until an explicit send accepts them. */
export function MokinaManualHandoff({ prompt, attachments, disabled, onEdit, onSend }: {
  prompt: string; attachments: ChatAttachment[]; disabled: boolean;
  onEdit: (prompt: string) => void; onSend: () => Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  return <details open className={styles.notice} data-testid="mokina-manual-handoff">
    <summary>{t('mokina.pendingSend.restore')}</summary>
    <p role="status">{t('mokina.pendingSend.manualOverflow')}</p>
    <Textarea className={styles.prompt} data-testid="mokina-manual-handoff-prompt"
      aria-label={t('chat.input.viewAll')} value={prompt} disabled={busy}
      onChange={event => onEdit(event.target.value)} />
    <ul className={styles.attachments}>{attachments.map((attachment, index) => <li key={`${attachment.path}:${index}`}>{attachment.name}</li>)}</ul>
    <Button data-testid="mokina-manual-handoff-send" disabled={disabled || busy || (!prompt.trim() && !attachments.length)} onClick={async () => {
      if (sending.current) return;
      sending.current = true; setBusy(true);
      try { await onSend(); } finally { sending.current = false; setBusy(false); }
    }}>{t('chat.send')}</Button>
  </details>;
}
