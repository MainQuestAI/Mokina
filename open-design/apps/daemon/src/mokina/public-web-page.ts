import { load } from 'cheerio';
import { parseCaptureMokinaWebEvidenceRequest, type CaptureMokinaWebEvidenceRequest, type MokinaWebCaptureReceipt } from '@open-design/contracts';
import { fetchExternalBrandAsset } from '../brands/safe-fetch.js';
import { renderWebEvidenceDocument, webEvidenceDigest } from './web-evidence-document.js';

export class WebEvidenceError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 502) { super(message); }
}
/** Anonymous, bounded static reading. No page scripts, images or nested URLs execute. */
export async function readPublicWebPage(input: CaptureMokinaWebEvidenceRequest, signal?: AbortSignal): Promise<{ content: string; receipt: MokinaWebCaptureReceipt }> {
  const request = parseCaptureMokinaWebEvidenceRequest(input);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let rejectAbort: (() => void) | undefined;
  const stopped = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new WebEvidenceError('WEB_READ_STOPPED', 'Page reading was stopped or exceeded 30 seconds. No completed evidence was saved.'));
    if (controller.signal.aborted) rejectAbort();
    else controller.signal.addEventListener('abort', rejectAbort, { once: true });
  });
  try {
    const response = await Promise.race([fetchExternalBrandAsset(request.url, { signal: controller.signal, headers: { accept: 'text/html, text/plain;q=0.9', 'user-agent': 'Mokina-WebEvidence/1' } }), stopped]);
    if (!response.ok) { await response.body?.cancel(); throw new WebEvidenceError('WEB_HTTP_ERROR', `Page returned HTTP ${response.status}; no page body was accepted as evidence.`); }
    const header = response.headers.get('content-type') ?? '';
    const mime = header.split(';')[0]?.trim().toLowerCase();
    const charset = header.match(/charset\s*=\s*["']?([^;"'\s]+)/iu)?.[1]?.toLowerCase();
    if (!['text/html', 'text/plain', 'text/markdown'].includes(mime ?? '') || (charset && !['utf-8', 'utf8'].includes(charset))) {
      await response.body?.cancel(); throw new WebEvidenceError('WEB_FORMAT_UNSUPPORTED', 'Only UTF-8 HTML or plain text pages are supported. Download other documents through the existing materials workflow.', 415);
    }
    const chunks: Buffer[] = []; let size = 0;
    reader = response.body?.getReader();
    while (reader) {
      const chunk = await Promise.race([reader.read(), stopped]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2 * 1024 * 1024) throw new WebEvidenceError('WEB_TOO_LARGE', 'Page response exceeds the 2 MiB reading limit; it was not silently truncated.', 413);
      chunks.push(Buffer.from(chunk.value));
    }
    const bytes = Buffer.concat(chunks); let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new WebEvidenceError('WEB_ENCODING_UNSUPPORTED', 'Page response is not valid UTF-8 text.', 415); }
    const html = mime === 'text/html';
    if (html) {
      const $ = load(text);
      $('script,style,noscript,template,svg,iframe,[hidden],[aria-hidden="true"]').remove();
      $('br').replaceWith('\n');
      $('p,div,li,h1,h2,h3,h4,h5,h6,section,article,tr').append('\n');
      text = $('body').text().replace(/[\t \u00a0]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim();
    }
    if (!text.trim()) throw new WebEvidenceError('WEB_EMPTY', 'No readable static text was returned. Search summaries cannot substitute for a page body.');
    const receipt: MokinaWebCaptureReceipt = { schema: 'mokina.web-evidence.v1', operationId: request.operationId,
      requestedUrl: request.url, resolvedUrl: response.url || request.url, retrievedAt: new Date().toISOString(), statusCode: response.status,
      contentType: html ? 'text/html' : 'text/plain', bodyDigest: webEvidenceDigest(bytes), textDigest: webEvidenceDigest(text), parserVersion: 'mokina-web/1',
      scope: html ? 'static-html-text' : 'plain-text', limitations: html
        ? ['Static HTML text with normalized whitespace; scripts, images, charts and authenticated or dynamically loaded content were not read.', 'Captured text and retrieval time do not verify factual truth, publication date or complete article coverage.']
        : ['Plain text response; factual truth and publication date have not been independently verified.'] };
    if (controller.signal.aborted) throw new WebEvidenceError('WEB_READ_STOPPED', 'Page reading was stopped before saving.');
    try { return { content: renderWebEvidenceDocument(receipt, text), receipt }; }
    catch { throw new WebEvidenceError('WEB_TOO_LARGE', 'Captured text and receipt exceed the 512 KiB source limit; no truncated evidence was saved.', 413); }
  } catch (error) {
    if (error instanceof WebEvidenceError) throw error;
    throw new WebEvidenceError('WEB_READ_FAILED', `Could not read the public page: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
    await reader?.cancel().catch(() => {}); reader?.releaseLock();
  }
}
