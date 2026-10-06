import { randomUUID } from '../../utils/uuid';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import type { WorkspaceCollabContext } from '@open-design/contracts';

/**
 * Client half of the project recovery package (T14): export the current
 * project's recovery ZIP, and import a ZIP into a NEW project. The server owns
 * validation (manifest, hashes, paths, capacity); this module only transports
 * files and surfaces the server's message verbatim.
 */

export type ImportedRecoveryProject = {
  projectId: string;
  warnings: string[];
};

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
  } = {},
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/mokina/recovery-export`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(workspaceHeaders(options.workspaceContext) ?? {}) },
      body: JSON.stringify({ operationId: options.operationId ?? randomUUID() }),
    },
  );
  if (!response.ok) {
    throw new Error(await serverErrorMessage(response, `恢复包导出失败（${response.status}）`));
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/u.exec(disposition);
  const filename = match?.[1] && match[1].trim().length > 0 ? match[1] : `${projectId}-recovery.zip`;
  return { blob: await response.blob(), filename };
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
  const body = await response.json() as { projectId?: unknown; warnings?: unknown };
  if (typeof body.projectId !== 'string' || body.projectId.length === 0) {
    throw new Error('恢复包导入响应缺少项目 ID。');
  }
  return {
    projectId: body.projectId,
    warnings: Array.isArray(body.warnings)
      ? body.warnings.filter((warning): warning is string => typeof warning === 'string')
      : [],
  };
}
