import { describe, expect, it } from 'vitest';
import { inspectOperationSupport, inspectOperationFields, applyOperationEdits, combineOperationSections, combineOperationEvidence } from '../src/mokina/operations.js';
const html = '<!doctype html><title>keep</title><section id="strategy" data-mokina-id="strategy"><p data-mokina-field="value" data-mokina-kind="strategy">原方向</p></section><section id="budget" data-mokina-id="budget"><table data-mokina-budget data-budget-limit="200" data-capacity-hours="1"><tr data-budget-item><td data-quantity>1</td><td data-unit-price>100.05</td><td data-amount>100.05</td><td data-hours>0.1</td></tr></table><p data-mokina-budget-total="0">100.05</p></section><footer>字节保留 &amp; spaces</footer>';
describe('controlled artifact operations', () => {
  it('edits escaped plain text without altering other bytes', () => {
    expect(applyOperationEdits(html, [{ id: 'value', value: '<script>&中文' }])).toBe(html.replace('原方向', '&lt;script&gt;&amp;中文'));
  });
  it('recalculates the affected budget with exact cents and its visible total', () => {
    const field = inspectOperationFields(html).find(f => f.kind === 'quantity')!;
    const result = applyOperationEdits(html, [{ id: field.id, value: '1.5' }]);
    expect(result).toContain('data-amount>150.08');
    expect(result).toContain('data-mokina-budget-total="0">150.08');
    expect(result).toContain('<footer>字节保留 &amp; spaces</footer>');
    expect(() => applyOperationEdits(html, [{ id: field.id, value: '3' }])).toThrow(/budget/i);
  });
  it('rejects ambiguous, nested, unknown and over-precision fields', () => {
    expect(inspectOperationFields(html.replace('原方向', '<b>富文本</b>')).some(f => f.id === 'value')).toBe(false);
    expect(inspectOperationFields(html.replace('原方向', '原方向</p><p data-mokina-field="value" data-mokina-kind="strategy">重复')).some(f => f.id === 'value')).toBe(false);
    expect(() => applyOperationEdits(html, [{ id: 'unknown', value: 'x' }])).toThrow();
    const f = inspectOperationFields(html).find(f => f.kind === 'hours')!;
    expect(() => applyOperationEdits(html, [{ id: f.id, value: '0.123456789' }])).toThrow();
  });
  it('combines only selected chapters while keeping the base direction', () => {
    const other = html.replace('原方向', '另一方向').replace('字节保留', '不能带入');
    const result = combineOperationSections(html, other, ['strategy']);
    expect(result).toBe(html.replace('原方向', '另一方向'));
    expect(() => combineOperationSections(html, other, ['absent'])).toThrow();
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createProjectFileVersion, readProjectFileVersion, listProjectFileVersions } from '../src/project-file-versions.js';
import { ensureProject, projectDir } from '../src/projects.js';
import { saveArtifactOperation, readArtifactOperations } from '../src/mokina/artifact-operations.js';
import { sha256Hex } from '../src/mokina/context-store.js';
import { buildProjectRecoveryPackage, importProjectRecoveryPackage } from '../src/mokina/recovery-package.js';

it('saves one candidate under concurrent retry, preserves donor evidence after deletion, and rejects changed intent', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-operations-'));
  try {
    await ensureProject(root, 'p'); await ensureProject(root, 'other');
    const source = '冻结的研究依据';
    await writeFile(path.join(projectDir(root, 'p'), 'source.txt'), source);
    const evidence = `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'research', path: 'source.txt', sha256: sha256Hex(source), kind: 'full-text', excerpt: source, locator: 'all', limitation: 'fixture', sectionId: 'claim' }] })}</script>`;
    const donorHtml = html.replace('原方向</p>', '有证据的方向</p></div>').replace('<p data-mokina-field="value"', '<div id="claim" data-mokina-id="claim"><p data-mokina-field="value"') + evidence;
    const donor = await createProjectFileVersion(root, 'p', 'plan.html', donorHtml);
    const base = await createProjectFileVersion(root, 'p', 'plan.html', html);
    await rm(path.join(projectDir(root, 'p'), 'source.txt'));
    const scope = { projectsRoot: root, projectId: 'p', fileName: 'plan.html' };
    const request = { operationId: 'combine-one', baseVersionId: base.id, contentDigest: sha256Hex(html), edits: [],
      combine: { versionId: donor.id, contentDigest: sha256Hex(donorHtml), sections: ['strategy'] } };
    const [a, b] = await Promise.all([saveArtifactOperation(scope, request), saveArtifactOperation(scope, request)]);
    expect(a.id).toBe(b.id); expect(a.candidate).toBe(true);
    const saved = await readProjectFileVersion(root, 'p', 'plan.html', a.id);
    expect(saved.quality.sources[0]?.text).toBe(source);
    expect(saved.quality.sources[0]?.sectionId).toBe('claim');
    expect(saved.content).toContain('有证据的方向');
    const refined = await saveArtifactOperation(scope, { operationId: 'refine-candidate', baseVersionId: a.id, contentDigest: sha256Hex(saved.content), edits: [{ id: 'value', value: '精修方向' }] });
    expect(refined.baseVersionId).toBe(base.id);
    expect((await readProjectFileVersion(root, 'p', 'plan.html', refined.id)).quality.sources[0]?.text).toBe(source);
    expect((await listProjectFileVersions(root, 'p', 'plan.html')).find(v => v.current)?.id).toBe(base.id);
    await expect(saveArtifactOperation(scope, { ...request, combine: undefined, edits: [{ id: 'value', value: '不同' }] })).rejects.toMatchObject({ code: 'VERSION_OPERATION_CONFLICT' });
    await expect(saveArtifactOperation({ ...scope, projectId: 'other' }, request)).rejects.toThrow();
    const restored = await createProjectFileVersion(root, 'p', 'plan.html', saved.content, { restoreFromVersionId: a.id, source: 'restore' });
    expect((await readProjectFileVersion(root, 'p', 'plan.html', restored.id)).quality.sources[0]?.text).toBe(source);
    const archive = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p', projectName: 'P', exportId: 'export' });
    const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: archive.buffer, operationId: 'restore', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
    expect(imported.ok).toBe(true);
    expect((await readProjectFileVersion(root, 'restored', 'plan.html', a.id)).quality.sources[0]?.text).toBe(source);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('reports unsupported resources before editing and ignores a forged receipt while retaining supported legacy fields', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-operations-inspect-'));
  try {
    await ensureProject(root, 'p');
    const scope = { projectsRoot: root, projectId: 'p', fileName: 'plan.html' };
    const resource = await createProjectFileVersion(root, 'p', 'plan.html', html + '<img src="https://example.com/x.png">');
    const blocked = await readArtifactOperations(scope, resource.id);
    expect(blocked.editable).toBe(false); expect(blocked.fields).toEqual([]);
    const legacyHtml = html.replace('<td data-hours>0.1</td>', '') + '<!-- mokina-operation e30= -->';
    const legacy = await createProjectFileVersion(root, 'p', 'plan.html', legacyHtml);
    const inspected = await readArtifactOperations(scope, legacy.id);
    expect(inspected.editable).toBe(true); expect(inspected.fields.some(f => f.id === 'value')).toBe(true);
    expect(inspected.fieldWarnings.length).toBeGreaterThan(0); expect(inspected.operation).toBeUndefined();
    const saved = await saveArtifactOperation(scope, { operationId: 'legacy-edit', baseVersionId: legacy.id, contentDigest: sha256Hex(legacyHtml), edits: [{ id: 'value', value: '可编辑部分' }] });
    expect((await readProjectFileVersion(root, 'p', 'plan.html', saved.id)).content).toContain('可编辑部分');
    await expect(saveArtifactOperation(scope, { operationId: 'legacy-budget', baseVersionId: legacy.id, contentDigest: sha256Hex(legacyHtml), edits: [{ id: 'budget-0-0-quantity', value: '2' }] })).rejects.toMatchObject({ code: 'MOKINA_OPERATION_INPUT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('cannot use a text marker to bypass budget arithmetic or edit a computed total', () => {
  const tagged = html.replace('<td data-quantity>', '<td data-quantity data-mokina-field="bypass" data-mokina-kind="strategy">').replace('<p data-mokina-budget-total="0">', '<p data-mokina-budget-total="0" data-mokina-field="fake-total" data-mokina-kind="strategy">');
  expect(() => applyOperationEdits(tagged, [{ id: 'bypass', value: '999' }])).toThrow();
  expect(() => applyOperationEdits(tagged, [{ id: 'fake-total', value: '0' }])).toThrow();
  expect(applyOperationEdits(tagged, [{ id: 'budget-0-0-quantity', value: '1.5' }])).toContain('data-amount>150.08');
});

it('returns a finished precommit failure to editing only after checking authoritative operation absence', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-operations-failure-'));
  try {
    await ensureProject(root, 'p');
    const large = html + '<!--' + 'x'.repeat(2 * 1024 * 1024 - Buffer.byteLength(html) - 8) + '-->';
    const base = await createProjectFileVersion(root, 'p', 'plan.html', large);
    await expect(saveArtifactOperation({ projectsRoot: root, projectId: 'p', fileName: 'plan.html' }, {
      operationId: 'over-entry-limit', baseVersionId: base.id, contentDigest: sha256Hex(large), edits: [{ id: 'value', value: '新增文字超过原始入口边界' }],
    })).rejects.toMatchObject({ code: 'MOKINA_OPERATION_NOT_SAVED' });
    expect(await listProjectFileVersions(root, 'p', 'plan.html')).toHaveLength(1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('recalculates summaries outside a combined budget chapter and supports valid local anchors', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-operations-combine-budget-'));
  try {
    await ensureProject(root, 'p');
    const summary = '<p data-mokina-budget-total="0">100.05</p>';
    const baseHtml = html.replace(summary, '') + summary;
    const donorHtml = baseHtml.replace('data-quantity>1<', 'data-quantity>1.5<').replace('原方向</p>', '新方向</p><a href="#budget">查看预算</a>');
    const base = await createProjectFileVersion(root, 'p', 'plan.html', baseHtml);
    const donor = await createProjectFileVersion(root, 'p', 'plan.html', donorHtml);
    const scope = { projectsRoot: root, projectId: 'p', fileName: 'plan.html' };
    const save = (sections: string[], operationId: string) => saveArtifactOperation(scope, { operationId, baseVersionId: base.id, contentDigest: sha256Hex(baseHtml), edits: [], combine: { versionId: donor.id, contentDigest: sha256Hex(donorHtml), sections } });
    const budget = await save(['budget'], 'combine-budget');
    const result = await readProjectFileVersion(root, 'p', 'plan.html', budget.id);
    expect(result.content).toContain('data-mokina-budget-total="0">150.08');
    expect(result.content).toContain('data-amount>150.08');
    const anchor = await save(['strategy'], 'combine-anchor');
    expect((await readProjectFileVersion(root, 'p', 'plan.html', anchor.id)).content).toContain('href="#budget"');
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('rejects donor budget layouts that would retarget global summary ordinals', () => {
  const extra = '<section id="extra" data-mokina-id="extra"><table data-mokina-budget></table></section>';
  expect(() => combineOperationSections(html, extra + html, ['budget'])).toThrow(/layout/);
});
it('keeps base declarations that surviving chapters may still reference', () => {
  const declaration = (id: string) => `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id, sectionId: 'strategy' }] })}</script>`;
  const combined = combineOperationEvidence(html.replace('字节保留', '[base-source] 字节保留') + declaration('base-source'), html + declaration('donor-source'), ['strategy']);
  expect(combined).toContain('base-source'); expect(combined).toContain('donor-source');
});

import { freezeVersionEvidence, readVersionEvidence } from '../src/mokina/version-evidence.js';
for (const ordinal of ['1', '-1', 'typo', '00', '9007199254740992']) it(`rejects orphaned/noncanonical summary ${ordinal} without blocking strategy edits`, async () => {
  const bad = html.replace('budget-total="0"', `budget-total="${ordinal}"`);
  expect(() => combineOperationSections(html, bad, ['budget'])).toThrow(/summary/i);
  expect(inspectOperationSupport(bad).warnings.join(' ')).toMatch(/summary/i);
  expect(() => applyOperationEdits(bad, [{ id: 'budget-0-0-quantity', value: '1.5' }])).toThrow(/summary/i);
  expect(applyOperationEdits(bad, [{ id: 'value', value: '策略仍可改' }])).toContain('策略仍可改');
  const declaration = `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 's', path: 's.txt', sha256: sha256Hex('source'), kind: 'full-text', excerpt: 'source', locator: 'all', limitation: '', sectionId: 'strategy' }] })}</script>`;
  const content = bad + declaration, digest = sha256Hex(content);
  const frozen = await freezeVersionEvidence(content, 'v', digest, async () => Buffer.from('source'));
  expect(readVersionEvidence(content, frozen, 'v', digest).issues.some(i => i.code === 'BUDGET_SUMMARY')).toBe(true);
});
it('updates all valid summaries and supports tables without summaries', () => {
  const all = html + '<span data-mokina-budget-remaining="0">99.95</span><span data-mokina-budget-hours="0">0.1</span>';
  const edited = applyOperationEdits(all, [{ id: 'budget-0-0-quantity', value: '1.5' }]);
  expect(edited).toContain('budget-remaining="0">49.92'); expect(edited).toContain('budget-hours="0">0.1');
  expect(applyOperationEdits(html.replace('<p data-mokina-budget-total="0">100.05</p>', ''), [{ id: 'budget-0-0-quantity', value: '1.5' }])).toContain('data-amount>150.08');
});
it('excludes unselected donor sources but includes internal anchors', () => {
  const donor = '<section id="strategy" data-mokina-id="strategy"><div id="claim" data-mokina-id="claim">x</div></section><section id="other" data-mokina-id="other">y</section>' + `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'nested', sectionId: 'claim' }, { id: 'unused', sectionId: 'other' }] })}</script>`;
  const combined = combineOperationEvidence(html, donor, ['strategy']);
  expect(combined).toContain('nested'); expect(combined).not.toContain('unused');
});

it('preserves valid retained navigation and rejects newly missing or duplicate targets', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-navigation-'));
  try {
    await ensureProject(root, 'p');
    const baseHtml = '<nav><a href="#offer-detail">查看细则</a><a href="#old-broken">旧坏链</a></nav>' + html.replace('原方向</p>', '原方向</p><h3 id="offer-detail">细则</h3>');
    const base = await createProjectFileVersion(root, 'p', 'plan.html', baseHtml);
    const scope = { projectsRoot: root, projectId: 'p', fileName: 'plan.html' };
    for (const [label, chapter, succeeds] of [
      ['missing', '<h3 id="new-detail">新细则</h3>', false],
      ['duplicate', '<h3 id="offer-detail">新细则</h3><p id="offer-detail">重复</p>', false],
      ['kept', '<h3 id="offer-detail">新细则</h3><a href="#budget">预算</a>', true],
    ] as const) {
      const donorHtml = html.replace('原方向</p>', `新方向</p>${chapter}`);
      const donor = await createProjectFileVersion(root, 'p', 'plan.html', donorHtml);
      const before = (await listProjectFileVersions(root, 'p', 'plan.html')).length;
      const request = { operationId: label, baseVersionId: base.id, contentDigest: sha256Hex(baseHtml), edits: [], combine: { versionId: donor.id, contentDigest: sha256Hex(donorHtml), sections: ['strategy'] } };
      if (succeeds) expect((await saveArtifactOperation(scope, request)).candidate).toBe(true);
      else { await expect(saveArtifactOperation(scope, request)).rejects.toThrow(/offer-detail/); expect(await listProjectFileVersions(root, 'p', 'plan.html')).toHaveLength(before); }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
for (const markup of [
  '<section id="strategy" data-mokina-id="strategy" onclick="alert(1)">x</section>',
  '<section id="strategy" data-mokina-id="strategy"><p onclick="alert(1)">x</p></section>',
  '<section id="strategy" data-mokina-id="strategy"><form action="https://example.com">x</form></section>',
  '<section id="strategy" data-mokina-id="strategy"><button formaction="https://example.com">x</button></section>',
  '<a id="strategy" data-mokina-id="strategy" href="javascript:alert(1)">x</a>',
  '<section id="strategy" data-mokina-id="strategy"><noscript><img src="https://example.com/x.png"></noscript></section>',
  '<section id="strategy" data-mokina-id="strategy"><iframe srcdoc="x"></iframe></section>',
]) it(`rejects behavior on roots and descendants: ${markup.slice(0, 80)}`, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-behavior-'));
  try {
    await ensureProject(root, 'p'); const scope = { projectsRoot: root, projectId: 'p', fileName: 'plan.html' };
    const base = await createProjectFileVersion(root, 'p', 'plan.html', html);
    const donorHtml = html.replace(/<section id="strategy"[\s\S]*?<\/section>/, markup);
    const donor = await createProjectFileVersion(root, 'p', 'plan.html', donorHtml);
    expect((await readArtifactOperations(scope, donor.id)).editable).toBe(false);
    await expect(saveArtifactOperation(scope, { operationId: 'unsafe', baseVersionId: base.id, contentDigest: sha256Hex(html), edits: [], combine: { versionId: donor.id, contentDigest: sha256Hex(donorHtml), sections: ['strategy'] } })).rejects.toMatchObject({ code: 'MOKINA_OPERATION_INPUT' });
    expect(await listProjectFileVersions(root, 'p', 'plan.html')).toHaveLength(2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('rejects unsafe or overlapping summary targets before exposing budget controls', () => {
  for (const summary of ['<span data-mokina-budget-total="0"><b>100.05</b></span>', '<input data-mokina-budget-total="0">', '<span data-mokina-budget-total="0" data-mokina-budget-hours="0">100.05</span>']) {
    const content = html.replace('<p data-mokina-budget-total="0">100.05</p>', summary);
    expect(inspectOperationSupport(content).warnings.join(' ')).toMatch(/summary/);
    expect(() => applyOperationEdits(content, [{ id: 'budget-0-0-quantity', value: '1.5' }])).toThrow(/summary/);
  }
});

it('returns an explicit unsupported result for an ambiguous saved chapter', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-invalid-chapter-'));
  try {
    await ensureProject(root, 'p');
    const content = html + '<section id="strategy" data-mokina-id="strategy">duplicate</section>';
    const version = await createProjectFileVersion(root, 'p', 'plan.html', content);
    const result = await readArtifactOperations({ projectsRoot: root, projectId: 'p', fileName: 'plan.html' }, version.id);
    expect(result.editable).toBe(false); expect(result.sections).toEqual([]); expect(result.unsupportedReason).toMatch(/duplicate/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
it('reports stale values in valid total, remaining and eight-decimal hours summaries', async () => {
  const declaration = `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 's', path: 's.txt', sha256: sha256Hex('source'), kind: 'full-text', excerpt: 'source', locator: 'all', limitation: '', sectionId: 'strategy' }] })}</script>`;
  for (const [kind, expected] of [['total', '100.05'], ['remaining', '99.95'], ['hours', '0.12345678']] as const) {
    const content = html.replace('data-hours>0.1', 'data-hours>0.12345678').replace('<p data-mokina-budget-total="0">100.05</p>', `<p data-mokina-budget-${kind}="0">999</p>`) + declaration;
    const digest = sha256Hex(content), frozen = await freezeVersionEvidence(content, 'v', digest, async () => Buffer.from('source'));
    const quality = readVersionEvidence(content, frozen, 'v', digest);
    expect(quality.status).toBe('issues'); expect(quality.issues.find(issue => issue.code === 'BUDGET_SUMMARY')?.message).toContain(expected);
  }
});
it('explicitly rejects conflicting source identities instead of dropping historical evidence', () => {
  const declaration = (sha256: string) => `<script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'shared', sectionId: 'strategy', sha256 }] })}</script>`;
  expect(() => combineOperationEvidence(html + declaration('a'.repeat(64)), html + declaration('b'.repeat(64)), ['strategy'])).toThrow(/conflict/);
});
