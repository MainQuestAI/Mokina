// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { MokinaQualitySnapshot } from '@open-design/contracts';
import { MokinaVersionQuality } from '../../src/components/mokina/MokinaVersionQuality';
afterEach(cleanup);
const quality: MokinaQualitySnapshot = { schema: 'mokina.quality.v1', versionId: 'v1', contentDigest: 'a'.repeat(64), fingerprint: 'b'.repeat(64), status: 'issues', sources: [], calculations: [], issues: [{ code: 'BUDGET_LINE', sectionId: 'budget', message: '2 × 300 = 600, displayed 700' }] };
it('does not show another selected version’s checks, and locates the actual issue chapter', () => {
  const onLocate = vi.fn(); const view = render(<MokinaVersionQuality quality={quality} versionId="v2" onLocate={onLocate} />);
  expect(screen.getByTestId('mokina-version-quality').textContent).toContain('Record unavailable');
  expect(screen.queryByText(/2 × 300/)).toBeNull();
  view.rerender(<MokinaVersionQuality quality={quality} versionId="v1" onLocate={onLocate} />);
  fireEvent.click(screen.getByText(/Evidence and quality/));
  fireEvent.click(screen.getByRole('button', { name: 'Locate chapter budget' }));
  expect(onLocate).toHaveBeenCalledWith('budget');
  expect(screen.getByText(/This is not approval/)).toBeTruthy();
});
it('distinguishes a missing response from an old unreviewed artifact', () => {
  const view = render(<MokinaVersionQuality versionId="v1" onLocate={() => {}} />);
  expect(screen.getByText(/Record unavailable/)).toBeTruthy();
  view.rerender(<MokinaVersionQuality quality={{ ...quality, status: 'unreviewed', issues: [] }} versionId="v1" onLocate={() => {}} />);
  expect(screen.getByText(/Not checked/)).toBeTruthy();
});

it('keeps loading and failed reads visible and retries only on explicit action', () => {
  const retry = vi.fn(); const view = render(<MokinaVersionQuality versionId="v2" quality={quality} requestState="loading" onRetry={retry} onLocate={() => {}} />);
  expect(screen.getByTestId('mokina-version-quality').textContent).toContain('Reading quality record');
  view.rerender(<MokinaVersionQuality versionId="v2" quality={quality} requestState="error" onRetry={retry} onLocate={() => {}} />);
  fireEvent.click(screen.getByText(/Evidence and quality/));
  expect(retry).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Read quality record again' }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText(/2 × 300/)).toBeNull();
});

const receipt = { schema: 'mokina.web-evidence.v1' as const, operationId: 'one', requestedUrl: 'https://example.com/a', resolvedUrl: 'https://example.com/a',
  retrievedAt: '2026-10-14T04:00:00Z', statusCode: 200, contentType: 'text/plain' as const, bodyDigest: 'c'.repeat(64), textDigest: 'd'.repeat(64),
  parserVersion: 'mokina-web/1', scope: 'plain-text' as const, limitations: ['Not a factual assessment.'] };
const webSource = (error?: string) => ({ id: 'page', path: 'evidence/web-one.md', sha256: 'e'.repeat(64), kind: 'full-text' as const,
  sectionId: 'budget', locator: 'captured plain text', limitation: 'no factual assessment', url: 'https://example.com/a',
  accessedAt: receipt.retrievedAt, versionId: 'web-v1', excerpt: 'Supported claim.', webCapture: receipt, ...(error ? { error } : {}) });

it('renders the retrieval receipt and excerpt for a verified captured source', () => {
  const snapshot = { ...quality, sources: [webSource()], issues: [], calculations: [] };
  render(<MokinaVersionQuality quality={snapshot} versionId="v1" onLocate={() => {}} />);
  fireEvent.click(screen.getByText(/Evidence and quality/));
  fireEvent.click(screen.getByText(/page · full-text/));
  expect(screen.getByText(/Public page retrieval receipt/)).toBeTruthy();
  expect(screen.getByText('https://example.com/a')).toBeTruthy();
  expect(screen.getByText(/Supported claim\./)).toBeTruthy();
  expect(screen.getByText(/Fixed source version web-v1/)).toBeTruthy();
});

it('marks a captured source that failed verification instead of reading as verified', () => {
  const snapshot = { ...quality, sources: [webSource('Supporting excerpt is not in captured text')], issues: [], calculations: [] };
  render(<MokinaVersionQuality quality={snapshot} versionId="v1" onLocate={() => {}} />);
  fireEvent.click(screen.getByText(/Evidence and quality/));
  fireEvent.click(screen.getByText(/page · full-text/));
  expect(screen.getByText(/Captured page, but this reference failed verification/)).toBeTruthy();
  expect(screen.queryByText(/Public page retrieval receipt/)).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain('Supporting excerpt');
});
