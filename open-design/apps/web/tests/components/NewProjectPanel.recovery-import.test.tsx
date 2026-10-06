// @vitest-environment jsdom
//
// T14：新项目面板中的"导入恢复包（zip）"入口。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const analytics = vi.hoisted(() => ({
  track: vi.fn(),
  newRequestId: vi.fn(() => 'request-recovery-1'),
}));

vi.mock('../../src/analytics/provider', () => ({
  useAnalytics: () => ({
    track: analytics.track,
    newRequestId: analytics.newRequestId,
  }),
}));

import { I18nProvider } from '../../src/i18n';
import { NewProjectPanel } from '../../src/components/NewProjectPanel';

function renderPanel(onImportMokinaRecovery: (file: File) => Promise<{ ok: boolean; message?: string }>) {
  render(
    <I18nProvider initial="en">
      <NewProjectPanel
        skills={[]}
        designSystems={[]}
        defaultDesignSystemId={null}
        templates={[]}
        promptTemplates={[]}
        onCreate={vi.fn()}
        mediaProviders={{}}
        connectors={[]}
        onImportMokinaRecovery={onImportMokinaRecovery}
      />
    </I18nProvider>,
  );
}

describe('NewProjectPanel recovery import entry', () => {
  beforeAll(() => {
    // jsdom has no layout engine; the panel's tab rail observes its overflow.
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
    analytics.track.mockReset();
  });

  it('forwards the selected zip to the handler', async () => {
    const handler = vi.fn(async (_file: File) => ({ ok: true }));
    renderPanel(handler);

    const input = screen.getByTestId('newproj-recovery-input') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'recovery.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it('shows the failure toast and keeps the button enabled for retry', async () => {
    const handler = vi.fn(async (_file: File) => ({ ok: false, message: 'recovery package is not readable' }));
    renderPanel(handler);

    const button = screen.getByRole('button', { name: /Import recovery package \(zip\)/ });
    expect(button).not.toBeDisabled();

    const input = screen.getByTestId('newproj-recovery-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([0])], 'bad.zip')] } });

    await screen.findByText(/Recovery package import failed/);
    await screen.findByText(/recovery package is not readable/);
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
