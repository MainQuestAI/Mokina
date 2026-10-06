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
    expect(isAllowedMokinaRecoveryKey(`od:send-request:${"x".repeat(4097)}`)).toBe(false);
    expect(isAllowedMokinaRecoveryKey('mokina:revision:中文\n文件')).toBe(false);
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
    expect(await store.get("od:continuation:op")).toMatchObject({ ok: true, result: { found: false, deletedRecordId: expect.any(String) } });
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
    expect(JSON.parse(onDisk)).toMatchObject({ schemaVersion: 2, key: "od:chat-composer:draft:p:c", recordId: "r1" });
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

  it.each(['deliverables/plan.html', '营销资料/方案 空格.html', 'a/plan.html', 'b/plan.html', `${'目录/'.repeat(80)}plan.html`])('RR5 persists legitimate composite file key %s across instances', async fileName => {
    const key = `mokina:revision:project:${fileName}`;
    expect(await store.put(key, { recordId: 'first', value: fileName })).toEqual({ ok: true, result: 'stored' });
    expect(await createMokinaRecoveryStore(root).get(key)).toMatchObject({ ok: true, result: { found: true, record: { value: fileName } } });
    expect(await store.list('mokina:revision:')).toEqual({ ok: true, result: [key] });
  });

  it('RR4 deletion survives restart, rejects stale recreation, and permits an explicit new generation with CAS', async () => {
    const key = 'mokina:context-snapshot:p';
    await store.put(key, { recordId: 'original', value: 'snapshot' });
    expect(await store.delete(key, 'original')).toEqual({ ok: true, result: 'deleted' });
    const reopened = createMokinaRecoveryStore(root);
    const deleted = await reopened.get(key);
    expect(deleted).toMatchObject({ ok: true, result: { found: false, deletedRecordId: expect.any(String) } });
    expect(await reopened.list('mokina:context-snapshot:')).toEqual({ ok: true, result: [] });
    expect(await reopened.put(key, { recordId: 'stale', value: 'old cache' })).toEqual({ ok: true, result: 'conflict' });
    const id = (deleted as { result: { deletedRecordId: string } }).result.deletedRecordId;
    expect(await reopened.put(key, { recordId: 'new', value: 'new choice' }, id)).toEqual({ ok: true, result: 'stored' });
    expect(await reopened.delete(key, 'original')).toEqual({ ok: true, result: 'conflict' });
    expect(await reopened.get(key)).toMatchObject({ ok: true, result: { found: true, record: { value: 'new choice' } } });
  });
  it('requires confirmation for ambiguous old profiles but permits migration into a fresh profile', async () => {
    expect(await store.get('od:revision:old')).toMatchObject({ ok: true, result: { found: false, legacyMigration: 'confirm' } });
    const fresh = createMokinaRecoveryStore(join(root, 'new-profile'));
    expect(await fresh.get('od:revision:old')).toEqual({ ok: true, result: { found: false } });
  });
  it('reads a v1 record and durably deletes it without losing CAS identity', async () => {
    await store.put('od:revision:v1', { recordId: 'v1', value: '旧记录' });
    const file = (await readdir(root)).find(n => n.endsWith('.json'))!;
    const record = JSON.parse(await readFile(join(root, file), 'utf8'));
    await writeFile(join(root, file), JSON.stringify({ ...record, schemaVersion: 1 }));
    const reopened = createMokinaRecoveryStore(root);
    expect(await reopened.get('od:revision:v1')).toMatchObject({ ok: true, result: { found: true, record: { value: '旧记录' } } });
    expect(await reopened.delete('od:revision:v1', 'v1')).toEqual({ ok: true, result: 'deleted' });
    expect(await reopened.delete('od:revision:v1', 'v1')).toEqual({ ok: true, result: 'deleted' });
  });
  it('counts retained deletion facts toward capacity and never evicts them', async () => {
    for (let index = 0; index < MOKINA_RECOVERY_STORE_LIMITS.maxRecords; index++) {
      expect(await store.put(`od:revision:${index}`, { recordId: `${index}`, value: index })).toEqual({ ok: true, result: 'stored' });
    }
    await store.delete('od:revision:0', '0');
    expect(await store.put('od:revision:extra', { recordId: 'extra', value: 1 })).toEqual({ ok: false, reason: 'record-capacity' });
    expect(await createMokinaRecoveryStore(root).get('od:revision:0')).toMatchObject({ ok: true, result: { found: false, deletedRecordId: expect.any(String) } });
  });
});
