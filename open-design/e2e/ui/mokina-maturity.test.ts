import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test.beforeEach(async ({ page }) => { await applyStandardMocks(page); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 600 }]) {
  test(`[P1] Mokina unsent section revision survives reopen and refresh without crossing projects at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const source = await seedRevisionProject(page, 'Mokina maturity source');
    const other = await seedRevisionProject(page, 'Mokina maturity other project');
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && /\/api\/(runs|projects)$/.test(new URL(request.url()).pathname)) writes.push(request.url());
    });
    await openRevision(page, source);
    const panel = page.locator('.artifact-version-panel');
    const request = '保留预算上限，只补充门店活动的渠道分配。';
    await panel.getByLabel('Section to revise').selectOption('budget');
    await panel.getByLabel('Section change request').fill(request);
    await recordDraft(page, info, 'entered-draft');
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole('button', { name: 'Revise section', exact: true }).click();
    await expect(panel.getByLabel('Section change request')).toBeVisible();
    await recordDraft(page, info, 'reopened-draft');
    await expect(panel.getByLabel('Section change request')).toHaveValue(request);
    await expect(panel.getByLabel('Section to revise')).toHaveValue('budget');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Revise section', exact: true }).click();
    await expect(panel.getByLabel('Section change request')).toHaveValue(request);
    await expect(panel.getByLabel('Section to revise')).toHaveValue('budget');

    await openRevision(page, other);
    await expect(panel.getByLabel('Section change request')).toHaveValue('');
    await panel.getByLabel('Section change request').fill('另一个项目的独立要求。');
    await openRevision(page, source);
    await expect(panel.getByLabel('Section change request')).toHaveValue(request);
    await expect(panel.getByLabel('Section to revise')).toHaveValue('budget');
    expect(writes, 'saving an unsent revision never creates a project or a run').toEqual([]);
    await recordDraft(page, info, 'restored-draft');
    for (const projectId of [source, other]) expect((await page.request.delete(`/api/projects/${projectId}`)).ok()).toBe(true);
  });
}

async function openRevision(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/files/plan.html`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
  await page.getByRole('button', { name: 'Revise section', exact: true }).click();
  await expect(page.locator('.artifact-version-panel').getByLabel('Section change request')).toBeVisible();
}

async function seedRevisionProject(page: Page, name: string) {
  const projectId = `maturity-${randomUUID()}`;
  const created = await page.request.post('/api/projects', { data: {
    id: projectId, name, skillId: null, designSystemId: null, metadata: { kind: 'prototype' },
  } });
  expect(created.ok(), await created.text()).toBe(true);
  const written = await page.request.post(`/api/projects/${projectId}/files`, { data: {
    name: 'plan.html', versionSource: 'manual', versionLabel: 'Current plan',
    content: '<!doctype html><html><body><h1>门店活动计划</h1><section id="strategy" data-mokina-id="strategy"><h2>渠道策略</h2><p>先验证门店需求，再扩大覆盖。</p></section><section id="budget" data-mokina-id="budget"><h2>预算</h2><p>保留预算上限，核对每个渠道的投入。</p></section></body></html>',
  } });
  expect(written.ok(), await written.text()).toBe(true);
  return projectId;
}

async function recordDraft(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await info.attach(`${name}-geometry`, { body: JSON.stringify(await page.evaluate(() => {
    const panel = document.querySelector('.artifact-version-panel')!;
    const box = panel.getBoundingClientRect();
    return { viewport: { width: innerWidth, height: innerHeight }, panel: { x: box.x, y: box.y, width: box.width, height: box.height }, horizontalOverflow: panel.scrollWidth - panel.clientWidth };
  })), contentType: 'application/json' });
}
