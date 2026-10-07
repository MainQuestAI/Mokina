import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
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
