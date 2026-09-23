import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAppConfig, writeAppConfig } from '../src/app-config.js';
import { readPosthogConfig } from '../src/analytics.js';
import { readRunTelemetrySinkConfig, readTelemetrySinkConfig } from '../src/langfuse-trace.js';

const previous = process.env.MOKINA_LOCAL_EDITION;
afterEach(() => {
  if (previous === undefined) delete process.env.MOKINA_LOCAL_EDITION;
  else process.env.MOKINA_LOCAL_EDITION = previous;
});

it('keeps previously consented upstream telemetry off in the local edition', async () => {
  process.env.MOKINA_LOCAL_EDITION = 'on';
  const root = await mkdtemp(path.join(tmpdir(), 'mokina-edition-'));
  try {
    await writeFile(path.join(root, 'app-config.json'), JSON.stringify({
      telemetry: { metrics: true, content: true, artifactManifest: true },
    }));
    expect((await readAppConfig(root)).telemetry).toEqual({
      metrics: false, content: false, artifactManifest: false,
    });
    await writeAppConfig(root, { telemetry: { metrics: true, content: true } });
    const persisted = JSON.parse(await readFile(path.join(root, 'app-config.json'), 'utf8'));
    expect(persisted.telemetry).toEqual({ metrics: false, content: false, artifactManifest: false });
    expect(readPosthogConfig({ POSTHOG_KEY: 'test-key' })).toBeNull();
    expect(readTelemetrySinkConfig({ OPEN_DESIGN_TELEMETRY_RELAY_URL: 'https://example.com' })).toBeNull();
    expect(readRunTelemetrySinkConfig({ OPEN_DESIGN_TELEMETRY_RELAY_URL: 'https://example.com' })).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
