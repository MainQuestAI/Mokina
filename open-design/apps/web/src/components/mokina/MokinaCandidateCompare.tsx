import { useMemo, useState } from 'react';

import { useT } from '../../i18n';

import type { ProjectFileVersion } from '@open-design/contracts';

import {
  compareMokinaChapter,
  detectChangedSections,
  extractNumericTokens,
} from '../../runtime/mokina/candidate-compare';
import styles from './MokinaCandidateCompare.module.css';

/**
 * 候选比较（T12）：基础版本与候选并排（窄屏切换）；非所选章节以字节一致性判定，
 * 数值变化单独提示供人工核对口径；采用与取消入口始终可见。
 */
export function MokinaCandidateCompare({ baseVersion, candidateVersion, baseHtml, candidateHtml, adopting, onClose, onAdopt }: {
  baseVersion: ProjectFileVersion;
  candidateVersion: ProjectFileVersion;
  baseHtml: string;
  candidateHtml: string;
  adopting: boolean;
  onClose: () => void;
  onAdopt: () => void;
}) {
  const t = useT();
  const changedSections = useMemo(
    () => detectChangedSections(baseHtml, candidateHtml),
    [baseHtml, candidateHtml],
  );
  const primarySection = changedSections[0] ?? '';
  const comparison = useMemo(
    () => compareMokinaChapter({ sectionId: primarySection, baseHtml, candidateHtml }),
    [primarySection, baseHtml, candidateHtml],
  );
  const [narrowPane, setNarrowPane] = useState<'base' | 'candidate'>('candidate');

  const baseNumbers = useMemo(() => extractNumericTokens(comparison.baseHtml ?? ''), [comparison.baseHtml]);
  const candidateNumbers = useMemo(() => extractNumericTokens(comparison.candidateHtml ?? ''), [comparison.candidateHtml]);

  return (
    <div className={styles.backdrop} role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('mokina.compare.dialogLabel')}
      >
        <div className={styles.head}>
          <div>
            <strong>{t('mokina.compare.dialogLabel')}</strong>
            <p>
              {t('mokina.compare.subtitle', {
                base: baseVersion.version,
                baseState: baseVersion.current ? t('mokina.compare.currentDraft') : t('mokina.compare.historicalDraft'),
                candidate: candidateVersion.version,
              })}
            </p>
          </div>
          <button type="button" onClick={onClose}>{t('mokina.compare.close')}</button>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <em>{t('mokina.compare.requirement')}</em>
            {candidateVersion.prompt?.trim() || t('mokina.compare.noRequirement')}
          </div>
          <div className={styles.metaItem}>
            <em>{t('mokina.compare.changedSections')}</em>
            {changedSections.length === 0
              ? t('mokina.compare.noSectionChange')
              : changedSections.length === 1
                ? changedSections[0]
                : t('mokina.compare.multiSectionChange', { count: changedSections.length, names: changedSections.join('、') })}
          </div>
          <div className={styles.metaItem}>
            <em>{t('mokina.compare.restSection')}</em>
            {comparison.restIdentical
              ? t('mokina.compare.restIdentical', { chars: comparison.baseRestLength })
              : t('mokina.compare.restChanged', { before: comparison.baseRestLength, after: comparison.candidateRestLength })}
          </div>
        </div>

        <div className={styles.wideToggle} role="tablist" aria-label={t('mokina.compare.togglePanes')}>
          <label>
            <input
              type="radio"
              name="mokina-compare-pane"
              checked={narrowPane === 'base'}
              onChange={() => setNarrowPane('base')}
            />
            <span>{t('mokina.compare.basePane')}</span>
          </label>
          <label>
            <input
              type="radio"
              name="mokina-compare-pane"
              checked={narrowPane === 'candidate'}
              onChange={() => setNarrowPane('candidate')}
            />
            <span>{t('mokina.compare.candidatePane')}</span>
          </label>
        </div>

        <div className={styles.wide}>
          <div className={`${styles.pane} ${styles.narrowPane} ${narrowPane === 'base' ? styles.narrowPaneActive : ''}`}>
            <h4>{t('mokina.compare.basePane')} · {primarySection || t('mokina.compare.sectionUnknown')}</h4>
            <pre>{comparison.baseHtml ?? t('mokina.compare.baseSectionMissing')}</pre>
          </div>
          <div className={`${styles.pane} ${styles.narrowPane} ${narrowPane === 'candidate' ? styles.narrowPaneActive : ''}`}>
            <h4>{t('mokina.compare.candidatePane')} · {primarySection || t('mokina.compare.sectionUnknown')}</h4>
            <pre>{comparison.candidateHtml ?? t('mokina.compare.candidateSectionMissing')}</pre>
          </div>
        </div>

        <div className={styles.findings}>
          <strong>{t('mokina.compare.numbersTitle')}</strong>
          <ul>
            {comparison.numbersOnlyInBase.length > 0
              ? <li>{t('mokina.compare.numberOnlyBase', { values: comparison.numbersOnlyInBase.join('、') })}</li>
              : null}
            {comparison.numbersOnlyInCandidate.length > 0
              ? <li>{t('mokina.compare.numberOnlyCandidate', { values: comparison.numbersOnlyInCandidate.join('、') })}</li>
              : null}
            {comparison.numbersOnlyInBase.length === 0 && comparison.numbersOnlyInCandidate.length === 0
              ? <li>{t('mokina.compare.noNumberChange')}</li>
              : null}
            <li>
              {t('mokina.compare.numberCount', { base: baseNumbers.length, candidate: candidateNumbers.length })}
            </li>
          </ul>
        </div>

        <div className={styles.foot}>
          <button type="button" disabled={adopting} onClick={onClose}>
            {t('mokina.compare.cancel')}
          </button>
          <button
            type="button"
            disabled={adopting || baseVersion.current === false}
            title={baseVersion.current === false ? t('mokina.compare.adoptConflict') : undefined}
            onClick={onAdopt}
          >
            {adopting ? t('mokina.compare.adopting') : t('mokina.compare.adopt')}
          </button>
        </div>
      </div>
    </div>
  );
}
