// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ProjectFileVersion } from '@open-design/contracts';
import { MokinaCanvasQuickEdit } from '../../src/components/mokina/MokinaCanvasQuickEdit';

const version = { id: 'v1', version: 1, current: true } as ProjectFileVersion;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('collects on-canvas edits and saves plus adopts them in one step', async () => {
  const contentWindow = { postMessage: vi.fn() };
  const iframeRef = { current: { contentWindow } } as unknown as React.RefObject<HTMLIFrameElement | null>;
  const onSaved = vi.fn();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/operations?versionId=')) {
      return Response.json({ versionId: 'v1', contentDigest: 'a'.repeat(64), fields: [{ id: 'strategy' }] });
    }
    if (url.endsWith('/operations') && init?.method === 'POST') {
      return Response.json({ version: { id: 'candidate-1', version: 2, candidate: true, baseVersionId: 'v1' } });
    }
    if (url.endsWith('/versions/candidate-1/adopt') && init?.method === 'POST') {
      return Response.json({ version: { id: 'candidate-1', version: 2, current: true, candidate: false } });
    }
    return Response.json({});
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<MokinaCanvasQuickEdit projectId="p1" fileName="plan.html" version={version}
    workspaceContext={null} iframeRef={iframeRef} ready onSaved={onSaved} />);

  fireEvent.click(screen.getByTestId('mokina-canvas-edit-toggle'));
  await waitFor(() => expect(contentWindow.postMessage).toHaveBeenCalledWith({ type: 'mokina:canvas-edit-mode', enabled: true }, '*'));

  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'mokina:canvas-edit', id: 'strategy', value: '侧睡零压的新方向' },
      source: contentWindow as unknown as Window,
    }));
  });
  await screen.findByText('已改 1 处');
  fireEvent.click(screen.getByTestId('mokina-canvas-edit-save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'candidate-1', current: true })));
  const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST' && String(init.body).includes('"operationId"'));
  expect(post).toBeTruthy();
  const body = JSON.parse(String(post![1]!.body));
  expect(body).toMatchObject({ baseVersionId: 'v1', contentDigest: 'a'.repeat(64), edits: [{ id: 'strategy', value: '侧睡零压的新方向' }] });
});
