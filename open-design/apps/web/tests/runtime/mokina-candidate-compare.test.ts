// @vitest-environment jsdom
//
// T12：候选比较——章节识别、非所选区域的字节一致性判定、数值差异提示。

import { describe, expect, it } from 'vitest';

import {
  blankOutSection,
  compareMokinaChapter,
  detectChangedSections,
  extractSectionHtml,
} from '../../src/runtime/mokina/candidate-compare';

const base = [
  '<html><body>',
  '<section id="objectives" data-mokina-id="objectives"><h2>目标</h2><p>新增 30 家门店</p></section>',
  '<section id="budget" data-mokina-id="budget"><p>预算 50 万</p></section>',
  '<section id="measurement" data-mokina-id="measurement"><p>月度复盘</p></section>',
  '</body></html>',
].join('');

const candidate = base.replace(
  '<section id="budget" data-mokina-id="budget"><p>预算 50 万</p></section>',
  '<section id="budget" data-mokina-id="budget"><p>预算 30 万，重点投放在门店</p></section>',
);

describe('candidate compare helpers', () => {
  it('detects exactly the changed section', () => {
    expect(detectChangedSections(base, candidate)).toEqual(['budget']);
    expect(extractSectionHtml(candidate, 'budget')).toContain('30 万');
    expect(extractSectionHtml(base, 'budget')).toContain('50 万');
  });

  it('treats everything outside the section as byte-identical only when it is', () => {
    const same = compareMokinaChapter({ sectionId: 'budget', baseHtml: base, candidateHtml: candidate });
    expect(same.restIdentical).toBe(true);

    const tampered = candidate.replace('<p>月度复盘</p>', '<p>季度复盘</p>');
    const different = compareMokinaChapter({ sectionId: 'budget', baseHtml: base, candidateHtml: tampered });
    expect(different.restIdentical).toBe(false);
    expect(detectChangedSections(base, tampered)).toEqual(['budget', 'measurement']);
  });

  it('surfaces numeric literals that only one side carries', () => {
    const result = compareMokinaChapter({ sectionId: 'budget', baseHtml: base, candidateHtml: candidate });
    expect(result.numbersOnlyInBase).toContain('50');
    expect(result.numbersOnlyInCandidate).toContain('30');
  });

  it('blanks only the selected section for the rest-of-document comparison', () => {
    const blanked = blankOutSection(base, 'budget');
    expect(blanked).toContain('<!--mokina-compare:budget-->');
    expect(blanked).toContain('data-mokina-id="objectives"');
    expect(blanked).not.toContain('50 万');
  });
});
