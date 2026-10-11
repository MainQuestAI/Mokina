import { promisify } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ run: vi.fn(), readFile: vi.fn(), resolveLaunch: vi.fn() }));
vi.mock('../src/runtimes/launch.js', () => ({
  resolveAgentLaunch: mocks.resolveLaunch,
  applyAgentLaunchEnv: (env: NodeJS.ProcessEnv) => env,
}));
vi.mock('../src/runtimes/env.js', () => ({
  spawnEnvForAgent: (_agent: string, base: NodeJS.ProcessEnv, configured: NodeJS.ProcessEnv) => ({ ...base, ...configured }),
}));
vi.mock('node:child_process', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:child_process')>(),
  execFile: Object.assign(() => undefined, { [promisify.custom]: mocks.run }),
}));
vi.mock('node:fs/promises', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  readFile: mocks.readFile,
}));

describe('Mokina Codex login probe', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.run.mockReset();
    mocks.resolveLaunch.mockReset().mockImplementation((_def: unknown, env: Record<string, string>) => ({
      launchPath: env.CODEX_BIN || '/synthetic/path-codex',
      configuredOverridePath: env.CODEX_BIN || null,
    }));
    mocks.readFile.mockReset().mockResolvedValue('model = "test-model"');
    mocks.run.mockImplementation(async (_binary: string, args: string[]) => args[0] === '--version'
      ? { stdout: 'codex-cli 0.162.0', stderr: '' }
      : { stdout: '', stderr: 'Logged in using ChatGPT' });
  });

  it('recognizes the real CLI login status emitted on stderr', async () => {
    const { probeMokinaCodexConnection } = await import('../src/mokina/codex-connection.js');
    const report = await probeMokinaCodexConnection({}, { useCache: false });
    expect(report).toMatchObject({ state: 'ready', auth: { state: 'logged-in', methodLabel: 'ChatGPT' } });
  });

  it('recognizes the CLI logged-out response even when it exits nonzero', async () => {
    mocks.run.mockImplementation(async (_binary: string, args: string[]) => {
      if (args[0] === '--version') return { stdout: 'codex-cli 0.162.0', stderr: '' };
      throw Object.assign(new Error('Command failed'), { code: 1, stdout: '', stderr: 'Not logged in' });
    });
    const { probeMokinaCodexConnection } = await import('../src/mokina/codex-connection.js');
    const report = await probeMokinaCodexConnection({}, { useCache: false });
    expect(report).toMatchObject({ state: 'login_required', auth: { state: 'logged-out' } });
  });

  it('probes login and config using the same explicit environment', async () => {
    const env = { PATH: '/synthetic/bin', CODEX_HOME: '/synthetic/profile' };
    const { probeMokinaCodexConnection } = await import('../src/mokina/codex-connection.js');
    await probeMokinaCodexConnection(env, { useCache: false });
    expect(mocks.run).toHaveBeenCalledWith('/synthetic/path-codex', ['login', 'status'], expect.objectContaining({ env }));
    expect(mocks.readFile).toHaveBeenCalledWith('/synthetic/profile/config.toml', 'utf8');
  });

  it('checks the saved CLI binary and profile used by actual runs', async () => {
    const { probeMokinaCodexConnection } = await import('../src/mokina/codex-connection.js');
    const report = await probeMokinaCodexConnection({ CODEX_HOME: '/synthetic/global' }, {
      useCache: false,
      agentCliEnv: { codex: { CODEX_BIN: '/synthetic/custom-codex', CODEX_HOME: '/synthetic/custom-profile' } },
    });
    expect(report.cli.source).toBe('configured-path');
    expect(mocks.run).toHaveBeenCalledWith('/synthetic/custom-codex', ['login', 'status'], expect.objectContaining({
      env: expect.objectContaining({ CODEX_HOME: '/synthetic/custom-profile' }),
    }));
    expect(mocks.readFile).toHaveBeenCalledWith('/synthetic/custom-profile/config.toml', 'utf8');
  });

  it('does not reuse another CLI home login status from the cache', async () => {
    const { probeMokinaCodexConnection } = await import('../src/mokina/codex-connection.js');
    await probeMokinaCodexConnection({ CODEX_HOME: '/synthetic/logged-in' });
    mocks.run.mockImplementation(async (_binary: string, args: string[]) => args[0] === '--version'
      ? { stdout: 'codex-cli 0.162.0', stderr: '' }
      : { stdout: 'Not logged in', stderr: '' });
    const report = await probeMokinaCodexConnection({ CODEX_HOME: '/synthetic/logged-out' });
    expect(report.state).toBe('login_required');
  });
});
