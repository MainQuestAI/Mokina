import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { mokinaCrashHtml, mokinaPendingHtml } from '../../src/main/mokina-splash.js';

const html = (url: string) => decodeURIComponent(url.slice(url.indexOf(',') + 1));
it('boots offline with a static inline candidate and actual stage updates', () => {
  const page = html(mokinaPendingHtml());
  expect(page).toContain('aria-label="Mokina"');
  expect(page).toContain('Starting Mokina');
  expect(page).toContain('window.__odSplashSetStage');
  expect(page).not.toMatch(/requestAnimationFrame|WebGL|<canvas|animation:|(?:src|href)="https?:\/\//);
  // The SVG namespace is metadata, not an external dependency.
});
it('retains local crash diagnostics without reachable upstream reporting', () => {
  const page = html(mokinaCrashHtml());
  expect(page).toContain('exportDiagnostics');
  expect(page).not.toMatch(/openExternal|mailto:|github\.com|OpenDesignHQ/);
});

for (const outcome of ['success', 'failure', 'cancel', 'reject', 'throw'] as const) {
  it(`shows diagnostics progress and ${outcome}, then restores the button`, async () => {
    const statusEl = { textContent: '' };
    const logs = { disabled: false, hidden: false, onclick: undefined as undefined | (() => void) };
    let resolve!: (value: unknown) => void;
    let reject!: (reason: Error) => void;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    const scope = { document: { getElementById: (id: string) => id === 'logs' ? logs : statusEl },
      openDesignDesktop: { exportDiagnostics: () => { if (outcome === 'throw') throw new Error('IPC'); return pending; } } };
    // Window.status is a string property, including assignment coercion.
    Object.defineProperty(scope, 'status', { get: () => '', set: () => {}, configurable: true });
    const context = { ...scope, window: scope };
    Object.defineProperty(context, 'status', { get: () => '', set: () => {}, configurable: true });
    const script = html(mokinaCrashHtml()).match(/<script>([\s\S]*?)<\/script>/)![1]!;
    runInNewContext(script, context);
    logs.onclick!();
    expect(logs.disabled).toBe(true);
    expect(statusEl.textContent).toBe('Saving logs…');
    await Promise.resolve();
    if (outcome === 'reject') reject(new Error('IPC'));
    else resolve(outcome === 'success' ? { ok: true } : outcome === 'cancel' ? { cancelled: true } : { ok: false });
    // Drain the handler's complete promise chain, not a wall-clock delay.
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(statusEl.textContent).toBe(outcome === 'success' ? 'Logs saved.' : outcome === 'cancel' ? '' : 'Could not save logs.');
    expect(logs.disabled).toBe(false);
  });
}
