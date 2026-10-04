// @vitest-environment jsdom
// R2 修复（P1-1 / P1-2）红测先行：「结果待确认」的显式出口（重新发送 / 放弃这条）
// 与大小上限不再拒发。streamViaDaemon 按 provider 契约模拟（受理/丢响应/明确拒绝），
// HTTP 分类本身由 provider 测试与第一轮浏览器证据覆盖。
// 宿主结构沿用 ProjectView.retry-gating.test.tsx 的 stub ChatPane。

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import type { ChatPane as ChatPaneComponent } from '../../src/components/ChatPane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectView } from '../../src/components/ProjectView';
import type { ProjectWorkspaceScopeState } from '../../src/collab/useProjectWorkspaceScope';
import type { WorkspaceCollabContext } from '@open-design/contracts';
import type {
  AgentInfo,
  AppConfig,
  ChatMessage,
  Conversation,
  Project,
} from '../../src/types';

/** 记录按 workspace authorityKey 分桶存储；测试直接扫 v2 前缀拿全量。 */
function storedRecords(): Array<{ clientRequestId: string; status: string; snapshot?: { prompt: string } }> {
  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith('od:send-request:v2:'))
    .map((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null'))
    .filter(Boolean);
}

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
const streamViaDaemon = vi.fn();
const saveMessage = vi.fn();
const createConversation = vi.fn();
const fetchBrands = vi.fn();

/** What each composer send was told to do with its draft. */
const sendOutcomes: unknown[] = [];

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
    seatSummary: {
      seatLimit: 1,
      usedSeats: 1,
      availableSeats: 0,
      isSeatFull: true,
    },
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

const daemonMocks = vi.hoisted(() => ({
  queryRunByClientRequest: vi.fn(),
}));

vi.mock('../../src/providers/daemon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/providers/daemon')>();
  return {
    ...actual,
    queryRunByClientRequest: (...args: unknown[]) => daemonMocks.queryRunByClientRequest(...args),
    fetchChatRunStatus: (...args: unknown[]) => fetchChatRunStatus(...args),
    listActiveChatRuns: (...args: unknown[]) => listActiveChatRuns(...args),
    listProjectRuns: (...args: unknown[]) => listProjectRuns(...args),
    publishDaemonRunFinishedEvent: vi.fn(),
    reattachDaemonRun: vi.fn(),
    streamViaDaemon: (...args: unknown[]) => streamViaDaemon(...args),
    fetchAmrWalletSnapshot: vi.fn().mockResolvedValue(null),
    formatVelaBalanceUsd: (value: string | null) => `$${value ?? '0'}`,
    fetchVelaLoginStatus: vi.fn().mockResolvedValue({ loggedIn: true }),
    startVelaLogin: vi.fn(),
    cancelVelaLogin: vi.fn(),
    canUpgradeVelaPlan: vi.fn().mockReturnValue(false),
    launchAntigravityOauth: vi.fn(),
  };
});

vi.mock('../../src/providers/project-events', () => ({
  useProjectFileEvents: vi.fn(),
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
  saveTabs: vi.fn(),
  cacheTabsLocally: (_projectId: string, state: unknown) => state,
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

const chatSurface = vi.hoisted(() => ({
  props: null as ComponentProps<typeof ChatPaneComponent> | null,
}));

vi.mock('../../src/components/AssistantMessage', () => ({
  AssistantMessage: ({ message }: { message: ChatMessage }) => (
    <output data-testid={`history-${message.id}`}>{JSON.stringify(message)}</output>
  ),
}));
vi.mock('../../src/components/ChatComposer', () => ({
  ChatComposer: forwardRef((_props, _ref) => <div data-testid="composer" />),
}));

vi.mock('../../src/components/ChatPane', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/components/ChatPane')>();
  return {
    ...actual,
    ChatPane: (props: {
      activeConversationId?: string | null;
      messages?: ChatMessage[];
      error?: string | null;
      recoveryActionsBlockedReason?: string | null;
      retryPendingAssistantId?: string | null;
      onRetry?: (message: ChatMessage, actionType?: string) => void;
      onSend?: (
        prompt: string,
        attachments: unknown[],
        commentAttachments: unknown[],
        meta?: unknown,
      ) => unknown;
    }) => {
      chatSurface.props = props as unknown as ComponentProps<typeof ChatPaneComponent>;
      const failed = [...(props.messages ?? [])]
        .reverse()
        .find((message) => message.role === 'assistant' && message.runStatus === 'failed');
      return (
        <section>
          {chatSurface.props?.composerFooterAccessory}
          <output data-testid="active-conversation">{props.activeConversationId ?? ''}</output>
          <output data-testid="host-error">{props.error ?? ''}</output>
          <output data-testid="retry-pending-id">{props.retryPendingAssistantId ?? 'none'}</output>
          <output data-testid="assistant-summary">
            {(props.messages ?? [])
              .filter((message) => message.role === 'assistant')
              .map((message) => `${message.id}|${message.runStatus ?? ''}|${message.runId ?? ''}`)
              .join('\n')}
          </output>
          <output data-testid="user-summary">
            {(props.messages ?? [])
              .filter((message) => message.role === 'user')
              .map((message) => message.id)
              .join('\n')}
          </output>
          <button
            type="button"
            data-testid="chat-retry"
            onClick={() => {
              if (failed) props.onRetry?.(failed, 'manual_retry');
            }}
          >
            retry
          </button>
          <button
            type="button"
            data-testid="send-message"
            onClick={() => {
              void Promise.resolve(props.onSend?.(nextPrompt, [], [])).then((outcome) => {
                sendOutcomes.push(outcome);
              });
            }}
          >
            send
          </button>
        </section>
      );
    },
  };
});

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

let conversationMessages: ChatMessage[] = [];
let nextPrompt = 'a fresh prompt';

/** streamViaDaemon 的 provider 契约档：accepted / lost（响应丢失）/ conflict（明确拒绝）。 */
const streamMode = vi.hoisted(() => ({ mode: 'accepted' as 'accepted' | 'lost' | 'conflict' }));

beforeEach(() => {
  mokinaEdition.on = true;
  chatSurface.props = null;
  sendOutcomes.length = 0;
  streamMode.mode = 'accepted';
  nextPrompt = 'a fresh prompt';
  window.localStorage.clear();
  window.sessionStorage.clear();
  conversationMessages = [];
  daemonMocks.queryRunByClientRequest.mockReset();
  daemonMocks.queryRunByClientRequest.mockResolvedValue(null);
  listConversations.mockResolvedValue([conversation]);
  createConversation.mockResolvedValue(conversation);
  listMessages.mockImplementation(async () => conversationMessages);
  fetchPreviewComments.mockResolvedValue([]);
  fetchProjectFiles.mockResolvedValue([]);
  fetchLiveArtifacts.mockResolvedValue([]);
  fetchBrands.mockResolvedValue([]);
  loadTabs.mockResolvedValue({ tabs: [], active: null });
  fetchChatRunStatus.mockResolvedValue(null);
  listActiveChatRuns.mockResolvedValue([]);
  listProjectRuns.mockResolvedValue([]);
  saveMessage.mockResolvedValue(null);
  streamViaDaemon.mockReset();
  streamViaDaemon.mockImplementation(async (options: {
    onBeforeRunCreate?: () => boolean;
    onRunCreateAccepted?: () => void;
    onRunCreateFailed?: (info: { definitive: boolean }) => void;
    onRunCreated?: (runId: string) => void;
    handlers: { onError: (error: Error) => void };
    clientRequestId?: string | null;
  }) => {
    if (options.onBeforeRunCreate?.() === false) {
      options.handlers.onError(new Error('run create blocked before dispatch'));
      return;
    }
    if (streamMode.mode === 'lost') {
      options.onRunCreateFailed?.({ definitive: false });
      options.handlers.onError(new Error('connection reset before receipt'));
      return;
    }
    if (streamMode.mode === 'conflict') {
      options.onRunCreateFailed?.({ definitive: true });
      options.handlers.onError(new Error('IDEMPOTENCY_CONFLICT'));
      return;
    }
    options.onRunCreateAccepted?.();
    options.onRunCreated?.('run-1');
  });
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

async function waitForConversation() {
  await waitFor(() =>
    expect(screen.getByTestId('active-conversation').textContent).toBe('conv-a'),
  );
}

/** 走完一次「发送 → 响应丢失」：会话里留下未知请求记录与失败气泡。 */
async function sendAndLoseResponse() {
  renderProjectView();
  await waitForConversation();
  streamMode.mode = 'lost';
  fireEvent.click(screen.getByTestId('send-message'));
  await waitFor(() =>
    expect(document.querySelector('[data-testid="mokina-pending-send"]')).not.toBeNull(),
  );
  expect(storedRecords().some((r) => r.status === 'unknown')).toBe(true);
}

describe('R2 「结果待确认」的显式出口', () => {
  it('服务端没收到时：重新发送复用原 clientRequestId 与快照全文，成功后记录清除', async () => {
    await sendAndLoseResponse();
    const firstCall = streamViaDaemon.mock.calls[0]?.[0] as { clientRequestId: string };
    streamMode.mode = 'accepted';
    fireEvent.click(screen.getByTestId('mokina-pending-send-resend'));
    await waitFor(() => {
      expect(storedRecords()).toHaveLength(0);
    });
    // 查询先行 + 一次显式重发，共两次 provider 调用；重发复用原请求身份。
    expect(daemonMocks.queryRunByClientRequest).toHaveBeenCalled();
    expect(streamViaDaemon).toHaveBeenCalledTimes(2);
    const resendCall = streamViaDaemon.mock.calls[1]?.[0] as {
      clientRequestId: string;
      history: ChatMessage[];
    };
    expect(resendCall.clientRequestId).toBe(firstCall.clientRequestId);
    const resentUser = resendCall.history.filter((m) => m.role === 'user').at(-1);
    expect(resentUser?.content).toBe('a fresh prompt');
    // 不画出重复的用户消息行。
    expect(screen.getByTestId('user-summary').textContent.split('\n').filter(Boolean))
      .toHaveLength(1);
  });

  it('服务端已受理时：重新发送先只读核对，恢复原 run，不再 POST', async () => {
    await sendAndLoseResponse();
    const assistantId = screen.getByTestId('assistant-summary').textContent.split('|')[0];
    daemonMocks.queryRunByClientRequest.mockResolvedValue({
      id: 'run-original',
      status: 'running',
      createdAt: 9,
      assistantMessageId: assistantId,
    });
    const callsBefore = streamViaDaemon.mock.calls.length;
    fireEvent.click(screen.getByTestId('mokina-pending-send-resend'));
    await waitFor(() => {
      expect(storedRecords()).toHaveLength(0);
    });
    expect(streamViaDaemon).toHaveBeenCalledTimes(callsBefore);
    // 原 assistant 行恢复 run 身份，不新增行。
    expect(screen.getByTestId('assistant-summary').textContent).toContain('run-original');
    expect(screen.getByTestId('assistant-summary').textContent.split('\n').filter(Boolean))
      .toHaveLength(1);
  });

  it('服务端明确拒绝（409）时：重新发送转入可编辑草稿，快照完整正文保留', async () => {
    await sendAndLoseResponse();
    streamMode.mode = 'conflict';
    fireEvent.click(screen.getByTestId('mokina-pending-send-resend'));
    await waitFor(() => {
      expect(storedRecords()[0]?.status).toBe('draft');
    });
    const record = storedRecords()[0];
    expect(record?.snapshot?.prompt).toBe('a fresh prompt');
    expect(screen.getByTestId('mokina-pending-send-restore')).not.toBeNull();
  });

  it('放弃这条：清除记录与提示，普通重试不再被拦', async () => {
    await sendAndLoseResponse();
    fireEvent.click(screen.getByTestId('mokina-pending-send-discard'));
    await waitFor(() => {
      expect(storedRecords()).toHaveLength(0);
    });
    expect(document.querySelector('[data-testid="mokina-pending-send"]')).toBeNull();
    streamMode.mode = 'accepted';
    // 重试不再被 unknown 记录拦下：retry 管线发起了第二次 provider 调用。
    fireEvent.click(screen.getByTestId('chat-retry'));
    await waitFor(() => {
      expect(streamViaDaemon.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('R2 大小上限不再拒发', () => {
  it('100Ki 正文照常发送，只提示不可自动恢复，不出现保存失败', async () => {
    renderProjectView();
    await waitForConversation();
    nextPrompt = 'y'.repeat(100 * 1024);
    fireEvent.click(screen.getByTestId('send-message'));
    await waitFor(() => {
      expect(sendOutcomes[0]).toBeUndefined();
    });
    expect(streamViaDaemon).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('host-error').textContent).not.toContain('mokina.pendingSend.saveFailed');
    expect(screen.getByTestId('host-error').textContent).toContain('mokina.pendingSend.notRecoverable');
  });

  it('25 条批注（超过 20 条上限）照常发送', async () => {
    renderProjectView();
    await waitForConversation();
    const comments = Array.from({ length: 25 }, (_, i) => ({
      id: `c-${i}`, filePath: 'a.html', elementId: `el-${i}`, body: 'note',
    }));
    const onSend = (chatSurface.props as unknown as {
      onSend: (p: string, a: unknown[], c: unknown[]) => Promise<boolean>;
    }).onSend;
    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await onSend('with many comments', [], comments);
    });
    expect(outcome).toBeUndefined();
    expect(streamViaDaemon).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('host-error').textContent).not.toContain('mokina.pendingSend.saveFailed');
  });
});
