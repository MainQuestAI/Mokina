// @vitest-environment jsdom
//
// 发送三态持久状态（Spec B1 §6.3 / FR-07/08）：pending 落盘失败不 POST、
// unknown 保留身份、只读查询三结果、同 scope 记录上限。

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSendRequestRecord,
  loadSendRequestRecords,
  markSendRequestUnknown,
  savePendingSendRequest,
  queryRunAccepted, persistPendingSendRequest,
  markSendRequestDispatched, recoverSendRequestRecords, releaseSendRequestOwnersForTests, resetSendRequestRecordsForTests,
} from '../../src/runtime/chat/send-request-state';

const SCOPE = { projectId: 'p1', conversationId: 'c1' } as const;

beforeEach(() => {
  window.localStorage.clear();
  resetSendRequestRecordsForTests();
});

describe('send-request-state 三态持久化', () => {
  it('pending 落盘可读回；clear 移除指定请求', () => {
    expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'req-1', prompt: '你好' })).toBe(true);
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)).toMatchObject([
      {
        clientRequestId: 'req-1',
        projectId: 'p1',
        conversationId: 'c1',
        promptPreview: '你好',
        status: 'pending',
        createdAt: expect.any(Number),
      },
    ]);
    clearSendRequestRecord(SCOPE.projectId, SCOPE.conversationId, 'req-1');
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)).toEqual([]);
  });

  it('unknown 标记保留身份与正文预览；不存在的请求不写入', () => {
    savePendingSendRequest({ ...SCOPE, clientRequestId: 'req-1', prompt: 'x' });
    markSendRequestUnknown(SCOPE.projectId, SCOPE.conversationId, 'req-1');
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)[0]?.status).toBe('unknown');
    markSendRequestUnknown(SCOPE.projectId, SCOPE.conversationId, 'req-ghost');
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)).toHaveLength(1);
  });

  it('长正文只存 120 字符预览（不持久化无边界正文）', () => {
    savePendingSendRequest({ ...SCOPE, clientRequestId: 'req-1', prompt: 'a'.repeat(5000) });
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)[0]?.promptPreview).toHaveLength(120);
  });

  it('同 scope 满 8 条后拒绝新增，不能挤掉未确认请求', () => {
    for (let i = 0; i < 10; i += 1) {
      savePendingSendRequest({ ...SCOPE, clientRequestId: `req-${i}`, prompt: 'x' });
    }
    const records = loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId);
    expect(records).toHaveLength(8);
    expect(records[0]?.clientRequestId).toBe('req-0');
    expect(records.at(-1)?.clientRequestId).toBe('req-7');
  });

  it('scope 之间互不串扰（跨项目不共享请求记录）', () => {
    savePendingSendRequest({ projectId: 'p1', conversationId: 'c1', clientRequestId: 'a', prompt: 'x' });
    savePendingSendRequest({ projectId: 'p2', conversationId: 'c1', clientRequestId: 'b', prompt: 'x' });
    expect(loadSendRequestRecords('p1', 'c1').map((r) => r.clientRequestId)).toEqual(['a']);
    expect(loadSendRequestRecords('p2', 'c1').map((r) => r.clientRequestId)).toEqual(['b']);
  });

  it('写入失败（配额满）时 savePendingSendRequest 返回 false——调用方须停在草稿不 POST', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'req-1', prompt: 'x' })).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('损坏的存储内容按空记录处理，不抛错', () => {
    window.localStorage.setItem('od:send-request:p1:c1', '{not-json');
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)).toEqual([]);
  });
});

 describe('受理核对不能把空列表当作未受理证明', () => {
  it('原 POST 晚到时空列表仍保持未知', async () => {
    const mock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ runs: [] })));
    try { expect(await queryRunAccepted('p1', 'c1', 'req-1')).toBeNull(); } finally { mock.mockRestore(); }
  });
 });

const extras = () => ({ attachments: [{ name: 'a.csv', kind: 'file' as const, path: 'a.csv' }], commentAttachments: [],
  quotes: [{ id: 'q', messageId: 'm', text: 'quoted' }], context: { skillIds: ['skill'], mcpServerIds: ['mcp'], connectorIds: [], workspaceItems: [] } });
it('saves complete bounded prompt and extras regardless of object property order', () => {
  const prompt = 'a'.repeat(64 * 1024);
  expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'full', prompt, snapshot: { prompt, extras: extras() } })).toBe(true);
  expect(loadSendRequestRecords('p1', 'c1')[0]?.snapshot).toEqual({ prompt, extras: extras() });
  expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'oversize', prompt: prompt + 'x' })).toBe(false);
  const tooMany = extras(); tooMany.quotes = Array.from({ length: 21 }, (_, i) => ({ id: String(i), messageId: 'm', text: 'x' }));
  expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'shed', prompt: 'x', snapshot: { prompt: 'x', extras: tooMany } })).toBe(false);
});
it('live prepared and dispatched sends remain pending; orphan phases recover conservatively without age guesses', () => {
  savePendingSendRequest({ ...SCOPE, clientRequestId: 'prepared', prompt: 'x' });
  savePendingSendRequest({ ...SCOPE, clientRequestId: 'dispatch', prompt: 'y' });
  expect(markSendRequestDispatched('p1', 'c1', 'dispatch')).toBe(true);
  expect(recoverSendRequestRecords('p1', 'c1').map(r => r.status)).toEqual(['pending', 'pending']);
  releaseSendRequestOwnersForTests();
  expect(recoverSendRequestRecords('p1', 'c1').map(r => r.status)).toEqual(['draft', 'unknown']);
});
it('legacy preview-only pending becomes unknown, never a restored full draft', () => {
  window.localStorage.setItem('od:send-request:p1:c1', JSON.stringify([{ ...SCOPE, clientRequestId: 'old', promptPreview: 'preview', status: 'pending', createdAt: 0 }]));
  expect(recoverSendRequestRecords('p1', 'c1')[0]).toMatchObject({ status: 'unknown' });
  expect(recoverSendRequestRecords('p1', 'c1')[0]?.snapshot).toBeUndefined();
});
it('authority scopes and independently saved requests cannot overwrite siblings', () => {
  for (const [id, authorityKey] of [['a', 'A'], ['b', 'A'], ['a', 'B']]) savePendingSendRequest({ ...SCOPE, clientRequestId: id!, authorityKey, prompt: 'x' });
  markSendRequestUnknown('p1', 'c1', 'a', 'A');
  expect(loadSendRequestRecords('p1', 'c1', 'A').map(r => r.clientRequestId)).toEqual(['a', 'b']);
  expect(loadSendRequestRecords('p1', 'c1', 'B')[0]?.status).toBe('pending');
});

it('native scope lock serializes simultaneous preparations and keeps all eight old receipts', async () => {
  let tail = Promise.resolve(); const names: string[] = [];
  const original = Object.getOwnPropertyDescriptor(navigator, 'locks');
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (name: string, _options: unknown, callback: () => boolean) => {
    names.push(name); const result = tail.then(callback); tail = result.then(() => {}); return result;
  } } });
  try {
    const saved = await Promise.all(Array.from({ length: 10 }, (_, index) => persistPendingSendRequest({ ...SCOPE, clientRequestId: `tab-${index}`, prompt: 'x' })));
    expect(saved.filter(Boolean)).toHaveLength(8); expect(loadSendRequestRecords('p1', 'c1')).toHaveLength(8);
    expect(new Set(names).size).toBe(1);
  } finally { if (original) Object.defineProperty(navigator, 'locks', original); else Reflect.deleteProperty(navigator, 'locks'); }
});
