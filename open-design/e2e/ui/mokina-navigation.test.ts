import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

// dev 模式冷编译 + 五次导航：默认 45s 不够。
test.slow();

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`[P1] Mokina open-resolution and recent summaries at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);

    // 一正式：无 tabs、无深链时按唯一正式成果直接打开准确 entry。
    const single = await seedProject(page, 'Mokina 导航-单成果', [
      { name: '预算分配与渠道优先级.html', label: '正式稿', html: '<!doctype html><html><body><h1>预算</h1><section id="budget" data-mokina-id="budget"><h2>预算</h2></section></body></html>' },
    ]);
    await page.goto(`/projects/${single.projectId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await expect(page.getByRole('tab', { name: '预算分配与渠道优先级.html' })).toBeVisible();
    await testInfo.attach(`p03-open-single-formal-${viewport.width}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });

    // 多正式：项目内紧凑选择器；选取后打开准确成果。
    const multi = await seedProject(page, 'Mokina 导航-多成果', [
      { name: '方案.html', label: '正式稿', html: '<!doctype html><html><body><h1>方案</h1></body></html>' },
      { name: '排期.html', label: '正式稿', html: '<!doctype html><html><body><h1>排期</h1></body></html>' },
    ]);
    await page.goto(`/projects/${multi.projectId}`, { waitUntil: 'domcontentloaded' });
    const chooser = page.getByTestId('mokina-entry-chooser');
    await expect(chooser).toBeVisible({ timeout: T.long });
    // 初始焦点在首个可选成果（Spec B1 §8）。
    await expect(chooser.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(chooser.getByRole('button').last()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(chooser.getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(chooser).toHaveCount(0);
    await expect(page.locator(':focus')).not.toHaveJSProperty('tagName', 'BODY');
    // Reopen without tabs to verify the keyboard selection path too.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(chooser).toBeVisible({ timeout: T.long });
    // A new current version arrives after the chooser captured v1. Selection
    // must retain the exact known version through the native history panel.
    expect((await page.request.post(`/api/projects/${multi.projectId}/files`, { data: {
      name: '排期.html', content: '<!doctype html><html><body><h1>新版排期</h1></body></html>',
      versionSource: 'manual', versionLabel: '选择后更新',
    } })).ok()).toBe(true);
    await chooser.getByRole('button', { name: /排期\.html/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await expect(chooser).toHaveCount(0);
    const pinnedPanel = page.locator('.artifact-version-panel');
    await expect(pinnedPanel).toBeVisible({ timeout: T.long });
    await expect(pinnedPanel.getByRole('listbox').getByRole('option', { selected: true })).toContainText('v1');
    await expect(pinnedPanel.getByText('Selected: v1 · History')).toBeVisible();

    // 深链失效：不静默打开别的成果。
    await page.goto(`/projects/${multi.projectId}/files/ghost.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await expect(page.getByTestId('mokina-entry-chooser')).toHaveCount(0);

    // P01/P02 生产截图（Spec B1 §8：两尺寸）。
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('home-hero-input')).toBeVisible({ timeout: T.long });
    // recent 行摘要的读取/五态/失效复核由 EntryNavRail.recent-section 单测
    // 完整覆盖（20 项）；此处保留 P01 生产截图作为视觉证据。
    await testInfo.attach(`p01-home-${viewport.width}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    const projectList = page.getByTestId('entry-view-projects');
    await expect(projectList).toHaveAttribute('data-active', 'true');
    await expect(projectList.getByRole('heading', { level: 1 })).toBeVisible({ timeout: T.long });
    await testInfo.attach(`p02-projects-${viewport.width}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
  });
}

test('[P1] Mokina workspace indicator settles without overshoot and respects reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-hero-input')).toBeVisible({ timeout: T.long });
  const indicator = page.locator('.workspace-tabs-glide');
  await expect(indicator).toBeAttached();

  // Sample the real, served indicator's CSS transitions on the browser's
  // animation clock. No sleep or synthetic copy of the easing function:
  // project tabs can be hidden by the dock, but their paint contract is shared.
  const samples = await indicator.evaluate((element) => {
    const start = Number.parseFloat(getComputedStyle(element).width);
    element.style.width = `${start + 80}px`;
    void getComputedStyle(element).width;
    const animation = element.getAnimations().find((entry) =>
      entry instanceof CSSTransition && entry.transitionProperty === 'width');
    if (!animation?.effect) throw new Error('Workspace width transition did not start');
    animation.pause();
    const duration = Number(animation.effect.getTiming().duration);
    const progress = [0, 0.25, 0.5, 0.6, 0.75, 1].map((fraction) => {
      animation.currentTime = duration * fraction;
      return (Number.parseFloat(getComputedStyle(element).width) - start) / 80;
    });
    animation.finish();
    return { duration, progress };
  });
  expect(samples.duration).toBe(300);
  let previous = -0.001;
  for (const progress of samples.progress) {
    expect(progress).toBeGreaterThanOrEqual(previous);
    expect(progress).toBeLessThanOrEqual(1.001);
    previous = progress;
  }
  expect(samples.progress.at(-1)).toBeCloseTo(1, 3);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await indicator.evaluate((element) => {
    const target = Number.parseFloat(getComputedStyle(element).width) + 40;
    element.style.width = `${target}px`;
    const width = Number.parseFloat(getComputedStyle(element).width);
    return { target, width, animations: element.getAnimations().length };
  });
  expect(reduced.width).toBeCloseTo(reduced.target, 3);
  expect(reduced.animations).toBe(0);
  await testInfo.attach('workspace-motion-browser-samples', {
    body: JSON.stringify({ samples, reduced }, null, 2), contentType: 'application/json',
  });
});

async function seedProject(
  page: Page,
  name: string,
  entries: Array<{ name: string; label: string; html: string }>,
) {
  const projectId = `mokina-nav-${randomUUID()}`;
  const created = await page.request.post('/api/projects', {
    data: { id: projectId, name, skillId: null, designSystemId: null, metadata: { kind: 'prototype' } },
  });
  expect(created.ok(), `create fixture: ${await created.text()}`).toBe(true);
  for (const entry of entries) {
    const response = await page.request.post(`/api/projects/${projectId}/files`, {
      data: {
        name: entry.name, content: entry.html, versionSource: 'manual', versionLabel: entry.label,
        artifactManifest: { version: 1, kind: 'html', title: entry.name, entry: entry.name, renderer: 'html', exports: ['html'] },
      },
    });
    expect(response.ok(), `seed ${entry.name}: ${await response.text()}`).toBe(true);
  }
  return { projectId };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`[P1] Mokina brand, action and title styles at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('home-hero-input')).toBeVisible({ timeout: T.long });
    await expect(page.locator('html')).toHaveAttribute('data-product', 'mokina');
    await expect(page.getByRole('img', { name: 'Mokina', exact: true })).toBeVisible();
    const title = page.locator('.home-hero__title');
    const style = await title.evaluate(node => ({ font: parseFloat(getComputedStyle(node).fontSize), line: parseFloat(getComputedStyle(node).lineHeight) }));
    const bodyFont = await page.locator('body').evaluate(node => getComputedStyle(node).fontFamily);
    expect(bodyFont).toContain('BlinkMacSystemFont');
    await expect(title).toHaveCSS('font-family', bodyFont);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 245, 245)');
    expect(style.font).toBeCloseTo(viewport.width <= 760 ? 40 : Math.min(68, Math.max(42, viewport.width * 0.0435)), 1);
    expect(style.line / style.font).toBeCloseTo(1.3, 1);
    await page.getByTestId('home-hero-input').fill('验证主操作');
    const submit = page.getByTestId('home-hero-submit');
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveCSS('background-color', 'rgb(0, 113, 227)');
    const box = await submit.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    // Exercise the real control's cascade and color transition without sending.
    await submit.hover();
    await expect.poll(() => controlBackgroundPixels(submit)).toEqual([0, 104, 209]);
    await page.mouse.down();
    await expect.poll(() => controlBackgroundPixels(submit)).toEqual([0, 97, 195]);
    // Release outside the button so this style check cannot create a project.
    await page.mouse.move(0, 0); await page.mouse.up();
    await testInfo.attach(`brand-home-${viewport.width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  });
}

test('[P1] Mokina empty project focuses its existing composer without writing or sending', async ({ page }, testInfo) => {
  const project = await seedProject(page, '初始空项目', []);
  await page.goto(`/projects/${project.projectId}`, { waitUntil: 'domcontentloaded' });
  const composer = page.getByTestId('chat-composer-input');
  await expect(composer).toBeVisible({ timeout: T.long });
  await composer.fill('保留这份草稿');
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/(?:runs|projects)$/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
  await expect(page.getByTestId('mokina-artifact-initial')).toBeVisible({ timeout: T.long });
  await page.getByRole('button', { name: 'Write your requirements', exact: true }).click();
  await expect(composer).toBeFocused(); await expect(composer).toContainText('保留这份草稿'); expect(writes).toEqual([]);
  await testInfo.attach('empty-project', { body: await page.screenshot(), contentType: 'image/png' });
});

async function controlBackgroundPixels(control: Locator) {
  return control.evaluate(node => {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const context = canvas.getContext('2d')!;
    context.fillStyle = getComputedStyle(node).backgroundColor; context.fillRect(0, 0, 1, 1);
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  });
}

test('[P1] Mokina keeps a legacy Cloud choice unavailable until an explicit model change', async ({ page }) => {
  await page.addInitScript(() => {
    const config = JSON.parse(localStorage.getItem('open-design:config') || '{}');
    localStorage.setItem('open-design:config', JSON.stringify({ ...config, agentId: 'amr', mode: 'daemon' }));
  });
  await page.route('**/api/app-config**', async route => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({ json: { config: { onboardingCompleted: true, agentId: 'amr', mode: 'daemon', privacyDecisionAt: 1 } } });
  });
  await page.route('**/api/integrations/vela/status*', route => route.fulfill({ json: { loggedIn: false, sessionState: 'signed_out' } }));
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/(?:runs|projects|integrations\/vela\/login)$/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.mokina-model-unavailable')).toContainText('unavailable in Mokina', { timeout: T.long });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('open-design:config')!).agentId)).toBe('amr');
  await page.getByTestId('home-hero-input').fill('保留未发送内容');
  await page.getByTestId('home-hero-submit').click();
  const settings = page.getByRole('region', { name: /^Settings/ });
  await expect(settings).toBeVisible({ timeout: T.long });
  await expect(page.locator('.settings-cloud-signin-callout')).toHaveCount(0);
  await expect(page.getByTestId('entry-nav-community')).toHaveCount(0);
  await expect(settings.locator('.amr-auth-anchor')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('open-design:config')!).agentId)).toBe('amr');
  expect(writes).toEqual([]);
});
