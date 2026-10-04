import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MOKINA_RECOVERY_STORE_LIMITS,
  createMokinaRecoveryStore,
  isAllowedMokinaRecoveryKey,
  type MokinaRecoveryStore,
} from "../../src/main/mokina-recovery-store.js";

describe("mokina recovery store", () => {
  let root: string;
  let store: MokinaRecoveryStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "mokina-recovery-"));
    store = createMokinaRecoveryStore(root);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("accepts only Mokina-owned key namespaces", () => {
    expect(isAllowedMokinaRecoveryKey("od:chat-composer:draft:p1:c1")).toBe(true);
    expect(isAllowedMokinaRecoveryKey("od:send-request:v2:[\"none\",\"p\",\"c\"]:r1")).toBe(true);
    expect(isAllowedMokinaRecoveryKey("od:revision:op-1")).toBe(true);
    expect(isAllowedMokinaRecoveryKey("od:continuation:op-2")).toBe(true);
    expect(isAllowedMokinaRecoveryKey("mokina:anything")).toBe(true);
    expect(isAllowedMokinaRecoveryKey("od:update:status")).toBe(false);
    expect(isAllowedMokinaRecoveryKey("../../etc/passwd")).toBe(false);
    expect(isAllowedMokinaRecoveryKey("od:send-request")).toBe(true);
    expect(isAllowedMokinaRecoveryKey(`od:send-request:${"x".repeat(200)}`)).toBe(false);
  });

  it("stores and reads a record", async () => {
    const put = await store.put("od:revision:op-1", { recordId: "r1", value: { phase: "prepared" } });
    expect(put).toEqual({ ok: true, result: "stored" });
    const got = await store.get("od:revision:op-1");
    expect(got).toEqual({ ok: true, result: { found: true, record: { recordId: "r1", value: { phase: "prepared" } } } });
  });

  it("treats put without expectedRecordId as create-if-absent", async () => {
    await store.put("od:revision:op-1", { recordId: "r1", value: 1 });
    const again = await store.put("od:revision:op-1", { recordId: "r2", value: 2 });
    expect(again).toEqual({ ok: true, result: "conflict" });
    const got = await store.get("od:revision:op-1");
    expect(got.ok && got.result.found && got.result.record.value).toBe(1);
  });

  it("replaces only with a matching expectedRecordId", async () => {
    await store.put("od:send-request:v2:[\"none\",\"p\",\"c\"]:r1", { recordId: "r1", value: { status: "pending" } });
    const stale = await store.put(
      "od:send-request:v2:[\"none\",\"p\",\"c\"]:r1",
      { recordId: "r2", value: { status: "draft" } },
      "r0",
    );
    expect(stale).toEqual({ ok: true, result: "conflict" });
    const swapped = await store.put(
      "od:send-request:v2:[\"none\",\"p\",\"c\"]:r1",
      { recordId: "r2", value: { status: "draft" } },
      "r1",
    );
    expect(swapped).toEqual({ ok: true, result: "stored" });
    const got = await store.get("od:send-request:v2:[\"none\",\"p\",\"c\"]:r1");
    expect(got.ok && got.result.found && got.result.record.recordId).toBe("r2");
  });

  it("deletes only with the expected record id", async () => {
    await store.put("od:continuation:op", { recordId: "r1", value: "x" });
    expect(await store.delete("od:continuation:op", "r0")).toEqual({ ok: true, result: "conflict" });
    expect(await store.delete("od:continuation:op", "r1")).toEqual({ ok: true, result: "deleted" });
    expect(await store.get("od:continuation:op")).toEqual({ ok: true, result: { found: false } });
  });

  it("rejects invalid keys, oversized and unserializable values without writing", async () => {
    expect((await store.put("nope:key", { recordId: "r", value: 1 })).ok).toBe(false);
    const oversized = "x".repeat(MOKINA_RECOVERY_STORE_LIMITS.maxValueChars + 1);
    expect(await store.put("od:revision:big", { recordId: "r", value: oversized })).toEqual({
      ok: false,
      reason: "value-too-large",
    });
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(await store.put("od:revision:cyclic", { recordId: "r", value: cyclic })).toEqual({
      ok: false,
      reason: "value-not-serializable",
    });
  });

  it("surfaces a corrupt record instead of treating it as absent", async () => {
    await store.put("od:revision:op", { recordId: "r1", value: { a: 1 } });
    const files = (await readdir(root)).filter((name) => name.endsWith(".json"));
    expect(files).toHaveLength(1);
    await writeFile(join(root, files[0]!), "{ not json", "utf8");
    expect(await store.get("od:revision:op")).toEqual({ ok: false, reason: "unreadable-record" });
    expect((await store.put("od:revision:op", { recordId: "r2", value: 2 })).ok).toBe(false);
  });

  it("lists owned keys, optionally by prefix, and ignores foreign files", async () => {
    await store.put("od:revision:a", { recordId: "r1", value: 1 });
    await store.put("od:continuation:b", { recordId: "r2", value: 2 });
    await writeFile(join(root, "foreign.json"), JSON.stringify({ key: "secret", recordId: "x", schemaVersion: 1 }), "utf8");
    expect(await store.list("od:revision")).toEqual({ ok: true, result: ["od:revision:a"] });
    const all = await store.list(undefined);
    expect(all.ok && all.result).toEqual(["od:continuation:b", "od:revision:a"]);
  });

  it("persists across store instances and writes atomically", async () => {
    await store.put("od:chat-composer:draft:p:c", { recordId: "r1", value: "hello" });
    const second = createMokinaRecoveryStore(root);
    const got = await second.get("od:chat-composer:draft:p:c");
    expect(got.ok && got.result.found && got.result.record.value).toBe("hello");
    const onDisk = await readFile(join(root, (await readdir(root)).filter((n) => n.endsWith(".json"))[0]!), "utf8");
    expect(JSON.parse(onDisk)).toMatchObject({ schemaVersion: 1, key: "od:chat-composer:draft:p:c", recordId: "r1" });
  });

  it("serializes concurrent writes to the same key (single writer, last write wins by CAS order)", async () => {
    await store.put("od:revision:race", { recordId: "r0", value: 0 });
    const results = await Promise.all([
      store.put("od:revision:race", { recordId: "r1", value: 1 }, "r0"),
      store.put("od:revision:race", { recordId: "r2", value: 2 }, "r0"),
    ]);
    // Exactly one CAS can win; the loser reports conflict rather than clobbering.
    expect(results.filter((r) => r.ok && r.result === "stored")).toHaveLength(1);
    expect(results.filter((r) => r.ok && r.result === "conflict")).toHaveLength(1);
  });
});
