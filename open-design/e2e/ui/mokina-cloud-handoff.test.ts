import { randomUUID } from 'node:crypto';
import { expect, test } from '@/playwright/suite';
import { routeMockAgents, routeUnavailableVelaStatus, suppressWhatsNew, routeSuccessfulRuns } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test('[P1] Mokina legacy Cloud handoff becomes a durable manual draft before a model switch', async ({ page }, testInfo) => {
  // This crosses project, lazy settings, reload and send boundaries.
  test.slow();
  await routeMockAgents(page);
  await routeUnavailableVelaStatus(page);
  await suppressWhatsNew(page);
  const runs = await routeSuccessfulRuns(page);
  const projectId = `mokina-cloud-${randomUUID()}`;
  const prompt = 'Review this retained Cloud draft only after I click Send.';
  let config: Record<string, unknown> = { agentId: 'amr', onboardingCompleted: true,
    privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} };
  await page.route('**/api/app-config', async route => {
    if (route.request().method() !== 'GET') {
      const body = route.request().postDataJSON();
      config = { ...config, ...(body.config ?? body) };
    }
    await route.fulfill({ json: { config } });
  });
  await page.addInitScript(({ projectId, prompt }) => {
    // Seed once: reload must use the product's actual persisted manual draft.
    if (localStorage.getItem(`test:cloud-handoff:${projectId}`)) return;
    localStorage.setItem(`test:cloud-handoff:${projectId}`, 'seeded');
    localStorage.setItem('open-design:config', JSON.stringify({ mode: 'daemon', agentId: 'amr', onboardingCompleted: true,
      privacyDecisionAt: 1, telemetry: { metrics: false, content: false, artifactManifest: false }, agentModels: {} }));
    sessionStorage.setItem(`od:auto-send-first:${projectId}`, '1');
    sessionStorage.setItem(`od:auto-send-prompt:${projectId}`, prompt);
    sessionStorage.setItem(`od:auto-send-attachments:${projectId}`, JSON.stringify([{ path: 'brief.txt', name: 'brief.txt', kind: 'file' }]));
  }, { projectId, prompt });
  const created = await page.request.post('/api/projects', { data: { id: projectId,
    name: 'Legacy Cloud manual draft', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } });
  expect(created.ok(), await created.text()).toBe(true);
  const attachment = await page.request.post(`/api/projects/${projectId}/files`, { data: { name: 'brief.txt', content: 'Retained attachment.' } });
  expect(attachment.ok(), await attachment.text()).toBe(true);
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
  await expect(page.getByTestId('chat-composer-input')).toContainText(prompt, { timeout: T.long });
  await expect(page.getByTestId('chat-composer')).toContainText('brief.txt');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('chat-composer-input')).toContainText(prompt, { timeout: T.long });
  await expect(page.getByTestId('chat-composer')).toContainText('brief.txt');
  await runs.expectNone();
  await testInfo.attach('legacy-cloud-manual-draft', { body: await page.screenshot(), contentType: 'image/png' });
  await page.getByTestId('chat-send').click();
  await runs.expectCount(1);
  expect(JSON.stringify(runs.bodies[0])).toContain(prompt);
  expect(JSON.stringify(runs.bodies[0])).toContain('brief.txt');
});
