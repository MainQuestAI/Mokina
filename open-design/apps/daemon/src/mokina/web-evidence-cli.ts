import { mokinaWebOperationId, parseCaptureMokinaWebEvidenceRequest } from '@open-design/contracts';

export async function runWebEvidenceCli(action: string, args: string[], deps: {
  parseFlags: (args: string[], options: { string: string[]; boolean: string[] }) => Record<string, unknown>;
  cliDaemonUrl: (flags: Record<string, unknown>) => Promise<string>;
}) {
  const flags = deps.parseFlags(args, { string: ['project', 'url', 'operation-id', 'daemon-url', 'namespace'], boolean: ['json'] });
  if (!['capture', 'read'].includes(action) || typeof flags.project !== 'string' || !flags.project) throw new Error('Specify capture|read --project <id> --operation-id <id>');
  const operationId = mokinaWebOperationId(flags['operation-id']);
  const base = (await deps.cliDaemonUrl(flags)).replace(/\/$/u, '');
  const endpoint = `${base}/api/projects/${encodeURIComponent(flags.project)}/mokina/web-evidence`;
  const request = action === 'capture' ? parseCaptureMokinaWebEvidenceRequest({ operationId, url: flags.url }) : null;
  const response = await fetch(request ? endpoint : `${endpoint}/${encodeURIComponent(operationId)}`, request
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) } : {});
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(result)}`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
