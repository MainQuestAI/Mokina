import type { WorkspaceContextItem } from '@open-design/contracts';
export interface HomeContextDraft {
  skillId: string | null;
  plugins: Array<{ id: string; inlineBacked: boolean }>;
  mcp: Array<{ id: string; inlineBacked: boolean }>;
  connectors: Array<{ id: string; inlineBacked: boolean }>;
  workspaceItems: WorkspaceContextItem[];
}
const key = (scope: string) => `od:home-context:${scope}`;
/** Only safe references; never serialize provider objects, credentials or plugin inputs. */
export function writeHomeContextDraft(scope: string, draft: HomeContextDraft): void {
  sessionStorage.setItem(key(scope), JSON.stringify(draft));
}
export function clearHomeContextDraft(scope: string): void { sessionStorage.removeItem(key(scope)); }
export function readHomeContextDraft(scope: string): HomeContextDraft | null {
  try {
    const row = JSON.parse(sessionStorage.getItem(key(scope)) ?? 'null') as HomeContextDraft | null;
    if (!row || !(row.skillId === null || typeof row.skillId === 'string')) return null;
    if (![row.plugins, row.mcp, row.connectors].every(items => Array.isArray(items)
      && items.every(item => typeof item.id === 'string' && typeof item.inlineBacked === 'boolean'))) return null;
    if (!Array.isArray(row.workspaceItems) || !row.workspaceItems.every(item => typeof item.id === 'string' && typeof item.kind === 'string' && typeof item.label === 'string')) return null;
    return row;
  } catch { return null; }
}

/** Empty snapshots must not wait for unrelated catalogs or clear new choices. */
export function hasHomeContextReferences(draft: HomeContextDraft | null): boolean {
  return !!draft && (!!draft.skillId || [draft.plugins, draft.mcp, draft.connectors, draft.workspaceItems].some(items => items.length > 0));
}
