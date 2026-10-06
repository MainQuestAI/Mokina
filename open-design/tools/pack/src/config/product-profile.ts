import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MOKINA_PRODUCT_PROFILE_FILE_NAME,
  isMokinaLocalNamespace,
  parseMokinaProductProfile,
  type MokinaProductProfile,
} from "@open-design/release";

// The profile ships next to the platform resources. Importing
// ../resources/index.js here would pull @open-design/platform into every
// identity-resolution import chain, which breaks hoisted test mocks for
// unrelated suites, so this module resolves the single JSON path by walking up
// to the @open-design/tools-pack package root. Walking (instead of a fixed
// "../..") keeps the path correct after the dist bundle flattens this file
// into tools/pack/dist/index.mjs.
function toolsPackRootFromModule(): string {
  let current = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      const raw = readFileSync(join(current, "package.json"), "utf8");
      if ((JSON.parse(raw) as { name?: unknown }).name === "@open-design/tools-pack") return current;
    } catch {
      // Keep walking until the tools-pack package root is found.
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`tools-pack: unable to resolve package root from ${fileURLToPath(import.meta.url)}`);
}

export function mokinaProductProfilePath(): string {
  return join(toolsPackRootFromModule(), "resources", MOKINA_PRODUCT_PROFILE_FILE_NAME);
}

export function loadMokinaProductProfile(path: string = mokinaProductProfilePath()): MokinaProductProfile {
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  return parseMokinaProductProfile(raw);
}

/**
 * Returns the profile when the packaging namespace activates it, otherwise
 * null so every caller keeps the upstream identity path untouched.
 */
export function resolveMokinaProductProfileForNamespace(
  namespace: string,
  profilePath?: string,
): MokinaProductProfile | null {
  if (!isMokinaLocalNamespace(namespace)) return null;
  const profile = loadMokinaProductProfile(profilePath);
  if (!isMokinaLocalNamespace(profile.namespace)) {
    throw new Error(
      `mokina product profile namespace ${profile.namespace} does not activate the Mokina identity`,
    );
  }
  return profile;
}
