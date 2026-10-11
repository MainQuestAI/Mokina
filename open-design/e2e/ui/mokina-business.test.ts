import { randomUUID } from 'node:crypto';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';
for (const width of [1440, 900]) test(`[P1] M1 confirmed facts, Brief isolation and explicit handoff at ${width}`, async ({ page }, info) => {
  await applyStandardMocks(page); await page.setViewportSize({ width, height: width === 1440 ? 900 : 600 });
  const id = `m1-${randomUUID()}`, other = `m1-${randomUUID()}`;
  for (const project of [id, other]) expect((await page.request.post('/api/projects', { data: { id: project, name: project === id ? 'M1 营销 Brief 验收' : 'M1 第二次营销任务', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
  const writes: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && /\/api\/runs$/.test(new URL(request.url()).pathname)) writes.push(request.url()); });
  const open = async (project: string) => {
    await page.goto(project === id ? `/projects/${project}/files/task-brief.html` : `/projects/${project}`);
    await expect(page.getByTestId('chat-composer-input')).toBeEditable({ timeout: T.long });
    await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByTestId('mokina-business-brief').locator('summary').first().click();
    await expect(page.getByTestId('mokina-business-brief').getByRole('textbox', { name: 'Goal', exact: true })).toBeVisible();
  };
  await page.goto(`/projects/${id}`);
  await expect(page.getByTestId('chat-composer-input')).toBeEditable({ timeout: T.long });
  await info.attach(`after-collapsed-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await page.getByTestId('mokina-business-brief').locator('summary').first().click();
  const panel = page.getByTestId('mokina-business-brief');
  await panel.getByRole('button', { name: 'Business background', exact: true }).click();
  await panel.getByRole('button', { name: 'Add unconfirmed item' }).click();
  await panel.getByLabel('Content', { exact: true }).fill('仅线上销售');
  await panel.getByLabel('Source / confirmation basis').fill('用户确认 2026-10-11');
  await panel.getByLabel('Applicable scope').fill('当前茶品牌');
  await panel.getByLabel('I confirm this business fact').check();
  await panel.getByRole('button', { name: 'Save artifact (does not start production)', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Saved as an HTML');
  await panel.getByRole('button', { name: 'Task Brief', exact: true }).click();
  await panel.getByLabel('Goal', { exact: true }).fill('增加线上新客');
  await panel.getByLabel('Budget ceiling and basis').fill('不超过 3 万元');
  await panel.getByLabel('Task constraints (e.g. no offline events)').fill('禁止线下活动');
  await panel.getByLabel('Missing conditions / evidence (staff, capacity, quotes)').fill('人员、产能、报价和周期待确认');
  await panel.getByRole('button', { name: 'Add deliverable', exact: true }).click();
  await panel.getByLabel('Deliverables 1', { exact: true }).fill('营销方案');
  await panel.getByRole('button', { name: 'Add deliverable', exact: true }).click();
  await panel.getByLabel('Deliverables 2', { exact: true }).fill('对外活动页');
  await panel.getByText('Explicitly select background version and facts', { exact: true }).click();
  await panel.getByRole('button', { name: 'Read fixed background version', exact: true }).click();
  await panel.getByRole('checkbox', { name: '仅线上销售 · Confirmed', exact: true }).check();
  await panel.getByRole('button', { name: 'Save artifact (does not start production)', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Saved as an HTML');
  await info.attach(`after-brief-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await open(other);
  await expect(panel.getByLabel('Goal', { exact: true })).toHaveValue('');
  await panel.getByText('Explicitly select background version and facts', { exact: true }).click();
  await panel.getByRole('button', { name: 'Read available projects', exact: true }).click();
  await expect(panel.getByRole('combobox')).toContainText('M1 营销 Brief 验收');
  await panel.getByRole('combobox').selectOption(id);
  await panel.getByRole('button', { name: 'Read fixed background version', exact: true }).click();
  await panel.getByRole('checkbox', { name: '仅线上销售 · Confirmed', exact: true }).check();
  await panel.getByRole('button', { name: 'Save artifact (does not start production)', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Saved as an HTML');
  const reused = await page.request.get(`/api/projects/${other}/mokina/business/brief`);
  expect((await reused.json()).result.document.backgroundSnapshot.facts[0].text).toBe('仅线上销售');
  await open(id);
  await expect(panel.getByLabel('Goal', { exact: true })).toHaveValue('增加线上新客');
  await info.attach(`restored-geometry-${width}`, { body: JSON.stringify(await panel.evaluate(node => ({ viewport: { width: innerWidth, height: innerHeight }, width: node.getBoundingClientRect().width, horizontalOverflow: node.scrollWidth - node.clientWidth }))), contentType: 'application/json' });
  await panel.getByRole('checkbox', { name: '营销方案', exact: true }).check();
  await panel.getByRole('button', { name: 'Prepare in composer; review before sending' }).click();
  await expect(page.getByTestId('chat-composer-input')).toContainText('禁止线下活动');
  await expect(page.getByTestId('chat-composer-input')).toContainText('营销方案');
  await expect(page.getByTestId('chat-composer-input')).not.toContainText('对外活动页');
  expect(writes, 'save, switch and prepare do not start a run').toEqual([]);
  for (const project of [id, other]) expect((await page.request.delete(`/api/projects/${project}`)).ok()).toBe(true);
});


test('[P1] M1 unknown save survives reload without an automatic retry', async ({ page }) => {
  await applyStandardMocks(page);
  const id = `m1-unknown-${randomUUID()}`;
  expect((await page.request.post('/api/projects', { data: { id, name: 'M1 unknown save', skillId: null, designSystemId: null } })).ok()).toBe(true);
  await page.goto(`/projects/${id}`);
  await expect(page.getByTestId('chat-composer-input')).toBeEditable({ timeout: T.long });
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  const panel = page.getByTestId('mokina-business-brief');
  await panel.locator('summary').first().click();
  await panel.getByLabel('Goal', { exact: true }).fill('结果未知也不能重复制作');
  let posts = 0; const operations: string[] = [];
  await page.route(`**/api/projects/${id}/mokina/business/brief`, async route => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    posts++; operations.push(route.request().postDataJSON().operationId);
    if (posts === 1) { const committed = await route.fetch(); expect(committed.ok()).toBe(true); await route.abort('failed'); }
    else await route.continue();
  });
  await panel.getByRole('button', { name: 'Save artifact (does not start production)', exact: true }).click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await expect(panel.getByLabel('Goal', { exact: true })).toBeDisabled();
  await page.goto(`/projects/${id}/files/task-brief.html`);
  await expect(page.getByTestId('chat-composer-input')).toBeEditable({ timeout: T.long });
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  await panel.locator('summary').first().click();
  await expect(panel.getByRole('button', { name: 'Reconcile the same save', exact: true })).toBeEnabled();
  expect(posts).toBe(1);
  await panel.getByRole('button', { name: 'Read current artifact, keep draft', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Saved as an HTML');
  expect(posts).toBe(1);
  expect(operations).toHaveLength(1);
  const history = await page.request.get(`/api/projects/${id}/files/task-brief.html/versions`);
  expect((await history.json()).versions).toHaveLength(1);
  expect((await page.request.delete(`/api/projects/${id}`)).ok()).toBe(true);
});

test('[P2] damaged Brief recovery keeps a backup and restores editing explicitly', async ({ page }, info) => {
  await applyStandardMocks(page); await page.setViewportSize({ width: 1280, height: 800 });
  const id = `m1-draft-${randomUUID()}`;
  const created = await page.request.post('/api/projects', { data: { id, name: 'Brief draft recovery', skillId: null, designSystemId: null } });
  expect(created.ok()).toBe(true);
  const { conversationId } = await created.json();
  const key = `od:composer-draft:mokina-business:${JSON.stringify(['none', id, conversationId])}:brief`;
  await page.goto(`/projects/${id}`);
  await expect(page.getByTestId('chat-composer-input')).toBeEditable({ timeout: T.long });
  await page.evaluate(key => localStorage.setItem(key, '{damaged draft bytes'), key);
  await page.reload();
  await page.getByRole('button', { name: 'Materials', exact: true }).click();
  const panel = page.getByTestId('mokina-business-brief'); await panel.locator('summary').first().click();
  await expect(panel.getByRole('alert')).toBeVisible();
  await info.attach('damaged-before-1280x800', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  await panel.getByRole('button', { name: 'Back up damaged draft and rebuild', exact: true }).click();
  await expect(panel.getByLabel('Goal', { exact: true })).toBeEditable();
  const retained = await page.evaluate(key => Object.keys(localStorage).filter(item => item.startsWith(key + ':unreadable:')).map(item => localStorage.getItem(item)), key);
  expect(retained).toEqual(['{damaged draft bytes']);
  await panel.getByLabel('Goal', { exact: true }).fill('恢复后继续准备，不自动开始制作');
  await info.attach('recovered-after-1280x800', { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  expect((await page.request.delete(`/api/projects/${id}`)).ok()).toBe(true);
});

for (const width of [1280, 900]) test(`[P1] M2 freezes evidence across source replacement and shows selected-version issues at ${width}`, async ({ page }, info) => {
  test.setTimeout(T.xlong);
  const { createHash } = await import('node:crypto');
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  await applyStandardMocks(page); await page.setViewportSize({ width, height: width === 1280 ? 800 : 600 });
  const id = `m2-${randomUUID()}`;
  let releaseHeldRead = () => {};
  expect((await page.request.post('/api/projects', { data: { id, name: 'M2 版本依据验收', skillId: null, designSystemId: null, metadata: { kind: 'prototype' } } })).ok()).toBe(true);
  try {
    const csv = 'id,amount,unit\noriginal,100,CNY';
    const body = '<html><body><section id="budget" data-mokina-id="budget"><h1>预算</h1><table data-mokina-budget data-budget-limit="1000" data-capacity-hours="5"><tr data-budget-item><td data-quantity>2</td><td data-unit-price>300</td><td data-amount>700</td><td data-hours>6</td></tr></table></section></body></html>';
    const put = async (name: string, content: string) => expect((await page.request.post(`/api/projects/${id}/files`, { data: { name, content } })).ok()).toBe(true);
    await put('sales.csv', csv); await put('plan.html', body);
    const open = async () => { await page.goto(`/projects/${id}/files/plan.html`); await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long }); await page.getByRole('button', { name: 'Versions', exact: true }).click(); };
    await open();
    await expect(page.getByTestId('mokina-version-quality')).toContainText('Not checked', { timeout: T.long });
    await info.attach(`m2-before-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    const declaration = { schema: 'mokina.evidence.v1', sources: [{ id: 'sales', path: 'sales.csv', sha256: sha(csv), kind: 'data', locator: 'all rows', limitation: 'synthetic data', sectionId: 'budget', csv: { id: 'id', amount: 'amount', unit: 'unit' } }] };
    await put('plan.html', body.replace('</body>', `<script id="mokina-evidence" type="application/json">${JSON.stringify(declaration)}</script></body>`));
    const versions = await (await page.request.get(`/api/projects/${id}/files/plan.html/versions?readOnly=true`)).json();
    const fixed = versions.versions.find((v: { current: boolean }) => v.current);
    await put('sales.csv', 'id,amount,unit\nreplacement,999,CNY');
    let failRead = true;
    const versionUrl = `**/api/projects/${id}/files/plan.html/versions/${fixed.id}`;
    await page.route(versionUrl, route => failRead ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"temporary read failure"}}' }) : route.continue());
    await open();
    await expect(page.getByTestId('mokina-version-quality')).toContainText('Record unavailable', { timeout: T.long });
    await info.attach(`r7-read-failure-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    failRead = false;
    await page.getByTestId('mokina-version-quality').locator('summary').first().click();
    await page.getByRole('button', { name: 'Read quality record again', exact: true }).click();
    const panel = page.getByTestId('mokina-version-quality'); await expect(panel).toContainText('Issues found', { timeout: T.long });
    await expect(panel).toContainText('BUDGET_LINE'); await expect(panel).toContainText('CAPACITY_EXCEEDED');
    await panel.getByText('sales · data · sales.csv', { exact: true }).click();
    await expect(panel.locator('pre')).toContainText('original,100,CNY');
    await expect(panel).not.toContainText('replacement,999');
    await info.attach(`m2-after-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    const response = await page.request.post(`/api/projects/${id}/export/html`, { data: { fileName: 'plan.html', versionId: fixed.id, title: 'Evidence export' } });
    expect(response.ok()).toBe(true);
    const exported = await response.text();
    expect(exported).toContain('original,100,CNY');
    expect(exported).not.toContain('replacement,999');
    await panel.getByRole('button', { name: 'Locate chapter budget' }).first().click();
    await expect(page.locator('.artifact-version-panel')).toHaveAttribute('data-mokina-task', 'versions');
    await expect(page.frameLocator('.artifact-version-panel__preview iframe').locator('#budget')).toHaveAttribute('data-mokina-located', 'true');
    await info.attach(`r6-located-current-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await expect(panel.getByRole('button', { name: 'Revise this chapter', exact: true })).toBeVisible();
    // Real API creates a later current version and a candidate; all three use
    // uncached reads after navigation, so live-source seeding cannot mask R7.
    await put('sales.csv', csv);
    const declared = body.replace('</body>', `<script id="mokina-evidence" type="application/json">${JSON.stringify(declaration)}</script></body>`);
    await put('plan.html', declared.replace('预算', '当前预算'));
    const list = await (await page.request.get(`/api/projects/${id}/files/plan.html/versions?readOnly=true`)).json();
    const current = list.versions.find((v: { current: boolean }) => v.current);
    const created = await page.request.post(`/api/projects/${id}/files/plan.html/candidates`, { data: {
      baseVersionId: current.id, sectionId: 'budget', replacementHtml: body.match(/<section[\s\S]*<\/section>/)![0].replace('预算', '候选预算'), operationId: randomUUID(), prompt: 'candidate inspection',
    } });
    expect(created.ok()).toBe(true); const candidate = (await created.json()).version;
    const unavailable = new Set([fixed.id, current.id, candidate.id]);
    await page.unroute(versionUrl);
    await page.route(`**/api/projects/${id}/files/plan.html/versions/*`, route => {
      const versionId = new URL(route.request().url()).pathname.split('/').pop()!;
      return unavailable.has(versionId) ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"temporary read failure"}}' }) : route.continue();
    });
    const inspectionWrites: string[] = [];
    const trackWrite = (request: Pick<import('@playwright/test').Request, 'url' | 'method'>) => {
      // Preview HTML is a read-only POST; navigation also persists workspace tabs.
      // Neither may create a run or mutate artifact/version content.
      const pathname = new URL(request.url()).pathname;
      const previewRead = request.method() === 'POST' && pathname === `/api/projects/${id}/export/html`;
      const tabState = request.method() === 'PUT' && pathname === `/api/projects/${id}/tabs`;
      const globalCreation = request.method() === 'POST' && (pathname === '/api/runs' || pathname === '/api/projects');
      const projectMutation = pathname.startsWith(`/api/projects/${id}/`) && !['GET', 'HEAD'].includes(request.method()) && !previewRead && !tabState;
      if (globalCreation || projectMutation) inspectionWrites.push(request.method() + ' ' + request.url());
    };
    // Check the actual collector before relying on its zero-write result.
    // These are synthetic callbacks only: no project/run is created on the server.
    const collectorCases = [
      ['POST', '/api/runs', true],
      ['POST', '/api/projects', true],
      ['POST', `/api/projects/${id}/files`, true],
      ['POST', `/api/projects/${id}/export/html`, false],
      ['PUT', `/api/projects/${id}/tabs`, false],
      ['DELETE', `/api/projects/${id}/tabs`, true],
      ['GET', '/api/runs', false],
      ['GET', '/api/projects', false],
    ] as const;
    for (const [method, pathname, captured] of collectorCases) {
      const url = new URL(pathname, page.url()).href;
      trackWrite({ method: () => method, url: () => url });
      expect(inspectionWrites, `${method} ${pathname}: collector coverage`).toEqual(captured ? [`${method} ${url}`] : []);
      inspectionWrites.length = 0;
    }
    page.on('request', trackWrite);
    await open();
    for (const [label, version] of [['current', current], ['candidate', candidate], ['history', fixed]] as const) {
      await page.getByRole('option').filter({ has: page.getByText(`v${version.version}`, { exact: true }) }).click();
      await expect(panel).toContainText('Record unavailable');
      await expect(page.frameLocator('.artifact-version-panel__preview iframe').locator('#budget')).toBeVisible();
      if (!(await panel.evaluate(el => (el as HTMLDetailsElement).open))) await panel.locator('summary').first().click();
      await info.attach(`r7-${label}-failed-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      unavailable.delete(version.id);
      await panel.getByRole('button', { name: 'Read quality record again', exact: true }).click();
      await expect(panel).toContainText(version.id);
      await panel.getByRole('button', { name: 'Locate chapter budget' }).first().click();
      await expect(page.frameLocator('.artifact-version-panel__preview iframe').locator('#budget')).toHaveAttribute('data-mokina-located', 'true');
      await expect(page.locator('.artifact-version-panel')).toHaveAttribute('data-mokina-task', 'versions');
      await info.attach(`r6-${label}-located-${width}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    }
    // Delay one old-version read, switch to another version, then release it.
    // The late result may warm its own cache but must not change the selection.
    let oldStarted = false;
    const held = new Promise<void>(resolve => { releaseHeldRead = resolve; });
    await page.route(versionUrl, async route => { oldStarted = true; await held; await route.continue(); });
    await open();
    await page.getByRole('option').filter({ has: page.getByText(`v${fixed.version}`, { exact: true }) }).click();
    await expect.poll(() => oldStarted, { message: 'Delayed historical read must reach the interceptor' }).toBe(true);
    await page.getByRole('option').filter({ has: page.getByText(`v${candidate.version}`, { exact: true }) }).click({ timeout: T.short });
    await expect(panel).toContainText(candidate.id);
    const late = page.waitForResponse(response => response.url().endsWith(`/versions/${fixed.id}`));
    releaseHeldRead(); await late;
    await expect(panel).toContainText(candidate.id); await expect(panel).not.toContainText(fixed.id);
    expect(inspectionWrites, 'inspection, retry and locating never write or create runs').toEqual([]);
    page.off('request', trackWrite);
    const other = `m2-other-${randomUUID()}`;
    expect((await page.request.post('/api/projects', { data: { id: other, name: 'Other project', skillId: null, designSystemId: null } })).ok()).toBe(true);
    try {
      expect((await page.request.post(`/api/projects/${other}/files`, { data: { name: 'plan.html', content: '<html><body>Other project</body></html>' } })).ok()).toBe(true);
      await page.goto(`/projects/${other}/files/plan.html`);
      await expect(page.getByTestId('file-workspace')).toBeVisible({ timeout: T.long });
      await page.getByRole('button', { name: 'Versions', exact: true }).click();
      await expect(panel).toContainText('Not checked'); await expect(panel).not.toContainText(candidate.id);
    } finally { expect((await page.request.delete(`/api/projects/${other}`)).ok()).toBe(true); }

  } finally { releaseHeldRead(); expect((await page.request.delete(`/api/projects/${id}`)).ok()).toBe(true); }
});
