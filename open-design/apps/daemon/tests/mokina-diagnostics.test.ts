import type http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MOKINA_NETWORK_DEPENDENCIES,
  assertMokinaDiagnosticsSanitized,
  buildMokinaDiagnostics,
  formatMokinaDiagnosticsSummary,
} from '../src/mokina/diagnostics.js';
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
});
