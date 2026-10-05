// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));

import type { ProjectFile } from '../../src/types';
import { FileViewer } from '../../src/components/FileViewer';
import {
  clearMokinaRevisionJobIfCurrent,
  reconcileMokinaRevisionJob,
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
  it('recovers an accepted run from the original artifact intent without a second POST', async () => {
    const intent: MokinaRevisionJob = { ...job('ignored', 'lost'), runId: undefined,
      clientRequestId: 'request-lost', conversationId: 'conversation-lost', revisionProjectId: 'revision-project' };
    localStorage.setItem('mokina:revision:lost', JSON.stringify(intent));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ runs: [{
      id: 'accepted-run', clientRequestId: 'request-lost', projectId: 'revision-project', conversationId: 'conversation-lost', status: 'succeeded',
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const recovered = await reconcileMokinaRevisionJob('mokina:revision:lost', intent);
    expect(recovered.runId).toBe('accepted-run');
    expect(parseMokinaRevisionJob(localStorage.getItem('mokina:revision:lost'))?.runId).toBe('accepted-run');
    expect(fetchMock.mock.calls).toHaveLength(1);
    localStorage.clear(); vi.unstubAllGlobals();
  });

  it('uses the already persisted accepted identity when the panel still holds its earlier intent', async () => {
    const intent: MokinaRevisionJob = { ...job('ignored', 'race'), runId: undefined,
      clientRequestId: 'request-race', conversationId: 'conversation-race', revisionProjectId: 'revision-race' };
    localStorage.setItem('mokina:revision:race', JSON.stringify({ ...intent, runId: 'accepted-race' }));
    const fetchMock = vi.fn(async () => Response.json({ runs: [{ id: 'accepted-race',
      clientRequestId: 'request-race', projectId: 'revision-race', conversationId: 'conversation-race' }] }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(reconcileMokinaRevisionJob('mokina:revision:race', intent)).resolves.toMatchObject({ runId: 'accepted-race' });
    expect(fetchMock).not.toHaveBeenCalled();
    localStorage.clear(); vi.unstubAllGlobals();
  });

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
  options: { versions?: Array<typeof currentVersion>; historyContent?: Promise<Response> } = {},
) {
  let candidateAttempts = 0;
  let statusReads = 0;
  const candidateOperations: string[] = [];
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/projects/project-1/files/index.html/versions' && method === 'GET') {
      return new Response(JSON.stringify({ file, versions: options.versions ?? [currentVersion] }), { status: 200 });
    }
    if (url === '/api/projects/project-1/files/index.html/versions/old' && options.historyContent) {
      return options.historyContent;
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

  it('opens chapter revision directly and moves focus without starting a run', async () => {
    const { fetchMock } = setupRecoveryFetch('running');
    render(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml={source} />);
    fireEvent.click(screen.getByRole('button', { name: '修订章节' }));
    const select = await screen.findByRole('combobox', { name: '要修订的章节' });
    await waitFor(() => expect(document.activeElement).toBe(select));
    const panel = screen.getByRole('dialog', { name: 'Versions' });
    fireEvent.change(select, { target: { value: 'strategy' } });
    const prompt = screen.getByRole('textbox', { name: '章节修改要求' });
    fireEvent.change(prompt, { target: { value: '保留尚未发送的修订要求' } });
    expect(screen.getByText('所选：v1 · 当前稿')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/runs' && init?.method === 'POST')).toBe(false);
    // This component test checks state retention. Full-workspace Playwright
    // coverage separately proves these panel-owned controls are actionable.
    const continueButton = within(panel).getByRole('button', { name: '继续制作' });
    fireEvent.pointerDown(continueButton);
    expect(screen.queryByRole('dialog', { name: 'Versions' })).toBe(panel);
    fireEvent.pointerUp(continueButton);
    fireEvent.click(continueButton);
    const continuation = screen.getByRole('region', { name: '选择性接续' });
    await waitFor(() => expect(document.activeElement).toBe(within(continuation).getByRole('checkbox')));
    expect((within(continuation).getByRole('button', { name: '创建接续项目（不发送）' }) as HTMLButtonElement).disabled).toBe(true);
    const chapter = within(continuation).getByRole('checkbox') as HTMLInputElement;
    fireEvent.click(chapter);
    const background = within(continuation).getByRole('textbox', { name: '接续背景' }) as HTMLTextAreaElement;
    fireEvent.change(background, { target: { value: '保留尚未发送的接续背景' } });
    const revisionButton = within(panel).getByRole('button', { name: '修订章节' });
    fireEvent.pointerDown(revisionButton);
    expect(screen.queryByRole('dialog', { name: 'Versions' })).toBe(panel);
    fireEvent.pointerUp(revisionButton);
    fireEvent.click(revisionButton);
    await waitFor(() => expect(document.activeElement).toBe(select));
    expect((select as HTMLSelectElement).value).toBe('strategy');
    expect((prompt as HTMLTextAreaElement).value).toBe('保留尚未发送的修订要求');
    fireEvent.click(continueButton);
    await waitFor(() => expect(document.activeElement).toBe(chapter));
    expect(chapter.checked).toBe(true);
    expect(background.value).toBe('保留尚未发送的接续背景');
    expect(screen.getByText('所选：v1 · 当前稿')).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Versions' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/runs' && init?.method === 'POST')).toBe(false);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/projects' && init?.method === 'POST')).toBe(false);
  });

  it('explains missing chapters instead of silently opening an unrelated version panel', async () => {
    setupRecoveryFetch('running');
    render(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml="<html><body>普通成果</body></html>" />);
    fireEvent.click(screen.getByRole('button', { name: '继续制作' }));
    const message = await screen.findByText('此版本没有可选择的章节，暂时不能修订或接续。');
    await waitFor(() => expect(document.activeElement).toBe(message));
    expect(screen.queryByRole('button', { name: '创建接续项目（不发送）' })).toBeNull();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Versions' })).getByRole('button', { name: '修订章节' }));
    await waitFor(() => expect(document.activeElement).toBe(message));
    expect(screen.queryByRole('button', { name: '生成候选（不改当前稿）' })).toBeNull();
  });

  it('keeps read-only action entries disabled', () => {
    const { fetchMock } = setupRecoveryFetch('running');
    render(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml={source} viewerOnly />);
    for (const name of ['修订章节', '继续制作']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(screen.queryByRole('dialog', { name: 'Versions' })).toBeNull();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('keeps both panel actions available to explain an empty version history', async () => {
    const { fetchMock } = setupRecoveryFetch('running', undefined, undefined, { versions: [] });
    const panel = await openRecoveryPanel();
    for (const name of ['修订章节', '继续制作']) {
      fireEvent.click(within(panel).getByRole('button', { name }));
      const status = await within(panel).findByText('尚无已保存版本；请先完成并保存方案。');
      await waitFor(() => expect(document.activeElement).toBe(status));
    }
    expect(fetchMock.mock.calls.some(([url, init]) =>
      (String(url) === '/api/projects' || String(url) === '/api/runs') && init?.method === 'POST')).toBe(false);
  });

  it('disables the mounted panel actions when the viewer becomes read-only', async () => {
    const { fetchMock } = setupRecoveryFetch('running');
    const view = render(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml={source} />);
    fireEvent.click(screen.getByRole('button', { name: '修订章节' }));
    const panel = await screen.findByRole('dialog', { name: 'Versions' });
    await within(panel).findByRole('combobox', { name: '要修订的章节' });
    view.rerender(<FileViewer projectId="project-1" projectKind="prototype" file={file} liveHtml={source} viewerOnly />);
    for (const name of ['修订章节', '继续制作']) {
      expect((within(panel).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((within(panel).getByRole('button', { name: '生成候选（不改当前稿）' }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock.mock.calls.some(([url, init]) =>
      (String(url) === '/api/projects' || String(url) === '/api/runs') && init?.method === 'POST')).toBe(false);
  });

  it('waits for selected history content and handles the latest panel action without changing versions', async () => {
    const historical = { ...currentVersion, id: 'old', label: '早期方案', current: false };
    let resolveHistory!: (response: Response) => void;
    const historyContent = new Promise<Response>(resolve => { resolveHistory = resolve; });
    const { fetchMock } = setupRecoveryFetch('running', undefined, undefined, {
      versions: [{ ...currentVersion, version: 2 }, historical], historyContent,
    });
    const panel = await openRecoveryPanel();
    await within(panel).findByRole('combobox', { name: '要修订的章节' });
    fireEvent.click(within(panel).getByRole('option', { name: /早期方案/ }));
    fireEvent.click(within(panel).getByRole('button', { name: '修订章节' }));
    await within(panel).findByText('正在读取所选版本；读取失败时请重新选择版本。');
    fireEvent.click(within(panel).getByRole('button', { name: '继续制作' }));
    await act(async () => {
      resolveHistory(new Response(JSON.stringify({ version: historical,
        content: '<section id="history" data-mokina-id="history">早期结论</section>' }), { status: 200 }));
    });
    const checkbox = await within(panel).findByRole('checkbox', { name: 'history：早期结论' });
    await waitFor(() => expect(document.activeElement).toBe(checkbox));
    expect(within(panel).getByText('所选：v1 · 历史稿')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: '修订章节' }));
    const status = await within(panel).findByText('章节修订仅支持当前稿；请先选择当前版本。');
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(within(panel).queryByRole('combobox', { name: '要修订的章节' })).toBeNull();
    expect(fetchMock.mock.calls.some(([url, init]) =>
      (String(url) === '/api/projects' || String(url) === '/api/runs') && init?.method === 'POST')).toBe(false);
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
