import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import * as storage from 'node:fs/promises';
import { ensureProject, projectDir } from '../src/projects.js';
import { createProjectFileVersion, readProjectFileVersion, getProjectFileVersionRootStats, listProjectFileVersions } from '../src/project-file-versions.js';
const storageFailure = vi.hoisted(() => ({ frozen: false, frozenOutput: null as string | null }));
vi.mock('../src/mokina/version-evidence.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/mokina/version-evidence.js')>();
  return { ...actual, freezeVersionEvidence: (...args: Parameters<typeof actual.freezeVersionEvidence>) =>
    storageFailure.frozenOutput === null ? actual.freezeVersionEvidence(...args) : Promise.resolve(storageFailure.frozenOutput) };
});
vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
    if (storageFailure.frozen && String(args[0]).endsWith('-frozen.html')) throw new Error('simulated disk full');
    return actual.writeFile(...args);
  } };
});
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


it('rejects a damaged original even when corruption removes the evidence declaration', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-evidence-original-'));
  try {
    await ensureProject(root, 'p'); await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), csv);
    const source = html(digest(csv));
    const version = await createProjectFileVersion(root, 'p', 'plan.html', source);
    const store = await getProjectFileVersionRootStats(root, 'p', 'plan.html');
    const manifest = JSON.parse(await readFile(path.join(store.root, 'manifest.json'), 'utf8'));
    await writeFile(path.join(store.root, manifest.entries[0].contentPath), '<p>damaged original without declaration</p>');
    await expect(readProjectFileVersion(root, 'p', 'plan.html', version.id)).rejects.toMatchObject({ code: 'VERSION_CONTENT_MISMATCH' });
    await expect(createProjectFileVersion(root, 'p', 'plan.html', source, { candidate: true, baseVersionId: version.id })).rejects.toMatchObject({ code: 'VERSION_CONTENT_MISMATCH' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

describe('PR18 review regressions', () => {
  for (const resource of ['https://example.invalid/photo.png', 'missing.png']) it(`keeps evidence and repair available with ${resource}`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mokina-review-'));
    try {
      await ensureProject(root, 'p');
      await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), csv);
      const source = html(digest(csv)).replace('</body>', `<img src="${resource}"></body>`);
      const version = await createProjectFileVersion(root, 'p', 'plan.html', source);
      const saved = await readProjectFileVersion(root, 'p', 'plan.html', version.id);
      expect(saved.content).toBe(source);
      expect(saved.quality.sources[0]?.text).toBe(csv);
      await rm(path.join(projectDir(root, 'p'), 'sales.csv'));
      const candidate = await createProjectFileVersion(root, 'p', 'plan.html', html(digest(csv)), { candidate: true, baseVersionId: version.id });
      expect((await readProjectFileVersion(root, 'p', 'plan.html', candidate.id)).quality.sources[0]?.text).toBe(csv);
      const restored = await createProjectFileVersion(root, 'p', 'plan.html', source, { restoreFromVersionId: version.id });
      expect((await readProjectFileVersion(root, 'p', 'plan.html', restored.id)).quality.sources[0]?.text).toBe(csv);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('inherits malformed but verified CSV bytes after source deletion, including recovery round trip', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mokina-review-'));
    try {
      await ensureProject(root, 'p');
      const malformed = 'record_id,amount,currency\na,"800,CNY';
      const source = html(digest(malformed));
      await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), malformed);
      await writeFile(path.join(projectDir(root, 'p'), 'plan.html'), source);
      const version = await createProjectFileVersion(root, 'p', 'plan.html', source);
      await rm(path.join(projectDir(root, 'p'), 'sales.csv'));
      for (const options of [{ restoreFromVersionId: version.id }, { candidate: true, baseVersionId: version.id }]) {
        const next = await createProjectFileVersion(root, 'p', 'plan.html', source, options);
        const saved = await readProjectFileVersion(root, 'p', 'plan.html', next.id);
        expect(saved.quality.sources[0]).toMatchObject({ text: malformed, sha256: digest(malformed), error: 'Unclosed CSV quote' });
      }
      const archive = await buildProjectRecoveryPackage({ projectsRoot: root, projectId: 'p', projectName: 'P', exportId: 'export' });
      const imported = await importProjectRecoveryPackage({ projectsRoot: root, archive: archive.buffer, operationId: 'restore', targetProjectId: 'restored', readProject: () => null, registerProject: () => undefined });
      expect(imported.ok).toBe(true);
      expect((await readProjectFileVersion(root, 'restored', 'plan.html', version.id)).quality.sources[0]?.text).toBe(malformed);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  const row = (q: string, p: string, a: string, h: string) => `<tr data-budget-item><td data-quantity>${q}</td><td data-unit-price>${p}</td><td data-amount>${a}</td><td data-hours>${h}</td></tr>`;
  async function inspect(body: string, sourceText = 'quote', csvMapping = false) {
    const source = { id: 's', path: 's.txt', sha256: digest(sourceText), kind: 'data', locator: 'all', limitation: 'synthetic', sectionId: 'budget', ...(csvMapping ? { csv: { id: 'id', amount: 'amount', unit: 'unit' } } : {}) };
    const raw = `<html><body><section id="budget" data-mokina-id="budget">${body}</section><script id="mokina-evidence" type="application/json">${JSON.stringify({ schema: 'mokina.evidence.v1', sources: [source] })}</script></body></html>`;
    return readVersionEvidence(raw, await freezeVersionEvidence(raw, 'v', digest(raw), async () => Buffer.from(sourceText)), 'v', digest(raw));
  }
  it('rounds decimal products at the line, catches wrong cents and compares exact capacity', async () => {
    const budget = (rows: string, limit: string, capacity: string) => `<table data-mokina-budget data-budget-limit="${limit}" data-capacity-hours="${capacity}">${rows}</table>`;
    expect((await inspect(budget(row('1.5', '100.05', '150.08', '0'), '150.08', '1'))).issues).toEqual([]);
    expect((await inspect(budget(row('1.5', '100.05', '150.07', '0'), '150.07', '1'))).issues.map(i => i.code)).toEqual(expect.arrayContaining(['BUDGET_LINE', 'BUDGET_EXCEEDED']));
    expect((await inspect(budget(row('1', '1', '1', '0.1') + row('1', '1', '1', '0.2'), '2', '0.3'))).issues).toEqual([]);
    expect((await inspect(budget(row('1', '1', '1.001', '0'), '2', '1'))).issues.map(i => i.code)).toContain('BUDGET_INPUT');
    expect((await inspect(budget(row('1.000000001', '1', '1', '0'), '2', '1'))).issues.map(i => i.code)).toContain('BUDGET_INPUT');
    expect((await inspect('', 'id,amount,unit\na,1000000000000.00000001,CNY', true)).issues.map(i => i.code)).toContain('CSV_MISSING');
  });
  it('counts completed ratios and rejects header-only CSV as no calculation', async () => {
    expect((await inspect('<div data-mokina-ratio><span data-numerator>1</span><span data-denominator>2</span><span data-ratio-result>0.5</span></div>')).issues).toEqual([]);
    const empty = await inspect('', 'id,amount,unit\n', true);
    expect(empty.status).toBe('issues');
    expect(empty.issues.map(i => i.code)).toEqual(expect.arrayContaining(['CSV_EMPTY', 'NO_CALCULATION']));
  });
});

it('distinguishes never captured evidence from a deleted declared snapshot and fails saves on disk errors', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-review-'));
  try {
    await ensureProject(root, 'p'); await writeFile(path.join(projectDir(root, 'p'), 'sales.csv'), csv);
    const raw = html(digest(csv));
    const version = await createProjectFileVersion(root, 'p', 'plan.html', raw);
    const directory = path.join(projectDir(root, 'p'), '.file-versions', digest('plan.html').slice(0, 24));
    const manifestPath = path.join(directory, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const entry = manifest.entries[0]; const frozenPath = entry.frozenContentPath;
    await rm(path.join(directory, frozenPath));
    await expect(readProjectFileVersion(root, 'p', 'plan.html', version.id)).rejects.toThrow();
    delete entry.frozenContentPath; await writeFile(manifestPath, JSON.stringify(manifest));
    const legacy = await readProjectFileVersion(root, 'p', 'plan.html', version.id);
    expect(legacy.content).toBe(raw);
    expect(legacy.quality).toMatchObject({ status: 'incomplete', sources: [], issues: [{ code: 'EVIDENCE_NOT_CAPTURED' }] });
    const before = await listProjectFileVersions(root, 'p', 'plan.html');
    storageFailure.frozen = true;
    try { await expect(createProjectFileVersion(root, 'p', 'plan.html', raw)).rejects.toThrow('simulated disk full'); }
    finally { storageFailure.frozen = false; }
    expect(await listProjectFileVersions(root, 'p', 'plan.html')).toEqual(before);
    expect((await storage.readdir(directory)).sort()).toEqual([entry.contentPath, 'manifest.json'].sort());
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Exercise the post-serialization persistence boundary without parsing a 100 MiB
// synthetic DOM. Real freeze/route behavior is covered by the large-source cases.
it('limits original and final serialized UTF-8 bytes separately before committing a version', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-size-boundary-'));
  try {
    await ensureProject(root, 'p');
    await expect(createProjectFileVersion(root, 'p', 'plan.html', 'a'.repeat(2 * 1024 * 1024 + 1)))
      .rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    storageFailure.frozenOutput = 'é'.repeat(50 * 1024 * 1024); // exactly 100 MiB, not 50 MiB
    const saved = await createProjectFileVersion(root, 'p', 'plan.html', '<html><body>boundary</body></html>');
    const before = await listProjectFileVersions(root, 'p', 'plan.html');
    expect(before.some(version => version.id === saved.id)).toBe(true);
    storageFailure.frozenOutput += 'x';
    await expect(createProjectFileVersion(root, 'p', 'plan.html', '<html><body>over</body></html>'))
      .rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(await listProjectFileVersions(root, 'p', 'plan.html')).toEqual(before);
  } finally { storageFailure.frozenOutput = null; await rm(root, { recursive: true, force: true }); }
});
