import { mokinaWebOperationId, parseCaptureMokinaWebEvidenceRequest, parseMokinaWebCaptureReceipt, type MokinaWebCaptureResult } from '@open-design/contracts';
import { flushDurableRecord, mirrorDurableRecord } from '../persistence/mokina-recovery-store';
import { mokinaBytesDigest } from './digest';

export type WebEvidenceDraft = { schema: 1; request: { operationId: string; url: string }; state: 'draft' | 'unknown' | 'saved' };
export const webEvidenceDraftKey = (scope: string) => `od:composer-draft:mokina-web-evidence:${scope}`;
/** Structured draft/closure failures the UI renders with localized copy. */
export type WebEvidenceFailure = 'cas-conflict' | 'not-durable' | 'reply-mismatch' | 'request-mismatch';
export class WebEvidenceDraftError extends Error {
  constructor(readonly reason: WebEvidenceFailure, message: string) { super(message); }
}
export function parseWebEvidenceDraft(raw: string | null): WebEvidenceDraft | null {
  if (raw === null) return null;
  const value = JSON.parse(raw) as WebEvidenceDraft;
  if (!value || value.schema !== 1 || !['draft', 'unknown', 'saved'].includes(value.state)
    || !value.request || typeof value.request.url !== 'string' || value.request.url.length > 4096) throw new Error('Unreadable web evidence draft');
  mokinaWebOperationId(value.request.operationId);
  if (value.state !== 'draft') parseCaptureMokinaWebEvidenceRequest(value.request);
  return value;
}
export async function persistWebEvidenceDraft(key: string, value: WebEvidenceDraft, expectedRaw: string | null): Promise<string> {
  if (localStorage.getItem(key) !== expectedRaw) throw new WebEvidenceDraftError('cas-conflict', 'Another window changed this draft. Read it before continuing.');
  const raw = JSON.stringify(value); localStorage.setItem(key, raw);
  if (!await mirrorDurableRecord(key, raw) || !await flushDurableRecord(key)) throw new WebEvidenceDraftError('not-durable', 'The draft has not been durably saved. Keep your input and retry.');
  return raw;
}
export async function validateWebCaptureReply(value: unknown, request: WebEvidenceDraft['request']): Promise<MokinaWebCaptureResult> {
  const row = value as MokinaWebCaptureResult;
  if (!row || typeof row !== 'object' || row.fileName !== `evidence/web-${request.operationId}.md`
    || typeof row.versionId !== 'string' || !/^[A-Za-z0-9_-]+$/u.test(row.versionId)
    || typeof row.content !== 'string' || !['matched', 'missing', 'changed'].includes(row.workingFile)
    || !row.material || row.material.name !== row.fileName || !Array.isArray(row.material.sections)
    || row.material.contentDigest !== row.contentDigest || row.material.sourceVersionId !== row.versionId) throw new WebEvidenceDraftError('reply-mismatch', 'Web capture response identity mismatch');
  const receipt = parseMokinaWebCaptureReceipt(row.receipt);
  if (receipt.operationId !== request.operationId || receipt.requestedUrl !== parseCaptureMokinaWebEvidenceRequest(request).url
    || await mokinaBytesDigest(new TextEncoder().encode(row.content).buffer) !== row.contentDigest) throw new WebEvidenceDraftError('request-mismatch', 'Web capture response does not match this request');
  return { ...row, receipt };
}
