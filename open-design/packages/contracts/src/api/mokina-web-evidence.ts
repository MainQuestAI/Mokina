import { isBlockedExternalApiHostname, isLoopbackApiHost } from './connectionTest.js';

/** A daemon retrieval receipt, not a signature or an assessment of factual truth. */
export interface MokinaWebCaptureReceipt {
  schema: 'mokina.web-evidence.v1';
  operationId: string;
  requestedUrl: string;
  resolvedUrl: string;
  retrievedAt: string;
  statusCode: number;
  contentType: 'text/plain' | 'text/html' | 'text/markdown';
  bodyDigest: string;
  textDigest: string;
  parserVersion: string;
  scope: 'plain-text' | 'static-html-text';
  limitations: string[];
}
export interface CaptureMokinaWebEvidenceRequest { operationId: string; url: string }
export interface MokinaWebCaptureResult {
  fileName: string;
  versionId: string;
  contentDigest: string;
  content: string;
  receipt: MokinaWebCaptureReceipt;
  material: import('./files.js').ProjectMaterialExtraction;
  /** The fixed version is saved even if materializing its working file failed. */
  workingFile: 'matched' | 'missing' | 'changed';
}
export function mokinaWebOperationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(value)) throw new Error('Invalid web evidence operation ID');
  return value;
}
export function mokinaPublicWebUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) throw new Error('A public HTTP(S) page URL is required');
  const url = new URL(value.trim());
  const host = url.hostname.replace(/^\[|\]$/gu, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || isLoopbackApiHost(host) || isBlockedExternalApiHostname(host) || /^ff[0-9a-f]{2}:/u.test(host)) {
    throw new Error('Only public HTTP(S) pages without URL credentials are supported');
  }
  url.hash = '';
  return url.href;
}
export function parseCaptureMokinaWebEvidenceRequest(value: unknown): CaptureMokinaWebEvidenceRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected web evidence request');
  const raw = value as Record<string, unknown>;
  return { operationId: mokinaWebOperationId(raw.operationId), url: mokinaPublicWebUrl(raw.url) };
}
export function parseMokinaWebCaptureReceipt(value: unknown): MokinaWebCaptureReceipt {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid web capture receipt');
  const raw = value as Record<string, unknown>;
  const request = parseCaptureMokinaWebEvidenceRequest({ operationId: raw.operationId, url: raw.requestedUrl });
  const resolvedUrl = mokinaPublicWebUrl(raw.resolvedUrl);
  const digest = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/u.test(v);
  if (raw.schema !== 'mokina.web-evidence.v1' || !digest(raw.bodyDigest) || !digest(raw.textDigest)
    || typeof raw.retrievedAt !== 'string' || !Number.isFinite(Date.parse(raw.retrievedAt))
    || typeof raw.statusCode !== 'number' || !Number.isInteger(raw.statusCode) || raw.statusCode < 200 || raw.statusCode >= 300
    || !['text/plain', 'text/html', 'text/markdown'].includes(String(raw.contentType))
    || !['plain-text', 'static-html-text'].includes(String(raw.scope))
    // Only the HTML extractor yields static-html-text; plain text and
    // markdown both record the limited plain-text scope.
    || (raw.contentType === 'text/html') !== (raw.scope === 'static-html-text')
    || typeof raw.parserVersion !== 'string' || !raw.parserVersion || raw.parserVersion.length > 100
    || !Array.isArray(raw.limitations) || !raw.limitations.length || raw.limitations.length > 8
    || raw.limitations.some(v => typeof v !== 'string' || !v || v.length > 2000)) throw new Error('Invalid web capture receipt fields');
  return { schema: 'mokina.web-evidence.v1', operationId: request.operationId, requestedUrl: request.url, resolvedUrl,
    retrievedAt: raw.retrievedAt, statusCode: raw.statusCode, contentType: raw.contentType as MokinaWebCaptureReceipt['contentType'],
    bodyDigest: raw.bodyDigest as string, textDigest: raw.textDigest as string, parserVersion: raw.parserVersion,
    scope: raw.scope as MokinaWebCaptureReceipt['scope'], limitations: raw.limitations as string[] };
}
