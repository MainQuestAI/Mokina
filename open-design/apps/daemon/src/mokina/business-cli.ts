import { parseSaveMokinaBusinessRequest } from '@open-design/contracts';
export async function runMokinaBusiness(action: string, args: string[], deps: {
  parseFlags: (args: string[], options: { string: string[]; boolean: string[] }) => Record<string, unknown>;
  cliDaemonUrl: (flags: Record<string, unknown>) => Promise<string>;
  safeReadJsonFile: (path: string) => unknown;
}) {
  const flags = deps.parseFlags(args, { string: ['project', 'kind', 'version', 'prompt-file', 'daemon-url', 'namespace'], boolean: ['json'] });
  if (!['get', 'save'].includes(action) || typeof flags.project !== 'string' || !flags.project
    || !['background', 'brief'].includes(String(flags.kind))) throw new Error('Specify get|save --project <id> --kind background|brief');
  const base = await deps.cliDaemonUrl(flags);
  let url = `${base.replace(/\/$/, '')}/api/projects/${encodeURIComponent(flags.project)}/mokina/business/${flags.kind}`;
  if (action === 'get' && flags.version) url += `?versionId=${encodeURIComponent(String(flags.version))}`;
  let body: string | undefined;
  if (action === 'save') {
    if (typeof flags['prompt-file'] !== 'string') throw new Error('--prompt-file <request.json|-> is required; preserve operationId after unknown outcomes');
    const request = parseSaveMokinaBusinessRequest(deps.safeReadJsonFile(flags['prompt-file']));
    if (request.body.kind !== flags.kind) throw new Error('Document kind mismatch');
    body = JSON.stringify(request);
  }
  const response = await fetch(url, action === 'get' ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: body! });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(result)}`);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
