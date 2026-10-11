import { randomUUID } from '../../utils/uuid';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { readMokinaRecoveryIntegrity, type MokinaRecoveryIntegrity, type MokinaRecoveryIssue, type WorkspaceCollabContext } from '@open-design/contracts';

/**
 * Client half of the project recovery package (T14): export the current
 * project's recovery ZIP, and import a ZIP into a NEW project. The server owns
 * validation (manifest, hashes, paths, capacity); this module only transports
 * files and surfaces the server's message verbatim.
 */

export type ImportedRecoveryProject = {
  projectId: string;
  warnings: string[];
  integrity: MokinaRecoveryIntegrity;
};

export class RecoveryExportIncompleteError extends Error {
  constructor(message: string, readonly issues: MokinaRecoveryIssue[]) { super(message); }
}

/** The displayed report is from the downloaded ZIP, not a separate, stale preflight. */
export async function inspectRecoveryZip(bytes: ArrayBuffer): Promise<MokinaRecoveryIntegrity> {
  const { default: JSZip } = await import('jszip');
  const archive = await JSZip.loadAsync(bytes);
  const manifest = archive.file('mokina-recovery.json');
  if (!manifest) throw new Error('恢复包缺少完整性清单，未开始下载。');
  const report = readMokinaRecoveryIntegrity(JSON.parse(await manifest.async('text')));
  if (!report) throw new Error('恢复包完整性清单无效，未开始下载。');
  return report;
}

export function mintRecoveryIdentity(): { operationId: string; targetProjectId: string } {
  return { operationId: randomUUID(), targetProjectId: randomUUID() };
}

function workspaceHeaders(workspaceContext?: WorkspaceCollabContext | null): HeadersInit | undefined {
  return workspaceContext ? workspaceProjectHeaders(workspaceContext) : undefined;
}

async function serverErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message || fallback;
}

export async function exportProjectRecoveryZip(
  projectId: string,
  options: {
    operationId?: string;
    workspaceContext?: WorkspaceCollabContext | null;
    mode?: 'complete' | 'partial';
  } = {},
): Promise<{ blob: Blob; filename: string; integrity: MokinaRecoveryIntegrity }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/mokina/recovery-export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(workspaceHeaders(options.workspaceContext) ?? {}) },
      body: JSON.stringify({ operationId: options.operationId ?? randomUUID(), mode: options.mode ?? 'complete' }),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null) as {
      error?: { code?: string; message?: string; details?: { issues?: MokinaRecoveryIssue[]; canSalvage?: boolean } };
    } | null;
    const message = body?.error?.message || `恢复包导出失败（${response.status}）`;
    const issues = body?.error?.details?.issues;
    if (body?.error?.code === 'MOKINA_RECOVERY_INCOMPLETE' && body.error.details?.canSalvage === true && Array.isArray(issues) && issues.length > 0) {
      throw new RecoveryExportIncompleteError(message, issues);
    }
    throw new Error(message);
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/u.exec(disposition);
  const filename = match?.[1] && match[1].trim().length > 0 ? match[1] : `${projectId}-recovery.zip`;
  const bytes = await response.arrayBuffer();
  const integrity = await inspectRecoveryZip(bytes);
  if (options.mode !== 'partial' && integrity.status !== 'complete') {
    throw new Error('服务端未提供可确认完整的恢复包；未自动下载，请更新服务或明确选择部分抢救。');
  }
  return { blob: new Blob([bytes], { type: 'application/zip' }), filename, integrity };
}

/** Trigger a browser download; a no-op outside the DOM (tests, SSR). */
export function saveRecoveryFile(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importProjectRecoveryZip(
  file: File,
  input: {
    operationId: string;
    targetProjectId: string;
    projectName?: string;
    workspaceContext?: WorkspaceCollabContext | null;
  },
): Promise<ImportedRecoveryProject> {
  const form = new FormData();
  form.append('operationId', input.operationId);
  form.append('targetProjectId', input.targetProjectId);
  if (input.projectName?.trim()) form.append('projectName', input.projectName.trim());
  form.append('file', file, file.name || 'recovery.zip');
  const response = await fetch('/api/mokina/recovery-import', {
    method: 'POST',
    headers: workspaceHeaders(input.workspaceContext),
    body: form,
  });
  if (!response.ok) {
    throw new Error(await serverErrorMessage(response, `恢复包导入失败（${response.status}）`));
  }
  const body = await response.json() as { projectId?: unknown; warnings?: unknown; integrity?: MokinaRecoveryIntegrity };
  if (typeof body.projectId !== 'string' || body.projectId.length === 0) {
    throw new Error('恢复包导入响应缺少项目 ID。');
  }
  return {
    projectId: body.projectId,
    warnings: Array.isArray(body.warnings)
      ? body.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
    integrity: body.integrity ?? { status: 'unknown', issues: [] },
  };
}
