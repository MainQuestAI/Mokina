import { randomUUID } from 'node:crypto';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

for (const width of [1440, 900]) test(`[P1] public web evidence preserves its URL draft without sending a private request at ${width}`, async ({ page }, info) => {
  await applyStandardMocks(page);
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 600 });
  const id = `web-evidence-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id, name: '网页研究证据', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
  try {
    expect((await page.request.post(`/api/projects/${id}/files`, { data: { name: 'report.html', content: '<section id="finding" data-mokina-id="finding"><h1>研究结论</h1><p>等待选择公开来源，不编造事实。</p></section>' } })).ok()).toBe(true);
    const open = async () => {
      await page.goto(`/projects/${id}/files/report.html`);
      await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
      await page.locator('.mokina-workspace-tabs').getByRole('button', { name: 'Materials', exact: true }).click();
    };
    await open();
    await info.attach(`m5-materials-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    const panel = page.getByTestId('mokina-web-evidence');
    await expect(panel).toBeVisible();
    let posts = 0;
    page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/mokina/web-evidence')) posts++; });
    await panel.getByRole('textbox', { name: 'Public page URL', exact: true }).fill('http://127.0.0.1/private');
    await panel.getByRole('button', { name: 'Read public page', exact: true }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    expect(posts).toBe(0);
    await page.reload();
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await page.locator('.mokina-workspace-tabs').getByRole('button', { name: 'Materials', exact: true }).click();
    await expect(panel.getByRole('textbox', { name: 'Public page URL', exact: true })).toHaveValue('http://127.0.0.1/private');
    expect(posts).toBe(0);
  } finally { await page.request.delete(`/api/projects/${id}`); }
});
