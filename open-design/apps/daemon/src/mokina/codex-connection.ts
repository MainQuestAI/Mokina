import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { extractCodexRootModelConfig, parseStableCodexVersion } from '../runtimes/codex-model-preflight.js';

/**
 * Minimal Codex connection check (T04).
 *
 * The authoritative login probe is `codex login status` — it covers both the
 * auth.json file and OS credential storage, so a bare "auth.json exists" check
 * can no longer report a false "connected". The classification reuses the
 * daemon's existing failure vocabulary (`cli_missing`, `login_required`,
 * `permission_denied`, `quota_or_billing`, `network_unavailable`,
 * `model_unavailable`, `unknown`) instead of a second taxonomy.
 */

export const MOKINA_CODEX_CONNECTION_STATES = Object.freeze([
  'ready',
  'cli_missing',
  'login_required',
  'permission_denied',
  'quota_or_billing',
  'network_unavailable',
  'model_unavailable',
  'unknown',
] as const);

export type MokinaCodexConnectionState = (typeof MOKINA_CODEX_CONNECTION_STATES)[number];

export type MokinaCodexProbeResults = {
  /** Which source resolved the CLI binary. */
  cliSource: 'configured-path' | 'path';
  versionOk: boolean;
  versionText: string | null;
  versionError: 'missing' | 'permission' | 'other' | null;
  loginStatusOk: boolean;
  loginStatusText: string | null;
  loginStatusError: 'permission' | 'network' | 'quota' | 'other' | null;
  configReadable: boolean;
  configuredModel: string | null;
};

export type MokinaCodexConnectionReport = {
  schemaVersion: 1;
  checkedAt: string;
  state: MokinaCodexConnectionState;
  cli: { resolved: boolean; version: string | null; source: MokinaCodexProbeResults['cliSource'] };
  auth: { state: 'logged-in' | 'logged-out' | 'unconfirmed'; methodLabel: string | null };
  model: { configuredModel: string | null; readable: boolean };
  nextAction: string;
};

function loginMethodLabel(text: string): string | null {
  if (/chatgpt/iu.test(text)) return 'ChatGPT';
  if (/api key/iu.test(text)) return 'API key';
  return null;
}

/** Pure classification so every state mapping is unit-testable. */
export function classifyMokinaCodexConnection(probes: MokinaCodexProbeResults): MokinaCodexConnectionReport {
  const base = {
    schemaVersion: 1 as const,
    checkedAt: new Date().toISOString(),
    cli: {
      resolved: probes.versionOk,
      version: probes.versionOk ? (parseStableCodexVersion(probes.versionText ?? '') ? (probes.versionText ?? '').trim() : (probes.versionText ?? '').trim() || null) : null,
      source: probes.cliSource,
    },
    model: { configuredModel: probes.configuredModel, readable: probes.configReadable },
  };
  if (!probes.versionOk) {
    if (probes.versionError === 'permission') {
      return {
        ...base,
        state: 'permission_denied',
        auth: { state: 'unconfirmed', methodLabel: null },
        nextAction: 'CLI 无法执行（权限被拒绝）。检查该路径的执行权限后重新检查。',
      };
    }
    return {
      ...base,
      state: 'cli_missing',
      auth: { state: 'unconfirmed', methodLabel: null },
      nextAction: '未找到可运行的 Codex CLI。按官方说明安装并登录后重新检查；也可在设置里指定已有 CLI 的绝对路径。',
    };
  }
  const loginText = probes.loginStatusText ?? '';
  const loggedOut = /not logged in|logged out/iu.test(loginText);
  if (probes.loginStatusOk && !loggedOut && /logged in/iu.test(loginText)) {
    return {
      ...base,
      state: 'ready',
      auth: { state: 'logged-in', methodLabel: loginMethodLabel(loginText) },
      nextAction: '连接可用。发起真实测试任务验证模型执行。',
    };
  }
  if (probes.loginStatusOk && loggedOut) {
    return {
      ...base,
      state: 'login_required',
      auth: { state: 'logged-out', methodLabel: null },
      nextAction: 'CLI 已安装但未登录。完成一次官方登录流程后重新检查（Mokina 不会代登录）。',
    };
  }
  switch (probes.loginStatusError) {
    case 'permission':
      return {
        ...base,
        state: 'permission_denied',
        auth: { state: 'unconfirmed', methodLabel: null },
        nextAction: '登录状态探测被权限拒绝。检查 CLI 与凭据存储的访问权限后重试。',
      };
    case 'network':
      return {
        ...base,
        state: 'network_unavailable',
        auth: { state: 'unconfirmed', methodLabel: null },
        nextAction: '网络不可用，无法确认登录状态。恢复网络后重试；本地浏览与编辑不受影响。',
      };
    case 'quota':
      return {
        ...base,
        state: 'quota_or_billing',
        auth: { state: 'unconfirmed', methodLabel: null },
        nextAction: '账号配额或付费状态异常。按官方说明处理后重试；这不影响本地已有成果。',
      };
    default:
      return {
        ...base,
        state: 'unknown',
        auth: { state: 'unconfirmed', methodLabel: null },
        nextAction: '无法确认登录状态；不要当作已连接。重试探测，或复制脱敏诊断用于排查。',
      };
  }
}

const probeCache = { at: 0, report: null as MokinaCodexConnectionReport | null };
const CACHE_MS = 30_000;

export async function probeMokinaCodexConnection(
  env: NodeJS.ProcessEnv = process.env,
  options: { useCache?: boolean } = {},
): Promise<MokinaCodexConnectionReport> {
  if (options.useCache !== false && probeCache.report && Date.now() - probeCache.at < CACHE_MS) {
    return probeCache.report;
  }
  const configuredPath = env.MOKINA_CODEX_CLI_PATH?.trim();
  const binary = configuredPath && configuredPath.length > 0 ? configuredPath : 'codex';
  const cliSource: MokinaCodexProbeResults['cliSource'] = configuredPath && configuredPath.length > 0 ? 'configured-path' : 'path';
  const run = promisify(execFile);

  let versionOk = false;
  let versionText: string | null = null;
  let versionError: MokinaCodexProbeResults['versionError'] = null;
  try {
    const { stdout } = await run(binary, ['--version'], { timeout: 3_000 });
    versionText = stdout.trim();
    versionOk = versionText.length > 0;
    if (!versionOk) versionError = 'other';
  } catch (error) {
    const message = error instanceof Error ? `${error.message}` : String(error);
    versionError = /ENOENT|not found/u.test(message)
      ? 'missing'
      : /EACCES|EPERM|permission/iu.test(message)
        ? 'permission'
        : 'other';
  }

  let loginStatusOk = false;
  let loginStatusText: string | null = null;
  let loginStatusError: MokinaCodexProbeResults['loginStatusError'] = null;
  if (versionOk) {
    try {
      const { stdout } = await run(binary, ['login', 'status'], { timeout: 5_000 });
      loginStatusText = stdout.trim();
      loginStatusOk = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      loginStatusError = /EACCES|EPERM|permission/iu.test(message)
        ? 'permission'
        : /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/iu.test(message)
          ? 'network'
          : /quota|billing|credit/iu.test(message)
            ? 'quota'
            : 'other';
    }
  }

  let configReadable = false;
  let configuredModel: string | null = null;
  try {
    const configPath = join(env.CODEX_HOME?.trim() || join(homedir(), '.codex'), 'config.toml');
    const content = await readFile(configPath, 'utf8');
    configReadable = true;
    configuredModel = extractCodexRootModelConfig(content).model ?? null;
  } catch {
    configReadable = false;
  }

  const report = classifyMokinaCodexConnection({
    cliSource,
    versionOk,
    versionText,
    versionError,
    loginStatusOk,
    loginStatusText,
    loginStatusError,
    configReadable,
    configuredModel,
  });
  probeCache.at = Date.now();
  probeCache.report = report;
  return report;
}
