import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  parseMokinaPackagedProduct,
  type MokinaPackagedProduct,
} from "@open-design/release";
import { SIDECAR_DEFAULTS, normalizeNamespace } from "@open-design/sidecar-proto";

// Keep Electron out of this module so pure/headless configuration helpers stay
// importable in Node. The GUI entry supplies app before the first event-loop turn.
type PackagedConfigApp = { getPath: (name: 'userData') => string; getAppPath: () => string };

export const PACKAGED_CONFIG_PATH_ENV = "OD_PACKAGED_CONFIG_PATH";
export const PACKAGED_NAMESPACE_ENV = "OD_PACKAGED_NAMESPACE";
export const PACKAGED_NAMESPACE_BASE_ROOT_ENV = "OD_PACKAGED_NAMESPACE_BASE_ROOT";
export const PACKAGED_WEB_OUTPUT_MODE_OVERRIDE_ENV = "OD_PACKAGED_ALLOW_WEB_OUTPUT_MODE_OVERRIDE";
export const PACKAGED_WEB_STANDALONE_ROOT_ENV = "OD_WEB_STANDALONE_ROOT";
export const PACKAGED_WEB_OUTPUT_MODE_ENV = "OD_WEB_OUTPUT_MODE";

export type PackagedWebOutputMode = "server" | "standalone";
export type PackagedAmrProfile = "prod" | "test" | "feature-test" | "local";
export type PackagedVelaWebUrls = Partial<Record<PackagedAmrProfile, string>>;

export type RawPackagedConfig = {
  amrProfile?: string;
  appVersion?: string;
  daemonCliEntryRelative?: string;
  daemonSidecarEntryRelative?: string;
  namespace?: string;
  namespaceBaseRoot?: string;
  // Baked by tools/pack when the build carries a product profile (Mokina
  // local preview). Upstream builds leave it absent and are unaffected.
  product?: unknown;
  nodeCommandRelative?: string;
  resourceRoot?: string;
  // Baked by tools/pack from OPEN_DESIGN_TELEMETRY_RELAY_URL and forwarded to
  // the daemon at runtime; Langfuse credentials never ship in packaged config.
  telemetryRelayUrl?: string;
  updateMetadataUrl?: string;
  // PostHog product-analytics ingest key, baked by tools/pack from
  // process.env.POSTHOG_KEY at packaging time. Forwarded to the daemon
  // sidecar's spawn env as POSTHOG_KEY. `phc_` keys are public ingest
  // tokens (write-only event capture); embedding them in the bundle is
  // the PostHog-recommended pattern. The integration short-circuits when
  // either this is absent or the user has declined Privacy → metrics.
  posthogKey?: string;
  posthogHost?: string;
  // Origin of the vela web console this build's AMR backend serves, baked by
  // tools/pack from OD_VELA_WEB_URL at packaging time. Forwarded to the daemon
  // spawn env as OD_VELA_WEB_URL, where it both gates the workspace-team
  // transports and supplies the workspace console links. Injected rather than
  // checked in because the non-prod AMR environments are internal deployments
  // and this repository is public; absent for prod and fork builds.
  velaWebUrl?: string;
  velaWebUrls?: Partial<Record<PackagedAmrProfile, string>>;
  webSidecarEntryRelative?: string;
  webStandaloneRoot?: string;
  webOutputMode?: string;
};

export type PackagedConfig = {
  amrProfile: PackagedAmrProfile | null;
  appVersion: string | null;
  daemonCliEntry: string | null;
  daemonSidecarEntry: string | null;
  namespace: string;
  namespaceBaseRoot: string;
  nodeCommand: string | null;
  product: MokinaPackagedProduct | null;
  resourceRoot: string;
  telemetryRelayUrl: string | null;
  updateMetadataUrl: string | null;
  posthogKey: string | null;
  posthogHost: string | null;
  velaWebUrl: string | null;
  velaWebUrls?: PackagedVelaWebUrls;
  webSidecarEntry: string | null;
  webStandaloneRoot: string | null;
  webOutputMode: PackagedWebOutputMode;
};

function readJsonIfExists(filePath: string): RawPackagedConfig | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as RawPackagedConfig;
}

function resolveDefaultConfigPath(): string {
  return join(process.resourcesPath, "open-design-config.json");
}

function readRawPackagedConfig(electronApp: PackagedConfigApp): RawPackagedConfig {
  const explicit = process.env[PACKAGED_CONFIG_PATH_ENV];
  if (explicit != null && explicit.length > 0) {
    const config = readJsonIfExists(resolve(explicit));
    if (config == null) throw new Error(`packaged config not found at ${explicit}`);
    return config;
  }

  return (
    readJsonIfExists(resolveDefaultConfigPath()) ??
    readJsonIfExists(join(electronApp.getAppPath(), "open-design-config.json")) ??
    {}
  );
}

function resolveOptionalPath(value: string | undefined): string | undefined {
  return value == null || value.length === 0 ? undefined : resolve(value);
}

export function resolvePackagedNamespaceBaseRoot(
  rawNamespaceBaseRoot: string | undefined,
  electronUserDataRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveOptionalPath(env[PACKAGED_NAMESPACE_BASE_ROOT_ENV])
    ?? resolveOptionalPath(rawNamespaceBaseRoot)
    ?? join(electronUserDataRoot, "namespaces");
}

// Config DTOs use null for optional scalar values consumed by runtime options;
// optional paths use undefined so callers can distinguish "no path" from a resolved path string.
function cleanOptionalString(value: string | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function cleanVelaWebUrls(
  value: Partial<Record<PackagedAmrProfile, string>> | undefined,
): PackagedVelaWebUrls {
  const result: PackagedVelaWebUrls = {};
  for (const profile of ['prod', 'test', 'feature-test', 'local'] as const) {
    const origin = cleanOptionalString(value?.[profile]);
    if (origin) result[profile] = origin.replace(/\/+$/, '');
  }
  return result;
}

function resolvePackagedWebOutputMode(value: string | undefined): PackagedWebOutputMode {
  if (value == null || value.length === 0) return "server";
  if (value === "server" || value === "standalone") return value;
  throw new Error(`unsupported packaged web output mode: ${value}`);
}

export function resolvePackagedAmrProfile(value: string | undefined): PackagedAmrProfile | null {
  const cleaned = cleanOptionalString(value);
  if (cleaned == null) return null;
  if (cleaned === "prod" || cleaned === "test" || cleaned === "feature-test" || cleaned === "local") {
    return cleaned;
  }
  throw new Error(`unsupported packaged AMR profile; expected prod, test, feature-test, or local: ${value}`);
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function resolvePackagedWebStandaloneRoot(
  webOutputMode: PackagedWebOutputMode,
  value: string | undefined,
): string | null {
  const configured = resolveOptionalPath(value);
  if (configured != null) return configured;
  if (webOutputMode !== "standalone") return null;
  return join(process.resourcesPath, "open-design-web-standalone");
}

function resolvePackagedRelativeEntry(value: string | undefined): string | null {
  const cleaned = cleanOptionalString(value);
  if (cleaned == null) return null;
  const entry = join(process.resourcesPath, cleaned);
  if (!existsSync(entry)) {
    throw new Error(`configured packaged entry not found at ${entry}`);
  }
  return entry;
}

/** Synchronous because namespace/session paths must be set before Electron ready. */
export function readPackagedConfig(electronApp: PackagedConfigApp): PackagedConfig {
  const raw = readRawPackagedConfig(electronApp);
  const namespace = normalizeNamespace(
    process.env[PACKAGED_NAMESPACE_ENV] ?? raw.namespace ?? SIDECAR_DEFAULTS.namespace,
  );
  const namespaceBaseRoot = resolvePackagedNamespaceBaseRoot(
    raw.namespaceBaseRoot,
    electronApp.getPath("userData"),
  );
  const resourceRoot = resolveOptionalPath(raw.resourceRoot) ?? join(process.resourcesPath, "open-design");
  const relativeNodeCommand =
    raw.nodeCommandRelative == null || raw.nodeCommandRelative.length === 0
      ? join("open-design", "bin", "node")
      : raw.nodeCommandRelative;
  const nodeCommandCandidate = join(process.resourcesPath, relativeNodeCommand);
  const nodeCommand = existsSync(nodeCommandCandidate) ? nodeCommandCandidate : null;
  const allowWebOutputModeOverride = isTruthyEnv(process.env[PACKAGED_WEB_OUTPUT_MODE_OVERRIDE_ENV]);
  const webOutputMode = resolvePackagedWebOutputMode(
    allowWebOutputModeOverride
      ? process.env[PACKAGED_WEB_OUTPUT_MODE_ENV] ?? raw.webOutputMode
      : raw.webOutputMode,
  );
  const webStandaloneRoot = resolvePackagedWebStandaloneRoot(
    webOutputMode,
    allowWebOutputModeOverride
      ? process.env[PACKAGED_WEB_STANDALONE_ROOT_ENV] ?? raw.webStandaloneRoot
      : raw.webStandaloneRoot,
  );
  const daemonCliEntry = resolvePackagedRelativeEntry(raw.daemonCliEntryRelative);
  const daemonSidecarEntry = resolvePackagedRelativeEntry(raw.daemonSidecarEntryRelative);
  const webSidecarEntry = resolvePackagedRelativeEntry(raw.webSidecarEntryRelative);

  return {
    amrProfile: resolvePackagedAmrProfile(raw.amrProfile),
    appVersion: cleanOptionalString(raw.appVersion),
    daemonCliEntry,
    daemonSidecarEntry,
    namespace,
    namespaceBaseRoot,
    nodeCommand,
    product: raw.product == null ? null : parseMokinaPackagedProduct(raw.product),
    resourceRoot,
    telemetryRelayUrl: cleanOptionalString(raw.telemetryRelayUrl),
    updateMetadataUrl: cleanOptionalString(raw.updateMetadataUrl),
    posthogKey: cleanOptionalString(raw.posthogKey),
    posthogHost: cleanOptionalString(raw.posthogHost),
    velaWebUrl: cleanOptionalString(raw.velaWebUrl),
    velaWebUrls: cleanVelaWebUrls(raw.velaWebUrls),
    webSidecarEntry,
    webStandaloneRoot,
    webOutputMode,
  };
}
