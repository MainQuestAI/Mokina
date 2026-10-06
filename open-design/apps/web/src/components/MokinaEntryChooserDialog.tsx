import { useEffect, useRef } from 'react';

import { Dialog } from '@open-design/components';
import type { MokinaFormalEntry } from '../artifacts/mokina-project-entry';
import { useI18n } from '../i18n';
import styles from './MokinaEntryChooserDialog.module.css';

/**
 * 项目内紧凑成果选择器（Spec B1 §5.2「多个正式 → 项目内紧凑选择器」）。
 *
 * 只在打开回退发现 >1 个正式成果时出现；不另造路由、不造卡网格。初始焦点
 * 在第一项，Esc/取消返回项目真实状态（不掉焦到 body）。时间缺失不虚构——
 * 只显示可核对的版本号。
 */
export function MokinaEntryChooserDialog({
  formals,
  onPick,
  onClose,
}: {
  formals: readonly MokinaFormalEntry[];
  onPick: (formal: MokinaFormalEntry) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const closingRef = useRef(false);
  const close = () => { closingRef.current = true; onClose(); };

  useEffect(() => {
    panelRef.current = firstItemRef.current?.closest<HTMLDivElement>('[role=dialog]') ?? null;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstItemRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key !== 'Tab') return;
      const controls = [...panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
      const first = controls[0]; const last = controls.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      document.removeEventListener('keydown', handleKey, true);
      // An unrelated route unmount must not redirect focus in the new project.
      if (!closingRef.current) return;
      if (previous?.isConnected && previous !== document.body) previous.focus();
      else {
        const fallback = document.querySelector<HTMLElement>('[data-testid="file-workspace"]');
        if (fallback) { fallback.tabIndex = -1; fallback.focus(); }
      }
    };
    // This dialog instance owns the captured focus and close handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog onClose={close} closeOnEscape includeChromeClassName={false}
      backdropClassName={styles.overlay} className={styles.dialog}
      ariaLabel={t('mokina.entryChooser.title')} data-testid="mokina-entry-chooser">
        <p className={styles.title}>{t('mokina.entryChooser.title')}</p>
        <ul className={styles.list}>
          {formals.map((formal, index) => (
            <li key={`${formal.entry}:${formal.versionId}`}>
              <button
                type="button"
                ref={index === 0 ? firstItemRef : undefined}
                className={styles.item}
                onClick={() => { closingRef.current = true; onPick(formal); }}
              >
                <span className={styles.itemName}>{formal.entry}</span>
                <span className={styles.itemVersion}>
                  {t('mokina.entryChooser.formal')} · v{formal.versionNumber}
                  {formal.createdAt !== null && Number.isFinite(formal.createdAt) ? <span className={styles.itemTime}>{t('mokina.entryChooser.versionTime')}：{new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(formal.createdAt)}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.cancel} onClick={close}>
          {t('mokina.entryChooser.cancel')}
        </button>
    </Dialog>
  );
}
