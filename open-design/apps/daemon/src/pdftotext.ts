import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

/**
 * Well-known absolute locations a Finder-launched process can still read even
 * though it does not inherit an interactive shell PATH (T05). A controlled
 * resource path supplied by packaging via `OD_PDFTOTEXT_PATH` wins; the bare
 * command name is the last resort so development keeps the historical lookup.
 */
export const PDFTOTEXT_FALLBACK_PATHS = [
  "/opt/homebrew/bin/pdftotext",
  "/usr/local/bin/pdftotext",
] as const;

export type PdftotextResolveOptions = {
  /** Injectable for tests; defaults to fs.existsSync. */
  exists?: (candidate: string) => boolean;
};

export function resolvePdftotextBinary(
  env: NodeJS.ProcessEnv = process.env,
  options: PdftotextResolveOptions = {},
): string {
  const configured = env.OD_PDFTOTEXT_PATH?.trim();
  if (configured != null && configured.length > 0) return configured;
  const exists = options.exists ?? ((candidate: string) => existsSync(candidate));
  for (const candidate of PDFTOTEXT_FALLBACK_PATHS) {
    if (exists(candidate)) return candidate;
  }
  return "pdftotext";
}

export type PdftotextResult = { ok: true; stdout: string } | { ok: false; reason: string };

/** Extract the text layer of a PDF through the resolved binary. */
export async function runPdftotext(
  file: string,
  options: { timeoutMs?: number; maxBufferBytes?: number; env?: NodeJS.ProcessEnv } = {},
): Promise<PdftotextResult> {
  try {
    const { stdout } = await promisify(execFile)(
      resolvePdftotextBinary(options.env),
      ["-layout", file, "-"],
      { timeout: options.timeoutMs ?? 15_000, maxBuffer: options.maxBufferBytes ?? 4 * 1024 * 1024 },
    );
    return { ok: true, stdout };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, reason };
  }
}
