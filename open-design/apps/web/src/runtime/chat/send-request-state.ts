/**
 * 发送三态的持久状态（Spec B1 §6.3 / FR-07/08）。
 *
 * 草稿提交前在同 scope（project+conversation）落一条 pending 记录（写入
 * 失败 → 停在草稿，不 POST）；daemon 明确接受 → 清记录；明确拒绝 → 清
 * 记录；响应丢失/超时 → 标 unknown。刷新/重开后只读查询原请求：
 * 查到受理 → 恢复原 run（既有 reattach 负责显示）并清记录；查询成功且
 * daemon 的按 clientRequestId 幂等底座证明该请求从未受理 → 回可发送草稿
 * （createOrReuse 以 clientRequestId 为键，受理过必然出现在列表里）；
 * 查询本身失败 → 保留 unknown（待确认），同请求不自动重发。
 *
 * 不持久化附件 blob 与无边界正文：prompt 截断存储，仅用于「待确认」展示。
 * 不另建数据库：沿草稿容器同域的 localStorage 键。
 */

export interface SendRequestRecord {
  readonly clientRequestId: string;
  readonly projectId: string;
  readonly conversationId: string;
  /** 截断展示用；不是重发payload。 */
  readonly promptPreview: string;
  status: 'pending' | 'unknown';
  readonly createdAt: number;
}

const MAX_RECORDS_PER_SCOPE = 8;
const PROMPT_PREVIEW_MAX_CHARS = 120;

const scopeKey = (projectId: string, conversationId: string): string =>
  `od:send-request:${projectId}:${conversationId}`;

function readScope(projectId: string, conversationId: string): SendRequestRecord[] {
  if (typeof window === 'undefined') return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(scopeKey(projectId, conversationId));
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SendRequestRecord =>
        !!item
        && typeof (item as SendRequestRecord).clientRequestId === 'string'
        && typeof (item as SendRequestRecord).projectId === 'string'
        && typeof (item as SendRequestRecord).conversationId === 'string'
        && ((item as SendRequestRecord).status === 'pending'
          || (item as SendRequestRecord).status === 'unknown'),
    );
  } catch {
    return [];
  }
}

function writeScope(projectId: string, conversationId: string, records: SendRequestRecord[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (records.length === 0) window.localStorage.removeItem(scopeKey(projectId, conversationId));
    else window.localStorage.setItem(scopeKey(projectId, conversationId), JSON.stringify(records));
    return true;
  } catch {
    // 隐私模式 / 配额满：写入失败 → 调用方停在草稿，不 POST。
    return false;
  }
}

export function loadSendRequestRecords(projectId: string, conversationId: string): SendRequestRecord[] {
  return readScope(projectId, conversationId);
}

/**
 * pending 落盘。返回 false = 写不进去（调用方必须停在草稿、不 POST）。
 */
export function savePendingSendRequest(input: {
  clientRequestId: string;
  projectId: string;
  conversationId: string;
  prompt: string;
}): boolean {
  const records = readScope(input.projectId, input.conversationId);
  const next: SendRequestRecord[] = [
    ...records.filter((record) => record.clientRequestId !== input.clientRequestId),
    {
      clientRequestId: input.clientRequestId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      promptPreview: input.prompt.slice(0, PROMPT_PREVIEW_MAX_CHARS),
      status: 'pending' as const,
      createdAt: Date.now(),
    },
  ].slice(-MAX_RECORDS_PER_SCOPE);
  return writeScope(input.projectId, input.conversationId, next);
}

export function markSendRequestUnknown(
  projectId: string,
  conversationId: string,
  clientRequestId: string,
): void {
  const records = readScope(projectId, conversationId);
  if (!records.some((record) => record.clientRequestId === clientRequestId)) return;
  const next = records.map((record) =>
    record.clientRequestId === clientRequestId ? { ...record, status: 'unknown' as const } : record,
  );
  writeScope(projectId, conversationId, next);
}

export function clearSendRequestRecord(
  projectId: string,
  conversationId: string,
  clientRequestId: string,
): void {
  const records = readScope(projectId, conversationId);
  const next = records.filter((record) => record.clientRequestId !== clientRequestId);
  if (next.length === records.length) return;
  writeScope(projectId, conversationId, next);
}

export type RunAcceptedQueryResult = true | false | null;

/**
 * 只读查询原请求是否已被受理（GET /api/runs，无副作用、不创建 run）。
 * true = 查到受理；false = 查询成功且该请求未受理（可回草稿）；
 * null = 查询本身失败/超时（不能可靠关联 → 待确认）。
 */
export async function queryRunAccepted(
  projectId: string,
  conversationId: string,
  clientRequestId: string,
  timeoutMs = 10_000,
): Promise<RunAcceptedQueryResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let body: { runs?: Array<{ clientRequestId?: string | null }> };
    try {
      const resp = await fetch(
        `/api/runs?projectId=${encodeURIComponent(projectId)}&conversationId=${encodeURIComponent(conversationId)}`,
        { cache: 'no-store', signal: controller.signal },
      );
      if (!resp.ok) return null;
      body = await resp.json() as { runs?: Array<{ clientRequestId?: string | null }> };
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(body.runs)) return null;
    return body.runs.some((run) => run?.clientRequestId === clientRequestId);
  } catch {
    return null;
  }
}

/** 测试用：清空全部 scope（模块级键与草稿容器同域，须显式清理）。 */
export function resetSendRequestRecordsForTests(): void {
  if (typeof window === 'undefined') return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith('od:send-request:')) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
