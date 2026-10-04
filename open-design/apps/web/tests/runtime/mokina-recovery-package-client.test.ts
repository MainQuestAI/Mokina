// @vitest-environment jsdom
//
// T14：恢复包 Web 客户端——导出（版本锁定的 ZIP 下载）与导入（新项目）。

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  exportProjectRecoveryZip,
  importProjectRecoveryZip,
  mintRecoveryIdentity,
  saveRecoveryFile,
} from '../../src/runtime/mokina/recovery-package-client';

describe('recovery package client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('mints distinct operation and target identities', () => {
    const first = mintRecoveryIdentity();
    const second = mintRecoveryIdentity();
    expect(first.operationId).not.toBe(second.operationId);
    expect(first.targetProjectId).not.toBe(second.targetProjectId);
  });

  it('exports via the recovery route and parses the server filename', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe('/api/projects/p1/mokina/recovery-export');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body)) as { operationId: string };
      expect(body.operationId.length).toBeGreaterThan(0);
      return new Response(new Blob(['zip-bytes']), {
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="Plan-recovery.zip"' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { blob, filename } = await exportProjectRecoveryZip('p1');
    expect(filename).toBe('Plan-recovery.zip');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('falls back to a project-derived filename and surfaces server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['x']), { status: 200 })));
    expect((await exportProjectRecoveryZip('p2')).filename).toBe('p2-recovery.zip');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { message: '恢复包不含版本或快照' },
    }), { status: 409 })));
    await expect(exportProjectRecoveryZip('p2')).rejects.toThrow('恢复包不含版本或快照');
  });

  it('imports a zip as a new project and forwards identity fields', async () => {
    let captured: FormData | null = null;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('/api/mokina/recovery-import');
      captured = init?.body as FormData;
      return new Response(JSON.stringify({ projectId: 'p9', warnings: ['仅恢复原件'] }), { status: 200 });
    }));
    const file = new File([new Uint8Array([1, 2, 3])], 'recovery.zip', { type: 'application/zip' });

    const result = await importProjectRecoveryZip(file, {
      operationId: 'op-1',
      targetProjectId: 'p9',
      projectName: '恢复后的项目',
    });
    expect(result).toEqual({ projectId: 'p9', warnings: ['仅恢复原件'] });
    expect(captured).not.toBeNull();
    expect(captured!.get('operationId')).toBe('op-1');
    expect(captured!.get('targetProjectId')).toBe('p9');
    expect(captured!.get('projectName')).toBe('恢复后的项目');
    expect(captured!.get('file')).toBeInstanceOf(File);
  });

  it('rejects a bad archive with the server message and guards a missing project id', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: { message: '恢复包包含不安全路径，已拒绝：../x' },
    }), { status: 400 })));
    const file = new File([new Uint8Array([0])], 'bad.zip');
    await expect(importProjectRecoveryZip(file, { operationId: 'op', targetProjectId: 'p' }))
      .rejects.toThrow('不安全路径');

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ warnings: [] }), { status: 200 })));
    await expect(importProjectRecoveryZip(file, { operationId: 'op', targetProjectId: 'p' }))
      .rejects.toThrow('缺少项目 ID');
  });

  it('saves through a temporary object URL and revokes it', () => {
    const createObjectURL = vi.fn(() => 'blob:temporary');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveRecoveryFile(new Blob(['zip']), 'Plan-recovery.zip');

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:temporary');
  });
});
