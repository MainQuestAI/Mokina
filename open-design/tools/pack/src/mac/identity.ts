import { SIDECAR_DEFAULTS } from "@open-design/sidecar-proto";
import {
  releaseChannelFromNamespace,
  releaseChannelFromVersion,
  releaseInstallIdentity,
} from "@open-design/release";

import type { ToolPackConfig } from "../config/index.js";
import { resolveMokinaProductProfileForNamespace } from "../config/product-profile.js";
import { PRODUCT_NAME } from "./constants.js";

export type MacInstallIdentity = {
  appId: string;
  executableName: string;
  installerTitle: string;
  productName: string;
  publicAppBundleName: string;
  systemAppBundleName: string;
};

function sanitizeNamespace(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export function resolveMacInstallIdentity(config: Pick<ToolPackConfig, "namespace" | "appVersion">): MacInstallIdentity {
  const namespaceToken = sanitizeNamespace(config.namespace);
  const mokinaProfile = resolveMokinaProductProfileForNamespace(config.namespace);
  if (mokinaProfile != null) {
    const appBundleName = `${mokinaProfile.productName}.app`;
    return {
      appId: mokinaProfile.bundleIdentifier,
      executableName: mokinaProfile.productName,
      installerTitle: mokinaProfile.productName,
      productName: mokinaProfile.productName,
      publicAppBundleName: appBundleName,
      systemAppBundleName: appBundleName,
    };
  }

  const channel = releaseChannelFromVersion(config.appVersion)
    ?? releaseChannelFromNamespace(config.namespace, SIDECAR_DEFAULTS.namespace);
  const channelIdentity = channel == null
    ? { appId: "io.open-design.desktop", productName: PRODUCT_NAME }
    : releaseInstallIdentity(channel);
  const publicAppBundleName = `${channelIdentity.productName}.app`;
  const systemAppBundleName = channel != null
    ? publicAppBundleName
    : `${PRODUCT_NAME}.${namespaceToken}.app`;

  return {
    ...channelIdentity,
    executableName: channelIdentity.productName,
    installerTitle: channel == null ? `${PRODUCT_NAME}-${namespaceToken}` : channelIdentity.productName,
    publicAppBundleName,
    systemAppBundleName,
  };
}

/**
 * Base name for dmg/zip/payload artifacts. Upstream keeps `Open Design-<ns>`;
 * the Mokina profile uses its own product name.
 */
export function resolveMacArtifactBaseName(config: Pick<ToolPackConfig, "namespace">): string {
  return resolveMokinaProductProfileForNamespace(config.namespace)?.productName ?? PRODUCT_NAME;
}
