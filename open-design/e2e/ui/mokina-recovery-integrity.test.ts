import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test.beforeEach(async ({ page }) => { await applyStandardMocks(page); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 600 }]) {
  test(`[P1] Recovery export requires explicit salvage and preserves the partial report on import at ${viewport.width}`, async ({ page, toolsDev }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const projectId = `recovery-integrity-${randomUUID()}`;
    const name = '恢复包完整性：门店活动方案';
    expect((await page.request.post('/api/projects', { data: { id: projectId, name, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
    expect((await page.request.post(`/api/projects/${projectId}/files`, { data: {
      name: 'plan.html', content: '<!doctype html><html><body><section id="plan" data-mokina-id="plan"><h1>门店活动方案</h1><p>原件需要保留。</p></section></body></html>',
      versionSource: 'manual',
    } })).ok()).toBe(true);
    const versions = join(toolsDev.dataDir, 'projects', projectId, '.file-versions');
    const key = createHash('sha256').update('plan.html').digest('hex').slice(0, 24);
    await writeFile(join(versions, key, 'manifest.json'), '{ damaged version history');
    // Multiple real corrupt records also exercise a long warning list in a small window.
    for (let index = 0; index < 10; index++) {
      await mkdir(join(versions, `damaged-${index}`), { recursive: true });
      await writeFile(join(versions, `damaged-${index}`, 'manifest.json'), '{ damaged');
    }
    let target: string | undefined;
    try {
      await page.goto('/projects', { waitUntil: 'domcontentloaded' });
      const rail = page.getByRole('navigation', { name: 'Primary', includeHidden: true });
      if (await rail.getAttribute('aria-hidden') === 'true') await page.getByTestId('entry-rail-collapse').click();
      const row = page.getByTestId('entry-nav-recent-item').filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: T.long });
      await info.attach('rail-before-actions', { body: JSON.stringify(await row.evaluate(el => ({ html: el.parentElement?.outerHTML, rect: el.getBoundingClientRect().toJSON(), parentStyle: getComputedStyle(el.parentElement!).visibility }))), contentType: 'application/json' });
      await row.hover({ timeout: T.medium });
      await row.locator('..').getByTestId('entry-nav-recent-more').click({ timeout: T.long });
      await info.attach('recovery-entry-before', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      const requests: string[] = [];
      page.on('request', request => {
        if (request.method() === 'POST' && request.url().endsWith('/mokina/recovery-export')) requests.push(request.postData() ?? '');
      });
      const failed = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/mokina/recovery-export'));
      await page.getByTestId('entry-nav-recent-export-recovery').click();
      const failure = await failed;
      expect(failure.status()).toBe(409);
      const error = await failure.json();
      const dialog = page.getByTestId('mokina-recovery-report');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText('Complete recovery package was not created');
      await expect(dialog.locator('li')).toHaveCount(error.error.details.issues.length);
      expect(requests).toHaveLength(1);
      expect(JSON.parse(requests[0]!).mode).toBe('complete');
      await info.attach('recovery-complete-failed', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      const box = await dialog.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      const [download, salvageResponse] = await Promise.all([
        page.waitForEvent('download'),
        page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/mokina/recovery-export')),
        dialog.getByRole('button', { name: 'Export recoverable data only', exact: true }).click(),
      ]);
      expect(salvageResponse.ok()).toBe(true);
      expect(requests).toHaveLength(2);
      expect(JSON.parse(requests[1]!).mode).toBe('partial');
      await expect(dialog.getByRole('heading')).toHaveText('Partial rescue package download started');
      const archivePath = info.outputPath('partial-rescue.zip');
      await download.saveAs(archivePath);
      await info.attach('recovery-partial-downloaded', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByTestId('entry-nav-new-project').click({ timeout: T.medium });
      const importedResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/mokina/recovery-import'));
      await page.getByTestId('newproj-recovery-input').setInputFiles(archivePath);
      const imported = await importedResponse;
      expect(imported.ok()).toBe(true);
      const result = await imported.json();
      target = result.projectId;
      expect(result.integrity.status).toBe('partial');
      await expect(dialog.getByRole('heading')).toHaveText('Restored project: review the recovery scope');
      await expect(dialog.locator('li')).toHaveCount(result.integrity.issues.length);
      expect(result.integrity.issues).toEqual(error.error.details.issues);
      await info.attach('recovery-imported-partial', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      await info.attach('recovery-evidence', { body: JSON.stringify({ viewport, namespace: toolsDev.namespace,
        source: projectId, target, requestModes: requests.map(raw => JSON.parse(raw).mode), integrity: result.integrity,
        bytes: (await readFile(archivePath)).length }), contentType: 'application/json' });
      expect(await (await page.request.get(`/api/projects/${target}/files/plan.html`)).text()).toContain('原件需要保留');
    } finally {
      try {
        if (target) expect((await page.request.delete(`/api/projects/${target}`)).ok()).toBe(true);
        expect((await page.request.delete(`/api/projects/${projectId}`)).ok()).toBe(true);
      } catch (cleanupError) {
        await info.attach('cleanup-deferred-to-owned-runtime', { body: String(cleanupError), contentType: 'text/plain' });
      }
    }
  });
}
