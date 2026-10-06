import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MOKINA_CODEX_CONNECTION_STATES,
  classifyMokinaCodexConnection,
  probeMokinaCodexConnection,
  type MokinaCodexProbeResults,
} from '../src/mokina/codex-connection.js';
import { startServer } from '../src/server.js';

function probes(overrides: Partial<MokinaCodexProbeResults> = {}): MokinaCodexProbeResults {
  return {
    cliSource: 'path',
    versionOk: true,
    versionText: 'codex-cli 0.160.0',
    versionError: null,
    loginStatusOk: true,
    loginStatusText: 'Logged in using ChatGPT',
    loginStatusError: null,
    configReadable: true,
    configuredModel: 'gpt-5.6-terra',
    ...overrides,
  };
}

describe('codex connection classification', () => {
  it('reports ready with the login method and configured model', () => {
    const report = classifyMokinaCodexConnection(probes());
    expect(report).toMatchObject({
      state: 'ready',
      auth: { state: 'logged-in', methodLabel: 'ChatGPT' },
      model: { configuredModel: 'gpt-5.6-terra', readable: true },
      cli: { resolved: true, source: 'path' },
    });
    expect(report.nextAction).toContain('真实测试');
  });

  it('never claims connected on a missing CLI or unconfirmed login', () => {
    const missing = classifyMokinaCodexConnection(probes({
      versionOk: false, versionText: null, versionError: 'missing',
      loginStatusOk: false, loginStatusText: null,
    }));
    expect(missing.state).toBe('cli_missing');
    expect(missing.auth.state).toBe('unconfirmed');

    const unconfirmed = classifyMokinaCodexConnection(probes({
      loginStatusOk: false, loginStatusText: null, loginStatusError: 'other',
    }));
    expect(unconfirmed.state).toBe('unknown');
    expect(unconfirmed.auth.state).toBe('unconfirmed');
    expect(unconfirmed.nextAction).toContain('不要当作已连接');
  });

  it('maps probe errors onto the existing failure vocabulary', () => {
    expect(classifyMokinaCodexConnection(probes({
      loginStatusOk: false, loginStatusError: 'permission',
    })).state).toBe('permission_denied');
    expect(classifyMokinaCodexConnection(probes({
      loginStatusOk: false, loginStatusError: 'network',
    })).state).toBe('network_unavailable');
    expect(classifyMokinaCodexConnection(probes({
      loginStatusOk: false, loginStatusError: 'quota',
    })).state).toBe('quota_or_billing');
    expect(classifyMokinaCodexConnection(probes({
      loginStatusText: 'Not logged in', loginStatusOk: true,
    })).state).toBe('login_required');
    expect(classifyMokinaCodexConnection(probes({
      versionOk: false, versionError: 'permission',
    })).state).toBe('permission_denied');
  });

  it('honors a configured CLI path as the resolution source', () => {
    const report = classifyMokinaCodexConnection(probes({ cliSource: 'configured-path' }));
    expect(report.cli.source).toBe('configured-path');
    expect(MOKINA_CODEX_CONNECTION_STATES).toContain(report.state);
  });
});

describe('GET /api/mokina/codex-connection', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const started = (await startServer({ port: 0, returnServer: true })) as {
      url: string;
      server: http.Server;
    };
    baseUrl = started.url;
    server = started.server;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('answers with a taxonomy state and a next action, without credentials content', async () => {
    const response = await fetch(`${baseUrl}/api/mokina/codex-connection`);
    expect(response.status).toBe(200);
    const body = await response.json() as {
      schemaVersion: number;
      state: string;
      nextAction: string;
      auth: { state: string };
      cli: { source: string };
    };
    expect(body.schemaVersion).toBe(1);
    expect(MOKINA_CODEX_CONNECTION_STATES).toContain(body.state);
    expect(body.nextAction.length).toBeGreaterThan(0);
    expect(['logged-in', 'logged-out', 'unconfirmed']).toContain(body.auth.state);
    expect(JSON.stringify(body)).not.toMatch(/\/Users\//u);
  });

  it('caches the probe so two reads agree', async () => {
    const first = await probeMokinaCodexConnection(process.env, { useCache: false });
    const second = await probeMokinaCodexConnection(process.env);
    expect(second.state).toBe(first.state);
    expect(second.checkedAt).toBe(first.checkedAt);
  });
});
