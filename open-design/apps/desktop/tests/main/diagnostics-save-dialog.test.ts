import { sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

// Regression for AppHangB1 on Windows: the diagnostics export used to seed the
// Save dialog with `join(app.getPath("downloads"), filename)`, opening the
// native dialog *inside* Downloads. When Downloads is OneDrive-backed the
// shell's folder-type discovery + cloud-provider status enumeration can stall
// the dialog's UI thread long enough for Windows to flag the owner window
// "not responding". The fix seeds only a bare filename and opts out of shell
// recent-items writes; this test locks both.
const { showSaveDialog } = vi.hoisted(() => ({
  showSaveDialog: vi.fn(
    async (_options: { title: string; defaultPath: string; properties?: string[] }) => ({
      canceled: true as const,
      filePath: undefined,
    }),
  ),
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn(() => null) },
  app: { getPath: vi.fn(() => `${sep}home${sep}user${sep}Downloads`) },
  dialog: { showSaveDialog },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
}));

import { exportDiagnosticsToFile } from "../../src/main/diagnostics.js";

describe("exportDiagnosticsToFile save dialog", () => {
  it.each([
    { product: null, title: 'Export OpenDesign diagnostics' },
    { product: { productId: 'mokina' as const }, title: 'Export Mokina diagnostics' },
  ])("seeds a bare filename and the correct product title: $title", async ({ product, title }) => {
    showSaveDialog.mockClear();
    const result = await exportDiagnosticsToFile(
      { discoverDaemonBaseUrl: vi.fn(), product },
      null,
    );

    // Canceled dialog short-circuits before any daemon fetch.
    expect(result).toEqual({ ok: false, cancelled: true });
    expect(showSaveDialog).toHaveBeenCalledTimes(1);

    const opts = showSaveDialog.mock.calls[0]![0];
    expect(opts.title).toBe(title);
    expect(opts.defaultPath).not.toContain(sep);
    expect(opts.defaultPath).not.toContain("Downloads");
    expect(opts.properties).toContain("dontAddToRecent");
  });
});
