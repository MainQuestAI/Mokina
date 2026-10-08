import { expect, test } from '@/playwright/suite';
import { applyStandardMocks, routeSuccessfulRuns } from '@/playwright/mock-factory';
import { T } from '@/timeouts';
test.beforeEach(async ({ page }) => { await applyStandardMocks(page); });

for (const outcome of ['ready', 'failed', 'leave', 'reload'] as const) {
  test(`[P1] Mokina T31 home preparation ${outcome} gates the original send`, async ({ page }, testInfo) => {
    const started = Date.now();
    const timeline: Array<Record<string, unknown>> = [];
    const relevant = (url: string) => /\/api\/projects|\/api\/runs|\/preview/.test(url);
    page.on('request', request => { if (relevant(request.url())) timeline.push({ ms: Date.now() - started, event: 'request', method: request.method(), path: new URL(request.url()).pathname }); });
    page.on('response', response => { if (relevant(response.url())) timeline.push({ ms: Date.now() - started, event: 'response', status: response.status(), path: new URL(response.url()).pathname }); });
    page.on('requestfailed', request => { if (relevant(request.url())) timeline.push({ ms: Date.now() - started, event: 'requestfailed', path: new URL(request.url()).pathname, error: request.failure()?.errorText }); });
    const runs = await routeSuccessfulRuns(page);
    let release!: () => void;
    let posted: Record<string, unknown> | null = null;
    let targetId = '';
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/mokina/context-snapshots', async route => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      posted = route.request().postDataJSON();
      targetId = new URL(route.request().url()).pathname.split('/')[3]!;
      await gate;
      if (outcome === 'failed') await route.fulfill({ status: 403, json: { error: 'Input preparation denied' } });
      else await route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('home-hero-input').fill('仅按所选 CSV 计算总金额，不添加其他资料。');
    await page.getByTestId('home-hero-file-input').setInputFiles({ name: 'budget.csv', mimeType: 'text/csv', buffer: Buffer.from('channel,amount\nsearch,100\nstore,200') });
    await page.getByLabel('budget.csv Mokina 用途').selectOption('material');
    await page.getByTestId('home-hero-submit').click();
    try {
      await expect.poll(() => posted, { timeout: T.long }).not.toBeNull();
      await runs.expectNone();
      if (outcome === 'leave') await page.getByRole('button', { name: 'Home', exact: true }).click();
      if (outcome === 'reload') await page.goto('/', { waitUntil: 'domcontentloaded' });
      release();
      if (outcome === 'ready') {
        await runs.expectCount(1);
        const body = runs.bodies[0]!;
        expect(JSON.stringify(body)).toContain(posted!.snapshotId);
        expect(body.attachments ?? []).toEqual([]);
        const read = await page.request.get(`/api/projects/${targetId}/mokina/context-snapshots/${posted!.snapshotId}`);
        expect(read.ok()).toBe(true);
        expect((await read.json()).snapshot.items[0].text).toBe('channel,amount\n\nsearch,100\n\nstore,200');
      } else if (outcome === 'failed') {
        await expect(page.getByTestId('mokina-home-preparation')).toContainText('Input preparation denied');
        await runs.expectNone();
      } else {
        await expect(page.getByTestId('home-hero-input')).toBeVisible();
        await runs.expectNone();
        if (outcome === 'leave') await expect.poll(() => page.evaluate(projectId => Object.keys(localStorage)
          .filter(key => key.startsWith('od:composer-draft:mokina-home:')).map(key => JSON.parse(localStorage.getItem(key)!))
          .find(row => row.projectId === projectId)?.status, targetId)).toBe('ready');
        await page.goto(`/projects/${targetId}`, { waitUntil: 'domcontentloaded' });
        // A full navigation terminates the old renderer promise. Its durable
        // preparation record survives; explicit recovery retains the same snapshot identity.
        if (outcome === 'reload') await page.getByRole('button', { name: 'Retry input preparation' }).click();
        await expect(page.getByTestId('mokina-home-preparation')).toContainText('Materials are fixed');
        await runs.expectNone();
      }
      await testInfo.attach(`input-${outcome}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    } finally {
      release();
      timeline.push({ ms: Date.now() - started, event: 'final-state', path: new URL(page.url()).pathname, preparation: await page.evaluate(() => document.querySelector('[data-testid="mokina-home-preparation"]')?.textContent ?? null).catch(() => null), runs: runs.bodies.length });
      await testInfo.attach(`request-state-timeline-${outcome}`, { body: JSON.stringify(timeline, null, 2), contentType: 'application/json' });
    }
  });
}

test('[P1] Mokina keeps file purpose after reload but requires file reselection', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('home-hero-file-input').setInputFiles({ name: 'kept.csv', mimeType: 'text/csv', buffer: Buffer.from('amount\n42') });
  await page.getByLabel('kept.csv Mokina 用途').selectOption('material');
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('od:composer-draft:mokina-staged:'))
    .map(key => JSON.parse(localStorage.getItem(key)!).inputs).flat().find(item => item.name === 'kept.csv')?.plan?.kind)).toBe('material');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const notice = page.getByTestId('mokina-missing-inputs');
  await expect(notice).toContainText('kept.csv');
  await expect(notice).toContainText('their bytes could not be restored');
  await notice.locator('input[type=file]').setInputFiles({ name: 'kept.csv', mimeType: 'text/csv', buffer: Buffer.from('amount\n42') });
  await expect(notice).toHaveCount(0);
  await expect(page.getByLabel('kept.csv Mokina 用途')).toHaveValue('material');
});

test('[P1] Mokina retains staged input when the initial preparation save fails and retries the same target', async ({ page }) => {
  const runs = await routeSuccessfulRuns(page);
  const createdIds: string[] = [];
  let uploads = 0;
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' && path === '/api/projects') createdIds.push(request.postDataJSON().id);
    if (request.method() === 'POST' && path.endsWith('/upload')) uploads++;
  });
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('od:composer-draft:mokina-home:') && !sessionStorage.getItem('mokina-test-preparation-failed')) {
        sessionStorage.setItem('mokina-test-preparation-failed', '1');
        throw new Error('Injected initial preparation write failure');
      }
      return original.call(this, key, value);
    };
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('home-hero-input').fill('只根据本次资料计算金额。');
  await page.getByTestId('home-hero-file-input').setInputFiles({ name: 'preserved.csv', mimeType: 'text/csv', buffer: Buffer.from('amount\n42') });
  await page.getByLabel('preserved.csv Mokina 用途').selectOption('material');
  const readStaged = () => page.evaluate(() => Object.keys(localStorage)
    .filter(key => key.startsWith('od:composer-draft:mokina-staged:'))
    .flatMap(key => JSON.parse(localStorage.getItem(key)!).inputs));
  await expect.poll(readStaged).toMatchObject([{ name: 'preserved.csv', plan: { kind: 'material' } }]);
  const originalInput = await readStaged();
  await page.getByTestId('home-hero-submit').click();
  await expect(page.getByRole('alert').filter({ hasText: '资料准备记录保存失败' })).toBeVisible();
  expect(await readStaged()).toEqual(originalInput);
  expect(createdIds).toHaveLength(1);
  expect(uploads).toBe(0);
  await runs.expectNone();
  await page.getByRole('button', { name: 'Retry input preparation', exact: true }).click();
  await runs.expectCount(1);
  expect(createdIds).toHaveLength(1);
  expect(new URL(page.url()).pathname.split('/')[2]).toBe(createdIds[0]);
  expect(uploads).toBe(1);
  await expect.poll(readStaged).toEqual([]);
  const context = runs.bodies[0]!.context as { mokinaSnapshotId: string };
  const snapshot = await page.request.get(`/api/projects/${createdIds[0]}/mokina/context-snapshots/${context.mokinaSnapshotId}`);
  expect(snapshot.ok()).toBe(true);
  expect((await snapshot.json()).snapshot.items[0].text).toBe('amount\n\n42');
});
