import { Button } from '@open-design/components';
import { useEffect, useRef, useState } from 'react';
import type { MokinaContinuationV2, WorkspaceCollabContext } from '@open-design/contracts';
import { useT } from '../../i18n';
import { projectFileUrl } from '../../providers/registry';
import { enqueueMokinaMetadataRead } from '../../hooks/useMokinaProjectSummaries';
import { workspaceIdentityCacheKey } from '../../collab/workspace-identity';
import { navigate } from '../../router';

type SourceRead = { identity: string; source: MokinaContinuationV2['source'] | null; failed?: boolean };
/** Only a validated continuation receipt establishes a fixed source. Project
 * metadata.sourceProjectId also serves other flows and is not this evidence. */
export function MokinaFixedSource({ projectId, workspaceContext = null, hideMissing = false }: {
  hideMissing?: boolean;
  projectId: string; workspaceContext?: WorkspaceCollabContext | null;
}) {
  const t = useT();
  const identity = JSON.stringify([projectId, workspaceIdentityCacheKey(workspaceContext)]);
  const contextRef = useRef(workspaceContext);
  contextRef.current = workspaceContext;
  const [read, setRead] = useState<SourceRead | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const requestContext = contextRef.current;
    void enqueueMokinaMetadataRead(async signal => {
      const response = await fetch(projectFileUrl(projectId, 'MOKINA-CONTINUATION.json', requestContext), { signal, cache: 'no-store' });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('source-read-failed');
      const receipt = await response.json() as Partial<MokinaContinuationV2>;
      const source = receipt.source;
      if (receipt.schemaVersion !== 2 || receipt.targetProjectId !== projectId || !source
        || typeof source.projectId !== 'string' || !source.projectId
        || typeof source.fileName !== 'string' || !source.fileName
        || typeof source.versionId !== 'string' || !source.versionId) throw new Error('invalid-source');
      return source;
    }, controller.signal, false).then(source => {
      if (!controller.signal.aborted) setRead({ identity, source });
    }).catch(() => { if (!controller.signal.aborted) setRead({ identity, source: null, failed: true }); });
    return () => controller.abort();
  }, [identity, projectId]);
  if (!read || read.identity !== identity) return <span>{t('common.loading')}</span>;
  if (read.failed) return <span>{t('mokina.pages.readFailed')}</span>;
  const source = read.source;
  if (!source && hideMissing) return null;
  if (!source) return <span>{t('mokina.pages.noSource')}</span>;
  return <Button type="button" className="mokina-source-link" title={`${source.fileName} · ${source.versionId}`}
    onClick={() => navigate({ kind: 'project', projectId: source.projectId, fileName: source.fileName, versionId: source.versionId })}>
    {source.fileName}<small>{source.versionId}</small>
  </Button>;
}
