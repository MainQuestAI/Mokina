import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const archiveFault = vi.hoisted(() => ({ mode: null as null | 'corrupt-temp' | 'changed-temp' | 'read-temp' }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const isArchiveTemp = (path: unknown) => typeof path === 'string' && /[\\/]\.deletions\.gz\.tmp(?:-|$)/u.test(path);
  return {
    ...actual,
    async writeFile(...args: Parameters<typeof actual.writeFile>) {
      if (archiveFault.mode === 'corrupt-temp' && isArchiveTemp(args[0])) {
        return actual.writeFile(args[0], Buffer.from('damaged archive'), args[2]);
      }
      if (archiveFault.mode === 'changed-temp' && isArchiveTemp(args[0])) {
        const payload = JSON.parse(gunzipSync(args[1] as Buffer).toString('utf8'));
        payload.records[0].recordId += '-changed';
        return actual.writeFile(args[0], gzipSync(JSON.stringify(payload)), args[2]);
      }
      return actual.writeFile(...args);
    },
    async readFile(...args: Parameters<typeof actual.readFile>) {
      if (archiveFault.mode === 'read-temp' && isArchiveTemp(args[0])) {
        throw Object.assign(new Error('archive read failed'), { code: 'EIO' });
      }
      return actual.readFile(...args);
    },
  };
});

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
    archiveFault.mode = null;
    root = await mkdtemp(join(tmpdir(), "mokina-recovery-"));
    store = createMokinaRecoveryStore(root);
  });

  afterEach(async () => {
    archiveFault.mode = null;
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
  it('M4 compacts deletion witnesses, frees capacity and fences stale writers after restart', async () => {
    for (let i = 0; i < MOKINA_RECOVERY_STORE_LIMITS.maxRecords; i++) {
      await store.put(`od:revision:${i}`, { recordId: `r${i}`, value: `draft ${i}` });
    }
    await store.delete('od:revision:0', 'r0');
    const witness = await store.get('od:revision:0');
    expect(await store.compact()).toMatchObject({ ok: true });
    const reopened = createMokinaRecoveryStore(root);
    expect(await reopened.get('od:revision:0')).toEqual(witness);
    expect(await reopened.put('od:revision:0', { recordId: 'stale', value: 'deleted draft' }, 'r0')).toEqual({ ok: true, result: 'conflict' });
    expect(await reopened.put('od:revision:0', { recordId: 'stale', value: 'deleted draft' })).toEqual({ ok: true, result: 'conflict' });
    expect(await reopened.put('od:revision:new', { recordId: 'new', value: 'new work' })).toEqual({ ok: true, result: 'stored' });
    expect(await reopened.get('od:revision:1')).toMatchObject({ ok: true, result: { found: true, record: { value: 'draft 1' } } });
    expect(await reopened.status()).toMatchObject({ ok: true, result: { active: 512, archived: 1, reclaimable: 0, limit: 512 } });
  });

  it('M4 refuses compaction on corrupt data and preserves unknown requests', async () => {
    await store.put('od:send-request:unknown', { recordId: 'u', value: { status: 'unknown' } });
    await store.put('od:revision:bad', { recordId: 'b', value: 'keep' });
    for (const file of (await readdir(root)).filter(n => n.endsWith('.json'))) {
      const raw = await readFile(join(root, file), 'utf8');
      if (JSON.parse(raw).key === 'od:revision:bad') await writeFile(join(root, file), '{broken');
    }
    expect(await store.compact()).toMatchObject({ ok: false });
    expect(await store.get('od:send-request:unknown')).toMatchObject({ ok: true, result: { found: true, record: { value: { status: 'unknown' } } } });
  });

  it('M4 missing archive never permits deleted content to be recreated', async () => {
    await store.put('od:revision:deleted', { recordId: 'r', value: 'old' });
    await store.delete('od:revision:deleted', 'r');
    await store.compact();
    await rm(join(root, '.deletions.gz'));
    const reopened = createMokinaRecoveryStore(root);
    expect(await reopened.get('od:revision:deleted')).toEqual({ ok: false, reason: 'unreadable-archive' });
    expect((await reopened.put('od:revision:deleted', { recordId: 'stale', value: 'old' })).ok).toBe(false);
    expect((await reopened.list(undefined)).ok).toBe(false);
  });

  for (const existingArchive of [false, true]) {
    it.each(['missing', 'non-null'] as const)(`refuses an invalid deletion value before publication (existing archive: ${existingArchive}, value: %s)`, async (shape) => {
      await store.put('od:send-request:unknown', { recordId: 'u', value: { status: 'unknown' } });
      let originalWitness: Awaited<ReturnType<typeof store.get>> | undefined;
      if (existingArchive) {
        await store.put('od:revision:archived', { recordId: 'a', value: 'old' });
        await store.delete('od:revision:archived', 'a');
        originalWitness = await store.get('od:revision:archived');
        expect((await store.compact()).ok).toBe(true);
      }
      await store.put('od:revision:bad', { recordId: 'b', value: 'old' });
      await store.delete('od:revision:bad', 'b');
      for (const name of (await readdir(root)).filter(n => n.endsWith('.json'))) {
        const path = join(root, name);
        const file = JSON.parse(await readFile(path, 'utf8'));
        if (file.key !== 'od:revision:bad') continue;
        if (shape === 'missing') delete file.value;
        else file.value = 'not a deletion';
        await writeFile(path, JSON.stringify(file));
      }
      const archiveBefore = existingArchive ? await readFile(join(root, '.deletions.gz')) : null;
      const markerBefore = await readFile(join(root, '.profile-state'));
      const filesBefore = await Promise.all((await readdir(root)).filter(n => n.endsWith('.json')).map(async name => ({ name, bytes: await readFile(join(root, name)) })));

      expect(await store.compact()).toEqual({ ok: false, reason: 'compaction-failed' });
      if (archiveBefore) expect(await readFile(join(root, '.deletions.gz'))).toEqual(archiveBefore);
      else expect((await readdir(root))).not.toContain('.deletions.gz');
      expect(await readFile(join(root, '.profile-state'))).toEqual(markerBefore);
      for (const file of filesBefore) expect(await readFile(join(root, file.name))).toEqual(file.bytes);
      expect(await store.get('od:revision:bad')).toEqual({ ok: false, reason: 'unreadable-record' });
      expect(await store.status()).toEqual({ ok: false, reason: 'unreadable-recovery-store' });
      if (originalWitness) {
        expect(await createMokinaRecoveryStore(root).get('od:revision:archived')).toEqual(originalWitness);
        expect(await store.put('od:revision:archived', { recordId: 'stale', value: 'old' })).toEqual({ ok: true, result: 'conflict' });
      }
      expect(await store.get('od:send-request:unknown')).toMatchObject({ ok: true, result: { found: true, record: { value: { status: 'unknown' } } } });
      expect(await store.put('od:revision:new', { recordId: 'new', value: 'new draft' })).toEqual({ ok: true, result: 'stored' });
      expect(await store.list(undefined)).toEqual({ ok: true, result: ['od:revision:new', 'od:send-request:unknown'] });
      expect(await store.expand()).toEqual({ ok: false, reason: 'expansion-failed' });
      expect(await readFile(join(root, '.profile-state'))).toEqual(markerBefore);
    });

    it.each(['corrupt-temp', 'changed-temp', 'read-temp'] as const)(`preserves published state on candidate I/O failure (existing archive: ${existingArchive}, fault: %s)`, async (fault) => {
      if (existingArchive) {
        await store.put('od:revision:archived', { recordId: 'a', value: 'old' });
        await store.delete('od:revision:archived', 'a');
        expect((await store.compact()).ok).toBe(true);
      }
      await store.put('od:revision:pending', { recordId: 'p', value: 'old' });
      await store.delete('od:revision:pending', 'p');
      const witness = await store.get('od:revision:pending');
      const archiveBefore = existingArchive ? await readFile(join(root, '.deletions.gz')) : null;
      const markerBefore = await readFile(join(root, '.profile-state'));
      archiveFault.mode = fault;
      const result = await store.compact();
      archiveFault.mode = null;
      expect(result).toEqual({ ok: false, reason: 'compaction-failed' });
      if (archiveBefore) expect(await readFile(join(root, '.deletions.gz'))).toEqual(archiveBefore);
      else expect(await readdir(root)).not.toContain('.deletions.gz');
      expect(await readFile(join(root, '.profile-state'))).toEqual(markerBefore);
      expect((await readdir(root)).filter(n => n.includes('.tmp'))).toEqual([]);
      expect(await createMokinaRecoveryStore(root).get('od:revision:pending')).toEqual(witness);
      expect((await store.compact()).ok).toBe(true);
      expect(await store.get('od:revision:pending')).toEqual(witness);
    });
  }

  it('M4 a retained duplicate after interrupted cleanup is safe and compaction can be retried', async () => {
    await store.put('od:revision:deleted', { recordId: 'r', value: 'old' });
    await store.delete('od:revision:deleted', 'r');
    const file = (await readdir(root)).find(n => n.endsWith('.json'))!;
    const raw = await readFile(join(root, file));
    const before = await store.get('od:revision:deleted');
    await store.compact();
    await writeFile(join(root, file), raw);
    const reopened = createMokinaRecoveryStore(root);
    expect(await reopened.get('od:revision:deleted')).toEqual(before);
    expect((await reopened.compact()).ok).toBe(true);
    expect(await reopened.get('od:revision:deleted')).toEqual(before);
  });

  it('M4 explicit recreation respects capacity and concurrent store instances share CAS ordering', async () => {
    await store.put('od:revision:deleted', { recordId: 'r', value: 'old' });
    await store.delete('od:revision:deleted', 'r'); await store.compact();
    const witness = await store.get('od:revision:deleted');
    const id = witness.ok && !witness.result.found ? witness.result.deletedRecordId! : '';
    const other = createMokinaRecoveryStore(root);
    const results = await Promise.all([
      store.put('od:revision:deleted', { recordId: 'a', value: 'a' }, id),
      other.put('od:revision:deleted', { recordId: 'b', value: 'b' }, id),
    ]);
    expect(results.filter(r => r.ok && r.result === 'stored')).toHaveLength(1);
    expect(results.filter(r => r.ok && r.result === 'conflict')).toHaveLength(1);
    await other.put('od:revision:another', { recordId: 'x', value: 'x' });
    await other.delete('od:revision:another', 'x'); await other.compact();
    expect(await other.get('od:revision:deleted')).toMatchObject({ ok: true, result: { found: true } });
  });

  it('M4 offline expansion restores old-host deletion witnesses without replacing live drafts', async () => {
    await store.put('od:revision:deleted', { recordId: 'r', value: 'old' });
    await store.delete('od:revision:deleted', 'r');
    const before = await store.get('od:revision:deleted');
    await store.compact();
    await store.put('od:revision:live', { recordId: 'live', value: 'keep' });
    expect((await store.expand()).ok).toBe(true);
    expect(JSON.parse(await readFile(join(root, '.profile-state'), 'utf8')).schemaVersion).toBe(2);
    expect((await readdir(root)).filter(n => n.endsWith('.json'))).toHaveLength(2);
    expect(await createMokinaRecoveryStore(root).get('od:revision:deleted')).toEqual(before);
    expect(await store.get('od:revision:live')).toMatchObject({ ok: true, result: { found: true, record: { value: 'keep' } } });
  });

  it('M4 another process holding the store lock cannot lose a successful write', async () => {
    await store.put('od:revision:race', { recordId: 'before', value: 'keep' });
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import { DatabaseSync } from 'node:sqlite';
      const db = new DatabaseSync(process.argv[1]);
      db.exec('BEGIN IMMEDIATE');
      process.stdout.write('locked');
      process.stdin.once('data', () => { db.close(); process.exit(0); });
    `, join(root, '.store-lock.sqlite')], { stdio: ['pipe', 'pipe', 'pipe'] });
    try {
      await once(child.stdout!, 'data');
      expect(await store.put('od:revision:race', { recordId: 'after', value: 'new' }, 'before')).toEqual({ ok: false, reason: 'recovery-store-busy' });
      expect(await store.compact()).toEqual({ ok: false, reason: 'recovery-store-busy' });
    } finally {
      const ended = once(child, 'exit'); child.stdin!.end('release'); await ended;
    }
    expect(await store.get('od:revision:race')).toMatchObject({ ok: true, result: { found: true, record: { value: 'keep' } } });
    expect(await store.put('od:revision:race', { recordId: 'after', value: 'new' }, 'before')).toEqual({ ok: true, result: 'stored' });
  });

});
