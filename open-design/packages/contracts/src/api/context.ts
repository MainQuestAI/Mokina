export interface RunContextSelection {
  skillIds?: string[];
  pluginIds?: string[];
  mcpServerIds?: string[];
  connectorIds?: string[];
  workspaceItems?: WorkspaceContextItem[];
  /**
   * Frozen Mokina context snapshot bound to this run (T06). The single new run
   * reference; there is deliberately no second top-level path. Older callers
   * omit it and keep working.
   */
  mokinaSnapshotId?: string;
  /** Local one-send binding identity; receipt cleanup must retain this generation. */
  mokinaSnapshotGeneration?: string;
}

export type WorkspaceContextKind =
  | 'design-files'
  | 'design-system'
  | 'project'
  | 'local-code'
  | 'file'
  | 'folder'
  | 'project'
  | 'local-code'
  | 'browser'
  | 'terminal'
  | 'side-chat'
  | 'live-artifact';

export interface WorkspaceContextItem {
  id: string;
  kind: WorkspaceContextKind;
  label: string;
  tabId?: string;
  path?: string;
  absolutePath?: string;
  url?: string;
  title?: string;
}

export interface ProjectContextPluginRef {
  id: string;
  title: string;
  description?: string;
}

export interface ProjectContextMcpServerRef {
  id: string;
  label?: string;
  transport?: string;
  url?: string;
  command?: string;
}

export interface ProjectContextConnectorRef {
  id: string;
  name: string;
  provider?: string;
  category?: string;
  description?: string;
  status?: string;
  accountLabel?: string;
}
