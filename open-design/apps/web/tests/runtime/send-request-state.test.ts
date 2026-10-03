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
} from '../../src/runtime/chat/send-request-state';

const SCOPE = { projectId: 'p1', conversationId: 'c1' } as const;

beforeEach(() => {
  window.localStorage.clear();
});

describe('send-request-state 三态持久化', () => {
  it('pending 落盘可读回；clear 移除指定请求', () => {
    expect(savePendingSendRequest({ ...SCOPE, clientRequestId: 'req-1', prompt: '你好' })).toBe(true);
    expect(loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId)).toEqual([
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

  it('同 scope 记录封顶 8 条，最旧的先淘汰', () => {
    for (let i = 0; i < 10; i += 1) {
      savePendingSendRequest({ ...SCOPE, clientRequestId: `req-${i}`, prompt: 'x' });
    }
    const records = loadSendRequestRecords(SCOPE.projectId, SCOPE.conversationId);
    expect(records).toHaveLength(8);
    expect(records[0]?.clientRequestId).toBe('req-2');
    expect(records.at(-1)?.clientRequestId).toBe('req-9');
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
