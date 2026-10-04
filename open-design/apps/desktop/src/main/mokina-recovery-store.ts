import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Narrow durable store for Mokina recovery state under the desktop profile:
 * composer drafts, PR3 send-intent records and revision/continuation journals.
 *
 * Semantics (mirrors `contracts/mokina-local.ts` `DurableRecoveryStore`):
 * - `put` with `expectedRecordId` replaces only when the stored record id
 *   matches; a mismatch (including "no record") is a conflict, never an
 *   overwrite.
 * - `put` without `expectedRecordId` is create-if-absent: an existing record
 *   is a conflict, NOT an unconditional overwrite.
 * - `delete` requires the expected record id.
 *
 * Ordering: every operation on one store instance runs on a single promise
 * chain, so main-process writes to the same key never interleave. Writes are
 * atomic (temp file + rename). Values are bounded JSON documents.
 */

export const MOKINA_RECOVERY_STORE_SCHEMA_VERSION = 1 as const;

export const MOKINA_RECOVERY_STORE_LIMITS = Object.freeze({
  maxKeyLength: 160,
  maxRecords: 512,
  maxValueChars: 256 * 1024,
});

/** Key namespaces this store owns. Anything else is rejected. */
export const MOKINA_RECOVERY_STORE_KEY_PREFIXES = Object.freeze([
  "od:chat-composer",
  "od:composer-draft",
  "od:send-request",
  "od:revision",
  "od:continuation",
  "mokina",
] as const);

// Keys are hashed into file names, so the pattern only needs to reject path
// separators/NUL and absurd shapes: PR3 send-request keys embed a JSON tuple
// (quotes, brackets, commas) that must survive verbatim.
export const MOKINA_RECOVERY_STORE_KEY_PATTERN = /^[A-Za-z0-9][^\\/\u0000]*$/;

export type MokinaRecoveryRecord = {
  recordId: string;
  value: unknown;
};

export type MokinaRecoveryStoreResult<T> =
  | { ok: true; result: T }
  | { ok: false; reason: string };

export type MokinaRecoveryStoreGetOutcome =
  | { found: false }
  | { found: true; record: MokinaRecoveryRecord };

export type MokinaRecoveryPutOutcome = "stored" | "conflict";
export type MokinaRecoveryDeleteOutcome = "deleted" | "conflict";

type ReadOutcome =
  | { kind: "missing" }
  | { kind: "found"; file: StoredFile }
  | { kind: "error"; reason: string };

type StoredFile = {
  schemaVersion: number;
  key: string;
  recordId: string;
  updatedAt: string;
  value: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

export function isAllowedMokinaRecoveryKey(key: string): boolean {
  if (key.length === 0 || key.length > MOKINA_RECOVERY_STORE_LIMITS.maxKeyLength) return false;
  if (!MOKINA_RECOVERY_STORE_KEY_PATTERN.test(key)) return false;
  return MOKINA_RECOVERY_STORE_KEY_PREFIXES.some(
    (prefix) => key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(`${prefix}.`),
  );
}

export class MokinaRecoveryStore {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly rootDir: string) {}

  private keyPath(key: string): string {
    const digest = createHash("sha256").update(key).digest("hex").slice(0, 40);
    return join(this.rootDir, `${digest}.json`);
  }

  /** Single-writer serialization; keeps a monotonic chain per instance. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.tail.then(operation, operation);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async readStored(key: string): Promise<ReadOutcome> {
    let raw: string;
    try {
      raw = await readFile(this.keyPath(key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
      return { kind: "error", reason: "read-failed" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { kind: "error", reason: "unreadable-record" };
    }
    if (
      !isRecord(parsed)
      || parsed.schemaVersion !== MOKINA_RECOVERY_STORE_SCHEMA_VERSION
      || parsed.key !== key
      || typeof parsed.recordId !== "string"
      || parsed.recordId.length === 0
    ) {
      return { kind: "error", reason: "unreadable-record" };
    }
    return {
      kind: "found",
      file: {
        schemaVersion: MOKINA_RECOVERY_STORE_SCHEMA_VERSION,
        key,
        recordId: parsed.recordId,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        value: parsed.value,
      },
    };
  }

  private async writeStored(file: StoredFile): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
    const target = this.keyPath(file.key);
    const temporary = `${target}.tmp`;
    await writeFile(temporary, `${JSON.stringify(file)}\n`, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  }

  private async enforceRecordCap(): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.rootDir);
    } catch {
      return;
    }
    const files = names.filter((name) => name.endsWith(".json"));
    if (files.length <= MOKINA_RECOVERY_STORE_LIMITS.maxRecords) return;
    const stats = await Promise.all(
      files.map(async (name) => {
        try {
          const info = await stat(join(this.rootDir, name));
          return { name, mtimeMs: info.mtimeMs };
        } catch {
          return { name, mtimeMs: 0 };
        }
      }),
    );
    stats.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const excess = stats.slice(0, files.length - MOKINA_RECOVERY_STORE_LIMITS.maxRecords);
    await Promise.all(excess.map((entry) => rm(join(this.rootDir, entry.name), { force: true })));
  }

  get(key: string): Promise<MokinaRecoveryStoreResult<MokinaRecoveryStoreGetOutcome>> {
    return this.enqueue(async () => {
      if (!isAllowedMokinaRecoveryKey(key)) return { ok: false as const, reason: "invalid-key" };
      const stored = await this.readStored(key);
      if (stored.kind === "error") return { ok: false as const, reason: stored.reason };
      if (stored.kind === "missing") return { ok: true as const, result: { found: false as const } };
      return {
        ok: true as const,
        result: { found: true as const, record: { recordId: stored.file.recordId, value: stored.file.value } },
      };
    });
  }

  list(prefix: string | undefined): Promise<MokinaRecoveryStoreResult<string[]>> {
    return this.enqueue(async () => {
      if (prefix != null && (prefix.length === 0 || !MOKINA_RECOVERY_STORE_KEY_PATTERN.test(prefix))) {
        return { ok: false as const, reason: "invalid-key" };
      }
      let names: string[];
      try {
        names = await readdir(this.rootDir);
      } catch {
        return { ok: true as const, result: [] };
      }
      const keys: string[] = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(await readFile(join(this.rootDir, name), "utf8")) as unknown;
          if (!isRecord(parsed) || typeof parsed.key !== "string") continue;
          const key = parsed.key;
          if (prefix != null && !(key === prefix || key.startsWith(prefix))) continue;
          if (!isAllowedMokinaRecoveryKey(key)) continue;
          keys.push(key);
        } catch {
          // A corrupt record must not hide the rest; callers surface it via get().
          continue;
        }
      }
      keys.sort();
      return { ok: true as const, result: keys };
    });
  }

  put(
    key: string,
    record: MokinaRecoveryRecord,
    expectedRecordId?: string,
  ): Promise<MokinaRecoveryStoreResult<MokinaRecoveryPutOutcome>> {
    return this.enqueue(async () => {
      if (!isAllowedMokinaRecoveryKey(key)) return { ok: false as const, reason: "invalid-key" };
      if (record == null || typeof record.recordId !== "string" || record.recordId.length === 0) {
        return { ok: false as const, reason: "invalid-record" };
      }
      let encoded: string;
      try {
        encoded = JSON.stringify(record.value);
      } catch {
        return { ok: false as const, reason: "value-not-serializable" };
      }
      if (encoded == null) encoded = "null";
      if (encoded.length > MOKINA_RECOVERY_STORE_LIMITS.maxValueChars) {
        return { ok: false as const, reason: "value-too-large" };
      }

      const stored = await this.readStored(key);
      if (stored.kind === "error") return { ok: false as const, reason: stored.reason };
      const currentRecordId = stored.kind === "found" ? stored.file.recordId : undefined;
      if (expectedRecordId === undefined) {
        // Create-if-absent: an existing record is a conflict, not an overwrite.
        if (currentRecordId != null) return { ok: true as const, result: "conflict" as const };
      } else if (currentRecordId !== expectedRecordId) {
        return { ok: true as const, result: "conflict" as const };
      }

      await this.writeStored({
        schemaVersion: MOKINA_RECOVERY_STORE_SCHEMA_VERSION,
        key,
        recordId: record.recordId,
        updatedAt: new Date().toISOString(),
        value: record.value,
      });
      await this.enforceRecordCap();
      return { ok: true as const, result: "stored" as const };
    });
  }

  delete(
    key: string,
    expectedRecordId: string,
  ): Promise<MokinaRecoveryStoreResult<MokinaRecoveryDeleteOutcome>> {
    return this.enqueue(async () => {
      if (!isAllowedMokinaRecoveryKey(key)) return { ok: false as const, reason: "invalid-key" };
      if (typeof expectedRecordId !== "string" || expectedRecordId.length === 0) {
        return { ok: false as const, reason: "invalid-record" };
      }
      const stored = await this.readStored(key);
      if (stored.kind === "error") return { ok: false as const, reason: stored.reason };
      if (stored.kind === "missing" || stored.file.recordId !== expectedRecordId) {
        return { ok: true as const, result: "conflict" as const };
      }
      await rm(this.keyPath(key), { force: true });
      return { ok: true as const, result: "deleted" as const };
    });
  }
}

export function createMokinaRecoveryStore(rootDir: string): MokinaRecoveryStore {
  return new MokinaRecoveryStore(rootDir);
}
