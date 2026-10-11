import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test.beforeEach(async ({ page }) => { await applyStandardMocks(page); });

for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 600 }]) {
  test(`[P1] Mokina conversation history supports new sessions, switching and refresh at ${viewport.width}`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const projectId = await seedRevisionProject(page, 'Mokina conversation recovery');
    const listed = await page.request.get(`/api/projects/${projectId}/conversations`);
    expect(listed.ok()).toBe(true);
    const { conversations } = await listed.json() as { conversations: Array<{ id: string }> };
    const first = conversations[0]!.id;
    const firstText = '第一轮讨论：保留门店活动预算上限。';
    const secondText = '第二轮讨论：只调整渠道分配。';
    await seedConversationMessage(page, projectId, first, firstText);
    await page.goto(`/projects/${projectId}/conversations/${first}`, { waitUntil: 'domcontentloaded' });
    const composer = page.getByTestId('chat-composer-input');
    const history = page.getByTestId('conversation-history-trigger');
    const menu = page.getByTestId('conversation-history-menu');
    await expect(composer).toBeEditable();
    await expect(page.getByTestId('chat-log')).toContainText(firstText);
    await history.click();
    await expect(menu).toBeVisible();
    await recordConversationMenu(page, info, 'conversation-menu-open');
    // Real hit testing is essential: a backdrop-filter stacking context once
    // let the transcript intercept this visible and enabled button.
    const [createdResponse] = await Promise.all([
      page.waitForResponse(response => response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/projects/${projectId}/conversations`),
      menu.getByTestId('chat-new-conversation').click({ timeout: T.short }),
    ]);
    expect(createdResponse.ok()).toBe(true);
    const { conversation } = await createdResponse.json() as { conversation: { id: string } };
    const second = conversation.id;
    expect(second).not.toBe(first);
    await expect(page).toHaveURL(new RegExp(`/conversations/${second}(?:/files/[^/]+)?$`));
    await expect(menu).toHaveCount(0);
    await expect(page.getByTestId('chat-log')).not.toContainText(firstText);
    await seedConversationMessage(page, projectId, second, secondText);

    // Seed real saved history, including long titles and enough rows to scroll.
    // No run is simulated or submitted by this conversation-navigation check.
    for (let index = 0; index < 14; index++) {
      const response = await page.request.post(`/api/projects/${projectId}/conversations`, { data: {
        title: `活动复盘 ${index + 1}：核对门店、渠道、预算与下一阶段安排，保留完整讨论记录`,
      } });
      expect(response.ok()).toBe(true);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('chat-log')).toContainText(secondText);
    await history.click();
    await expect(page.getByTestId('conversation-list').locator('[data-testid^="conversation-item-"]')).toHaveCount(16);
    const list = page.getByTestId('conversation-list');
    await list.hover();
    await page.mouse.wheel(0, 800);
    await expect.poll(() => list.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await recordConversationMenu(page, info, 'conversation-menu-long-history');
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(await menu.evaluate(element => element.scrollWidth - element.clientWidth)).toBe(0);
    await page.getByTestId(`conversation-select-${first}`).click();
    await expect(page).toHaveURL(new RegExp(`/conversations/${first}(?:/files/[^/]+)?$`));
    await expect(page.getByTestId('chat-log')).toContainText(firstText);
    await expect(page.getByTestId('chat-log')).not.toContainText(secondText);
    const draft = '第一轮的未发送补充说明。';
    await composer.fill(draft);

    await history.click();
    await page.getByTestId('conversation-history-search').fill(second);
    await expect(page.getByTestId('conversation-list').locator('[data-testid^="conversation-item-"]')).toHaveCount(1);
    await page.getByTestId(`conversation-select-${second}`).click();
    await expect(page).toHaveURL(new RegExp(`/conversations/${second}(?:/files/[^/]+)?$`));
    await expect(page.getByTestId('chat-log')).toContainText(secondText);
    await expect(page.getByTestId('chat-log')).not.toContainText(firstText);
    await expect(composer).toHaveText('');
    await history.click();
    await page.getByTestId('conversation-history-search').fill(first);
    await page.getByTestId(`conversation-select-${first}`).click();
    await expect(composer).toHaveText(draft);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/conversations/${first}(?:/files/[^/]+)?$`));
    await expect(page.getByTestId('chat-log')).toContainText(firstText);
    await expect(page.getByTestId('chat-log')).not.toContainText(secondText);
    await expect(composer).toHaveText(draft);
    await composer.fill('');
    await history.click();
    await page.getByTestId('conversation-history-search').click();
    await expect(page.getByTestId('conversation-history-search')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await history.click();
    await expect(menu).toBeVisible();
    await composer.click();
    await expect(menu).toHaveCount(0);
    await composer.fill('刷新后仍可以继续输入。');
    await expect(page.getByTestId('chat-send')).toBeEnabled();
    await info.attach('conversation-restored', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    expect((await page.request.delete(`/api/projects/${projectId}`)).ok()).toBe(true);
  });

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

async function seedConversationMessage(page: Page, projectId: string, conversationId: string, content: string) {
  const response = await page.request.put(`/api/projects/${projectId}/conversations/${conversationId}/messages/${randomUUID()}`, {
    data: { role: 'user', content, timestamp: Date.now() },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function recordConversationMenu(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await info.attach(`${name}-geometry`, { body: JSON.stringify(await page.getByTestId('chat-new-conversation').evaluate(button => {
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    const ancestors = [];
    for (let node: Element | null = button; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      ancestors.push({ tag: node.tagName, className: node.className, zIndex: style.zIndex, backdrop: style.backdropFilter, overflow: style.overflow, animation: style.animationName, animationFillMode: style.animationFillMode });
    }
    return { viewport: { width: innerWidth, height: innerHeight }, hit: hit?.getAttribute('data-testid'), buttonReceivesClick: hit === button || button.contains(hit), ancestors };
  })), contentType: 'application/json' });
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
