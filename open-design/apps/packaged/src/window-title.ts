import {
  releaseChannelFromNamespace,
  releaseChannelFromVersion,
  releaseInstallIdentity,
} from "@open-design/release";

const DEFAULT_WINDOW_TITLE = "Open Design";

export function resolvePackagedWindowTitle(config: {
  appVersion: string | null;
  namespace: string;
  product?: { productName: string } | null;
}): string {
  const productName = config.product?.productName?.trim();
  if (productName != null && productName.length > 0) return productName;
  const channel =
    releaseChannelFromVersion(config.appVersion) ??
    releaseChannelFromNamespace(config.namespace);
  return channel == null ? DEFAULT_WINDOW_TITLE : releaseInstallIdentity(channel).productName;
}
