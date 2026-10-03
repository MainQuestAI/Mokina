import { useEffect, useRef } from 'react';

import type { MokinaFormalEntry } from '../artifacts/mokina-project-entry';
import { useT } from '../i18n';
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
  const t = useT();
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstItemRef.current?.focus();
  }, []);

  return (
    <div
      className={styles.overlay}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('mokina.entryChooser.title')}
        className={styles.dialog}
        data-testid="mokina-entry-chooser"
      >
        <p className={styles.title}>{t('mokina.entryChooser.title')}</p>
        <ul className={styles.list}>
          {formals.map((formal, index) => (
            <li key={`${formal.entry}:${formal.versionId}`}>
              <button
                type="button"
                ref={index === 0 ? firstItemRef : undefined}
                className={styles.item}
                onClick={() => onPick(formal)}
              >
                <span className={styles.itemName}>{formal.entry}</span>
                <span className={styles.itemVersion}>v{formal.versionNumber}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.cancel} onClick={onClose}>
          {t('mokina.entryChooser.cancel')}
        </button>
      </div>
    </div>
  );
}
