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
