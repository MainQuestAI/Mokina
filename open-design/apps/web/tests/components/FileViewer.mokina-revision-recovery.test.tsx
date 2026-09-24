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

function setupRecoveryFetch(status: 'running' | 'succeeded') {
  let candidateAttempts = 0;
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
      return new Response(JSON.stringify({ run: { status } }), { status: 200 });
    }
    if (url === '/api/runs/run-a/cancel' && method === 'POST') {
      return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
    }
    if (url === '/api/projects/project-run-a/raw/MOKINA-REPLACEMENT.html') {
      return new Response('<section id="strategy" data-mokina-id="strategy">新渠道</section>', { status: 200 });
    }
    if (url === '/api/projects/project-1/files/index.html/candidates' && method === 'POST') {
      candidateAttempts++;
      candidateOperations.push((JSON.parse(String(init?.body)) as { operationId: string }).operationId);
      return candidateAttempts === 1
        ? new Response(JSON.stringify({ error: { message: '保存失败' } }), { status: 500 })
        : new Response(JSON.stringify({ version: { ...currentVersion, id: 'v2', version: 2, current: false } }), { status: 200 });
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
});
