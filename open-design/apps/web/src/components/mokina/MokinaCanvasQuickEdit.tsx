import { useEffect, useRef, useState } from 'react';
import { Button } from '@open-design/components';
import type { ProjectFileVersion, WorkspaceCollabContext } from '@open-design/contracts';
import { workspaceProjectHeaders } from '../../collab/workspace-identity';
import { notifyMokinaEntriesChanged } from '../../runtime/mokina-entry-events';

type Props = {
  projectId: string;
  fileName: string;
  version: ProjectFileVersion;
  workspaceContext: WorkspaceCollabContext | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  ready: boolean;
  onSaved: (version: ProjectFileVersion) => void;
  onBusyChange?: (busy: boolean) => void;
};

/**
 * Direct on-canvas editing for the current Mokina version. The iframe bridge
 * turns supported plain-text fields and budget cells into editable nodes; this
 * panel collects the edits, saves one candidate, and makes it current in one
 * step so the visible page reflects the change immediately.
 */
export function MokinaCanvasQuickEdit({ projectId, fileName, version, workspaceContext, iframeRef, ready, onSaved, onBusyChange }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filesEndpoint = `/api/projects/${encodeURIComponent(projectId)}/files/${fileName.split('/').map(encodeURIComponent).join('/')}`;
  const editsRef = useRef(edits);
  editsRef.current = edits;

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || !event.data) return;
      if (event.data.type === 'mokina:canvas-edit' && typeof event.data.id === 'string' && typeof event.data.value === 'string') {
        setEdits(current => ({ ...current, [event.data.id]: event.data.value }));
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [iframeRef]);

  useEffect(() => {
    if (!enabled || !ready) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'mokina:canvas-edit-mode', enabled: true }, '*');
    return () => { iframeRef.current?.contentWindow?.postMessage({ type: 'mokina:canvas-edit-mode', enabled: false }, '*'); };
  }, [enabled, ready, iframeRef]);

  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, { ...init, headers: { ...(workspaceContext ? workspaceProjectHeaders(workspaceContext) : {}), ...init?.headers }, signal: AbortSignal.timeout(20_000) });
    const result = await response.json().catch(() => null) as { error?: { message?: string }; [key: string]: unknown } | null;
    if (!response.ok) throw Object.assign(new Error(result?.error?.message || String(response.status)), { status: response.status });
    return result!;
  }

  async function saveAndApply() {
    if (!version.current || busy || Object.keys(editsRef.current).length === 0) return;
    setBusy(true); setError('');
    try {
      const inspection = await request(`${filesEndpoint}/operations?versionId=${encodeURIComponent(version.id)}`) as { contentDigest: string; fields: Array<{ id: string }> };
      const validIds = new Set(inspection.fields.map(field => field.id));
      const changes = Object.entries(editsRef.current).filter(([id]) => validIds.has(id)).map(([id, value]) => ({ id, value }));
      if (!changes.length) throw new Error('没有可保存的修改。');
      const saved = await request(`${filesEndpoint}/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: crypto.randomUUID(), baseVersionId: version.id,
          contentDigest: inspection.contentDigest, edits: changes }),
      }) as { version: ProjectFileVersion };
      const adopted = await request(`${filesEndpoint}/versions/${encodeURIComponent(saved.version.id)}/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedCurrentVersionId: version.id, operationId: crypto.randomUUID() }),
      }) as { version: ProjectFileVersion };
      notifyMokinaEntriesChanged(projectId);
      setEdits({});
      setEnabled(false);
      onSaved(adopted.version ?? saved.version);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  if (!version.current) return null;
  const count = Object.keys(edits).length;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    <Button data-testid="mokina-canvas-edit-toggle" variant={enabled ? 'secondary' : 'ghost'} disabled={busy || !ready} onClick={() => { setError(''); setEnabled(value => !value); }}>
      {enabled ? '退出画布改字' : '画布直接改字'}
    </Button>
    {enabled ? <span role="status" style={{ fontSize: 12, opacity: 0.75 }}>点击页面上的文字或预算数字直接修改，按回车或点击空白处记录</span> : null}
    {count > 0 ? <>
      <span role="status" style={{ fontSize: 12, fontWeight: 600 }}>已改 {count} 处</span>
      <Button data-testid="mokina-canvas-edit-save" variant="primary" disabled={busy} onClick={() => void saveAndApply()}>保存修改并生效</Button>
      <Button variant="ghost" disabled={busy} onClick={() => setEdits({})}>放弃修改</Button>
    </> : null}
    {error ? <span role="alert" style={{ fontSize: 12, color: '#b91c1c' }}>{error}</span> : null}
  </div>;
}
