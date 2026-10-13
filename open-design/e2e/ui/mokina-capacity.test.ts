import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, expect } from '@/playwright/suite';
import { applyStandardMocks } from '@/playwright/mock-factory';
import { openSettingsDialog } from '@/playwright/amr';
// Actual built persistence authority; only the Electron transport is adapted for Chromium.
const { createMokinaRecoveryStore } = await import(new URL('../../apps/desktop/dist/main/mokina-recovery-store.js', import.meta.url).href);
for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 600 }]) {
  test(`[P1] recovery capacity, failure and restart at ${viewport.width}`, async ({ page }, info) => {
    const root = await mkdtemp(join(tmpdir(), 'mokina-capacity-ui-'));
    let store = createMokinaRecoveryStore(root);
    try {
      for (let i = 0; i < 512; i++) {
        await store.put(`mokina:capacity:${i}`, { recordId: `r${i}`, value: '未完成草稿' });
        if (i < 500) await store.delete(`mokina:capacity:${i}`, `r${i}`);
      }
      let fail = true;
      await page.exposeFunction('capacityRead', async () => {
        if (fail) return { ok: false, reason: 'read-failed' };
        return store.status();
      });
      await page.exposeFunction('capacityCompact', () => store.compact());
      await applyStandardMocks(page);
      await page.addInitScript(() => {
        const scope = window as unknown as Record<string, any>;
        const ok = async () => ({ ok: true });
        const updater = async () => ({ supported: false, enabled: false, state: 'idle', platform: 'test', arch: 'arm64', currentVersion: '0.0.4-local.7', capabilities: {} });
        scope.__od__ = { version: 2, client: { type: 'desktop', platform: 'test' },
          shell: { openExternal: ok, openPath: ok }, browser: { clearData: ok }, capture: { page: ok },
          project: { pickAndImport: ok, pickAndReplaceWorkingDir: ok }, pdf: { print: ok }, pet: { setVisible() {} },
          updater: { status: updater, check: updater, 'clear-cache': updater, download: updater, install: updater,
            quit: ok, setMenuLabels: ok, subscribe: () => () => {}, subscribeOpenDialog: () => () => {} },
          recoveryStore: { status: () => scope.capacityRead(), compact: () => scope.capacityCompact(),
            get: async () => ({ ok: true, found: false }), list: async () => ({ ok: true, keys: [] }) },
        };
      });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      const dialog = await openSettingsDialog(page);
      await dialog.getByRole('button', { name: 'About', exact: true }).click();
      if (process.env.MOKINA_CAPACITY_BASELINE === '1') {
        await expect(page.getByTestId('mokina-recovery-capacity')).toHaveCount(0);
        await page.screenshot({ path: info.outputPath('before.png') });
        return;
      }
      const panel = page.getByTestId('mokina-recovery-capacity');
      await expect(panel.getByRole('alert')).toContainText('read-failed');
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('read-failure.png') });
      fail = false;
      await panel.getByRole('button', { name: 'Read again' }).click();
      await expect(panel).toContainText('Active 12 / 512');
      await panel.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('after.png') });
      await panel.getByRole('button', { name: 'Compact deleted records' }).click();
      await panel.getByRole('button', { name: 'Confirm compaction' }).focus();
      await page.keyboard.press('Enter');
      await expect(panel).toContainText('Archived witnesses 500');
      expect(await store.put('mokina:capacity:new', { recordId: 'new', value: 'new draft' })).toMatchObject({ ok: true, result: 'stored' });
      store = createMokinaRecoveryStore(root);
      await page.reload();
      await page.getByRole('button', { name: 'About', exact: true }).click();
      await expect(panel).toContainText('Active 13 / 512');
      await expect(panel).toContainText('Archived witnesses 500');
      expect(await store.put('mokina:capacity:0', { recordId: 'stale', value: 'deleted content' })).toMatchObject({ ok: true, result: 'conflict' });
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}
