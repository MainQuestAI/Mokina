import type http from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MOKINA_NETWORK_DEPENDENCIES,
  assertMokinaDiagnosticsSanitized,
  buildMokinaDiagnostics,
  formatMokinaDiagnosticsSummary,
} from '../src/mokina/diagnostics.js';
import { readAppConfig, writeAppConfig } from '../src/app-config.js';
import { startServer } from '../src/server.js';

describe('mokina diagnostics', () => {
  it('reports product/build/runtime/privacy without leaking sensitive fields', () => {
    const report = buildMokinaDiagnostics({
      productId: 'mokina',
      productName: 'Mokina',
      productVersion: '0.0.2-local.1',
      releaseKind: 'local-preview',
      edition: 'local',
      startedAt: 0,
      now: 65_000,
      checks: { daemon: 'ok', codexCli: 'missing', dataRootIsolated: true },
    });
    expect(report).toMatchObject({
      schemaVersion: 1,
      product: { productId: 'mokina', productVersion: '0.0.2-local.1', edition: 'local' },
      runtime: { uptimeSeconds: 65, daemon: 'ok', codexCli: 'missing', dataRootIsolated: true },
      privacy: { telemetry: 'disabled', updater: 'disabled' },
    });
    expect(report.network).toHaveLength(MOKINA_NETWORK_DEPENDENCIES.length);
    for (const dependency of report.network) {
      expect(dependency.nextAction.length).toBeGreaterThan(0);
    }
    assertMokinaDiagnosticsSanitized(report);
    const summary = formatMokinaDiagnosticsSummary(report);
    expect(summary).not.toMatch(/\/Users\//u);
    expect(summary).toContain('codex=missing');
  });

  it('flags upstream editions as enabling telemetry and manual updates', () => {
    const report = buildMokinaDiagnostics({
      productId: 'mokina',
      productName: 'Mokina',
      productVersion: null,
      releaseKind: null,
      edition: 'off',
      startedAt: 0,
    });
    expect(report.privacy).toMatchObject({ telemetry: 'enabled', updater: 'manual-only' });
    expect(report.runtime.codexCli).toBe('unknown');
  });

  it('rejects a report that would leak a path, token or credential file', () => {
    expect(() => assertMokinaDiagnosticsSanitized({ note: '/Users/me/secret-project' })).toThrow(/sensitive/);
    expect(() => assertMokinaDiagnosticsSanitized({ token: 'abc' })).toThrow(/sensitive/);
    expect(() => assertMokinaDiagnosticsSanitized({ hint: 'sk-abcdefgh12345' })).toThrow(/sensitive/);
    expect(() => assertMokinaDiagnosticsSanitized({ file: 'auth.json' })).toThrow(/sensitive/);
  });
});

describe('GET /api/mokina/diagnostics', () => {
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

  it('serves a sanitized diagnostics report', async () => {
    const response = await fetch(`${baseUrl}/api/mokina/diagnostics`);
    expect(response.status).toBe(200);
    const body = await response.json() as {
      product: { productId: string };
      runtime: { codexCli: string };
      privacy: { omitted: string[] };
    };
    assertMokinaDiagnosticsSanitized(body);
    expect(body.product.productId).toBe('mokina');
    expect(['detected', 'missing', 'unknown']).toContain(body.runtime.codexCli);
    expect(body.privacy.omitted).toContain('absolute filesystem paths');
  });

  it('follows the saved CLI and home across configuration changes without stale detection', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mokina-diagnostics-cli-'));
    const binary = path.join(root, 'configured-codex');
    const cliHome = path.join(root, 'profile');
    const dataDir = process.env.OD_DATA_DIR!;
    const previous = await readAppConfig(dataDir);
    const priorPath = process.env.PATH;
    const priorAgentHome = process.env.OD_AGENT_HOME;
    try {
      await mkdir(cliHome);
      await writeFile(binary, `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
if (process.argv[2] === '--version') {
  if (fs.existsSync(path.join(process.env.CODEX_HOME || '', 'probe-denied'))) {
    console.error('EACCES: version probe permission denied');
    process.exitCode = 1;
  } else {
    console.log('codex-cli 0.162.0');
  }
} else if (process.argv[2] === 'login' && process.argv[3] === 'status') {
  const loggedOut = fs.existsSync(path.join(process.env.CODEX_HOME || '', 'logged-out'));
  console.error(loggedOut ? 'Not logged in' : 'Logged in using ChatGPT');
  process.exitCode = loggedOut ? 1 : 0;
} else {
  process.exitCode = 2;
}
`, { mode: 0o700 });
      // A GUI launch can have no Codex on PATH. The saved absolute path is
      // authoritative for connection checks, diagnostics and actual runs.
      process.env.PATH = root;
      process.env.OD_AGENT_HOME = root;
      await writeAppConfig(dataDir, { agentCliEnv: { codex: { CODEX_BIN: binary, CODEX_HOME: cliHome } } });
      const connection = async () => {
        const response = await fetch(`${baseUrl}/api/mokina/codex-connection`);
        expect(response.status).toBe(200);
        return response.json();
      };
      const diagnostics = async () => {
        const response = await fetch(`${baseUrl}/api/mokina/diagnostics`);
        expect(response.status).toBe(200);
        const report = await response.json() as ReturnType<typeof buildMokinaDiagnostics>;
        assertMokinaDiagnosticsSanitized(report);
        expect(JSON.stringify(report)).not.toContain(root);
        return report.runtime.codexCli;
      };
      expect(await connection()).toMatchObject({ state: 'ready', cli: { source: 'configured-path', resolved: true } });
      expect(await diagnostics()).toBe('detected');

      await writeFile(path.join(cliHome, 'logged-out'), 'synthetic expired login');
      expect(await connection()).toMatchObject({ state: 'login_required' });
      expect(await diagnostics()).toBe('detected');

      await writeAppConfig(dataDir, { agentCliEnv: { codex: { CODEX_BIN: path.join(root, 'missing-codex'), CODEX_HOME: cliHome } } });
      expect(await connection()).toMatchObject({ state: 'cli_missing' });
      expect(await diagnostics()).toBe('missing');

      await writeFile(path.join(cliHome, 'probe-denied'), 'synthetic permission failure');
      await writeAppConfig(dataDir, { agentCliEnv: { codex: { CODEX_BIN: binary, CODEX_HOME: cliHome } } });
      expect(await connection()).toMatchObject({ state: 'permission_denied' });
      expect(await diagnostics()).toBe('unknown');
    } finally {
      if (priorPath == null) delete process.env.PATH;
      else process.env.PATH = priorPath;
      if (priorAgentHome == null) delete process.env.OD_AGENT_HOME;
      else process.env.OD_AGENT_HOME = priorAgentHome;
      await writeAppConfig(dataDir, { agentCliEnv: previous.agentCliEnv ?? null });
      await rm(root, { recursive: true, force: true });
    }
  });
});
