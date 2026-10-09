import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test.beforeEach(async ({ page }) => { await applyStandardMocks(page); });
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 900, height: 600 }, { width: 390, height: 844 }]) {
  test(`[P1] P01-P08 restoration and task draft isolation at ${viewport.width}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await seed(page);
    await page.goto('/');
    await expect(page.getByTestId('home-hero-input')).toBeVisible({ timeout: T.long });
    await expect(page.getByTestId('home-hero-submit')).toBeVisible();
    await shot(page, info, 'P01');
    await page.goto('/projects');
    await expect(page.getByTestId('mokina-projects')).toBeVisible({ timeout: T.long });
    await expect(page.getByRole('button', { name: 'Mokina restoration source', exact: true }).last()).toBeVisible();
    await shot(page, info, 'P02');
    await page.goto(`/projects/${fixture.projectId}/files/plan.html`);
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    const composer = page.getByTestId('chat-composer-input');
    await expect(composer).toBeVisible();
    await composer.fill('Keep this unsent collaboration draft.');
    if (viewport.width <= 760) await page.getByRole('button', { name: 'Collapse the conversation pane', exact: true }).click();
    await expect(page.frameLocator('[data-testid="artifact-preview-frame"]').getByText('Current source')).toBeVisible({ timeout: T.long });
    await shot(page, info, 'P03');
    const writes: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && /\/api\/(runs|projects)$/.test(new URL(request.url()).pathname)) writes.push(request.url());
    });
    await page.locator('.mokina-workspace-tabs').getByRole('button', { name: 'Materials', exact: true }).click();
    const materials = page.locator('.mokina-context-panel--expanded');
    await expect(materials).toBeVisible();
    await materials.getByRole('checkbox', { name: /research.md/ }).check();
    await materials.getByRole('button', { name: 'Preview readable range', exact: true }).click();
    await expect(materials.getByText('Selected market evidence.', { exact: true })).toBeVisible();
    await materials.locator('.mokina-material-picker__preview').getByRole('checkbox').first().check();
    await shot(page, info, 'P04');
    await materials.getByRole('button', { name: /Freeze as task snapshot/ }).click();
    await expect(materials.locator('.mokina-context-panel__frozen')).toBeVisible();
    await page.locator('.mokina-workspace-tabs').getByRole('button', { name: 'Read', exact: true }).click();
    await page.getByRole('button', { name: 'Revise section', exact: true }).click();
    const panel = page.locator('.artifact-version-panel');
    await expect(panel.getByLabel('Section to revise')).toBeVisible();
    await panel.getByLabel('Section to revise').selectOption('strategy');
    await panel.getByLabel('Section change request').fill('Preserve the budget and refine the channel strategy.');
    await shot(page, info, 'P05');
    await panel.getByRole('button', { name: 'Versions', exact: true }).click();
    await expect(panel.getByRole('listbox')).toBeVisible();
    await expect(panel.getByLabel('Section change request')).toBeHidden();
    await shot(page, info, 'P06');
    await panel.getByRole('button', { name: 'Continue', exact: true }).click();
    await panel.getByRole('checkbox', { name: /strategy：/ }).check();
    await panel.getByLabel('Continuation background').fill('Keep this unsent continuation.');
    await shot(page, info, 'P07');
    await panel.getByRole('button', { name: 'Revise section', exact: true }).click();
    await expect(panel.getByLabel('Section change request')).toHaveValue('Preserve the budget and refine the channel strategy.');
    await panel.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(panel.getByLabel('Continuation background')).toHaveValue('Keep this unsent continuation.');
    await expect(panel.getByRole('checkbox', { name: /strategy：/ })).toBeChecked();
    expect(writes).toEqual([]);
    await panel.getByRole('button', { name: 'Close', exact: true }).click();
    if (viewport.width <= 760) await page.getByRole('button', { name: 'Show chat', exact: true }).click();
    await expect(composer).toContainText('Keep this unsent collaboration draft.');
    await page.goto(`/projects/${fixture.targetId}/files/event.html`);
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    if (viewport.width <= 760 && await page.getByRole('button', { name: 'Collapse the conversation pane', exact: true }).isVisible()) await page.getByRole('button', { name: 'Collapse the conversation pane', exact: true }).click();
    await expect(page.frameLocator('[data-testid="artifact-preview-frame"]').getByText('Local launch event')).toBeVisible({ timeout: T.long });
    await shot(page, info, 'P08');
    const sourceLink = page.locator('.mokina-workspace-tabs .mokina-source-link');
    await expect(sourceLink).toContainText(fixture.versionId);
    await sourceLink.click();
    await expect(page).toHaveURL(new RegExp(`/versions/${fixture.versionId}/files/plan.html`));
    await expect(page.locator('.artifact-version-panel')).toBeVisible({ timeout: T.long });
    await expect(page.locator('.artifact-version-panel').getByText('Selected: v1 · History')).toBeVisible();
    expect(writes).toEqual([]);
    for (const id of [fixture.projectId, fixture.targetId]) expect((await page.request.delete(`/api/projects/${id}`)).ok()).toBe(true);
  });
}
async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await info.attach(`${name}-geometry`, { body: JSON.stringify(await page.evaluate(() => ({ viewport: { width: innerWidth, height: innerHeight }, content: Array.from(document.querySelectorAll('[data-testid="file-workspace"], .mokina-projects, .home-hero, .artifact-version-panel')).filter(node => node.getBoundingClientRect().width > 0).map(node => ({ surface: node.className, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })) }))), contentType: 'application/json' });
  const width = page.viewportSize()!.width;
  const panel = page.locator('.artifact-version-panel');
  if (await panel.isVisible()) {
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    const overflow = await panel.evaluate(node => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
}
async function seed(page: Page) {
  const projectId = `restore-source-${randomUUID()}`; const targetId = `restore-target-${randomUUID()}`;
  for (const [id, name] of [[projectId, 'Mokina restoration source'], [targetId, 'Mokina restoration event']]) {
    const r = await page.request.post('/api/projects', { data: { id, name, skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } });
    expect(r.ok(), await r.text()).toBe(true);
  }
  let versionId = '';
  for (const label of ['Historical source', 'Current source']) {
    const response = await page.request.post(`/api/projects/${projectId}/files`, { data: { name: 'plan.html', content: `<!doctype html><html><body><h1>${label}</h1><section id="strategy" data-mokina-id="strategy"><h2>Channel strategy</h2><p>Validate in-store demand before expanding.</p></section><section id="budget" data-mokina-id="budget"><h2>Budget</h2><p>Keep the agreed budget ceiling.</p></section></body></html>`, versionSource: 'manual', versionLabel: label } });
    expect(response.ok(), await response.text()).toBe(true); const body = await response.json(); if (!versionId) versionId = body.version.id;
  }
  for (const [id, name, content] of [[projectId, 'research.md', '# Research\n\nSelected market evidence.\n\nBudget assumptions.'], [targetId, 'event.html', '<!doctype html><html><body><h1>Local launch event</h1><section id="event" data-mokina-id="event"><p>Use the approved channel strategy.</p></section></body></html>'], [targetId, 'MOKINA-CONTINUATION.json', JSON.stringify({ schemaVersion: 2, operationId: randomUUID(), targetProjectId: targetId, source: { projectId, fileName: 'plan.html', versionId }, sections: [{ id: 'strategy', text: 'Validate in-store demand before expanding.' }], productionIntent: 'landing-page' })]]) {
    const response = await page.request.post(`/api/projects/${id}/files`, { data: { name, content, versionSource: 'manual' } });
    expect(response.ok(), await response.text()).toBe(true);
  }
  return { projectId, targetId, versionId };
}
