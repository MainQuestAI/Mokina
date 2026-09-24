// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectFile } from '../../src/types';
import { FileViewer } from '../../src/components/FileViewer';
import {
  clearMokinaRevisionJobIfCurrent,
  parseMokinaRevisionJob,
  storeMokinaRevisionJobIfVacant,
  type MokinaRevisionJob,
} from '../../src/components/FileViewer';

function job(runId: string, operationId: string): MokinaRevisionJob {
  return {
    runId,
    operationId,
    revisionProjectId: `project-${runId}`,
    baseVersionId: 'base-version',
    sectionId: 'strategy',
    prompt: 'revise',
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('Mokina revision recovery record ownership', () => {
  it('does not let a second run overwrite a pending recovery record', () => {
    const storage = memoryStorage();
    const first = job('run-a', 'operation-a');
    const second = job('run-b', 'operation-b');
    expect(storeMokinaRevisionJobIfVacant(storage, 'revision', first)).toBe(true);
    expect(storeMokinaRevisionJobIfVacant(storage, 'revision', second)).toBe(false);
    expect(parseMokinaRevisionJob(storage.getItem('revision'))).toEqual(first);
  });

  it('lets an old completion clear only its own run and operation', () => {
    const storage = memoryStorage();
    const first = job('run-a', 'operation-a');
    const newer = job('run-b', 'operation-b');
    storage.setItem('revision', JSON.stringify(newer));
    expect(clearMokinaRevisionJobIfCurrent(storage, 'revision', first)).toBe(false);
    expect(parseMokinaRevisionJob(storage.getItem('revision'))).toEqual(newer);
    expect(clearMokinaRevisionJobIfCurrent(storage, 'revision', newer)).toBe(true);
    expect(storage.getItem('revision')).toBeNull();
  });
});

const source = '<html><body><section id="strategy" data-mokina-id="strategy">原渠道</section></body></html>';
const revisionKey = 'mokina:revision:project-1:index.html';
const file: ProjectFile = {
  name: 'index.html', path: 'index.html', type: 'file', size: source.length,
  mtime: 1710000000, kind: 'html', mime: 'text/html',
};
const currentVersion = {
  id: 'v1', fileName: 'index.html', version: 1, label: 'Version 1',
  createdAt: 1710000000000, source: 'manual', size: source.length,
  mime: 'text/html', kind: 'html', current: true,
};

function setupRecoveryFetch(
  status: 'running' | 'succeeded',
  failure?: 'missing-replacement' | 'invalid-candidate',
  secondStatus?: Promise<Response>,
) {
  let candidateAttempts = 0;
  let statusReads = 0;
  const candidateOperations: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/projects/project-1/files/index.html/versions' && method === 'GET') {
      return new Response(JSON.stringify({ file, versions: [currentVersion] }), { status: 200 });
    }
    if (url === '/api/projects/project-1/export/html' && method === 'POST') {
      return new Response(source, { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url === '/api/runs/run-a' && method === 'GET') {
      statusReads++;
      if (statusReads === 2 && secondStatus) return secondStatus;
      return new Response(JSON.stringify({ run: { status } }), { status: 200 });
    }
    if (url === '/api/runs/run-a/cancel' && method === 'POST') {
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
    }
    if (url === '/api/projects/project-run-a/raw/MOKINA-REPLACEMENT.html') {
      if (failure === 'missing-replacement') return new Response('{}', { status: 404 });
      return new Response('<section id="strategy" data-mokina-id="strategy">新渠道</section>', { status: 200 });
    }
    if (url === '/api/projects/project-1/files/index.html/candidates' && method === 'POST') {
      candidateAttempts++;
      candidateOperations.push((JSON.parse(String(init?.body)) as { operationId: string }).operationId);
      if (failure === 'invalid-candidate') {
        return new Response(JSON.stringify({ error: { message: '替换章节无效' } }), { status: 400 });
      }
      return candidateAttempts === 1
        ? new Response(JSON.stringify({ error: { message: '保存失败' } }), { status: 500 })
        : new Response(JSON.stringify({ version: { ...currentVersion, id: 'v2', version: 2, current: false } }), { status: 200 });
    }
    if (url === '/api/projects/project-1' && method === 'GET') {
      return new Response(JSON.stringify({ project: { metadata: {} } }), { status: 200 });
    }
    if (url === '/api/projects' && method === 'POST') {
      return new Response(JSON.stringify({ project: { id: 'project-run-b' }, conversationId: 'conversation-b' }), { status: 200 });
    }
    if (url === '/api/projects/project-run-b/files' && method === 'POST') {
      return new Response(JSON.stringify({ file }), { status: 200 });
    }
    if (url === '/api/runs' && method === 'POST') {
      return new Response(JSON.stringify({ runId: 'run-b' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, candidateOperations };
}

async function openRecoveryPanel() {
  render(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml={source} />);
  fireEvent.click(screen.getByRole('button', { name: 'Versions' }));
  return screen.findByRole('dialog', { name: 'Versions' });
}

describe('Mokina revision recovery UI', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('keeps a running job after cancel fails and blocks a second generation', async () => {
    const saved = job('run-a', 'operation-a');
    localStorage.setItem(revisionKey, JSON.stringify(saved));
    const { fetchMock } = setupRecoveryFetch('running');
    const dialog = await openRecoveryPanel();
    const generate = within(dialog).getByRole('button', { name: '生成候选（不改当前稿）' }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消本次修订' }));
    await waitFor(() => expect(within(dialog).getByText('取消请求失败；请检查运行状态后重试。')).toBeTruthy());
    expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))).toEqual(saved);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/runs/run-a/cancel')).toBe(true);
    expect(generate.disabled).toBe(true);
    expect(within(dialog).queryByRole('button', { name: '放弃本次结果' })).toBeNull();
  });

  it('preserves a succeeded job after candidate save fails and retries with one operation ID', async () => {
    const saved = job('run-a', 'operation-a');
    localStorage.setItem(revisionKey, JSON.stringify(saved));
    const { candidateOperations } = setupRecoveryFetch('succeeded');
    const dialog = await openRecoveryPanel();
    const resume = await within(dialog).findByRole('button', { name: '保存已完成运行的候选' });
    fireEvent.click(resume);
    await waitFor(() => expect(within(dialog).getByText('保存失败')).toBeTruthy(), { timeout: 5000 });
    expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))).toEqual(saved);
    fireEvent.click(within(dialog).getByRole('button', { name: '保存已完成运行的候选' }));
    await waitFor(() => expect(localStorage.getItem(revisionKey)).toBeNull(), { timeout: 5000 });
    expect(candidateOperations).toEqual(['operation-a', 'operation-a']);
  });

  it.each([
    ['missing-replacement', '模型未写出 MOKINA-REPLACEMENT.html；当前稿未变化。'],
    ['invalid-candidate', '替换章节无效'],
  ] as const)('lets the user abandon a succeeded job with %s and start a new revision', async (failure, message) => {
    const saved = job('run-a', 'operation-a');
    localStorage.setItem(revisionKey, JSON.stringify(saved));
    const { fetchMock } = setupRecoveryFetch('succeeded', failure);
    let dialog = await openRecoveryPanel();
    fireEvent.click(await within(dialog).findByRole('button', { name: '保存已完成运行的候选' }));
    await waitFor(() => expect(within(dialog).getByText(message)).toBeTruthy(), { timeout: 5000 });
    expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))).toEqual(saved);
    cleanup();
    dialog = await openRecoveryPanel();
    await within(dialog).findByRole('button', { name: '保存已完成运行的候选' });

    fireEvent.click(within(dialog).getByRole('button', { name: '放弃本次结果' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '返回继续保存' }));
    expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))).toEqual(saved);

    fireEvent.click(within(dialog).getByRole('button', { name: '放弃本次结果' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认放弃结果' }));
    await waitFor(() => expect(localStorage.getItem(revisionKey)).toBeNull());
    expect(fetchMock.mock.calls.some(([url]) => String(url) === '/api/runs/run-a/cancel')).toBe(false);

    fireEvent.change(within(dialog).getByRole('combobox', { name: '要修订的章节' }), { target: { value: 'strategy' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '章节修改要求' }), { target: { value: '调整渠道' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '生成候选（不改当前稿）' }));
    await waitFor(() => expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))?.runId).toBe('run-b'));
  });

  it('does not let an old abandon response clear a newer recovery record', async () => {
    const first = job('run-a', 'operation-a');
    const newer = job('run-b', 'operation-b');
    localStorage.setItem(revisionKey, JSON.stringify(first));
    let releaseStatus: (response: Response) => void = () => {};
    const secondStatus = new Promise<Response>(resolve => { releaseStatus = resolve; });
    const { fetchMock } = setupRecoveryFetch('succeeded', undefined, secondStatus);
    const dialog = await openRecoveryPanel();
    fireEvent.click(await within(dialog).findByRole('button', { name: '放弃本次结果' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认放弃结果' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/runs/run-a').length).toBe(2));
    localStorage.setItem(revisionKey, JSON.stringify(newer));
    releaseStatus(new Response(JSON.stringify({ run: { status: 'succeeded' } }), { status: 200 }));
    await waitFor(() => expect(within(dialog).getByText('修订记录已变化，请重新检查当前任务。')).toBeTruthy());
    expect(parseMokinaRevisionJob(localStorage.getItem(revisionKey))).toEqual(newer);
    expect((within(dialog).getByRole('button', { name: '生成候选（不改当前稿）' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
