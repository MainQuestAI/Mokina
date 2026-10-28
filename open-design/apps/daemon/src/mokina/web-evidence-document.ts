import { createHash } from 'node:crypto';
import { parseMokinaWebCaptureReceipt, type MokinaWebCaptureReceipt } from '@open-design/contracts';

const prefix = '# Captured web text\n\n```json\n';
const separator = '\n```\n\n';
export class WebEvidenceTooLargeError extends Error {
  constructor() { super('Web evidence exceeds 512 KiB'); }
}
export const webEvidenceDigest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function renderWebEvidenceDocument(receipt: MokinaWebCaptureReceipt, text: string): string {
  const content = prefix + JSON.stringify(parseMokinaWebCaptureReceipt(receipt), null, 2) + separator + text;
  if (webEvidenceDigest(text) !== receipt.textDigest) throw new Error('Captured web text does not match the receipt digest');
  if (Buffer.byteLength(content) > 512 * 1024) throw new WebEvidenceTooLargeError();
  return content;
}
export function readWebEvidenceDocument(content: string, expected: MokinaWebCaptureReceipt): { receipt: MokinaWebCaptureReceipt; text: string } {
  if (!content.startsWith(prefix)) throw new Error('Captured web document header missing');
  const boundary = content.indexOf(separator, prefix.length);
  if (boundary < 0 || boundary > 16 * 1024) throw new Error('Captured web document receipt missing');
  const receipt = parseMokinaWebCaptureReceipt(JSON.parse(content.slice(prefix.length, boundary)));
  const text = content.slice(boundary + separator.length);
  if (JSON.stringify(receipt) !== JSON.stringify(parseMokinaWebCaptureReceipt(expected))
    || webEvidenceDigest(text) !== receipt.textDigest || Buffer.byteLength(content) > 512 * 1024) throw new Error('Captured web document integrity mismatch');
  return { receipt, text };
}

/** Display extraction only; this never grants a trusted retrieval receipt to a file. */
export function webEvidenceMaterialText(content: string): string | null {
  if (!content.startsWith(prefix)) return null;
  const boundary = content.indexOf(separator, prefix.length);
  if (boundary < 0 || boundary > 16 * 1024) return null;
  try {
    const receipt = parseMokinaWebCaptureReceipt(JSON.parse(content.slice(prefix.length, boundary)));
    return readWebEvidenceDocument(content, receipt).text;
  } catch { return null; }
}
