import { randomUUID } from 'node:crypto';
import { MOKINA_M3_HTML } from '../resources/mokina-m3.js';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';
for (const width of [1440, 900]) test(`[P1] M3 edit, unknown save, combine and fixed-version delivery at ${width}`, async ({ page }, info) => {
  test.setTimeout(T.xlong);
  await applyStandardMocks(page); await page.setViewportSize({ width, height: width === 1440 ? 900 : 600 });
  const id = `m3-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id, name: 'M3 可操作成果', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
  const html = MOKINA_M3_HTML;
  const url = `/api/projects/${id}/files/plan.html`;
  const put = async (content: string) => expect((await page.request.post(`/api/projects/${id}/files`, { data: { name: 'plan.html', content } })).ok()).toBe(true);
  const list = async () => (await (await page.request.get(`${url}/versions?readOnly=true`)).json()).versions;
  try {
    await put(html.replace('面向小企业', '面向自由职业者')); const donor = (await list())[0];
    await put(html); const base = (await list()).find((v: { current: boolean }) => v.current);
    const open = async () => { await page.goto(`/projects/${id}/files/plan.html`); await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long }); await page.getByRole('button', { name: 'Versions', exact: true }).click(); await page.getByTestId('mokina-artifact-operations-open').click(); };
    await open(); const panel = page.getByTestId('mokina-artifact-operations');
    await expect(panel.getByRole('textbox', { name: 'Strategy', exact: true })).toHaveValue('面向小企业，提供线上咨询；不举办线下活动。');
    await info.attach(`m3-before-edit-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await panel.getByRole('textbox', { name: 'budget · budget-0-0-quantity', exact: true }).fill('1.5');
    let posts = 0;
    await page.route(`**${url}/operations`, async route => {
      if (route.request().method() !== 'POST') return route.continue();
      posts++; const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort('failed');
    });
    await panel.getByRole('button', { name: 'Save candidate', exact: true }).click();
    await expect.poll(() => posts).toBe(1);
    await expect(panel.getByRole('button', { name: 'Read save result' })).toBeEnabled();
    await page.reload(); await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long }); await page.getByRole('button', { name: 'Versions', exact: true }).click(); await page.getByTestId('mokina-artifact-operations-open').click();
    await expect(panel.getByRole('button', { name: 'Read save result' })).toBeVisible(); expect(posts).toBe(1);
    await panel.getByRole('button', { name: 'Read save result' }).click();
    await expect(page.getByRole('listbox', { name: 'File versions' }).getByRole('option', { selected: true })).toContainText('Candidate', { timeout: T.long });
    await expect(panel.getByRole('button', { name: 'Read save result' })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    const versions = await list(); const candidate = versions.find((v: { candidate?: boolean }) => v.candidate);
    expect(versions.find((v: { current: boolean }) => v.current).id).toBe(base.id);
    const candidateRead = await (await page.request.get(`${url}/versions/${candidate.id}`)).json();
    expect(candidateRead.content).toContain('data-amount>150.08'); expect(candidateRead.content).toContain('data-mokina-budget-total="0">150.08');
    expect(candidateRead.content).toContain('面向小企业'); expect(posts).toBe(1);
    await info.attach(`m3-candidate-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await page.unroute(`**${url}/operations`);
    await open(); await panel.getByRole('combobox', { name: 'Combine chapters from version' }).selectOption(donor.id);
    await expect(panel).toContainText('面向自由职业者');
    await panel.locator('label').filter({ hasText: /^strategy/ }).getByRole('checkbox').check();
    const savedResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `${url}/operations`);
    await panel.getByRole('button', { name: 'Save candidate', exact: true }).click(); const saved = await savedResponse; expect(saved.ok()).toBe(true);
    const combined = (await saved.json()).version;
    // Continue in the just-created candidate; never reopen the base route.
    await expect(panel.locator('header')).toContainText(`v${combined.version}`);
    await expect(panel.getByRole('textbox', { name: 'Strategy', exact: true })).toHaveValue('面向自由职业者，提供线上咨询；不举办线下活动。');
    await panel.getByRole('textbox', { name: 'Strategy', exact: true }).fill('面向自由职业者，先验证线上咨询渠道；不举办线下活动。');
    const refinedResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === `${url}/operations`);
    await panel.getByRole('button', { name: 'Save candidate', exact: true }).click();
    const refined = (await (await refinedResponse).json()).version;
    expect(refined.baseVersionId).toBe(base.id);
    await expect(panel.locator('header')).toContainText(`v${refined.version}`);
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await page.locator('.artifact-version-panel').getByRole('button', { name: 'Compare', exact: true }).click();
    const comparison = page.getByRole('dialog', { name: 'Candidate comparison', exact: true });
    await expect(comparison).toContainText('先验证线上咨询渠道');
    await info.attach(`m3-comparison-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await expect(comparison).not.toContainText('Changes outside the selected section were detected');
    await expect(comparison).toContainText('byte-identical');
    await comparison.getByRole('button', { name: 'Adopt candidate', exact: true }).click();
    await expect(comparison).toHaveCount(0);
    await expect.poll(async () => (await list()).find((v: { current: boolean }) => v.current)?.id).toBe(refined.id);
    const exported = await page.request.post(`/api/projects/${id}/export/html`, { data: { fileName: 'plan.html', versionId: refined.id, title: 'M3 refined and adopted' } });
    expect(exported.ok()).toBe(true); const text = await exported.text(); expect(text).toContain('先验证线上咨询渠道'); expect(text).toContain('data-amount>100.05');
    await page.goto('/projects'); await expect(page.getByTestId('mokina-projects')).toBeVisible({ timeout: T.long });
    const row = page.getByRole('row').filter({ hasText: 'M3 可操作成果' }); await row.getByText('Project artifacts', { exact: true }).click();
    await expect(row).toContainText(`v${refined.version}`); await info.attach(`m3-catalog-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await row.getByRole('button', { name: new RegExp(`plan.html · v${refined.version} ·`) }).click();
    await expect(page).toHaveURL(new RegExp(`/versions/${refined.id}/files/plan.html`));
  } finally { await page.request.delete(`/api/projects/${id}`); }
});

test('[P1] M3 research to strategy to landing keeps fixed facts and never auto-sends', async ({ page }, info) => {
  test.setTimeout(T.xlong);
  await applyStandardMocks(page); await page.setViewportSize({ width: 1440, height: 900 });
  const ids: string[] = []; const runs: string[] = [];
  page.on('request', req => { if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/runs') runs.push(req.url()); });
  const source = `m3-chain-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id: source, name: 'M3 固定研究', skillId: null, designSystemId: null } })).ok()).toBe(true); ids.push(source);
  const put = async (id: string, content: string) => expect((await page.request.post(`/api/projects/${id}/files`, { data: { name: 'plan.html', content } })).ok()).toBe(true);
  const continueAs = async (id: string, intent: string, sections: string[]) => {
    await page.goto(`/projects/${id}/files/plan.html`); await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); const panel = page.locator('.artifact-version-panel');
    for (const section of sections) await panel.getByRole('checkbox', { name: new RegExp(`^${section}：`) }).check();
    await panel.getByRole('radio', { name: intent, exact: true }).check();
    await panel.getByLabel('Continuation background').fill('保持线上咨询、不承诺折扣、有效预约数口径。');
    await panel.getByRole('button', { name: 'Create continuation project (no send)', exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(id)); await expect(page.getByTestId('chat-composer-input')).toContainText('不承诺折扣', { timeout: T.long });
    const target = new URL(page.url()).pathname.split('/')[2]!; ids.push(target); return target;
  };
  try {
    await put(source, MOKINA_M3_HTML);
    const strategy = await continueAs(source, 'Develop strategy', ['research', 'facts']);
    const read = async (id: string) => (await page.request.get(`/api/projects/${id}/files/MOKINA-CONTINUATION.json`)).json();
    const fixed = await read(strategy); expect(fixed.productionIntent).toBe('strategy');
    expect(fixed.sections.map((s: { id: string }) => s.id)).toEqual(['research', 'facts']);
    await put(source, MOKINA_M3_HTML.replace('不承诺折扣', '上游已修改，不能串入旧下游'));
    expect(await read(strategy)).toEqual(fixed);
    // A maintained HTML fixture witnesses the next handoff, not model quality.
    await put(strategy, MOKINA_M3_HTML);
    const landing = await continueAs(strategy, 'Build a landing page (draft only, nothing generated automatically)', ['strategy', 'facts']);
    const pageSource = await read(landing); expect(pageSource.productionIntent).toBe('landing-page'); expect(pageSource.source.projectId).toBe(strategy);
    expect(JSON.stringify(pageSource)).not.toContain('上游已修改');
    expect(pageSource.sections.map((s: { id: string }) => s.id)).toEqual(['strategy', 'facts']);
    await page.reload(); await expect(page.getByTestId('chat-composer-input')).toContainText('不承诺折扣', { timeout: T.long });
    expect(runs).toEqual([]);
    await info.attach('m3-fixed-chain', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  } finally { for (const id of ids.reverse()) await page.request.delete(`/api/projects/${id}`); }
});

test('[P1] M3 invalid budget binding keeps strategy work available and unsupported behavior has an explicit fallback', async ({ page }) => {
  test.setTimeout(T.xlong); await applyStandardMocks(page); await page.setViewportSize({ width: 900, height: 600 });
  const id = `m3-invalid-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id, name: 'M3 边界提示', skillId: null, designSystemId: null } })).ok()).toBe(true);
  const put = async (content: string) => expect((await page.request.post(`/api/projects/${id}/files`, { data: { name: 'plan.html', content } })).ok()).toBe(true);
  const open = async () => { await page.goto(`/projects/${id}/files/plan.html`); await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long }); await page.getByRole('button', { name: 'Versions', exact: true }).click(); await page.getByTestId('mokina-artifact-operations-open').click(); };
  try {
    await put(MOKINA_M3_HTML.replace('budget-total="0"', 'budget-total="00"')); await open();
    const panel = page.getByTestId('mokina-artifact-operations');
    await expect(panel).toContainText('Invalid budget summary');
    await expect(panel.getByRole('textbox', { name: 'budget · budget-0-0-quantity', exact: true })).toHaveCount(0);
    await panel.getByRole('textbox', { name: 'Strategy', exact: true }).fill('预算待修复，策略草稿可继续。');
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/files/plan.html/operations'));
    await panel.getByRole('button', { name: 'Save candidate', exact: true }).click(); expect((await saved).ok()).toBe(true);
    await expect(panel.getByRole('textbox', { name: 'Strategy', exact: true })).toHaveValue('预算待修复，策略草稿可继续。');
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await put(MOKINA_M3_HTML.replace('<section id="strategy"', '<section onclick="alert(1)" id="strategy"')); await open();
    await expect(panel).toContainText('unsupported behavior'); await expect(panel).toContainText('chapter revision');
    await expect(panel.getByRole('button', { name: 'Save candidate', exact: true })).toBeDisabled();
  } finally { await page.request.delete(`/api/projects/${id}`); }
});
