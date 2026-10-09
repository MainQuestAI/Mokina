import { Button } from '@open-design/components';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { EntryNavRail } from '../EntryNavRail';
import { ENTRY_RAIL_STATE_EVENT, ENTRY_RAIL_TOGGLE_EVENT, RAIL_OPEN_STORAGE_KEY, readStoredRailOpen } from '../entryRailBridge';
import { useT } from '../../i18n';
import { navigate } from '../../router';
import { MokinaBrand } from './MokinaBrand';

type Props = Pick<ComponentProps<typeof EntryNavRail>, 'recentProjects' | 'onOpenRecentProject' | 'onOpenSettings' | 'onRenameRecentProject' | 'onDeleteRecentProject' | 'onDuplicateRecentProject' | 'onExportRecoveryRecentProject'> & { children: ReactNode };
export function MokinaProjectShell({ children, ...props }: Props) {
  const t = useT();
  const [open, setOpen] = useState(readStoredRailOpen);
  useEffect(() => {
    const toggle = () => setOpen(value => !value);
    window.addEventListener(ENTRY_RAIL_TOGGLE_EVENT, toggle);
    return () => window.removeEventListener(ENTRY_RAIL_TOGGLE_EVENT, toggle);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(RAIL_OPEN_STORAGE_KEY, String(open)); } catch { /* presentation preference only */ }
    window.dispatchEvent(new CustomEvent(ENTRY_RAIL_STATE_EVENT, { detail: { open } }));
  }, [open]);
  return <div className={`mokina-project-shell entry-shell--no-header${open ? ' is-rail-open' : ''}`}>
    <div className="mokina-compact-nav"><Button aria-label="Mokina" onClick={() => navigate({ kind: 'home', view: 'home' })}><MokinaBrand size={28} /></Button>
      <Button onClick={() => navigate({ kind: 'home', view: 'home' })}>{t('mokina.pages.start')}</Button>
      <Button onClick={() => navigate({ kind: 'home', view: 'projects' })}>{t('mokina.pages.projects')}</Button>
      <Button onClick={() => props.onOpenSettings?.()}>{t('entry.accountSettings')}</Button></div>
    <div className={`entry${open ? ' entry--rail-open' : ''}`}>
      <EntryNavRail {...props} view="projects" context={null} open={open}
        onViewChange={view => navigate({ kind: 'home', view })}
        onNewProject={() => navigate({ kind: 'home', view: 'home' })} />
      <div className="mokina-project-content">{children}</div>
    </div>
  </div>;
}
