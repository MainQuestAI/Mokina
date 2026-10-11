import type { BrowserWindow } from 'electron';

/** Keep exports on an opaque origin without Chromium's data-URL length limit.
 * Large documents travel over renderer IPC into a Blob, not a URL or a local
 * file with filesystem-origin access. The render window owns the Blob lifetime.
 */
export async function loadExportDocument(
  window: BrowserWindow,
  html: string,
  load: (url: string) => Promise<unknown> = url => window.loadURL(url),
): Promise<void> {
  if (Buffer.byteLength(html, 'utf8') < 256 * 1024) {
    await load(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return;
  }
  await window.loadURL('data:text/html;charset=utf-8,<!doctype html><html></html>');
  const url: unknown = await window.webContents.executeJavaScript(
    `URL.createObjectURL(new Blob([${JSON.stringify(html)}], {type: 'text/html;charset=utf-8'}))`,
  );
  if (typeof url !== 'string' || !url.startsWith('blob:null/')) throw new Error('Export document requires an opaque Blob origin');
  try { await load(url); }
  finally {
    if (!window.isDestroyed()) await window.webContents.executeJavaScript(`URL.revokeObjectURL(${JSON.stringify(url)})`).catch(() => {});
  }
}
