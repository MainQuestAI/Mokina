// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import type { MokinaBusinessReadResult } from '@open-design/contracts';
import { businessBriefHandoff, businessDraftKey, emptyBusinessBody, persistBusinessDraft, readBusinessDraft, type BusinessDraft } from '../../src/runtime/mokina/business-brief';
beforeEach(() => localStorage.clear());
it('restores incomplete input and keeps projects and conversations isolated', async () => {
  const first = businessDraftKey(JSON.stringify(['none', 'p1', 'c1']), 'brief');
  const second = businessDraftKey(JSON.stringify(['none', 'p1', 'c2']), 'brief');
  const third = businessDraftKey(JSON.stringify(['none', 'p2', 'c1']), 'brief');
  const body = emptyBusinessBody('brief');
  if (body.kind !== 'brief') throw new Error('fixture');
  body.value.title = ''; body.value.deliverables = [{ id: 'one', title: '' }];
  const draft: BusinessDraft = { schema: 1, pending: false, request: { operationId: 'save1', expectedRevision: null, body } };
  await persistBusinessDraft(first, draft, null);
  expect(readBusinessDraft(first)).toEqual(draft);
  expect(readBusinessDraft(second)).toBeNull(); expect(readBusinessDraft(third)).toBeNull();
  await expect(persistBusinessDraft(first, draft, null)).rejects.toThrow('另一窗口');
});
it('does not reinterpret corrupt recovery data as a new empty task', () => {
  localStorage.setItem('draft', '{broken');
  expect(() => readBusinessDraft('draft')).toThrow();
  expect(localStorage.getItem('draft')).toBe('{broken');
});
it('hands off only the chosen scope and preserves marketing constraints and missing evidence', () => {
  const body = emptyBusinessBody('brief'); if (body.kind !== 'brief') throw new Error('fixture');
  body.value.deliverables = [{ id: 'plan', title: '营销方案' }, { id: 'page', title: '对外活动页' }];
  body.value.constraints = '禁止线下活动'; body.value.budget = '不超过3万元'; body.value.missing = '人员、报价、产能与周期待确认';
  const saved: MokinaBusinessReadResult = { fileName: 'task-brief.html', revision: 'a'.repeat(64), versionId: 'v1', document: {
    schema: 'mokina.business.v1', operationId: 'save1', requestDigest: 'b'.repeat(64), body, backgroundSnapshot: null,
  } };
  const prompt = businessBriefHandoff(saved, ['plan']);
  expect(prompt).toContain('营销方案'); expect(prompt).not.toContain('对外活动页');
  expect(prompt).toContain('禁止线下活动'); expect(prompt).toContain('不超过3万元'); expect(prompt).toContain('人员、报价、产能与周期待确认');
  expect(prompt).toContain('要求预览不代表确认建议');
  expect(() => businessBriefHandoff(saved, ['missing'])).toThrow();
});
