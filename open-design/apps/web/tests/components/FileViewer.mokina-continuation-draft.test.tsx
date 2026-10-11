// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import type { OpenDesignHostBridge } from '@open-design/host';
vi.mock('../../src/mokina-edition', () => ({ MOKINA_LOCAL_EDITION: true }));
const host = vi.hoisted(() => ({ current: null as OpenDesignHostBridge | null }));
vi.mock('@open-design/host', async () => ({ ...await vi.importActual('@open-design/host'), getOpenDesignHost: () => host.current }));

import { FileViewer } from '../../src/components/FileViewer';
import type { ProjectFile } from '../../src/types';
import * as recoveryStore from '../../src/runtime/persistence/mokina-recovery-store';

const source = '<html><body><section id="strategy" data-mokina-id="strategy">保留门店预算</section></body></html>';
const file: ProjectFile = { name: 'plan.html', path: 'plan.html', type: 'file', size: source.length,
  mtime: 1710000000, kind: 'html', mime: 'text/html' };
const version = { id: 'v1', fileName: file.name, version: 1, label: 'Version 1', createdAt: 1710000000000,
  source: 'manual', size: source.length, mime: 'text/html', kind: 'html', current: true };

function setupFetch() {
  vi.stubGlobal('crypto', webcrypto);
  const state = { versions: [version], asset: 'image-original', brand: 'brand-original' };
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    if (/\/files\/plan.html\/versions$/.test(url)) return Response.json({ file, versions: state.versions });
    if (/\/export\/html$/.test(url)) return new Response(source, { headers: { 'content-type': 'text/html' } });
    if (/\/files$/.test(url)) return Response.json({ files: [file, { ...file, name: 'hero.png', kind: 'image', mime: 'image/png' }] });
    if (/\/raw\/hero.png$/.test(url)) return new Response(state.asset);
    if (url === '/api/design-systems') return Response.json({ designSystems: [{ id: 'brand', title: '门店品牌' }] });
    if (url === '/api/design-systems/brand') return Response.json({ body: state.brand });
    if (/\/api\/projects\/[^/]+$/.test(url) && (init?.method ?? 'GET') === 'GET') return Response.json({ project: { metadata: {} } });
    return Response.json({}, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, state };
}

async function openPanel(projectId = 'source-project') {
  render(<FileViewer projectId={projectId} projectKind="other" file={file} liveHtml={source} />);
  fireEvent.click(screen.getByRole('button', { name: /^Continue$/ }));
  const panel = await screen.findByRole('dialog', { name: /^Continue$/ });
  await within(panel).findByRole('checkbox', { name: 'strategy：保留门店预算' });
  return panel;
}

const draftKey = 'od:continuation:draft:["none","source-project","plan.html"]';
const background = () => screen.getByRole('textbox', { name: 'Continuation background' }) as HTMLTextAreaElement;
const createButton = () => screen.getByRole('button', { name: 'Create continuation project (no send)' }) as HTMLButtonElement;
async function enterDraft() {
  const panel = await openPanel();
  fireEvent.click(within(panel).getByRole('checkbox', { name: 'strategy：保留门店预算' }));
  fireEvent.change(background(), { target: { value: '恢复我的继续制作要求' } });
  await waitFor(() => expect(createButton().disabled).toBe(false));
  return panel;
}
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); recoveryStore.resetDurableRecoveryForTests(); host.current = null; });

describe('Mokina creation-before-continuation draft', () => {
  it('preserves unsent requirements, selected source and intent after close and reopen without creating a project or run', async () => {
    const { fetchMock } = setupFetch();
    let panel = await openPanel();
    fireEvent.click(within(panel).getByRole('checkbox', { name: 'strategy：保留门店预算' }));
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Continuation background' }), { target: { value: '保留中文要求，先不创建活动页' } });
    fireEvent.click(within(panel).getByRole('radio', { name: 'Build a landing page (draft only, nothing generated automatically)' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/ }));
    panel = await screen.findByRole('dialog', { name: /^Continue$/ });
    await waitFor(() => expect((within(panel).getByRole('textbox', { name: 'Continuation background' }) as HTMLTextAreaElement).value).toBe('保留中文要求，先不创建活动页'));
    expect((within(panel).getByRole('checkbox', { name: 'strategy：保留门店预算' }) as HTMLInputElement).checked).toBe(true);
    expect((within(panel).getByRole('radio', { name: 'Build a landing page (draft only, nothing generated automatically)' }) as HTMLInputElement).checked).toBe(true);
    expect(fetchMock.mock.calls.some(([url, init]) => ['/api/projects', '/api/runs'].includes(String(url)) && init?.method === 'POST')).toBe(false);
  });

  it('isolates projects and restores the same unsent draft after a fresh mount', async () => {
    setupFetch();
    await enterDraft();
    cleanup(); await openPanel('other-project');
    expect(background().value).toBe('');
    expect((screen.getByRole('checkbox', { name: 'strategy：保留门店预算' }) as HTMLInputElement).checked).toBe(false);
    cleanup(); await openPanel();
    expect(background().value).toBe('恢复我的继续制作要求');
    expect((screen.getByRole('checkbox', { name: 'strategy：保留门店预算' }) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps requirements but requires explicit section selection when the saved version no longer exists', async () => {
    const { state } = setupFetch();
    await enterDraft(); cleanup();
    state.versions = [{ ...version, id: 'v2', version: 2 }];
    await openPanel();
    expect(background().value).toBe('恢复我的继续制作要求');
    await screen.findByText(/saved source version or sections are no longer selected/);
    expect(createButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'strategy：保留门店预算' }));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(JSON.parse(localStorage.getItem(draftKey)!)).toMatchObject({ baseVersionId: 'v2', background: '恢复我的继续制作要求' });
  });

  it('restores asset roles and notes, then requires confirmation when the bytes change', async () => {
    const { state, fetchMock } = setupFetch();
    await enterDraft();
    fireEvent.click(await screen.findByRole('checkbox', { name: 'hero.png' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'hero.png Assets carried into the continuation' }), { target: { value: 'hero' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'hero.png Usage note' }), { target: { value: '保留裁切说明' } });
    await waitFor(() => expect(createButton().disabled).toBe(false));
    const savedDigest = JSON.parse(localStorage.getItem(draftKey)!).assets[0].digest;
    expect(savedDigest).toMatch(/^[a-f0-9]{64}$/);
    cleanup(); state.asset = 'changed-image'; await openPanel();
    expect((screen.getByRole('textbox', { name: 'hero.png Usage note' }) as HTMLInputElement).value).toBe('保留裁切说明');
    expect((screen.getByRole('combobox', { name: 'hero.png Assets carried into the continuation' }) as HTMLSelectElement).value).toBe('hero');
    await screen.findByText(/Asset changed or could not be read: hero.png/);
    expect(createButton().disabled).toBe(true);
    expect(JSON.parse(localStorage.getItem(draftKey)!).assets[0].digest).toBe(savedDigest);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm current source' }));
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(JSON.parse(localStorage.getItem(draftKey)!).assets[0]).toMatchObject({ role: 'hero', usageNote: '保留裁切说明' });
    expect(JSON.parse(localStorage.getItem(draftKey)!).assets[0].digest).not.toBe(savedDigest);
    expect(fetchMock.mock.calls.some(([url, init]) => ['/api/projects', '/api/runs'].includes(String(url)) && init?.method === 'POST')).toBe(false);
  });

  it('restores brand identity without silently accepting updated rules', async () => {
    const { state } = setupFetch();
    await enterDraft();
    const brand = await screen.findByRole('combobox', { name: 'Brand requirements' });
    fireEvent.change(brand, { target: { value: 'brand' } });
    await screen.findByText(/Will freeze brand: 门店品牌/);
    await waitFor(() => expect(createButton().disabled).toBe(false));
    cleanup(); state.brand = 'different-brand-rules'; await openPanel();
    await screen.findByText(/saved brand rules changed or could not be read/);
    expect(background().value).toBe('恢复我的继续制作要求');
    expect(createButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm current source' }));
    await screen.findByText(/Will freeze brand: 门店品牌/);
    await waitFor(() => expect(createButton().disabled).toBe(false));
  });

  it('retains typed text and blocks creation when saving fails, then allows a successful retry', async () => {
    setupFetch(); await enterDraft();
    const mirror = vi.spyOn(recoveryStore, 'mirrorDurableRecord').mockResolvedValue(false);
    fireEvent.change(background(), { target: { value: '保存失败时仍保留的文字' } });
    await screen.findByText(/Continuation requirements could not be saved/);
    expect(background().value).toBe('保存失败时仍保留的文字');
    expect(createButton().disabled).toBe(true);
    mirror.mockResolvedValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(createButton().disabled).toBe(false));
  });

  it('does not overwrite another window draft while keeping this window input visible', async () => {
    setupFetch(); await enterDraft();
    const newer = JSON.stringify({ ...JSON.parse(localStorage.getItem(draftKey)!), background: '另一窗口的要求' });
    localStorage.setItem(draftKey, newer);
    fireEvent.change(background(), { target: { value: '本窗口尚未保存的要求' } });
    await screen.findByText(/Continuation requirements could not be saved/);
    expect(background().value).toBe('本窗口尚未保存的要求');
    expect(localStorage.getItem(draftKey)).toBe(newer);
    expect(createButton().disabled).toBe(true);
  });

  it('preserves unreadable bytes until explicit backup and reset', async () => {
    setupFetch(); localStorage.setItem(draftKey, '{invalid');
    await openPanel();
    await screen.findByText(/Saved continuation requirements cannot be read/);
    expect(background().disabled).toBe(true);
    expect(localStorage.getItem(draftKey)).toBe('{invalid');
    fireEvent.click(screen.getByRole('button', { name: 'Keep a backup and start a new draft' }));
    await waitFor(() => expect(background().disabled).toBe(false));
    expect(localStorage.getItem(draftKey)).toBeNull();
    const backup = Object.keys(localStorage).find(key => key.startsWith(`${draftKey}:unreadable:`));
    expect(localStorage.getItem(backup!)).toBe('{invalid');
  });

  it('keeps version browsing available when draft storage cannot be read, and restores the original after retry', async () => {
    setupFetch(); await enterDraft(); cleanup();
    const original = localStorage.getItem(draftKey);
    const get = Storage.prototype.getItem;
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === draftKey) throw new Error('Storage denied');
      return get.call(this, key);
    });
    await openPanel();
    await screen.findByText(/Continuation draft could not be read/);
    expect(background().disabled).toBe(true);
    expect(createButton().disabled).toBe(true);
    read.mockRestore();
    expect(localStorage.getItem(draftKey)).toBe(original);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(background().value).toBe('恢复我的继续制作要求'));
    expect(background().disabled).toBe(false);
  });

  it('ignores an old asset read after deselecting and selecting newer bytes', async () => {
    const { fetchMock, state } = setupFetch();
    await enterDraft();
    const fetch = fetchMock.getMockImplementation()!;
    let release!: (response: Response) => void;
    let first = true;
    fetchMock.mockImplementation((input, init) => {
      if (String(input).endsWith('/raw/hero.png') && first) {
        first = false;
        return new Promise(resolve => { release = resolve; });
      }
      return fetch(input, init);
    });
    const checkbox = await screen.findByRole('checkbox', { name: 'hero.png' });
    fireEvent.click(checkbox);
    await screen.findByText('Checking selected sources…');
    expect(screen.queryByText(/Asset changed or could not be read/)).toBeNull();
    fireEvent.click(checkbox); state.asset = 'new-selection'; fireEvent.click(checkbox);
    await waitFor(() => expect(createButton().disabled).toBe(false));
    const saved = localStorage.getItem(draftKey);
    await act(async () => release(new Response('old-selection')));
    expect(localStorage.getItem(draftKey)).toBe(saved);
    expect(createButton().disabled).toBe(false);
  });

  it('recovers from the native mirror after browser storage is lost, without starting execution', async () => {
    const { fetchMock } = setupFetch();
    const records = new Map<string, { recordId: string; value: string }>();
    host.current = { recoveryStore: {
      get: async (key: string) => records.has(key) ? { ok: true, found: true, record: records.get(key)! } : { ok: true, found: false },
      list: async (prefix: string) => ({ ok: true, keys: [...records.keys()].filter(key => key.startsWith(prefix)) }),
      put: async (key: string, record: { recordId: string; value: string }, expected?: string) => {
        if (records.get(key)?.recordId !== expected) return { ok: true, result: 'conflict' };
        records.set(key, record); return { ok: true, result: 'stored' };
      },
    } } as unknown as OpenDesignHostBridge;
    await enterDraft();
    await act(async () => { expect(await recoveryStore.flushDurableRecord(draftKey)).toBe(true); });
    expect(records.has(draftKey)).toBe(true);
    cleanup(); localStorage.clear(); recoveryStore.resetDurableRecoveryForTests();
    await recoveryStore.hydrateDurableRecoveryIntoLocalStorage();
    await openPanel();
    expect(background().value).toBe('恢复我的继续制作要求');
    expect((screen.getByRole('checkbox', { name: 'strategy：保留门店预算' }) as HTMLInputElement).checked).toBe(true);
    expect(fetchMock.mock.calls.some(([url, init]) => ['/api/projects', '/api/runs'].includes(String(url)) && init?.method === 'POST')).toBe(false);
  });
});
