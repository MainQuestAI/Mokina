import { captureProcessSnapshot, readProcessStampFromCommand } from '@open-design/platform';
import { SIDECAR_STAMP_CONTRACT, normalizeSidecarStamp } from './stamp.js';

/** Strict, read-only inventory including launchers not yet holding a generation. */
export async function findSidecarProcessesInNamespace(namespace: string) {
  normalizeSidecarStamp({ namespace, channel: 'validate', source: 'validate', mode: 'validate', app: 'validate' });
  const processes = await captureProcessSnapshot({ timeoutMs: 10_000 });
  return processes.filter(process => readProcessStampFromCommand(process.command, SIDECAR_STAMP_CONTRACT)?.namespace === namespace);
}
