// @vitest-environment jsdom
//
// T04：Codex 连接检查行——点击前不发请求；分类展示；未确认不得显示"已连接"。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../src/i18n';
import { MokinaCodexConnectionRow } from '../../src/components/mokina/MokinaCodexConnectionRow';

function renderRow() {
  render(
    <I18nProvider initial="en">
      <MokinaCodexConnectionRow />
    </I18nProvider>,
  );
}

describe('MokinaCodexConnectionRow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('stays inert until the user clicks, then renders the state and next action', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      state: 'ready',
      checkedAt: new Date().toISOString(),
      cli: { resolved: true, version: 'codex-cli 0.160.0', source: 'path' },
      auth: { state: 'logged-in', methodLabel: 'ChatGPT' },
      model: { configuredModel: 'gpt-5.6-terra', readable: true },
      nextAction: 'CLI 已安装并登录。发起真实测试任务验证模型与网络连接。',
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    renderRow();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    await screen.findByTestId('mokina-codex-connection-state');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const state = await screen.findByTestId('mokina-codex-connection-state');
    expect(state.textContent).toContain('Logged in');
    expect(state.textContent).toContain('ChatGPT');
    expect((await screen.findByTestId('mokina-codex-connection-next')).textContent).toContain('真实测试任务');
  });

  it('never claims connected when the probe is unconfirmed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      state: 'unknown',
      checkedAt: new Date().toISOString(),
      cli: { resolved: true, version: null, source: 'path' },
      auth: { state: 'unconfirmed', methodLabel: null },
      model: { configuredModel: null, readable: false },
      nextAction: '无法确认登录状态；不要当作已连接。',
    }), { status: 200 })));

    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    const state = await screen.findByTestId('mokina-codex-connection-state');
    expect(state.textContent).toContain('State unconfirmed');
    expect(state.textContent).not.toContain('Logged in');
  });

  it('surfaces a failed check without a fake state', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'Check connection' }));
    await screen.findByText(/Connection check failed/);
    expect(screen.queryByTestId('mokina-codex-connection-state')).toBeNull();
  });
});
