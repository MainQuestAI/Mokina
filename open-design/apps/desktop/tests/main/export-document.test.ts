import { runInNewContext } from 'node:vm';
import type { BrowserWindow } from 'electron';
import { expect, it, vi } from 'vitest';
import { loadExportDocument } from '../../src/main/export-document.js';

it('transports large escaped HTML intact on an opaque origin and releases its Blob on load failure', async () => {
  const html = '<html><body>' + '<&中文'.repeat(100_000) + '</body></html>';
  const created: Blob[] = []; const revoked: string[] = [];
  const loadURL = vi.fn(async (_url: string) => {});
  const window = { loadURL, isDestroyed: () => false, webContents: {
    executeJavaScript: async (script: string) => runInNewContext(script, { Blob, URL: {
      createObjectURL: (blob: Blob) => { created.push(blob); return 'blob:null/fixture'; },
      revokeObjectURL: (url: string) => revoked.push(url),
    } }),
  } } as unknown as BrowserWindow;
  const failingLoad = vi.fn(async () => { throw new Error('load failed'); });
  await expect(loadExportDocument(window, html, failingLoad)).rejects.toThrow('load failed');
  expect(loadURL.mock.calls[0]?.[0]).not.toContain(html);
  expect(failingLoad).toHaveBeenCalledWith('blob:null/fixture');
  expect(await created[0]!.text()).toBe(html);
  expect(revoked).toEqual(['blob:null/fixture']);
});
