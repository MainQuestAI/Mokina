import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { gzipSync, gunzipSync } from "node:zlib";
import { basename, join, resolve } from "node:path";

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
 * Ordering: each profile has a shared in-process queue and a SQLite write
 * lock across processes, released on close or process death. Writes are
 * atomic (temp file + rename). Values are bounded JSON documents.
 */

export const MOKINA_RECOVERY_STORE_SCHEMA_VERSION = 2 as const;

export const MOKINA_RECOVERY_STORE_LIMITS = Object.freeze({
  maxKeyLength: 4096,
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
// control characters and absurd shapes: PR3 send-request keys embed a JSON tuple
// (quotes, brackets, commas) that must survive verbatim.
export const MOKINA_RECOVERY_STORE_KEY_PATTERN = /^[A-Za-z0-9][^\u0000-\u001f\u007f-\u009f]*$/;

export type MokinaRecoveryRecord = {
  recordId: string;
  value: unknown;
};

export type MokinaRecoveryStoreResult<T> =
  | { ok: true; result: T }
  | { ok: false; reason: string };

export type MokinaRecoveryStoreGetOutcome =
  | { found: false; deletedRecordId?: string; legacyMigration?: 'confirm' }
  | { found: true; record: MokinaRecoveryRecord };

export type MokinaRecoveryPutOutcome = "stored" | "conflict";
export type MokinaRecoveryDeleteOutcome = "deleted" | "conflict";

type ReadOutcome =
  | { kind: "missing" }
  | { kind: "found"; file: StoredFile }
  | { kind: "deleted"; file: StoredFile }
  | { kind: "error"; reason: string };

type StoredFile = {
  schemaVersion: number;
  key: string;
  recordId: string;
  updatedAt: string;
  value: unknown;
  deleted?: true;
  previousRecordId?: string;
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

export type MokinaRecoveryCapacity = {
  active: number; reclaimable: number; archived: number; limit: number; archiveBytes: number;
};
// Several renderer windows share the same main-process authority.
const storeTails = new Map<string, Promise<unknown>>();
const ARCHIVE = '.deletions.gz';
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;

export class MokinaRecoveryStore {
  private legacyMissingRequiresConfirmation: boolean | undefined;
  private createdRoot = false;

  constructor(private readonly rootDir: string) {}

  /** A pre-v2 profile cannot distinguish old physical deletion from an unmigrated cache. */
  private async initializeProfilePolicy(): Promise<void> {
    const marker = join(this.rootDir, '.profile-state');
    try {
      const parsed: unknown = JSON.parse(await readFile(marker, 'utf8'));
      if (!isRecord(parsed) || ![2, 3].includes(parsed.schemaVersion as number) || typeof parsed.confirmLegacyMissing !== 'boolean') throw new Error('unreadable-profile');
      this.legacyMissingRequiresConfirmation = parsed.confirmLegacyMissing;
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    let existed = !this.createdRoot;
    try { await lstat(this.rootDir); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') existed = false; else throw error; }
    await mkdir(this.rootDir, { recursive: true });
    const temporary = `${marker}.tmp-${randomUUID()}`;
    await writeFile(temporary, JSON.stringify({ schemaVersion: 2, confirmLegacyMissing: existed }), { mode: 0o600 });
    await rename(temporary, marker);
    this.legacyMissingRequiresConfirmation = existed;
  }

  private keyPath(key: string): string {
    const digest = createHash("sha256").update(key).digest("hex").slice(0, 40);
    return join(this.rootDir, `${digest}.json`);
  }

  /** Single-writer serialization; keeps a monotonic chain per instance. */
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const scope = resolve(this.rootDir);
    const locked = async (): Promise<T> => {
      // OS-backed lock covers readers and every writer, including offline CLI
      // processes and an application starting immediately after quiescence check.
      this.createdRoot = (await mkdir(this.rootDir, { recursive: true })) !== undefined;
      const mutex = new DatabaseSync(join(this.rootDir, '.store-lock.sqlite'));
      try {
        try { mutex.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE'); }
        catch { return { ok: false, reason: 'recovery-store-busy' } as T; }
        return await operation();
      } finally { mutex.close(); }
    };
    const run = (storeTails.get(scope) ?? Promise.resolve()).then(locked, locked);
    const settled = run.then(() => undefined, () => undefined);
    storeTails.set(scope, settled);
    void settled.then(() => { if (storeTails.get(scope) === settled) storeTails.delete(scope); });
    return run;
  }

  private async readStored(key: string): Promise<ReadOutcome> {
    let raw: string;
    try {
      raw = await readFile(this.keyPath(key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        try {
          const archived = (await this.readArchive()).records.find(file => file.key === key);
          return archived ? { kind: 'deleted', file: archived } : { kind: 'missing' };
        } catch { return { kind: 'error', reason: 'unreadable-archive' }; }
      }
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
      || (parsed.schemaVersion !== 1 && parsed.schemaVersion !== MOKINA_RECOVERY_STORE_SCHEMA_VERSION)
      || parsed.key !== key
      || typeof parsed.recordId !== "string"
      || parsed.recordId.length === 0
      || (parsed.deleted === true && (parsed.schemaVersion !== 2 || typeof parsed.previousRecordId !== 'string' || !parsed.previousRecordId))
    ) {
      return { kind: "error", reason: "unreadable-record" };
    }
    return {
      kind: parsed.deleted === true ? "deleted" : "found",
      file: {
        schemaVersion: MOKINA_RECOVERY_STORE_SCHEMA_VERSION,
        key,
        recordId: parsed.recordId,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        value: parsed.value,
        ...(parsed.deleted === true ? { deleted: true as const, previousRecordId: typeof parsed.previousRecordId === 'string' ? parsed.previousRecordId : undefined } : {}),
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

  private async readArchive(): Promise<{ records: StoredFile[]; bytes: number }> {
    let data: Buffer;
    try { data = await readFile(join(this.rootDir, ARCHIVE)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const marker = JSON.parse(await readFile(join(this.rootDir, '.profile-state'), 'utf8'));
      if (marker.schemaVersion === 3) throw new Error('missing-archive');
      return { records: [], bytes: 0 };
    }
    const payload = JSON.parse(gunzipSync(data, { maxOutputLength: MAX_ARCHIVE_BYTES }).toString('utf8')) as unknown;
    if (!isRecord(payload) || payload.schemaVersion !== 1 || !Array.isArray(payload.records)) throw new Error('unreadable-archive');
    const keys = new Set<string>();
    for (const item of payload.records) {
      if (!isRecord(item) || item.schemaVersion !== 2 || item.deleted !== true || item.value !== null
        || typeof item.key !== 'string' || !isAllowedMokinaRecoveryKey(item.key) || keys.has(item.key)
        || typeof item.recordId !== 'string' || !item.recordId || typeof item.previousRecordId !== 'string'
        || !item.previousRecordId || typeof item.updatedAt !== 'string') throw new Error('unreadable-archive');
      keys.add(item.key);
    }
    return { records: payload.records as StoredFile[], bytes: data.length };
  }

  private async inventory() {
    await this.initializeProfilePolicy();
    const archive = await this.readArchive();
    const files: StoredFile[] = [];
    for (const name of await readdir(this.rootDir)) {
      if (!name.endsWith('.json')) continue;
      const parsed: unknown = JSON.parse(await readFile(join(this.rootDir, name), 'utf8'));
      if (!isRecord(parsed) || typeof parsed.key !== 'string' || !isAllowedMokinaRecoveryKey(parsed.key)
        || join(this.rootDir, name) !== this.keyPath(parsed.key)) throw new Error('unreadable-record');
      const record = await this.readStored(parsed.key);
      if (record.kind !== 'found' && record.kind !== 'deleted') throw new Error('unreadable-record');
      files.push(record.file);
    }
    const liveKeys = new Set(files.filter(f => !f.deleted).map(f => f.key));
    const status: MokinaRecoveryCapacity = { active: liveKeys.size, reclaimable: files.filter(f => f.deleted).length,
      archived: archive.records.filter(f => !liveKeys.has(f.key)).length, limit: MOKINA_RECOVERY_STORE_LIMITS.maxRecords, archiveBytes: archive.bytes };
    return { archive, files, status };
  }

  status(): Promise<MokinaRecoveryStoreResult<MokinaRecoveryCapacity>> {
    return this.enqueue(async () => {
      try { return { ok: true, result: (await this.inventory()).status }; }
      catch { return { ok: false, reason: 'unreadable-recovery-store' }; }
    });
  }

  /** Exact deletion witnesses survive compaction; no active value is archived.
   * Publish archive before unlink, so interruption leaves only harmless duplicates.
   * The v3 profile marker fences older hosts that cannot read archived witnesses.
   */
  compact(): Promise<MokinaRecoveryStoreResult<MokinaRecoveryCapacity>> {
    return this.enqueue(async () => {
      try {
        const { archive, files, status } = await this.inventory();
        if (!status.reclaimable) return { ok: true, result: status };
        const records = new Map(archive.records.map(f => [f.key, f]));
        for (const file of files) {
          if (file.deleted) records.set(file.key, file);
          else records.delete(file.key);
        }
        const raw = Buffer.from(JSON.stringify({ schemaVersion: 1, records: [...records.values()] }));
        if (raw.length > MAX_ARCHIVE_BYTES) return { ok: false, reason: 'archive-capacity' };
        const target = join(this.rootDir, ARCHIVE);
        await writeFile(`${target}.tmp`, gzipSync(raw), { mode: 0o600 });
        await rename(`${target}.tmp`, target);
        const marker = join(this.rootDir, '.profile-state');
        await writeFile(`${marker}.tmp`, JSON.stringify({ schemaVersion: 3, confirmLegacyMissing: this.legacyMissingRequiresConfirmation }), { mode: 0o600 });
        await rename(`${marker}.tmp`, marker);
        // Validate persisted bytes before removing any individual witness.
        await this.readArchive();
        for (const file of files) if (file.deleted) await rm(this.keyPath(file.key));
        return { ok: true, result: (await this.inventory()).status };
      } catch { return { ok: false, reason: 'compaction-failed' }; }
    });
  }

  /** Offline downgrade preparation: materialize every retained witness before
   * removing the old-host fence. Active records always take precedence. */
  expand(): Promise<MokinaRecoveryStoreResult<MokinaRecoveryCapacity>> {
    return this.enqueue(async () => {
      try {
        const { archive, files } = await this.inventory();
        const present = new Set(files.map(file => file.key));
        for (const file of archive.records) if (!present.has(file.key)) await this.writeStored(file);
        const marker = join(this.rootDir, '.profile-state');
        await writeFile(`${marker}.tmp`, JSON.stringify({ schemaVersion: 2, confirmLegacyMissing: this.legacyMissingRequiresConfirmation }), { mode: 0o600 });
        await rename(`${marker}.tmp`, marker);
        await rm(join(this.rootDir, ARCHIVE), { force: true });
        return { ok: true, result: (await this.inventory()).status };
      } catch { return { ok: false, reason: 'expansion-failed' }; }
    });
  }

  get(key: string): Promise<MokinaRecoveryStoreResult<MokinaRecoveryStoreGetOutcome>> {
    return this.enqueue(async () => {
      if (!isAllowedMokinaRecoveryKey(key)) return { ok: false as const, reason: "invalid-key" };
      await this.initializeProfilePolicy();
      const stored = await this.readStored(key);
      if (stored.kind === "error") return { ok: false as const, reason: stored.reason };
      if (stored.kind === "missing") return { ok: true as const, result: { found: false as const,
        ...(this.legacyMissingRequiresConfirmation ? { legacyMigration: 'confirm' as const } : {}) } };
      if (stored.kind === "deleted") return { ok: true as const, result: { found: false as const, deletedRecordId: stored.file.recordId } };
      return {
        ok: true as const,
        result: { found: true as const, record: { recordId: stored.file.recordId, value: stored.file.value } },
      };
    });
  }

  list(prefix: string | undefined): Promise<MokinaRecoveryStoreResult<string[]>> {
    return this.enqueue(async () => {
      if (prefix != null && !isAllowedMokinaRecoveryKey(prefix)) {
        return { ok: false as const, reason: "invalid-key" };
      }
      await this.initializeProfilePolicy();
      try { await this.readArchive(); } catch { return { ok: false as const, reason: 'unreadable-archive' }; }
      let names: string[];
      try {
        names = await readdir(this.rootDir);
      } catch {
        return { ok: false as const, reason: 'read-failed' };
      }
      const keys: string[] = [];
      for (const name of names) {
        if (!name.endsWith(".json")) continue;
        try {
          const parsed = JSON.parse(await readFile(join(this.rootDir, name), "utf8")) as unknown;
          if (!isRecord(parsed) || typeof parsed.key !== "string") continue;
          if (parsed.deleted === true) continue;
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
      await this.initializeProfilePolicy();
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
      const currentRecordId = stored.kind === "found" || stored.kind === 'deleted' ? stored.file.recordId : undefined;
      if (expectedRecordId === undefined) {
        // Create-if-absent: an existing record is a conflict, not an overwrite.
        if (currentRecordId != null) return { ok: true as const, result: "conflict" as const };
      } else if (currentRecordId !== expectedRecordId) {
        return { ok: true as const, result: "conflict" as const };
      }

      if (stored.kind === 'missing' || (stored.kind === 'deleted' && !(await readdir(this.rootDir)).includes(basename(this.keyPath(key))))) {
        await mkdir(this.rootDir, { recursive: true });
        const names = await readdir(this.rootDir);
        if (names.filter(name => name.endsWith('.json')).length >= MOKINA_RECOVERY_STORE_LIMITS.maxRecords) {
          return { ok: false as const, reason: 'record-capacity' };
        }
      }
      await this.writeStored({
        schemaVersion: MOKINA_RECOVERY_STORE_SCHEMA_VERSION,
        key,
        recordId: record.recordId,
        updatedAt: new Date().toISOString(),
        value: record.value,
      });

      return { ok: true as const, result: "stored" as const };
    });
  }

  delete(
    key: string,
    expectedRecordId: string,
  ): Promise<MokinaRecoveryStoreResult<MokinaRecoveryDeleteOutcome>> {
    return this.enqueue(async () => {
      if (!isAllowedMokinaRecoveryKey(key)) return { ok: false as const, reason: "invalid-key" };
      await this.initializeProfilePolicy();
      if (typeof expectedRecordId !== "string" || expectedRecordId.length === 0) {
        return { ok: false as const, reason: "invalid-record" };
      }
      const stored = await this.readStored(key);
      if (stored.kind === "error") return { ok: false as const, reason: stored.reason };
      if (stored.kind === 'deleted') return { ok: true as const, result: stored.file.previousRecordId === expectedRecordId ? 'deleted' as const : 'conflict' as const };
      if (stored.kind === "missing" || stored.file.recordId !== expectedRecordId) {
        return { ok: true as const, result: "conflict" as const };
      }
      await this.writeStored({ schemaVersion: MOKINA_RECOVERY_STORE_SCHEMA_VERSION, key, recordId: randomUUID(),
        previousRecordId: expectedRecordId, updatedAt: new Date().toISOString(), deleted: true, value: null });
      return { ok: true as const, result: "deleted" as const };
    });
  }
}

export function createMokinaRecoveryStore(rootDir: string): MokinaRecoveryStore {
  return new MokinaRecoveryStore(rootDir);
}
