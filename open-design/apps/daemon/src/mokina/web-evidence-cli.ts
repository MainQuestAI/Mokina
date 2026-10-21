import { mokinaWebOperationId, parseCaptureMokinaWebEvidenceRequest } from '@open-design/contracts';
import { surfaceFetchError } from '../cli-shared.js';

export async function runWebEvidenceCli(action: string, args: string[], deps: {
  parseFlags: (args: string[], options: { string: ReadonlySet<string>; boolean: ReadonlySet<string> }) => Record<string, unknown>;
  cliDaemonUrl: (flags: Record<string, unknown>) => Promise<string>;
}) {
  // Real Sets keep strict-flag semantics: unknown flags and missing values
  // fail with precise errors instead of falling through generic parsing.
  const flags = deps.parseFlags(args, {
    string: new Set(['project', 'url', 'operation-id', 'daemon-url', 'namespace']),
    boolean: new Set(['json']),
  });
  if (!['capture', 'read'].includes(action) || typeof flags.project !== 'string' || !flags.project) throw new Error('Specify capture|read --project <id> --operation-id <id>');
  const operationId = mokinaWebOperationId(flags['operation-id']);
  const base = (await deps.cliDaemonUrl(flags)).replace(/\/$/u, '');
  const endpoint = `${base}/api/projects/${encodeURIComponent(flags.project)}/mokina/web-evidence`;
  const request = action === 'capture' ? parseCaptureMokinaWebEvidenceRequest({ operationId, url: flags.url }) : null;
  let response: Response;
  try {
    response = await fetch(request ? endpoint : `${endpoint}/${encodeURIComponent(operationId)}`, request
      ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) } : {});
  } catch (err) {
    // Same exit contract as `od research search`: transport failure is 3.
    surfaceFetchError(err, base);
    process.exitCode = 3;
    return;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    // Daemon error body surfaced verbatim; a rejected request is exit 4.
    const message = result && typeof result === 'object' && 'error' in result
      ? JSON.stringify((result as { error: unknown }).error)
      : response.statusText;
    process.stderr.write(`daemon ${response.status}: ${message}\n`);
    process.exitCode = 4;
    return;
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
