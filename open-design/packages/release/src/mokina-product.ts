/**
 * Mokina local-preview product identity.
 *
 * This is a packaging/local-runner identity — it is deliberately NOT a release
 * channel: `releaseChannelFromVersion("0.0.2-local.1")` yields null because
 * `local` is a reserved release name, and Mokina never publishes to the
 * upstream update feed at all. The profile below is baked into the packaged
 * config by tools-pack and re-consumed (read-only) by the packaged runtime,
 * desktop, daemon and web.
 */

export const MOKINA_PRODUCT_ID = "mokina";
export const MOKINA_PRODUCT_NAME = "Mokina";
export const MOKINA_LOCAL_PREVIEW_NAMESPACE = "mokina-local";
export const MOKINA_RELEASE_KIND = "local-preview";

export const MOKINA_PRODUCT_ENV_KEYS = Object.freeze({
  id: "MOKINA_PRODUCT_ID",
  name: "MOKINA_PRODUCT_NAME",
  releaseKind: "MOKINA_RELEASE_KIND",
  version: "MOKINA_PRODUCT_VERSION",
});

export type MokinaReleaseKind = typeof MOKINA_RELEASE_KIND;

export interface MokinaProductProfile {
  productId: typeof MOKINA_PRODUCT_ID;
  productName: string;
  bundleIdentifier: string;
  releaseKind: MokinaReleaseKind;
  /** Namespace the profile activates for; packaging must use this namespace. */
  namespace: string;
  automaticUpdates: false;
  upstreamNews: false;
  defaultTelemetry: false;
  requiresUpstreamAccount: false;
  registersOdScheme: false;
}

/** The subset every runtime consumer receives in the packaged config. */
export interface MokinaPackagedProduct {
  productId: typeof MOKINA_PRODUCT_ID;
  productName: string;
  productVersion: string | null;
  releaseKind: MokinaReleaseKind;
  automaticUpdates: false;
  upstreamNews: false;
  defaultTelemetry: false;
  requiresUpstreamAccount: false;
  registersOdScheme: false;
}

export const MOKINA_PRODUCT_PROFILE_FILE_NAME = "mokina-product.json";

/**
 * A namespace activates the Mokina profile only when it is the profile
 * namespace or a boundary extension of it (`mokina-local`, `mokina-local-qa`,
 * `mokina-local.1`, ...). Arbitrary `mokina-*` namespaces do not activate it.
 */
export function isMokinaLocalNamespace(namespace: string): boolean {
  return /^mokina-local(?:$|[-_.])/.test(namespace);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`mokina product profile: ${field} must be a non-empty string`);
  }
  return value;
}

function requireFalse(value: unknown, field: string): false {
  if (value !== false) {
    throw new Error(`mokina product profile: ${field} must be false in the local preview`);
  }
  return false;
}

export function parseMokinaProductProfile(value: unknown): MokinaProductProfile {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new Error("mokina product profile: expected a JSON object");
  }
  const raw = value as Record<string, unknown>;
  if (raw.productId !== MOKINA_PRODUCT_ID) {
    throw new Error(`mokina product profile: productId must be "${MOKINA_PRODUCT_ID}"`);
  }
  return {
    productId: MOKINA_PRODUCT_ID,
    productName: requireString(raw.productName, "productName"),
    bundleIdentifier: requireString(raw.bundleIdentifier, "bundleIdentifier"),
    releaseKind: MOKINA_RELEASE_KIND,
    namespace: requireString(raw.namespace, "namespace"),
    automaticUpdates: requireFalse(raw.automaticUpdates, "automaticUpdates"),
    upstreamNews: requireFalse(raw.upstreamNews, "upstreamNews"),
    defaultTelemetry: requireFalse(raw.defaultTelemetry, "defaultTelemetry"),
    requiresUpstreamAccount: requireFalse(raw.requiresUpstreamAccount, "requiresUpstreamAccount"),
    registersOdScheme: requireFalse(raw.registersOdScheme, "registersOdScheme"),
  };
}

/** Parse the packaged-config `product` section. This is the runtime subset of
 * the profile file: bundle identifier and namespace stay packaging-time
 * concerns and are not required here. Unknown shapes are rejected. */
export function parseMokinaPackagedProduct(value: unknown): MokinaPackagedProduct {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    throw new Error("mokina product profile: expected a JSON object");
  }
  const raw = value as Record<string, unknown>;
  if (raw.productId !== MOKINA_PRODUCT_ID) {
    throw new Error(`mokina product profile: productId must be "${MOKINA_PRODUCT_ID}"`);
  }
  if (raw.releaseKind != null && raw.releaseKind !== MOKINA_RELEASE_KIND) {
    throw new Error(`mokina product profile: releaseKind must be "${MOKINA_RELEASE_KIND}"`);
  }
  const productVersion = raw.productVersion;
  if (productVersion != null && typeof productVersion !== "string") {
    throw new Error("mokina product profile: productVersion must be a string or null");
  }
  return {
    productId: MOKINA_PRODUCT_ID,
    productName: requireString(raw.productName, "productName"),
    productVersion: productVersion ?? null,
    releaseKind: MOKINA_RELEASE_KIND,
    automaticUpdates: requireFalse(raw.automaticUpdates, "automaticUpdates"),
    upstreamNews: requireFalse(raw.upstreamNews, "upstreamNews"),
    defaultTelemetry: requireFalse(raw.defaultTelemetry, "defaultTelemetry"),
    requiresUpstreamAccount: requireFalse(raw.requiresUpstreamAccount, "requiresUpstreamAccount"),
    registersOdScheme: requireFalse(raw.registersOdScheme, "registersOdScheme"),
  };
}

export function mokinaProductEnv(product: MokinaPackagedProduct): Record<string, string> {
  const env: Record<string, string> = {
    [MOKINA_PRODUCT_ENV_KEYS.id]: product.productId,
    [MOKINA_PRODUCT_ENV_KEYS.name]: product.productName,
    [MOKINA_PRODUCT_ENV_KEYS.releaseKind]: product.releaseKind,
  };
  if (product.productVersion != null) env[MOKINA_PRODUCT_ENV_KEYS.version] = product.productVersion;
  return env;
}
