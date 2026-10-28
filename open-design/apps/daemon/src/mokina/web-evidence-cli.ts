import { mokinaWebOperationId, parseCaptureMokinaWebEvidenceRequest, parseMokinaWebCaptureResult } from '@open-design/contracts';
import { surfaceFetchError } from '../cli-shared.js';
import { webEvidenceDigest } from './web-evidence-document.js';

function validateReply(value: unknown, operationId: string, requestedUrl?: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('result' in value)) throw new Error('Missing result envelope');
  if (value.result === null && requestedUrl === undefined) return;
  const row = parseMokinaWebCaptureResult(value.result, { operationId, ...(requestedUrl !== undefined ? { url: requestedUrl } : {}) });
  if (webEvidenceDigest(row.content) !== row.contentDigest) throw new Error('Saved result bytes do not match the digest');
}

export async function runWebEvidenceCli(action: string, args: string[], deps: {
  parseFlags: (args: string[], options: { string: ReadonlySet<string>; boolean: ReadonlySet<string> }) => Record<string, unknown>;
  cliDaemonUrl: (flags: Record<string, unknown>) => Promise<string>;
}) {
  let flags: Record<string, unknown>;
  let operationId: string;
  let request: ReturnType<typeof parseCaptureMokinaWebEvidenceRequest> | null;
  try {
    // Real Sets keep strict-flag semantics: unknown flags and missing values
    // fail with precise errors instead of falling through generic parsing.
    flags = deps.parseFlags(args, {
      string: new Set(['project', 'url', 'operation-id', 'daemon-url', 'namespace']),
      boolean: new Set(['json']),
    });
    if (!['capture', 'read'].includes(action) || typeof flags.project !== 'string' || !flags.project) throw new Error('Specify capture|read --project <id> --operation-id <id>');
    operationId = mokinaWebOperationId(flags['operation-id']);
    request = action === 'capture' ? parseCaptureMokinaWebEvidenceRequest({ operationId, url: flags.url }) : null;
  } catch (err) {
    // Usage errors exit 2 like `od research search`, never a raw stack trace.
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 2;
    return;
  }
  const base = (await deps.cliDaemonUrl(flags)).replace(/\/$/u, '');
  const endpoint = `${base}/api/projects/${encodeURIComponent(flags.project as string)}/mokina/web-evidence`;
  // A successful HTTP status does not establish that the saved result arrived.
  // Keep the operation identity recoverable without issuing another capture.
  const reportUnknown = () => {
    const quote = (value: string) => `'${value.replace(/'/gu, `'"'"'`)}'`;
    process.stderr.write(`Web evidence result is unknown for operation ${operationId}. Query the same operation without repeating capture: od research read --project ${quote(flags.project as string)} --operation-id ${operationId} --daemon-url ${quote(base)}\n`);
  };
  let response: Response;
  try {
    response = await fetch(request ? endpoint : `${endpoint}/${encodeURIComponent(operationId)}`, request
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) } : {});
  } catch (err) {
    // Same exit contract as `od research search`: transport failure is 3.
    surfaceFetchError(err, base);
    if (request) reportUnknown();
    process.exitCode = 3;
    return;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Preserve daemon diagnostics and exit 4 even when saving may have begun.
    const error = result && typeof result === 'object' && 'error' in result ? result.error : undefined;
    const message = error !== undefined ? JSON.stringify(error) : response.statusText;
    process.stderr.write(`daemon ${response.status}: ${message}\n`);
    if (request && error && typeof error === 'object' && 'code' in error && error.code === 'WEB_CAPTURE_UNAVAILABLE') reportUnknown();
    process.exitCode = 4;
    return;
  }
  try { validateReply(result, operationId, request?.url); }
  catch (error) {
    process.stderr.write(`Invalid daemon web evidence response: ${error instanceof Error ? error.message : String(error)}\n`);
    reportUnknown();
    process.exitCode = 3;
    return;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
