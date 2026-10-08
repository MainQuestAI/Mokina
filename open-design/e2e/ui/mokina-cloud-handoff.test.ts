import { randomUUID } from 'node:crypto';
import { expect, test } from '@/playwright/suite';
import { routeMockAgents, routeUnavailableVelaStatus, suppressWhatsNew, routeSuccessfulRuns } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

for (const [count, length] of [[1, 60], [50, 65536], [51, 65536], [50, 65537]]) {
test(`[P1] Mokina legacy Cloud handoff retains ${count} files and ${length} characters before explicit send`, async ({ page }, testInfo) => {
  // This crosses project, lazy settings, reload and send boundaries.
  test.slow();
  page.on('pageerror', error => { void testInfo.attach('page-error', { body: error.stack ?? error.message, contentType: 'text/plain' }); });
  await routeMockAgents(page);
  await routeUnavailableVelaStatus(page);
  await suppressWhatsNew(page);
  const runs = await routeSuccessfulRuns(page);
  const projectId = `mokina-cloud-${randomUUID()}`;
  let prompt = 'x'.repeat(length!);
  const files = Array.from({ length: count! }, (_, i) => ({ path: `brief-${i}.txt`, name: `brief-${i}.txt`, kind: 'file' }));
  const overflow = count! > 50 || length! > 65536;
  let config: Record<string, unknown> = { agentId: 'amr', onboardingCompleted: true,
    privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} };
  await page.route('**/api/app-config', async route => {
    if (route.request().method() !== 'GET') {
      const body = route.request().postDataJSON();
      config = { ...config, ...(body.config ?? body) };
    }
    await route.fulfill({ json: { config } });
  });
  await page.addInitScript(({ projectId, prompt, files }) => {
    // Seed once: reload must use the product's actual persisted manual draft.
    if (localStorage.getItem(`test:cloud-handoff:${projectId}`)) return;
    localStorage.setItem(`test:cloud-handoff:${projectId}`, 'seeded');
    localStorage.setItem('open-design:config', JSON.stringify({ mode: 'daemon', agentId: 'amr', onboardingCompleted: true,
      privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} }));
    sessionStorage.setItem(`od:auto-send-first:${projectId}`, '1');
    sessionStorage.setItem(`od:auto-send-prompt:${projectId}`, prompt);
    sessionStorage.setItem(`od:auto-send-attachments:${projectId}`, JSON.stringify(files));
  }, { projectId, prompt, files });
  const created = await page.request.post('/api/projects', { data: { id: projectId,
    name: 'Legacy Cloud manual draft', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } });
  expect(created.ok(), await created.text()).toBe(true);
  for (const file of files) {
    const attachment = await page.request.post(`/api/projects/${projectId}/files`, { data: { name: file.name, content: 'Retained attachment.' } });
    expect(attachment.ok(), await attachment.text()).toBe(true);
  }
  await page.goto(`/projects/${projectId}`, { waitUntil: 'domcontentloaded' });
  // The real settings handoff navigates to the settings page and unmounts
  // ProjectView; the payload must survive that boundary before returning.
  const settings = page.getByRole('region', { name: /^Settings/ });
  await expect(settings).toBeVisible({ timeout: T.long });
  await settings.getByTestId('settings-agent-select-mock').click();
  await expect(settings.getByTestId('settings-agent-select-mock')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => config.agentId).toBe('mock');
  await runs.expectNone();
  await page.goto(`/projects/${projectId}`, { waitUntil: 'domcontentloaded' });
  const editor = page.getByTestId(overflow ? 'mokina-manual-handoff-prompt' : 'chat-composer-input');
  const container = page.getByTestId(overflow ? 'mokina-manual-handoff' : 'chat-composer');
  if (overflow) await expect(editor).toHaveValue(prompt, { timeout: T.long });
  else await expect(editor).toHaveText(prompt, { timeout: T.long });
  await expect(container).toContainText(files.at(-1)!.name);
  if (overflow) {
    await container.locator('summary').click(); // cancel/collapse never consumes the source
    await runs.expectNone();
    await container.locator('summary').click();
    prompt = `edited:${prompt}`;
    await editor.fill(prompt);
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (overflow) await expect(editor).toHaveValue(prompt, { timeout: T.long });
  else await expect(editor).toHaveText(prompt, { timeout: T.long });
  await expect(container).toContainText(files.at(-1)!.name);
  await runs.expectNone();
  await testInfo.attach('legacy-cloud-manual-draft', { body: await page.screenshot(), contentType: 'image/png' });
  const send = page.getByTestId(overflow ? 'mokina-manual-handoff-send' : 'chat-send');
  if (overflow) await send.dblclick(); else await send.click();
  await runs.expectCount(1);
  expect(JSON.stringify(runs.bodies[0])).toContain(prompt);
  expect(runs.bodies[0]!.attachments).toEqual(files.map(file => file.path));
});

}

test('[P1] Mokina Home retains bound MCP context through cancelled selection, settings return and refresh', async ({ page }, testInfo) => {
  test.slow();
  await routeMockAgents(page); await routeUnavailableVelaStatus(page); await suppressWhatsNew(page);
  const runs = await routeSuccessfulRuns(page);
  let config: Record<string, unknown> = { agentId: 'amr', onboardingCompleted: true,
    privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} };
  await page.route('**/api/app-config', async route => {
    if (route.request().method() !== 'GET') { const body = route.request().postDataJSON(); config = { ...config, ...(body.config ?? body) }; }
    await route.fulfill({ json: { config } });
  });
  await page.route('**/api/mcp/servers', route => route.fulfill({ json: { servers: [
    { id: 'retained-mcp', label: 'Retained MCP', enabled: true, transport: 'stdio', command: 'mcp', env: { SECRET: 'never-store-this' } },
  ] } }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded-home')) return;
    sessionStorage.setItem('seeded-home', '1');
    localStorage.setItem('open-design:config', JSON.stringify({ mode: 'daemon', agentId: 'amr', onboardingCompleted: true,
      privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} }));
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('home-hero-input').fill('Use my retained context. ');
  await page.getByTestId('home-hero-plus-trigger').click();
  await page.getByTestId('composer-plus-mcp').click();
  await page.getByRole('menuitem', { name: /Retained MCP/ }).click();
  await expect(page.getByTestId('home-hero-input')).toContainText('context. @Retained MCP');
  await page.getByTestId('home-hero-submit').click();
  await expect(page.getByTestId('home-hero-input')).toBeVisible();
  await runs.expectNone();
  const chip = page.getByTestId('inline-model-switcher-chip');
  await chip.click(); await page.keyboard.press('Escape');
  await chip.click();
  await page.getByTestId('inline-model-switcher-agent-mock').click();
  await expect.poll(() => config.agentId).toBe('mock');
  await page.keyboard.press('Escape');
  await chip.click();
  await page.getByTestId('inline-model-switcher-open-settings').click();
  await expect(page.getByRole('region', { name: /^Settings/ })).toBeVisible();
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-hero-input')).toContainText('Retained MCP');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-hero-input')).toContainText('Retained MCP');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('od:home-context:none') ?? '{}').mcp)).toEqual([{ id: 'retained-mcp', inlineBacked: true }]);
  expect(await page.evaluate(() => JSON.stringify(Object.values(sessionStorage)))).not.toContain('never-store-this');
  await runs.expectNone();
  await testInfo.attach('home-restored-context', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByTestId('home-hero-submit').click();
  await runs.expectCount(1);
  // Home binds MCP references to project metadata; the daemon derives run context from it.
  const response = await page.request.get(`/api/projects/${runs.bodies[0]!.projectId}`);
  expect(response.ok()).toBe(true);
  const persisted = await response.json();
  expect(persisted.project.metadata.contextMcpServers).toEqual([{ id: 'retained-mcp', label: 'Retained MCP', transport: 'stdio', command: 'mcp' }]);
});

test('[P1] Mokina generated crash page displays every export outcome in Chromium', async ({ page }, testInfo) => {
  const { mokinaCrashHtml } = await import('../../apps/desktop/src/main/mokina-splash.js');
  const markup = decodeURIComponent(mokinaCrashHtml().split(',').slice(1).join(','));
  for (const outcome of ['success', 'failure', 'cancel', 'reject', 'throw']) {
    await page.setContent(markup.replace('<script>', `<script>window.openDesignDesktop={exportDiagnostics:function(){
      if ('${outcome}' === 'throw') throw new Error('IPC');
      return new Promise(function(resolve,reject){window.resolveExport=resolve;window.rejectExport=reject;});
    }};</script><script>`));
    const button = page.getByRole('button', { name: 'Save logs…' });
    await button.click();
    if (outcome !== 'throw') {
      await expect(page.getByRole('status')).toHaveText('Saving logs…');
      await expect(button).toBeDisabled();
      await page.evaluate(outcome => {
        const host = window as unknown as { resolveExport: (result: unknown) => void; rejectExport: (error: Error) => void };
        if (outcome === 'reject') host.rejectExport(new Error('IPC'));
        else host.resolveExport(outcome === 'success' ? { ok: true } : outcome === 'cancel' ? { cancelled: true } : { ok: false });
      }, outcome);
    }
    await expect(page.getByRole('status')).toHaveText(outcome === 'success' ? 'Logs saved.' : outcome === 'cancel' ? '' : 'Could not save logs.');
    await expect(button).toBeEnabled();
    await testInfo.attach(`diagnostics-${outcome}`, { body: await page.screenshot(), contentType: 'image/png' });
  }
});
