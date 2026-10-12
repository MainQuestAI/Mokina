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

import type { ProjectFileVersion } from '@open-design/contracts';
const record = (id: string, digest: string, operationId?: string, restoreFromVersionId?: string) => ({ id, contentDigest: digest, operationId, restoreFromVersionId } as ProjectFileVersion);
const receipt = (operationId: string, baseVersionId: string, contentDigest: string) => '\n<!-- mokina-operation ' + btoa(JSON.stringify({ operationId, baseVersionId, contentDigest, edits: [{ id: 'field', value: 'changed' }] })) + ' -->';
it('ignores only receipts bound to the version catalog across consecutive edits and exact restores', () => {
  const d0 = 'a'.repeat(64), d1 = 'b'.repeat(64), d2 = 'c'.repeat(64);
  const r1 = receipt('op1', 'v0', d0), r2 = receipt('op2', 'v1', d1);
  const versions = [record('v0', d0), record('v1', d1, 'op1'), record('v2', d2, 'op2'), record('restored', d2, undefined, 'v2')];
  const input = { sectionId: 'budget', baseHtml: base, candidateHtml: candidate + r1 + r2, baseVersionId: 'v0', candidateVersionId: 'v2', versions };
  expect(compareMokinaChapter(input).restIdentical).toBe(true);
  expect(compareMokinaChapter({ ...input, candidateVersionId: 'restored' }).restIdentical).toBe(true);
  expect(compareMokinaChapter({ ...input, versions: versions.filter(v => v.id !== 'v1') }).restIdentical).toBe(false);
  expect(compareMokinaChapter({ ...input, candidateHtml: candidate + r1 + receipt('forged', 'v1', d1) }).restIdentical).toBe(false);
  expect(compareMokinaChapter({ ...input, candidateHtml: candidate + r1 + receipt('op2', 'v1', d0) }).restIdentical).toBe(false);
  for (const extra of ['<!-- ordinary business comment -->', '<style>body{color:red}</style>', '<script type="application/json" id="mokina-evidence">{}</script>']) {
    expect(compareMokinaChapter({ ...input, candidateHtml: candidate + extra + r1 + r2 }).restIdentical).toBe(false);
  }
  expect(compareMokinaChapter({ ...input, candidateHtml: candidate.replace('月度复盘', '季度复盘') + r1 + r2 }).restIdentical).toBe(false);
});
it('retains malformed, cyclic and mismatched restored receipts', () => {
  const digest = 'd'.repeat(64), r = receipt('op', 'v', digest);
  const input = { sectionId: 'budget', baseHtml: base, candidateHtml: candidate + r, baseVersionId: 'base', candidateVersionId: 'v', versions: [record('v', digest, 'op')] };
  expect(compareMokinaChapter(input).restIdentical).toBe(false);
  expect(compareMokinaChapter({ ...input, candidateHtml: candidate + '\n<!-- mokina-operation e30= -->' }).restIdentical).toBe(false);
  expect(compareMokinaChapter({ ...input, candidateVersionId: 'restore', versions: [...input.versions, record('restore', 'e'.repeat(64), undefined, 'v')] }).restIdentical).toBe(false);
});

it('keeps adopted operation identity when the next candidate continues the receipt chain', () => {
  const d0 = 'a'.repeat(64), d1 = 'b'.repeat(64), d2 = 'c'.repeat(64);
  const r1 = receipt('op1', 'v0', d0), r2 = receipt('op2', 'v1', d1);
  const adopted = { ...record('v1', d1, 'op1'), candidate: false, current: true, adoptionOperationId: 'adopt' };
  const result = compareMokinaChapter({ sectionId: 'budget', baseHtml: base + r1, candidateHtml: candidate + r1 + r2,
    baseVersionId: 'v1', candidateVersionId: 'v2', versions: [record('v0', d0), adopted, record('v2', d2, 'op2')] });
  expect(result.restIdentical).toBe(true);
});
