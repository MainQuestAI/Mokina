// @vitest-environment jsdom
//
// T14：恢复包 Web 客户端——导出（版本锁定的 ZIP 下载）与导入（新项目）。

import { afterEach, describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';

import {
  exportProjectRecoveryZip,
  importProjectRecoveryZip,
  mintRecoveryIdentity,
  saveRecoveryFile,
  RecoveryExportIncompleteError,
} from '../../src/runtime/mokina/recovery-package-client';

async function archive(status: 'complete' | 'partial' = 'complete') {
  const zip = new JSZip();
  zip.file('mokina-recovery.json', JSON.stringify({ schema: 'mokina.project-recovery.v2', files: [], versions: [], contexts: [],
    integrity: { status, issues: status === 'partial' ? [{ path: 'history', reason: 'missing', message: 'Missing version' }] : [] } }));
  return zip.generateAsync({ type: 'arraybuffer' });
}

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
      expect(JSON.parse(String(init?.body)).mode).toBe('complete');
      return new Response(await archive(), {
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
    vi.stubGlobal('fetch', vi.fn(async () => new Response(await archive(), { status: 200 })));
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
    expect(result).toEqual({ projectId: 'p9', warnings: ['仅恢复原件'], integrity: { status: 'unknown', issues: [] } });
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

  it('never automatically retries a failed complete export as salvage', async () => {
    const issues = [{ path: '.file-versions', reason: 'unreadable', message: 'Permission denied' }];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: {
      code: 'MOKINA_RECOVERY_INCOMPLETE', message: 'Not complete', details: { issues, canSalvage: true },
    } }), { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(exportProjectRecoveryZip('p1')).rejects.toBeInstanceOf(RecoveryExportIncompleteError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads the actual partial ZIP report only after explicit salvage, and refuses silent downgrade', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(await archive('partial'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(exportProjectRecoveryZip('p1')).rejects.toThrow('未提供可确认完整');
    const result = await exportProjectRecoveryZip('p1', { mode: 'partial' });
    expect(result.integrity).toEqual({ status: 'partial', issues: [{ path: 'history', reason: 'missing', message: 'Missing version' }] });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).mode).toBe('partial');
  });
});
