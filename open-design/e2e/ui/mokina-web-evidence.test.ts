import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

// This witness spans the running renderer and the real recovery store. The
// capture response is controlled here; daemon/external-web publication is
// covered by its API tests, not claimed by this transport-failure fixture.
for (const width of [1440, 900]) test(`[P1] public web evidence retains its verified result after a recovery mirror failure at ${width}`, async ({ page }, info) => {
  const { createMokinaRecoveryStore } = await import(new URL('../../apps/desktop/dist/main/mokina-recovery-store.js', import.meta.url).href);
  const root = await mkdtemp(join(tmpdir(), 'mokina-web-recovery-ui-'));
  const store = createMokinaRecoveryStore(root);
  const id = `web-recovery-${randomUUID()}`;
  const api = page.request;
  let created = false;
  try {
    await applyStandardMocks(page);
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 600 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect((await api.post('/api/projects', { data: { id, name: '网页来源恢复验证', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
    created = true;
    expect((await api.post(`/api/projects/${id}/files`, { data: { name: 'report.html', content: '<section id="finding" data-mokina-id="finding"><h1>研究结论</h1><p>保留固定来源与读取凭据。</p></section>' } })).ok()).toBe(true);
    const conversationResponse = await api.post(`/api/projects/${id}/conversations`, { data: { title: '公开来源读取恢复' } });
    expect(conversationResponse.ok()).toBe(true);
    const { conversation } = await conversationResponse.json() as { conversation: { id: string } };
    const operation = { operationId: `recovery-witness-${width}`, url: 'https://example.com/research' };
    const key = `od:composer-draft:mokina-web-evidence:${JSON.stringify(['none', id, conversation.id])}`;
    expect(await store.put(key, { recordId: 'initial-draft', value: JSON.stringify({ schema: 1, request: operation, state: 'draft' }) })).toMatchObject({ ok: true, result: 'stored' });

    let mirrorFailures = 0;
    await page.exposeFunction('webRecoveryGet', async (recordKey: string) => {
      const got = await store.get(recordKey);
      return got.ok ? { ok: true, ...got.result } : got;
    });
    await page.exposeFunction('webRecoveryList', async (prefix?: string) => {
      const listed = await store.list(prefix);
      return listed.ok ? { ok: true, keys: listed.result } : listed;
    });
    await page.exposeFunction('webRecoveryDelete', (recordKey: string, expectedRecordId: string) => store.delete(recordKey, expectedRecordId));
    await page.exposeFunction('webRecoveryPut', (recordKey: string, record: { recordId: string; value: unknown }, expectedRecordId?: string) => {
      if (recordKey === key && JSON.parse(String(record.value)).state === 'saved' && mirrorFailures === 0) {
        mirrorFailures++;
        return { ok: false, reason: 'write-failed' };
      }
      return store.put(recordKey, record, expectedRecordId);
    });
    await page.addInitScript(() => {
      const scope = window as unknown as Record<string, any>;
      const ok = async () => ({ ok: true });
      const updater = async () => ({ supported: false, enabled: false, state: 'idle', platform: 'test', arch: 'arm64', currentVersion: 'test', capabilities: {} });
      scope.__od__ = { version: 2, client: { type: 'desktop', platform: 'test' },
        shell: { openExternal: ok, openPath: ok }, browser: { clearData: ok }, capture: { page: ok },
        project: { pickAndImport: ok, pickAndReplaceWorkingDir: ok }, pdf: { print: ok }, pet: { setVisible() {} },
        updater: { status: updater, check: updater, 'clear-cache': updater, download: updater, install: updater,
          quit: ok, setMenuLabels: ok, subscribe: () => () => {}, subscribeOpenDialog: () => () => {} },
        recoveryStore: { get: (key: string) => scope.webRecoveryGet(key), list: (prefix?: string) => scope.webRecoveryList(prefix),
          put: (key: string, record: unknown, expected?: string) => scope.webRecoveryPut(key, record, expected),
          delete: (key: string, expected: string) => scope.webRecoveryDelete(key, expected) },
      };
    });

    const content = 'A fixed public source for the recovery-state browser witness.';
    const contentDigest = createHash('sha256').update(content).digest('hex');
    const fileName = `evidence/web-${operation.operationId}.md`;
    const receipt = { schema: 'mokina.web-evidence.v1', operationId: operation.operationId,
      requestedUrl: operation.url, resolvedUrl: operation.url, retrievedAt: '2026-10-14T04:00:00Z', statusCode: 200,
      contentType: 'text/plain', bodyDigest: contentDigest, textDigest: contentDigest, parserVersion: 'mokina-web/1',
      scope: 'plain-text', limitations: ['This fixture does not assess the source facts.'] };
    const result = { fileName, versionId: 'fixed-source-v1', contentDigest, content, receipt, workingFile: 'matched',
      material: { name: fileName, sourceVersionId: 'fixed-source-v1', contentDigest, parserVersion: 'mokina-material/2', status: 'read', sections: [], limitations: [], webCapture: receipt } };
    const capturePath = `/api/projects/${id}/mokina/web-evidence`;
    const requests: { method: string; path: string; body: unknown }[] = [];
    await page.route(`**${capturePath}**`, async route => {
      const request = route.request(); const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path === capturePath) {
        requests.push({ method: 'POST', path, body: request.postDataJSON() });
        await route.fulfill({ json: { result } }); return;
      }
      if (request.method() === 'GET' && path === `${capturePath}/${operation.operationId}`) {
        requests.push({ method: 'GET', path, body: null });
        await route.fulfill({ json: { result } }); return;
      }
      await route.fallback();
    });
    await page.goto(`/projects/${id}/conversations/${conversation.id}/files/report.html`);
    await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
    await page.locator('.mokina-workspace-tabs').getByRole('button', { name: 'Materials', exact: true }).click();
    const panel = page.getByTestId('mokina-web-evidence');
    await expect(panel.getByRole('textbox', { name: 'Public page URL', exact: true })).toHaveValue(operation.url);
    await info.attach(`web-recovery-entry-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });

    const captured = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === capturePath);
    await panel.getByRole('button', { name: 'Read public page', exact: true }).click();
    expect((await captured).ok()).toBe(true);
    await expect(panel.getByRole('alert')).toBeVisible();
    // Keep the same failure screenshot on both baseline and fix, before the
    // regression assertion goes red on baseline.
    await panel.getByRole('alert').scrollIntoViewIfNeeded();
    await info.attach(`web-recovery-mirror-failure-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    expect(mirrorFailures).toBe(1);
    expect(requests).toEqual([{ method: 'POST', path: capturePath, body: operation }]);
    const beforeRecovery = await store.get(key);
    expect(beforeRecovery).toMatchObject({ ok: true, result: { found: true } });
    expect(JSON.parse(beforeRecovery.result.record.value)).toMatchObject({ request: operation, state: 'unknown' });
    await expect(panel.getByRole('alert')).toContainText('response was verified');
    await expect(panel.getByRole('alert')).not.toContainText('nothing was sent');
    await expect(panel).toContainText(`${fileName} · fixed-source-v1 · ${contentDigest}`);
    await expect(panel).toContainText('Source version saved');
    await expect(panel.getByRole('button', { name: 'Read page again as a new source', exact: true })).toBeDisabled();

    const queried = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === `${capturePath}/${operation.operationId}`);
    await panel.getByRole('button', { name: 'Read capture result', exact: true }).click();
    expect((await queried).ok()).toBe(true);
    await expect(panel.getByRole('button', { name: 'Read page again as a new source', exact: true })).toBeEnabled();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel).toContainText(`${fileName} · fixed-source-v1 · ${contentDigest}`);
    expect(requests).toEqual([{ method: 'POST', path: capturePath, body: operation }, { method: 'GET', path: `${capturePath}/${operation.operationId}`, body: null }]);
    const afterRecovery = await store.get(key);
    expect(afterRecovery).toMatchObject({ ok: true, result: { found: true } });
    expect(JSON.parse(afterRecovery.result.record.value)).toMatchObject({ request: operation, state: 'saved' });
    await info.attach(`web-recovery-reconciled-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  } finally {
    // Close the consumer before removing its isolated recovery authority.
    try { await page.close(); if (created) await api.delete(`/api/projects/${id}`); }
    finally { await rm(root, { recursive: true, force: true }); }
  }
});
