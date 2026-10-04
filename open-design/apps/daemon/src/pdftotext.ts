import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Locate the pdftotext binary.
 *
 * The packaged Mokina build ships a controlled copy and points
 * `OD_PDFTOTEXT_PATH` at it, because a Finder-launched child process does not
 * inherit Homebrew's PATH. Development keeps the historical PATH lookup.
 */
export function resolvePdftotextBinary(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.OD_PDFTOTEXT_PATH?.trim();
  return configured != null && configured.length > 0 ? configured : "pdftotext";
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
