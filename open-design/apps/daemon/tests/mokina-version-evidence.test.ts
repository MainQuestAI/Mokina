import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ensureProject, projectDir } from '../src/projects.js';
import { createProjectFileVersion, readProjectFileVersion } from '../src/project-file-versions.js';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
const csv = 'record_id,period,amount,currency\na,Jan,100,CNY\na,Jan,100,CNY\nb,Feb,,CNY\nc,Feb,90,USD\nd,Jan,0,CNY';
const html = (sha: string) => `<html><body><section id="budget" data-mokina-id="budget"><table data-mokina-budget data-budget-limit="1000" data-capacity-hours="5"><tr data-budget-item><td data-quantity>2</td><td data-unit-price>300</td><td data-amount>700</td><td data-hours>6</td></tr></table></section><script type="application/json" id="mokina-evidence">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [{ id: 'sales', path: 'sales.csv', sha256: sha, kind: 'data', locator: 'rows 1-6', limitation: 'synthetic', sectionId: 'budget', csv: { id: 'record_id', amount: 'amount', unit: 'currency' } }] })}</script></body></html>`;
describe('version evidence closure', () => {
  it('freezes source bytes, reports dirty data and arithmetic, and never rereads a changed source', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mokina-evidence-'));
    try {
      await ensureProject(root, 'p');
      await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), csv);
      const version = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)), { operationId: 'save-one' });
      await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), 'replaced');
      const saved = await readProjectFileVersion(root, 'p', 'plan.html', version.id);
      expect(saved.quality).toMatchObject({ versionId: version.id, contentDigest: digest(html(digest(csv))), status: 'issues' });
      expect(saved.quality?.sources[0]?.text).toBe(csv);
      expect(saved.quality?.issues.map(i => i.code)).toEqual(expect.arrayContaining(['CSV_DUPLICATE', 'CSV_MISSING', 'CSV_MIXED_UNITS', 'BUDGET_LINE', 'CAPACITY_EXCEEDED']));
      expect(saved.frozenContent).toContain('mokina-quality-snapshot');
      const retry = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)), { operationId: 'save-one' });
      expect(retry.id).toBe(version.id);
      expect((await readProjectFileVersion(root, 'p', 'plan.html', retry.id)).quality).toEqual(saved.quality);
      const restored = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)), { source: 'restore', restoreFromVersionId: version.id });
      expect((await readProjectFileVersion(root, 'p', 'plan.html', restored.id)).quality.sources[0]?.text).toBe(csv);
      const candidate = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)).replace('>700<', '>600<'), { candidate: true, baseVersionId: version.id });
      const reviewed = await readProjectFileVersion(root, 'p', 'plan.html', candidate.id);
      expect(reviewed.quality.sources[0]?.text).toBe(csv);
      expect(reviewed.quality.issues.map(i => i.code)).not.toContain('BUDGET_LINE');
      const next = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)));
      expect((await readProjectFileVersion(root, 'p', 'plan.html', next.id)).quality?.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_UNAVAILABLE' })]));
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

import { freezeVersionEvidence, readVersionEvidence } from '../src/mokina/version-evidence.js';
import { buildProjectRecoveryPackage, importProjectRecoveryPackage } from '../src/mokina/recovery-package.js';

describe('evidence failures and offline recovery', () => {
  it('keeps old HTML unreviewed and rejects declared but missing/tampered evidence', async () => {
    expect(readVersionEvidence('<p>old</p>', undefined, 'v', digest('old')).status).toBe('unreviewed');
    const source = html(digest(csv));
    expect(() => readVersionEvidence(source, undefined, 'v', digest(source))).toThrow('unavailable');
    const frozen = await freezeVersionEvidence(source, 'v', digest(source), async () => Buffer.from(csv));
    expect(() => readVersionEvidence(source, frozen.replace('"status":"issues"', '"status":"rules-clear"'), 'v', digest(source))).toThrow('integrity');
    expect(() => readVersionEvidence(source, frozen.replace('>700<', '>600<'), 'v', digest(source))).toThrow('body integrity');
    expect(() => readVersionEvidence(source, frozen, 'other-version', digest(source))).toThrow('integrity');
  });
  it('rejects traversal before reading and records unavailable sources without claiming empty success', async () => {
    let reads = 0;
    const source = html(digest(csv)).replace('sales.csv', '../secret');
    const frozen = await freezeVersionEvidence(source, 'v', digest(source), async () => { reads++; return Buffer.from(csv); });
    expect(reads).toBe(0);
    expect(readVersionEvidence(source, frozen, 'v', digest(source)).status).toBe('incomplete');
  });
  it('reports zero denominators; compares displayed claims and retains valid grouped CSV totals', async () => {
    const clean = 'record_id,amount,currency\n"a",100,CNY\nb,20,USD';
    const source = html(digest(clean)).replace('</section>', '<div data-mokina-ratio><span data-numerator>100</span><span data-denominator>0</span><span data-ratio-result>0</span></div></section>');
    const frozen = await freezeVersionEvidence(source, 'v', digest(source), async () => Buffer.from(clean));
    const result = readVersionEvidence(source, frozen, 'v', digest(source));
    expect(result.issues.map(i => i.code)).toContain('ZERO_DENOMINATOR');
    expect(result.calculations.map(c => c.result)).toEqual(expect.arrayContaining(['100', '20']));
  });
  it('retains exact evidence and fingerprint after importing into a new project without original sources', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mokina-evidence-recovery-'));
    try {
      await ensureProject(root, 'p');
      await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), csv);
      const source = html(digest(csv)); await writeFile(path.join(projectDir(root, 'p'), 'plan.html'), source);
      const version = await createProjectFileVersion(root, 'p', 'plan.html', source);
      const before = await readProjectFileVersion(root, 'p', 'plan.html', version.id);
      await rm(path.join(projectDir(root, 'p'), 'sales.csv'));
      const archive = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p', projectName: 'P', exportId: 'export' });
      const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: archive.buffer, operationId: 'restore', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
      expect(imported.ok).toBe(true);
      const after = await readProjectFileVersion(root, 'restored', 'plan.html', version.id);
      expect(after.quality).toEqual(before.quality);
      expect(after.frozenContent).toBe(before.frozenContent);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});


it('rechecks the actual model artifacts using their captured source bytes, without current project files', async () => {
  for (const name of ['plan', 'analysis']) {
    const base = new URL('../../../../docs/mokina-m2-2026-10-11/evidence/', import.meta.url);
    const raw = await readFile(new URL(`${name}.html`, base), 'utf8');
    const saved = JSON.parse(await readFile(new URL(`${name}-quality.json`, base), 'utf8'));
    expect(digest(raw)).toBe(saved.contentDigest);
    const frozen = await freezeVersionEvidence(raw, saved.versionId, saved.contentDigest, async path => {
      const source = saved.sources.find((s: { path: string }) => s.path === path);
      if (!source || typeof source.text !== 'string') throw new Error('Missing captured source');
      return Buffer.from(source.text);
    });
    const checked = readVersionEvidence(raw, frozen, saved.versionId, saved.contentDigest);
    expect(checked.sources).toEqual(saved.sources);
    expect(checked.issues).toEqual(saved.issues);
    expect(checked.calculations).toEqual(saved.calculations);
    expect(checked.status).toBe(name === 'plan' ? 'rules-clear' : 'issues');
    if (name === 'plan') expect(checked.calculations.map(c => c.result)).toEqual(expect.arrayContaining(['5200 / 12800 / 18', '5600 / 12400 / 20']));
    else expect(checked.calculations.map(c => c.result)).toEqual(expect.arrayContaining(['3000', '90']));
  }
});


it('preserves decimal CSV amounts when a large amount would swallow a small one in binary floating point', async () => {
  const data = 'record_id,amount,currency\na,1000000000000,CNY\nb,0.00000001,CNY';
  const source = html(digest(data));
  const frozen = await freezeVersionEvidence(source, 'v', digest(source), async () => Buffer.from(data));
  expect(readVersionEvidence(source, frozen, 'v', digest(source)).calculations.map(c => c.result)).toContain('1000000000000.00000001');
});
