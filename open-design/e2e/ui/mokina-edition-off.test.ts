import { randomUUID } from 'node:crypto';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { ensureRailOpen } from '@/playwright/rail';
import { T } from '@/timeouts';

test('Mokina off production keeps populated recent projects without Mokina summary subscriptions', async ({ page }, testInfo) => {
  test.skip(process.env.NEXT_PUBLIC_MOKINA_EDITION !== 'off', 'Requires a separate off build and daemon configuration');
  await applyStandardMocks(page);
  const id = `off-recent-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id, name: 'Existing off project' } })).ok()).toBe(true);
  expect((await page.request.post(`/api/projects/${id}/files`, { data: { name: 'plan.html', content: '<html><h1>Plan</h1></html>' } })).ok()).toBe(true);
  const summaryReads: string[] = [];
  page.on('request', request => { if (request.url().includes('/versions?readOnly=true')) summaryReads.push(request.url()); });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await ensureRailOpen(page);
    await expect(page.getByTestId('entry-nav-recent-item').filter({ hasText: 'Existing off project' })).toBeVisible({ timeout: T.long });
    await expect(page.getByTestId('entry-nav-recent-artifact')).toHaveCount(0);
    expect(summaryReads).toEqual([]);
    await testInfo.attach(`off-populated-${viewport.width}`, { body: await page.screenshot(), contentType: 'image/png' });
  }
});
