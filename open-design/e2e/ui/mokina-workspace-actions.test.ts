import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test.beforeEach(async ({ page }) => {
  await applyStandardMocks(page);
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
  test(`[P1] Mokina long-path materials stay inside the continuation panel at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const source = await seedWorkspace(page);
    const paths = [0, 1, 2].map(index => `assets/${'中文目录 with spaces/'.repeat(6)}${index}/同名品牌素材.svg`);
    const storedPaths: string[] = [];
    for (const name of paths) {
      const saved = await page.request.post(`/api/projects/${source.projectId}/files`, {
        data: { name, content: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="red"/></svg>' },
      });
      expect(saved.ok(), await saved.text()).toBe(true);
      const receipt = await saved.json();
      expect(receipt.file?.name).toBeTruthy();
      storedPaths.push(receipt.file.name);
    }
    await openArtifact(page, source, 'plan.html');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    const panel = page.locator('.artifact-version-panel');
    for (const name of storedPaths) {
      const checkbox = panel.getByRole('checkbox', { name, exact: true });
      await checkbox.check();
    }
    const geometry = await panel.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth,
      regions: Array.from(element.querySelectorAll('.artifact-version-panel__continuation, fieldset')).map(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth })) }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.width + 1);
    for (const region of geometry.regions) expect(region.scrollWidth).toBeLessThanOrEqual(region.width + 1);
    const usages = panel.locator('.artifact-version-panel__continuation-assets input:not([type="checkbox"])');
    await expect(usages).toHaveCount(3);
    await usages.last().fill('完整保留中文用途说明');
    await panel.getByRole('checkbox', { name: /strategy：/ }).check();
    await panel.getByLabel('Continuation background').fill('长路径素材接续');
    await testInfo.attach('long-path-continuation', { body: await page.screenshot(), contentType: 'image/png' });
    await panel.getByRole('button', { name: 'Create continuation project (no send)', exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(source.projectId));
    await expect(page.getByTestId('chat-composer-input')).toContainText('长路径素材接续');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('chat-composer-input')).toContainText('长路径素材接续');
  });

  test(`[P1] Mokina panel actions remain reachable and preserve drafts at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const project = await seedWorkspace(page);
    const unexpectedWrites = await guardActionSideEffects(page);
    await openArtifact(page, project, 'plan.html');

    // These entry buttons really live in the tab-row portal. Its whole host is
    // intentionally hidden behind the panel; only the in-panel controls can
    // provide an actionable switch with the production shell stylesheet.
    await expect(page.locator('.ws-tabs-file-actions').getByRole('button', { name: 'Revise section', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Revise section', exact: true }).click();
    const panel = page.locator('.artifact-version-panel');
    await expect(panel).toBeVisible();
    const originalPanel = await panel.elementHandle();
    expect(originalPanel).not.toBeNull();
    const revision = panel.getByRole('button', { name: 'Revise section', exact: true });
    const continuation = panel.getByRole('button', { name: 'Continue', exact: true });
    await expect(revision).toBeVisible();
    await expect(continuation).toBeVisible();
    await expect(panel.getByLabel('Section to revise')).toBeFocused();

    await panel.getByLabel('Section to revise').selectOption('budget');
    await panel.getByLabel('Section change request').fill('保留预算上限，补充渠道分配。');
    const selectedVersion = await panel.getByRole('listbox').getByRole('option', { selected: true }).textContent();
    await continuation.click();
    await expect(panel.getByRole('checkbox').first()).toBeFocused();
    await panel.getByRole('checkbox', { name: /strategy：/ }).check();
    await panel.getByLabel('Continuation background').fill('沿用已选择结论，制作门店传播内容。');
    await revision.click();
    await expect(panel.getByLabel('Section to revise')).toBeFocused();

    // Keyboard activation must use the same mounted panel, too. Playwright's
    // normal press/click actionability is essential: synthetic click dispatch
    // used to pass even though the only buttons were visibility:hidden.
    await continuation.press('Enter');
    await expect(panel.getByRole('checkbox').first()).toBeFocused();
    await revision.press('Space');
    await expect(panel.getByLabel('Section to revise')).toBeFocused();
    expect(await originalPanel!.evaluate((element) => element === document.querySelector('.artifact-version-panel'))).toBe(true);
    await expect(panel.getByRole('listbox').getByRole('option', { selected: true })).toHaveText(selectedVersion!);
    await expect(panel.getByLabel('Section to revise')).toHaveValue('budget');
    await expect(panel.getByLabel('Section change request')).toHaveValue('保留预算上限，补充渠道分配。');
    await expect(panel.getByRole('checkbox', { name: /strategy：/ })).toBeChecked();
    await expect(panel.getByLabel('Continuation background')).toHaveValue('沿用已选择结论，制作门店传播内容。');

    await testInfo.attach('panel-with-preserved-drafts', {
      body: await page.screenshot(), contentType: 'image/png',
    });
    await page.getByTestId('chat-composer-input').click();
    await expect(panel).toHaveCount(0);
    await verifyWorkspaceGeometry(page);
    await testInfo.attach('workspace-after-resize', {
      body: await page.screenshot(), contentType: 'image/png',
    });
    expect(unexpectedWrites, 'switching actions must neither create a project nor start a model run').toEqual([]);
    await originalPanel!.dispose();
  });
}

test('[P1] Mokina panel explains historical and chapterless action restrictions', async ({ page }) => {
  const project = await seedWorkspace(page);
  const unexpectedWrites = await guardActionSideEffects(page);
  await openArtifact(page, project, 'plan.html');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const panel = page.locator('.artifact-version-panel');
  await panel.getByRole('listbox').getByRole('option').filter({ hasText: '第一稿' }).click();
  await expect(panel.getByRole('checkbox', { name: /strategy：第一稿/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Revise section', exact: true }).click();
  await expect(panel.getByText('Section revision only supports the current draft; select the current version first.')).toBeVisible();
  await expect(panel.getByLabel('Section to revise')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  await expect(panel.getByRole('checkbox').first()).toBeFocused();
  await expect(panel.getByRole('listbox').getByRole('option', { selected: true })).toContainText('第一稿');

  await openArtifact(page, project, 'plain.html');
  await page.getByRole('button', { name: 'Revise section', exact: true }).click();
  await expect(panel.getByText('This version has no selectable sections, so it cannot be revised or continued yet.')).toBeVisible();
  await panel.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(panel.getByText('This version has no selectable sections, so it cannot be revised or continued yet.')).toBeVisible();
  await expect(panel.getByLabel('Section change request')).toHaveCount(0);
  await expect(panel.getByLabel('Continuation background')).toHaveCount(0);
  expect(unexpectedWrites).toEqual([]);
});

test('[P1] Mokina continuation creates an editable fixed-excerpt draft without a run', async ({ page }, testInfo) => {
  const source = await seedWorkspace(page);
  const runPosts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/runs') runPosts.push(request.url()); });
  await openArtifact(page, source, 'plan.html');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const panel = page.locator('.artifact-version-panel');
  await panel.getByRole('checkbox', { name: /strategy：/ }).check();
  await panel.getByLabel('Continuation background').fill('只选策略，制作门店传播内容。');
  await panel.getByRole('button', { name: 'Create continuation project (no send)', exact: true }).click();
  await expect(page).not.toHaveURL(new RegExp(source.projectId));
  const input = page.getByTestId('chat-composer-input');
  await expect(input).toContainText('【strategy】', { timeout: T.long });
  await expect(input).toContainText('只选策略，制作门店传播内容。');
  await expect(input).not.toContainText('【budget】');
  const projectId = new URL(page.url()).pathname.split('/')[2]!;
  const snapshot = await page.request.get(`/api/projects/${projectId}/files/MOKINA-CONTINUATION.json`);
  expect(snapshot.ok()).toBe(true);
  expect(await snapshot.json()).toMatchObject({ source: { projectId: source.projectId, fileName: 'plan.html' }, sections: [{ id: 'strategy' }], background: '只选策略，制作门店传播内容。' });
  await input.fill('Edited continuation draft');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(input).toHaveText('Edited continuation draft');
  expect(runPosts).toEqual([]);
  await testInfo.attach('continuation-editable-draft', { body: await page.screenshot(), contentType: 'image/png' });
});

async function seedWorkspace(page: Page) {
  const projectId = `mokina-actions-${randomUUID()}`;
  const created = await page.request.post('/api/projects', {
    data: { id: projectId, name: 'Mokina panel regression', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } },
  });
  expect(created.ok(), `create fixture: ${await created.text()}`).toBe(true);
  const { conversationId } = await created.json() as { conversationId: string };
  for (const label of ['第一稿', '当前稿']) {
    await seedVersion(page, projectId, 'plan.html', label, `<!doctype html><html><body><h1>${label}</h1>
      <section id="strategy" data-mokina-id="strategy"><h2>${label}策略</h2><p>优先验证门店渠道。</p></section>
      <section id="budget" data-mokina-id="budget"><h2>${label}预算</h2><p>预算保持十万元上限。</p></section>
      </body></html>`);
  }
  await seedVersion(page, projectId, 'plain.html', '无章节稿', '<!doctype html><html><body><h1>尚未划分章节</h1></body></html>');
  return { projectId, conversationId };
}

async function seedVersion(page: Page, projectId: string, name: string, label: string, content: string) {
  const response = await page.request.post(`/api/projects/${projectId}/files`, {
    data: {
      name, content, versionSource: 'manual', versionLabel: label,
      artifactManifest: { version: 1, kind: 'html', title: name, entry: name, renderer: 'html', exports: ['html'] },
    },
  });
  expect(response.ok(), `seed ${name}/${label}: ${await response.text()}`).toBe(true);
  const body = await response.json() as { version?: { id: string } };
  expect(body.version?.id, `${name}/${label} must have a real saved version`).toBeTruthy();
}

async function openArtifact(page: Page, project: { projectId: string; conversationId: string }, file: string) {
  await page.goto(`/projects/${project.projectId}/conversations/${project.conversationId}/files/${file}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
  await expect(page.getByRole('button', { name: 'Revise section', exact: true })).toBeEnabled();
}

async function guardActionSideEffects(page: Page) {
  const unexpectedWrites: string[] = [];
  await page.route(/\/api\/(?:projects|runs)\/?(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    unexpectedWrites.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 500, json: { error: 'Action navigation must not create work' } });
  });
  return unexpectedWrites;
}

async function verifyWorkspaceGeometry(page: Page) {
  const handle = page.locator('.split-resize-handle');
  const indicator = await handle.evaluate((element) => {
    const style = getComputedStyle(element, '::after');
    const transform = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return {
      display: style.display, width: parseFloat(style.width), height: parseFloat(style.height),
      offsetX: parseFloat(style.left) + transform.m41 + parseFloat(style.width) / 2 - element.clientWidth / 2,
      offsetY: parseFloat(style.top) + transform.m42 + parseFloat(style.height) / 2 - element.clientHeight / 2,
    };
  });
  expect(indicator.display).toBe('block');
  expect(indicator.width).toBe(3);
  expect(indicator.height).toBe(36);
  expect(Math.abs(indicator.offsetX)).toBeLessThanOrEqual(1);
  expect(Math.abs(indicator.offsetY)).toBeLessThanOrEqual(1);

  const chatLog = page.locator('.chat-log');
  const forbiddenAncestors = await chatLog.evaluate((element) => {
    const violations: string[] = [];
    for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      const rounded = [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius]
        .some((radius) => parseFloat(radius) > 0);
      if (rounded && [style.overflowX, style.overflowY].some((overflow) => /^(hidden|clip|scroll|auto)$/.test(overflow))) {
        violations.push(`${ancestor.tagName}.${ancestor.className}: ${style.borderRadius}; ${style.overflowX}/${style.overflowY}`);
      }
    }
    return violations;
  });
  expect(forbiddenAncestors, 'chat log ancestors must not impose a rounded clip on wheel hit testing').toEqual([]);

  const chatBox = await box(chatLog);
  const scrollEdge = { x: chatBox.x + chatBox.width - 1, y: chatBox.y + chatBox.height / 2 };
  await page.mouse.move(scrollEdge.x, scrollEdge.y);
  const hit = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    return { chat: Boolean(element?.closest('.chat-log')), resize: Boolean(element?.closest('.split-resize-handle')) };
  }, scrollEdge);
  expect(hit).toEqual({ chat: true, resize: false });
  expect(await handle.evaluate((element) => element.matches(':hover'))).toBe(false);
  const initialWidth = Number(await handle.getAttribute('aria-valuenow'));
  await page.mouse.down();
  await page.mouse.move(scrollEdge.x + 20, scrollEdge.y, { steps: 3 });
  await expect(page.locator('.split')).not.toHaveClass(/is-resizing-chat/);
  await page.mouse.up();
  expect(Number(await handle.getAttribute('aria-valuenow'))).toBe(initialWidth);

  const handleBox = await box(handle);
  const center = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - 24, center.y, { steps: 4 });
  await page.mouse.up();
  const draggedWidth = Number(await handle.getAttribute('aria-valuenow'));
  expect(draggedWidth).toBeLessThan(initialWidth);
  await handle.press('ArrowRight');
  await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(draggedWidth);
}

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  const value = await locator.boundingBox();
  if (!value) throw new Error('Visible workspace control has no bounding box');
  return value;
}
