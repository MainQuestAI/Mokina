import { parseMokinaOperationRequest } from '@open-design/contracts';
export async function runMokinaOperations(action: string, args: string[], deps: {
  parseFlags: (args: string[], options: { string: string[]; boolean: string[] }) => Record<string, unknown>;
  cliDaemonUrl: (flags: Record<string, unknown>) => Promise<string>;
  safeReadJsonFile: (path: string) => unknown;
}) {
  const flags = deps.parseFlags(args, { string: ['project', 'file', 'version', 'request-file', 'daemon-url', 'namespace'], boolean: ['json'] });
  if (!['get', 'save'].includes(action) || typeof flags.project !== 'string' || typeof flags.file !== 'string') throw new Error('Specify get|save --project <id> --file <HTML>');
  const base = await deps.cliDaemonUrl(flags);
  const endpoint = `${base.replace(/\/$/, '')}/api/projects/${encodeURIComponent(flags.project)}/files/${flags.file.split('/').map(encodeURIComponent).join('/')}`;
  let body: string | undefined;
  if (action === 'save') {
    if (typeof flags['request-file'] !== 'string') throw new Error('--request-file required; query versions before retrying an unknown outcome with the SAME operationId');
    body = JSON.stringify(parseMokinaOperationRequest(deps.safeReadJsonFile(flags['request-file'])));
  } else if (typeof flags.version !== 'string') throw new Error('--version required');
  const response = await fetch(`${endpoint}/operations${action === 'get' ? `?versionId=${encodeURIComponent(String(flags.version))}` : ''}`,
    body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body } : {});
  const result = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(result)}`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
