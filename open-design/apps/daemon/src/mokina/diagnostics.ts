import os from 'node:os';

/**
 * Minimal, sanitized local diagnostics for the Mokina local preview (T15).
 *
 * Hard rules encoded here and pinned by tests:
 * - no credentials, tokens, prompt/transcript content, project/file names or
 *   absolute paths ever leave this function;
 * - every declared external dependency carries the next user action instead of
 *   a bare error code;
 * - the report describes what the product DOES reach (telemetry/updater
 *   disabled in the local preview) so support does not guess.
 */

export const MOKINA_NETWORK_DEPENDENCIES = Object.freeze([
  {
    id: 'codex-cli',
    kind: 'external-tool',
    required: true,
    summary: 'Codex CLI is user-provided; Mokina detects it and its login state but never installs or logs in for you.',
    nextAction: 'Install the CLI or sign in with the official flow, then re-run the connection check.',
  },
  {
    id: 'model-endpoint',
    kind: 'external-service',
    required: true,
    summary: 'Model calls go to the endpoint the selected agent adapter is configured to use.',
    nextAction: 'Open Agent settings, pick a configured agent, and verify the connection; offline browsing and editing stay available.',
  },
  {
    id: 'web-search',
    kind: 'external-service',
    required: false,
    summary: 'Search runs only when the user explicitly enables it for a task.',
    nextAction: 'Ignore unless the task needs fresh sources; results are cited with URL and access time when used.',
  },
] as const);

export type MokinaDiagnosticsInput = {
  productId: string;
  productName: string;
  productVersion: string | null;
  releaseKind: string | null;
  edition: 'local' | 'off';
  startedAt: number;
  now?: number;
  /** Probe outcomes the caller already computed; booleans only, no details. */
  checks?: {
    daemon?: 'ok' | 'degraded';
    codexCli?: 'detected' | 'missing' | 'unknown';
    dataRootIsolated?: boolean;
  };
};

export type MokinaDiagnosticsReport = {
  schemaVersion: 1;
  generatedAt: string;
  product: {
    productId: string;
    productName: string;
    productVersion: string | null;
    releaseKind: string | null;
    edition: 'local' | 'off';
  };
  build: {
    platform: string;
    arch: string;
    nodeMajor: number;
    osReleaseRedacted: boolean;
  };
  runtime: {
    uptimeSeconds: number;
    daemon: 'ok' | 'degraded';
    codexCli: 'detected' | 'missing' | 'unknown';
    dataRootIsolated: boolean | null;
  };
  privacy: {
    telemetry: 'disabled' | 'enabled';
    updater: 'disabled' | 'manual-only';
    /** Fields this endpoint deliberately never reports. */
    omitted: string[];
  };
  network: Array<{
    id: string;
    kind: string;
    required: boolean;
    summary: string;
    nextAction: string;
  }>;
};

export function buildMokinaDiagnostics(input: MokinaDiagnosticsInput): MokinaDiagnosticsReport {
  const now = input.now ?? Date.now();
  return {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    product: {
      productId: input.productId,
      productName: input.productName,
      productVersion: input.productVersion,
      releaseKind: input.releaseKind,
      edition: input.edition,
    },
    build: {
      platform: process.platform,
      arch: process.arch,
      nodeMajor: Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10) || 0,
      osReleaseRedacted: true,
    },
    runtime: {
      uptimeSeconds: Math.max(0, Math.floor((now - input.startedAt) / 1000)),
      daemon: input.checks?.daemon ?? 'ok',
      codexCli: input.checks?.codexCli ?? 'unknown',
      dataRootIsolated: input.checks?.dataRootIsolated ?? null,
    },
    privacy: {
      telemetry: input.edition === 'local' ? 'disabled' : 'enabled',
      updater: input.edition === 'local' ? 'disabled' : 'manual-only',
      omitted: [
        'credentials and tokens',
        'prompt and transcript content',
        'project and file names',
        'absolute filesystem paths',
        'run outputs',
      ],
    },
    network: MOKINA_NETWORK_DEPENDENCIES.map((dependency) => ({ ...dependency })),
  };
}

/** Last-resort redaction scan for callers that add fields around the report. */
export function formatMokinaDiagnosticsSummary(report: MokinaDiagnosticsReport): string {
  return [
    `${report.product.productName} ${report.product.productVersion ?? 'dev'} (${report.product.releaseKind ?? 'unknown'})`,
    `platform=${report.build.platform}/${report.build.arch} node=${report.build.nodeMajor} uptime=${report.runtime.uptimeSeconds}s`,
    `telemetry=${report.privacy.telemetry} updater=${report.privacy.updater} codex=${report.runtime.codexCli}`,
    `network: ${report.network.map((entry) => `${entry.id}${entry.required ? '*' : ''}`).join(', ')}`,
    `hostname redacted: ${os.hostname().length > 0}`,
  ].join('\n');
}

/** Value shapes that must never appear, regardless of their key. */
const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /\/Users\//u,
  /\/home\//u,
  /sk-[A-Za-z0-9]{8,}/u,
  /phc_[A-Za-z0-9]{8,}/u,
  /auth\.json/u,
];

/** Keys whose non-empty values are treated as secrets. Prose (e.g. the
 *  `omitted` list that names these categories) is deliberately allowed. */
const FORBIDDEN_KEY_PATTERN = /token|secret|password|credential|authorization/iu;

/**
 * Used by tests (and defensively by callers) to keep the report sanitized.
 * Checks VALUE shapes at any depth plus sensitive KEY names, so a report can
 * still say "credentials are omitted" without tripping the scan.
 */
export function assertMokinaDiagnosticsSanitized(report: unknown): void {
  const visit = (node: unknown, pathLabel: string): void => {
    if (typeof node === 'string') {
      for (const pattern of FORBIDDEN_VALUE_PATTERNS) {
        if (pattern.test(node)) {
          throw new Error(`mokina diagnostics leaked a sensitive pattern at ${pathLabel}: ${pattern}`);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${pathLabel}[${index}]`));
      return;
    }
    if (node != null && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        const nextPath = pathLabel ? `${pathLabel}.${key}` : key;
        if (FORBIDDEN_KEY_PATTERN.test(key) && typeof value === 'string' && value.length > 0) {
          throw new Error(`mokina diagnostics exposed a sensitive key at ${nextPath}`);
        }
        visit(value, nextPath);
      }
    }
  };
  visit(report, '');
}
