import { useMemo, useState } from 'react';

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
        aria-label="候选比较"
      >
        <div className={styles.head}>
          <div>
            <strong>候选比较</strong>
            <p>
              基础版本 v{baseVersion.version}（{baseVersion.current ? '当前稿' : '历史稿'}）
              {' → '}候选 v{candidateVersion.version}；采用前当前稿不会变化。
            </p>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaItem}>
            <em>用户要求</em>
            {candidateVersion.prompt?.trim() || '（未记录修改要求）'}
          </div>
          <div className={styles.metaItem}>
            <em>变化章节</em>
            {changedSections.length === 0
              ? '未检测到章节变化（请人工核对）'
              : changedSections.length === 1
                ? changedSections[0]
                : `${changedSections.length} 个章节发生变化：${changedSections.join('、')}`}
          </div>
          <div className={styles.metaItem}>
            <em>其余章节</em>
            {comparison.restIdentical
              ? `字节完全一致（${comparison.baseRestLength} 字符）`
              : `检测到所选章节之外的变化（${comparison.baseRestLength} → ${comparison.candidateRestLength} 字符），采用前请核对`}
          </div>
        </div>

        <div className={styles.wideToggle} role="tablist" aria-label="切换原文与候选">
          <label>
            <input
              type="radio"
              name="mokina-compare-pane"
              checked={narrowPane === 'base'}
              onChange={() => setNarrowPane('base')}
            />
            <span>原文</span>
          </label>
          <label>
            <input
              type="radio"
              name="mokina-compare-pane"
              checked={narrowPane === 'candidate'}
              onChange={() => setNarrowPane('candidate')}
            />
            <span>候选</span>
          </label>
        </div>

        <div className={styles.wide}>
          <div className={`${styles.pane} ${styles.narrowPane} ${narrowPane === 'base' ? styles.narrowPaneActive : ''}`}>
            <h4>基础版本 · {primarySection || '（未识别章节）'}</h4>
            <pre>{comparison.baseHtml ?? '（基础版本中未找到该章节）'}</pre>
          </div>
          <div className={`${styles.pane} ${styles.narrowPane} ${narrowPane === 'candidate' ? styles.narrowPaneActive : ''}`}>
            <h4>候选 · {primarySection || '（未识别章节）'}</h4>
            <pre>{comparison.candidateHtml ?? '（候选中未找到该章节）'}</pre>
          </div>
        </div>

        <div className={styles.findings}>
          <strong>数值变化提示（需人工核对口径）</strong>
          <ul>
            {comparison.numbersOnlyInBase.length > 0
              ? <li>原文出现、候选未出现：{comparison.numbersOnlyInBase.join('、')}</li>
              : null}
            {comparison.numbersOnlyInCandidate.length > 0
              ? <li>候选出现、原文未出现：{comparison.numbersOnlyInCandidate.join('、')}</li>
              : null}
            {comparison.numbersOnlyInBase.length === 0 && comparison.numbersOnlyInCandidate.length === 0
              ? <li>所选章节内未检测到数值字面量的增减。</li>
              : null}
            <li>
              章节内数值总数：原文 {baseNumbers.length} 项 → 候选 {candidateNumbers.length} 项；
              提示只指出字面量差异，不是数值正确性的结论。
            </li>
          </ul>
        </div>

        <div className={styles.foot}>
          <button type="button" disabled={adopting} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            disabled={adopting || baseVersion.current === false}
            title={baseVersion.current === false ? '当前稿已变化：请先重新比较或重新生成候选' : undefined}
            onClick={onAdopt}
          >
            {adopting ? '正在采用…' : '采用候选'}
          </button>
        </div>
      </div>
    </div>
  );
}
