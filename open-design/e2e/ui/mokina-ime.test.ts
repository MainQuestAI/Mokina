import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { T } from '@/timeouts';

test('[P1] Mokina keeps an active Chinese composition on Enter without creating or sending', async ({ page }) => {
  await applyStandardMocks(page);
  await page.goto('/');
  const input = page.getByTestId('home-hero-input');
  await expect(input).toBeVisible({ timeout: T.long });
  await input.click();
  const writes: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/(projects|runs)$/.test(new URL(request.url()).pathname)) writes.push(request.url());
  });
  // Chromium's IME pipeline, rather than jsdom composition event stubs.
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.imeSetComposition', { text: '中国市场', selectionStart: 4, selectionEnd: 4 });
    await expect(input).toContainText('中国市场');
    await input.press('Enter');
    await expect(input).toContainText('中国市场');
    await expect(page).toHaveURL(/\/$/);
    expect(writes).toEqual([]);
  } finally { await cdp.detach(); }
});
