import { Button } from '@open-design/components';
import { useMemo, useState } from 'react';
import type { Project, WorkspaceCollabContext } from '@open-design/contracts';
import { useT } from '../../i18n';
import { STATUS_LABEL_KEYS } from '../../state/projectRunStatus';
import { useProjectRunStatuses } from '../../hooks/useProjectRunStatuses';
import { MokinaBrand } from './MokinaBrand';
import { MokinaFixedSource } from './MokinaFixedSource';

export function MokinaProjects({ projects, loading, error, onStart, onRetry, onOpen, openingProjectId, workspaceContext }: {
  projects: Project[]; loading: boolean; error?: string | null;
  onStart: () => void; onRetry?: () => void; onOpen: (id: string) => unknown;
  openingProjectId?: string | null; workspaceContext?: WorkspaceCollabContext | null;
}) {
  const t = useT();
  const sceneLabels = { prototype: t('homeHero.chip.prototype'), ppt: t('homeHero.chip.deck'), marketing: t('examples.scenarioMarketing'), hyperframes: t('homeHero.chip.hyperframes') };
  const [collection, setCollection] = useState<'recent' | 'all'>('recent');
  const [limit, setLimit] = useState(20);
  const sorted = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects]);
  const visible = useMemo(() => sorted.slice(0, collection === 'recent' ? 10 : limit), [sorted, collection, limit]);
  const ids = useMemo(() => visible.map(project => project.id), [visible]);
  const statuses = useProjectRunStatuses(ids, { workspaceContext });
  return <section className="mokina-projects" data-testid="mokina-projects">
    <header className="mokina-page-header"><div><h1>{t('mokina.pages.projects')}</h1><p>{t('mokina.pages.subtitle')}</p></div>
      <Button type="button" variant="primary" onClick={onStart}>{t('mokina.pages.newWork')}</Button></header>
    <div className="mokina-project-tabs" role="group" aria-label={t('mokina.pages.projects')}>
      {(['recent', 'all'] as const).map(value => <Button key={value} type="button" aria-pressed={collection === value}
        onClick={() => setCollection(value)}>{t(`mokina.pages.${value}`)}</Button>)}
    </div>
    {loading ? <p role="status">{t('common.loading')}</p> : error ? <div role="alert"><p>{error}</p>
      {onRetry ? <Button type="button" onClick={onRetry}>{t('preview.retry')}</Button> : null}</div> : projects.length === 0 ?
      <div className="mokina-project-empty"><MokinaBrand size={88} /><p>{t('mokina.pages.empty')}</p>
        <Button variant="primary" type="button" onClick={onStart}>{t('mokina.pages.newWork')}</Button></div> :
      <div className="mokina-project-table"><table><thead><tr>
        <th>{t('mokina.pages.projects')}</th><th>{t('mokina.pages.scene')}</th><th>{t('mokina.pages.status')}</th><th>{t('mokina.pages.source')}</th><th>{t('mokina.pages.open')}</th>
      </tr></thead><tbody>{visible.map(project => {
        const status = statuses.get(project.id) ?? project.status?.value;
        return <tr key={project.id}><th scope="row"><Button type="button" onClick={() => onOpen(project.id)} disabled={openingProjectId === project.id}>{project.name}</Button></th>
          <td data-label={t('mokina.pages.scene')}>{project.metadata?.scenarioBinding?.taskProfile ? sceneLabels[project.metadata.scenarioBinding.taskProfile] : t('mokina.pages.unclassified')}</td>
          <td data-label={t('mokina.pages.status')}>{status ? t(STATUS_LABEL_KEYS[status]) : t('mokina.pages.unknown')}</td>
          <td data-label={t('mokina.pages.source')}><MokinaFixedSource projectId={project.id} workspaceContext={workspaceContext} /></td>
          <td><Button type="button" disabled={openingProjectId === project.id} onClick={() => onOpen(project.id)}>{openingProjectId === project.id ? t('common.loading') : t('mokina.pages.open')}</Button></td></tr>;
      })}</tbody></table></div>}
    {!loading && !error && collection === 'all' && sorted.length > limit ? <Button type="button" onClick={() => setLimit(value => value + 20)}>{t('brandPicker.showMore')}</Button> : null}
  </section>;
}
