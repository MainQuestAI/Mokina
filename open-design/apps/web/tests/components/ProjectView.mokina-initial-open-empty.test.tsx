// @vitest-environment jsdom
// R2 修复（P2-1）红测先行：交错时序下空项目的首个成果自动打开。
// 成果元数据先落定「0 个正式成果」（workspace intent），文件列表随后到达 ——
// 「已处理过首次打开」标记必须在真正找到主文件之后才置位，否则首个文件
// 永远不会自动打开。宿主结构沿用 ProjectView.retry-gating.test.tsx。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectView } from '../../src/components/ProjectView';
import { notifyMokinaEntriesChanged } from '../../src/hooks/useMokinaProjectSummaries';
import type { ProjectWorkspaceScopeState } from '../../src/collab/useProjectWorkspaceScope';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import type {
  AgentInfo,
  AppConfig,
  ChatMessage,
  Conversation,
  Project,
} from '../../src/types';

const mokinaEdition = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/mokina-edition', () => ({ get MOKINA_LOCAL_EDITION() { return mokinaEdition.on; } }));

const listConversations = vi.fn();
const listMessages = vi.fn();
const fetchPreviewComments = vi.fn();
const loadTabs = vi.fn();
const fetchProjectFiles = vi.fn();
const fetchLiveArtifacts = vi.fn();
const fetchChatRunStatus = vi.fn();
const listActiveChatRuns = vi.fn();
const listProjectRuns = vi.fn();
const saveMessage = vi.fn();
const createConversation = vi.fn();
const fetchBrands = vi.fn();
const saveTabs = vi.fn();
const cacheTabsLocally = vi.fn((_projectId: string, state: unknown) => state);

const workspaceScopeMocks = vi.hoisted(() => {
  const personalContext = (): WorkspaceCollabContext => ({
    workspaceId: 'workspace-personal',
    workspaceMemberId: 'member-personal',
    workspaceType: 'personal',
    role: 'owner',
    memberStatus: 'active',
    lifecycleState: 'active',
    billingState: 'active',
    planId: null,
    providerMode: 'platform_credits',
    seatSummary: { seatLimit: 1, usedSeats: 1, availableSeats: 0, isSeatFull: true },
    permissions: {
      canManageMembers: true,
      canManageBilling: true,
      canInviteMembers: true,
      canManageAutoRecharge: true,
      canShareProjects: true,
      canWriteSyncedFiles: true,
      canViewWorkspaceSettings: true,
      canManageSharedResources: true,
    },
  } as WorkspaceCollabContext);
  return {
    personalContext,
    ambientContext: null as WorkspaceCollabContext | null,
    projectScope: {
      loading: false,
      scope: {
        kind: 'personal' as const,
        projectId: 'project-1',
        workspaceId: 'workspace-personal',
        visibility: 'personal' as const,
        context: personalContext(),
      },
    } as ProjectWorkspaceScopeState,
  };
});

vi.mock('../../src/analytics/provider', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}));

vi.mock('../../src/i18n', () => ({
  useI18n: () => ({ locale: 'zh-CN', setLocale: () => undefined, t: (key: string) => key }),
  useT: () => (key: string) => key,
}));

vi.mock('../../src/router', () => ({ navigate: vi.fn() }));

vi.mock('../../src/providers/anthropic', () => ({ streamMessage: vi.fn() }));

vi.mock('../../src/collab/useWorkspaceContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/collab/useWorkspaceContext')>()),
  useWorkspaceContext: () => ({
    context: workspaceScopeMocks.ambientContext,
    loading: false,
  }),
  lastResolvedTeamProjects: () => [],
  lastResolvedWorkspaceContext: () => workspaceScopeMocks.ambientContext,
  workspaceIdentityCanBillAmr: (state: { context: unknown; loading: boolean }) =>
    state.context !== null || state.loading,
  useWorkspaceBilling: () => null,
}));

vi.mock('../../src/collab/useProjectWorkspaceScope', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/collab/useProjectWorkspaceScope')>()),
  useProjectWorkspaceScope: () => workspaceScopeMocks.projectScope,
}));

vi.mock('../../src/collab/useProjectCollab', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/collab/useProjectCollab')>()),
  useProjectCollab: () => ({
    enabled: false,
    member: null,
    present: [],
    publishedVersion: null,
    syncState: 'local_only',
    viewerOnly: false,
    isOwner: true,
    writerAuthority: 'allowed',
    ownerDisplayName: null,
    ownerRole: null,
    downloadPending: false,
    reportChange: vi.fn(),
    requestPublish: vi.fn(),
    refreshPresence: vi.fn(),
    checkStatusNow: vi.fn(),
    applyContentTransferState: vi.fn(),
  }),
}));

vi.mock('../../src/providers/daemon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/providers/daemon')>();
  return {
    ...actual,
    queryRunByClientRequest: vi.fn().mockResolvedValue(null),
    fetchChatRunStatus: (...args: unknown[]) => fetchChatRunStatus(...args),
    listActiveChatRuns: (...args: unknown[]) => listActiveChatRuns(...args),
    listProjectRuns: (...args: unknown[]) => listProjectRuns(...args),
    publishDaemonRunFinishedEvent: vi.fn(),
    reattachDaemonRun: vi.fn(),
    streamViaDaemon: vi.fn(),
    fetchAmrWalletSnapshot: vi.fn().mockResolvedValue(null),
    formatVelaBalanceUsd: (value: string | null) => `$${value ?? '0'}`,
    fetchVelaLoginStatus: vi.fn().mockResolvedValue({ loggedIn: true }),
    startVelaLogin: vi.fn(),
    cancelVelaLogin: vi.fn(),
    canUpgradeVelaPlan: vi.fn().mockReturnValue(false),
    launchAntigravityOauth: vi.fn(),
  };
});

const fileEvents = vi.hoisted(() => ({
  handler: null as null | ((evt: { type: string; path?: string; kind?: string }) => void),
}));

vi.mock('../../src/providers/project-events', () => ({
  useProjectFileEvents: (
    _projectId: unknown,
    _enabled: unknown,
    onChange?: (evt: { type: string; path?: string; kind?: string }) => void,
  ) => {
    fileEvents.handler = onChange ?? null;
  },
}));

vi.mock('../../src/runtime/amr-balance-gate', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/runtime/amr-balance-gate')>()),
  checkAmrBalanceGate: vi.fn().mockResolvedValue({ kind: 'allow' }),
}));

vi.mock('../../src/runtime/brands', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/runtime/brands')>()),
  fetchBrands: (...args: unknown[]) => fetchBrands(...args),
}));

vi.mock('../../src/providers/registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/providers/registry')>()),
  deletePreviewComment: vi.fn(),
  fetchDesignSystem: vi.fn(),
  fetchLiveArtifacts: (...args: unknown[]) => fetchLiveArtifacts(...args),
  fetchPreviewComments: (...args: unknown[]) => fetchPreviewComments(...args),
  fetchProjectFiles: (...args: unknown[]) => fetchProjectFiles(...args),
  fetchProjectFileVersions: vi.fn().mockResolvedValue({ versions: [] }),
  fetchSkill: vi.fn(),
  getTemplate: vi.fn(),
  patchPreviewCommentStatus: vi.fn(),
  upsertPreviewComment: vi.fn(),
  writeProjectTextFile: vi.fn(),
}));

vi.mock('../../src/state/projects', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/state/projects')>()),
  createConversation: (...args: unknown[]) => createConversation(...args),
  deleteConversation: vi.fn(),
  listConversations: (...args: unknown[]) => listConversations(...args),
  listMessages: (...args: unknown[]) => listMessages(...args),
  loadTabs: (...args: unknown[]) => loadTabs(...args),
  patchConversation: vi.fn(),
  patchProject: vi.fn(),
  persistTabsToDaemonNow: vi.fn(),
  saveMessage: (...args: unknown[]) => saveMessage(...args),
  saveTabs: (...args: unknown[]) => saveTabs(...args),
  cacheTabsLocally: (projectId: string, state: unknown) => cacheTabsLocally(projectId, state),
}));

vi.mock('../../src/components/AppChromeHeader', () => ({
  AppChromeHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
}));
vi.mock('../../src/components/AvatarMenu', () => ({ AvatarMenu: () => null }));
vi.mock('../../src/components/Loading', () => ({ CenteredLoader: () => null }));
vi.mock('../../src/components/FileWorkspace', () => ({
  DESIGN_SYSTEM_TAB: '__design_system__',
  FileWorkspace: () => <div data-testid="file-workspace" />,
}));

vi.mock('../../src/components/ChatPane', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/ChatPane')>();
  return {
    ...actual,
    ChatPane: (props: { activeConversationId?: string | null; messages?: ChatMessage[] }) => (
      <section>
        <output data-testid="active-conversation">{props.activeConversationId ?? ''}</output>
      </section>
    ),
  };
});
void forwardRef;

const project: Project = {
  id: 'project-1',
  name: 'Project',
  skillId: null,
  designSystemId: null,
  createdAt: 1,
  updatedAt: 1,
};

const conversation: Conversation = {
  id: 'conv-a',
  projectId: project.id,
  title: 'A',
  createdAt: 1,
  updatedAt: 1,
};

const localConfig: AppConfig = {
  mode: 'daemon',
  apiProtocol: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  agentId: 'agent-1',
  agentModels: {},
  skillId: null,
  designSystemId: null,
};

const agents = [
  { id: 'agent-1', name: 'OpenCode', bin: 'opencode', available: true, models: [] },
] as unknown as AgentInfo[];

let filesFixture: Array<Record<string, unknown>> = [];

beforeEach(() => {
  mokinaEdition.on = true;
  window.localStorage.clear();
  window.sessionStorage.clear();
  filesFixture = [];
  fileEvents.handler = null;
  saveTabs.mockClear();
  cacheTabsLocally.mockClear();
  listConversations.mockResolvedValue([conversation]);
  createConversation.mockResolvedValue(conversation);
  listMessages.mockResolvedValue([]);
  fetchPreviewComments.mockResolvedValue([]);
  fetchProjectFiles.mockImplementation(async () => filesFixture);
  fetchLiveArtifacts.mockResolvedValue([]);
  fetchBrands.mockResolvedValue([]);
  loadTabs.mockResolvedValue({ tabs: [], active: null });
  fetchChatRunStatus.mockResolvedValue(null);
  listActiveChatRuns.mockResolvedValue([]);
  listProjectRuns.mockResolvedValue([]);
  saveMessage.mockResolvedValue(null);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderProjectView(config: AppConfig = localConfig) {
  return render(
    <ProjectView
      project={project}
      routeFileName={null}
      config={config}
      agents={agents}
      skills={[]}
      designTemplates={[]}
      designSystems={[]}
      daemonLive
      onModeChange={vi.fn()}
      onAgentChange={vi.fn()}
      onAgentModelChange={vi.fn()}
      onRefreshAgents={vi.fn()}
      onOpenSettings={vi.fn()}
      onBack={vi.fn()}
      onClearPendingPrompt={vi.fn()}
      onTouchProject={vi.fn()}
      onProjectChange={vi.fn()}
      onProjectsRefresh={vi.fn()}
    />,
  );
}

describe('R2 交错时序下空项目的首个成果自动打开（P2-1）', () => {
  it('元数据先判成 workspace（0 个正式成果），文件列表后到：首个 HTML 自动打开', async () => {
    renderProjectView();
    await waitFor(() =>
      expect(screen.getByTestId('active-conversation').textContent).toBe('conv-a'),
    );
    // 让元数据与文件列表都先落定在空状态。
    await waitFor(() => {
      expect(fetchProjectFiles).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 首个成果到达：文件列表刷新 + 成果摘要失效重读。
    filesFixture = [{ name: 'a.html', kind: 'html', mtime: 2 }];
    fileEvents.handler?.({ type: 'file-changed', path: 'a.html', kind: 'add' });
    notifyMokinaEntriesChanged(project.id);

    await waitFor(() => {
      expect(cacheTabsLocally).toHaveBeenCalledWith(
        project.id,
        expect.objectContaining({ tabs: ['a.html'], active: 'a.html' }),
        expect.anything(),
      );
    }, { timeout: 3000 });
    expect(saveTabs).toHaveBeenCalled();
  });
});
