import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { findSidecarProcessesInNamespace } from '@open-design/sidecar';
import { MOKINA_LOCAL_PREVIEW_NAMESPACE } from '@open-design/release';
import { MOKINA_V004_TABLES } from './mokina-profile-schema.js';
import { createMokinaRecoveryStore, isAllowedMokinaRecoveryKey } from './mokina-recovery-store.js';

export const MOKINA_STABLE_PROFILE = MOKINA_LOCAL_PREVIEW_NAMESPACE;
/** Deliberately not a scan/merge of every historical QA namespace. */
export const MOKINA_PROFILE_SOURCES = ['mokina-local-v004-1', 'mokina-local-maturity-4'] as const;
const DATA_ENTRIES = new Set(['app.sqlite', 'app.sqlite-wal', 'app-config.json', 'media-config.json', 'projects', 'artifacts', 'connectors', 'composio', 'memory', 'plugins', 'brands', 'library', 'critique-artifacts', 'design-templates', 'skills', 'design-systems', 'runs', 'od-plugin-lock.json', 'plugin-asset-cache', 'od-next-task-inputs', 'od-next-run-inputs', 'observations', 'diagnostics', 'telemetry', 'workspace-selection.json', 'mcp-config.json', 'mcp-oauth-clients.json', 'mcp-tokens.json', 'xai-tokens.json', 'conformance', 'orbit', 'agent-runtime']);
const exec = promisify(execFile);
type Entry = { path: string; sha256: string; bytes: number };
export type MokinaProfileMigrationReport = {
  schemaVersion: 1; sourceNamespace: string | null; targetNamespace: string; status: 'migrated' | 'fresh';
  sourceManifestSha256: string | null; filesCopied: number; bytesCopied: number; completedAt: string;
  projects: number; conversations: number; messages: number; recoveryRecords: number;
  externalProjectIds: string[]; resetAgentSessions: number; disabledRoutines: number;
  excluded: string[];
};
export type MokinaProfileMigrationOptions = { namespaceBaseRoot: string; sourceNamespace: string; targetNamespace?: string };
export type MokinaProfileMigrationDependencies = {
  assertQuiescent?: (root: string, namespace: string) => Promise<void>;
  /** Fault-injection seam, never configured by packaged startup or CLI. */
  afterCopy?: () => Promise<void>;
  beforePublish?: () => Promise<void>;
};

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}
function fail(reason: string): never { throw new Error(`MOKINA_PROFILE_MIGRATION: ${reason}`); }
async function assertDirectory(path: string): Promise<void> {
  const info = await lstat(path);
  if (!info.isDirectory() || info.isSymbolicLink()) fail(`目录不是普通目录：${path}`);
}
async function baseRoot(input: string): Promise<string> {
  if (!isAbsolute(input)) fail('namespaceBaseRoot 必须为绝对路径');
  await mkdir(input, { recursive: true });
  await assertDirectory(input);
  // macOS /var is a system alias for /private/var; retain the caller's path spelling.
  return resolve(input);
}
function sourceAllowed(source: string): void {
  if (!(MOKINA_PROFILE_SOURCES as readonly string[]).includes(source)) fail(`不支持来源 ${source}；支持 ${MOKINA_PROFILE_SOURCES.join(', ')}`);
}
function targetAllowed(target: string): void {
  if (target !== MOKINA_STABLE_PROFILE) fail(`目标必须为版本无关的 ${MOKINA_STABLE_PROFILE}`);
}

/** Fail closed if process inspection is unavailable. No process is killed. */
export async function assertMokinaProfileQuiescent(root: string, namespace: string): Promise<void> {
  if (process.platform !== 'darwin') fail('此轮迁移仅支持已验证的 macOS');
  const processes = await findSidecarProcessesInNamespace(namespace);
  if (processes.some(p => p.pid !== process.pid)) {
    fail(`请先退出 ${namespace} 的应用和侧车，再重试迁移`);
  }
  if (!await exists(root)) return;
  try {
    const { stdout, stderr } = await exec('/usr/sbin/lsof', ['-nP', '-t', '+D', await realpath(root)], { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 }).catch(error => {
      const e = error as { code?: number; stdout?: string; stderr?: string };
      // macOS lsof may return 1 with selected PIDs; still inspect every result.
      if (e.code === 1 && !e.stderr?.trim()) return { stdout: e.stdout ?? '', stderr: '' };
      throw error;
    });
    if (stderr.trim()) fail(`无法确认来源无人写入：${stderr.trim()}`);
    const pids = stdout.trim().split(/\s+/).filter(Boolean).map(Number).filter(pid => pid !== process.pid);
    if (pids.length) fail(`profile 仍被进程占用（PID ${pids.join(', ')}）；请退出后重试`);
  } catch (error) {
    const e = error as Error & { code?: number; stdout?: string; stderr?: string };
    if (e.code === 1 && !e.stdout?.trim() && !e.stderr?.trim()) return; // lsof: no open files
    throw error;
  }
}

async function withLock<T>(base: string, operation: () => Promise<T>): Promise<T> {
  // SQLite is used only as an OS-backed mutex, with no application tables or data.
  // A killed process releases its kernel locks. Never unlink the mutex file:
  // doing so would let another caller lock a different inode concurrently.
  const path = join(base, '.mokina-profile-migration-lock.sqlite');
  if (await exists(path)) {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) fail('迁移互斥文件异常');
  }
  const mutex = new DatabaseSync(path);
  try {
    mutex.exec('PRAGMA busy_timeout = 0');
    try { mutex.exec('BEGIN EXCLUSIVE'); }
    catch (error) {
      if ((error as { errcode?: number }).errcode === 5) fail('另一个迁移或首次启动正在使用目标；请稍后重试');
      throw error;
    }
    return await operation();
  } finally {
    if (mutex.isTransaction) mutex.exec('ROLLBACK');
    mutex.close();
  }
}

function excludedRunFile(path: string): boolean {
  return /^data\/runs\/[^/]+\/(?:agent-process-.*\.json|agent-stdin-.*\.prompt)$/.test(path);
}
async function inventory(root: string): Promise<{ entries: Entry[]; excluded: string[] }> {
  await assertDirectory(root);
  await assertDirectory(join(root, 'data'));
  const entries: Entry[] = [];
  const excluded: string[] = ['runtime/', 'logs/', 'cache/', 'updates/', 'user-data/session/'];
  async function visit(path: string): Promise<void> {
    const full = join(root, path);
    const info = await lstat(full);
    if (info.isSymbolicLink()) fail(`不支持符号链接：${path}`);
    if (/^user-data\/mokina-recovery\/\.store-lock\.sqlite(?:-journal|-wal|-shm)?$/.test(path)) { excluded.push(path); return; }
    if (excludedRunFile(path)) { excluded.push(path); return; }
    if (info.isDirectory()) {
      entries.push({ path, sha256: 'directory', bytes: 0 });
      for (const name of (await readdir(full)).sort()) await visit(`${path}/${name}`);
    } else if (info.isFile()) {
      const data = await readFile(full);
      entries.push({ path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    } else fail(`不支持特殊文件：${path}`);
  }
  for (const name of (await readdir(join(root, 'data'))).sort()) {
    if (name === 'app.sqlite-shm') { excluded.push(`data/${name}`); continue; }
    if (!DATA_ENTRIES.has(name)) fail(`来源含未支持的数据项 data/${name}；未复制任何目标数据`);
    await visit(`data/${name}`);
  }
  if (!entries.some(e => e.path === 'data/app.sqlite')) fail('来源缺少 app.sqlite');
  if (await exists(join(root, 'user-data'))) await assertDirectory(join(root, 'user-data'));
  if (await exists(join(root, 'user-data/mokina-recovery'))) await visit('user-data/mokina-recovery');
  return { entries, excluded };
}
function manifestHash(entries: Entry[]): string { return createHash('sha256').update(JSON.stringify(entries)).digest('hex'); }
function remapPath(value: string, source: string, target: string): string {
  return value === source || value.startsWith(`${source}${sep}`) ? `${target}${value.slice(source.length)}` : value;
}
function remapConfig(value: unknown, source: string, target: string): unknown {
  if (!record(value)) fail('app-config.json 必须为对象');
  const env = value.agentCliEnv;
  if (!record(env)) return value;
  return { ...value, agentCliEnv: Object.fromEntries(Object.entries(env).map(([agent, settings]) => [agent,
    record(settings) ? Object.fromEntries(Object.entries(settings).map(([key, setting]) => [key,
      typeof setting === 'string' && /^(?:HOME|CODEX_HOME|CLAUDE_CONFIG_DIR|XDG_.*|OD_.*_DIR|[A-Z_]+_BIN|MMD_MODEL_ROUTES_FILE)$/.test(key)
        ? remapPath(setting, source, target) : setting])) : settings])) };
}
function parseJson(text: string, name: string): unknown {
  try { return JSON.parse(text); } catch { fail(`JSON 损坏：${name}`); }
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }

function validateDatabase(path: string, source: string, target: string) {
  const db = new DatabaseSync(path);
  try {
    if ((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version !== 0) fail('不支持此数据库 user_version');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    if (tables.length !== Object.keys(MOKINA_V004_TABLES).length) fail('数据库表集合不属于已验证的 v0.0.4 schema');
    for (const { name } of tables) {
      if (!Object.hasOwn(MOKINA_V004_TABLES, name)) fail(`不支持数据库表 ${name}`);
      const shape = db.prepare(`PRAGMA table_info("${name}")`).all().map(({ name, type, notnull, pk }) => ({ name, type, notnull, pk }));
      if (JSON.stringify(shape) !== MOKINA_V004_TABLES[name]) fail(`数据库表 ${name} 结构不受支持`);
    }
    if (JSON.stringify(db.prepare('PRAGMA integrity_check').all()) !== '[{"integrity_check":"ok"}]') fail('数据库完整性检查失败');
    if (db.prepare('PRAGMA foreign_key_check').all().length) fail('数据库外键完整性检查失败');
    const count = (table: string) => Number((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
    const externalProjectIds: string[] = [];
    for (const row of db.prepare('SELECT id, metadata_json FROM projects').all()) {
      if (typeof row.metadata_json !== 'string') continue;
      const meta = parseJson(row.metadata_json, 'projects.metadata_json');
      if (record(meta) && typeof meta.baseDir === 'string' && isAbsolute(meta.baseDir) && remapPath(meta.baseDir, source, target) === meta.baseDir) externalProjectIds.push(String(row.id));
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      // Only mutable location fields are rebased. Frozen prompts, input identities,
      // snapshot/provenance JSON and digest-bound replies remain byte-for-byte.
      const runtimeColumns: Record<string, string[]> = {
        installed_plugins: ['fs_path'], library_assets: ['file_path'],
        critique_runs: ['transcript_path'], skill_plugin_candidates: ['draft_path'],
        workspace_artifacts: ['current_path'],
      };
      for (const [name, columns] of Object.entries(runtimeColumns)) for (const key of columns) {
        for (const row of db.prepare(`SELECT rowid AS migration_rowid, "${key}" AS value FROM "${name}" WHERE "${key}" IS NOT NULL`).all()) {
          if (typeof row.value !== 'string') continue;
          const next = remapPath(row.value, source, target);
          if (next !== row.value) db.prepare(`UPDATE "${name}" SET "${key}" = ? WHERE rowid = ?`).run(next, row.migration_rowid as SQLInputValue);
        }
      }
      for (const row of db.prepare('SELECT id, metadata_json FROM projects WHERE metadata_json IS NOT NULL').all()) {
        const meta = parseJson(String(row.metadata_json), 'projects.metadata_json');
        if (record(meta) && typeof meta.baseDir === 'string') {
          const next = remapPath(meta.baseDir, source, target);
          if (next !== meta.baseDir) db.prepare('UPDATE projects SET metadata_json = ? WHERE id = ?').run(JSON.stringify({ ...meta, baseDir: next }), row.id as SQLInputValue);
        }
      }
      // Native CLI sessions retain their old workspace identity. Fresh sessions keep history in Mokina.
      const resetAgentSessions = Number(db.prepare('DELETE FROM agent_sessions WHERE cwd = ? OR substr(cwd, 1, ?) = ?').run(source, source.length + 1, `${source}/`).changes);
      // Timers are not a user intent to replay work in a second profile.
      const disabledRoutines = Number(db.prepare('UPDATE routines SET enabled = 0 WHERE enabled != 0').run().changes);
      db.exec('COMMIT');
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      db.exec('PRAGMA journal_mode = DELETE');
      return { projects: count('projects'), conversations: count('conversations'), messages: count('messages'), externalProjectIds, resetAgentSessions, disabledRoutines };
    } catch (e) { if (db.isTransaction) db.exec('ROLLBACK'); throw e; }
  } finally { db.close(); }
}
async function validateRecovery(stage: string): Promise<number> {
  const root = join(stage, 'user-data/mokina-recovery');
  if (!await exists(root)) return 0;
  let count = 0;
  for (const name of await readdir(root)) {
    if (/^\.store-lock\.sqlite(?:-journal|-wal|-shm)?$/.test(name)) continue;
    const file = join(root, name);
    if (name === '.deletions.gz') continue;
    if (name !== '.profile-state' && !/^[a-f0-9]{40}\.json$/.test(name)) fail(`不支持恢复记录 ${name}`);
    const value = parseJson(await readFile(file, 'utf8'), `mokina-recovery/${name}`);
    if (!record(value)) fail('恢复记录格式错误');
    if (name === '.profile-state') {
      if (![2, 3].includes(value.schemaVersion as number) || typeof value.confirmLegacyMissing !== 'boolean') fail('恢复 profile schema 不受支持');
    } else {
      if ((value.schemaVersion !== 1 && value.schemaVersion !== 2) || typeof value.key !== 'string'
        || !isAllowedMokinaRecoveryKey(value.key) || typeof value.recordId !== 'string' || !value.recordId
        || (value.deleted === true && (value.schemaVersion !== 2 || typeof value.previousRecordId !== 'string' || !value.previousRecordId))
        || createHash('sha256').update(value.key).digest('hex').slice(0, 40) + '.json' !== name) fail('恢复记录 schema/身份不受支持');
      count++;
    }
    // Recovery values include frozen request identities. Preserve every byte and recordId.
  }
  const health = await createMokinaRecoveryStore(root).status();
  if (!health.ok) fail('恢复记录或归档不完整');
  return count;
}

/** This journal is a mutable write destination, not an immutable version/snapshot. */
async function rebaseAdoptionJournals(stage: string, source: string, target: string, entries: Entry[]) {
  for (const entry of entries) {
    if (!/^data\/projects\/[^/]+\/\.file-versions\/[^/]+\/candidate-adoption\.json$/.test(entry.path)) continue;
    const file = join(stage, entry.path);
    const journal = parseJson(await readFile(file, 'utf8'), entry.path);
    if (!record(journal) || typeof journal.targetFile !== 'string' || !isAbsolute(journal.targetFile)
      || !['operationId', 'versionId', 'expectedCurrentVersionId'].every(key => typeof journal[key] === 'string')) fail('采用恢复记录格式错误');
    const targetFile = remapPath(journal.targetFile, source, target);
    if (targetFile !== journal.targetFile) await writeFile(file, JSON.stringify({ ...journal, targetFile }), { mode: 0o600 });
  }
}

async function migrateLocked(base: string, sourceNamespace: string, deps: MokinaProfileMigrationDependencies): Promise<MokinaProfileMigrationReport> {
  const source = join(base, sourceNamespace);
  const target = join(base, MOKINA_STABLE_PROFILE);
  const stage = join(base, '.mokina-profile-migration-stage');
  const journal = join(base, '.mokina-profile-migration.json');
  if (await exists(target)) fail('目标 profile 已存在；禁止覆盖或合并。请继续使用现有目标或选择另一隔离根目录');
  const quiescent = deps.assertQuiescent ?? assertMokinaProfileQuiescent;
  await quiescent(source, sourceNamespace);
  await quiescent(target, MOKINA_STABLE_PROFILE);
  const before = await inventory(source);
  // A prior interrupted stage is private and never used by runtime. Rebuild from the unchanged source.
  if (await exists(stage)) {
    await assertDirectory(stage);
    const prior = parseJson(await readFile(journal, 'utf8'), 'migration journal');
    if (!record(prior) || prior.schemaVersion !== 1 || prior.targetNamespace !== MOKINA_STABLE_PROFILE || !(MOKINA_PROFILE_SOURCES as readonly unknown[]).includes(prior.sourceNamespace)) fail('既有 staging 无有效迁移归属，未清理');
  }
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { mode: 0o700 });
  await writeFile(journal, JSON.stringify({ schemaVersion: 1, status: 'copying', sourceNamespace, targetNamespace: MOKINA_STABLE_PROFILE, sourceManifestSha256: manifestHash(before.entries) }), { mode: 0o600 });
  try {
    for (const entry of before.entries) {
      const destination = join(stage, entry.path);
      if (entry.sha256 === 'directory') { await mkdir(destination, { recursive: true, mode: 0o700 }); continue; }
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      await copyFile(join(source, entry.path), destination);
      const bytes = await readFile(destination);
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) fail(`复制期间来源已变化：${entry.path}`);
    }
    await deps.afterCopy?.();
    await rebaseAdoptionJournals(stage, source, target, before.entries);
    const database = validateDatabase(join(stage, 'data/app.sqlite'), source, target);
    const recoveryRecords = await validateRecovery(stage);
    const config = join(stage, 'data/app-config.json');
    if (await exists(config)) await writeFile(config, JSON.stringify(remapConfig(parseJson(await readFile(config, 'utf8'), 'app-config.json'), source, target)), { mode: 0o600 });
    const report: MokinaProfileMigrationReport = {
      schemaVersion: 1, status: 'migrated', sourceNamespace, targetNamespace: MOKINA_STABLE_PROFILE,
      sourceManifestSha256: manifestHash(before.entries), filesCopied: before.entries.filter(e => e.sha256 !== 'directory').length,
      bytesCopied: before.entries.reduce((sum, e) => sum + e.bytes, 0), completedAt: new Date().toISOString(),
      ...database, recoveryRecords, excluded: before.excluded,
    };
    await writeFile(join(stage, 'profile-migration.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
    await deps.beforePublish?.();
    await quiescent(source, sourceNamespace);
    await quiescent(target, MOKINA_STABLE_PROFILE);
    if (manifestHash((await inventory(source)).entries) !== report.sourceManifestSha256) fail('复制期间来源已变化；目标未启用，请退出旧版后重试');
    if (await exists(target)) fail('目标已被另一启动创建；未覆盖');
    await rename(stage, target);
    // The atomic directory rename is the commit point. The report lives inside it;
    // journal cleanup failure cannot turn a completed migration into an ambiguous failure.
    await rm(journal, { force: true }).catch(() => undefined);
    return report;
  } catch (error) {
    await writeFile(journal, JSON.stringify({ schemaVersion: 1, status: 'interrupted', sourceNamespace, targetNamespace: MOKINA_STABLE_PROFILE, reason: error instanceof Error ? error.message : String(error) }), { mode: 0o600 });
    throw error;
  }
}
export async function migrateMokinaProfile(options: MokinaProfileMigrationOptions, deps: MokinaProfileMigrationDependencies = {}): Promise<MokinaProfileMigrationReport> {
  sourceAllowed(options.sourceNamespace); targetAllowed(options.targetNamespace ?? MOKINA_STABLE_PROFILE);
  const base = await baseRoot(options.namespaceBaseRoot);
  return withLock(base, () => migrateLocked(base, options.sourceNamespace, deps));
}

/** Called before any namespace paths/sidecars/session are initialized. Cancel is read-only to the target. */
export async function prepareMokinaStableProfile(options: {
  namespaceBaseRoot: string;
  choose: (sources: readonly string[]) => Promise<string | 'fresh' | null>;
}, deps: MokinaProfileMigrationDependencies = {}): Promise<MokinaProfileMigrationReport | 'existing' | 'cancelled'> {
  const base = await baseRoot(options.namespaceBaseRoot);
  return withLock(base, async () => {
    const target = join(base, MOKINA_STABLE_PROFILE);
    if (await exists(target)) { await assertDirectory(target); return 'existing'; }
    const sources: string[] = [];
    for (const source of MOKINA_PROFILE_SOURCES) if (await exists(join(base, source, 'data/app.sqlite'))) sources.push(source);
    const choice = sources.length ? await options.choose(sources) : 'fresh';
    if (choice === null) return 'cancelled';
    if (choice !== 'fresh') { sourceAllowed(choice); return migrateLocked(base, choice, deps); }
    const report: MokinaProfileMigrationReport = { schemaVersion: 1, sourceNamespace: null, targetNamespace: MOKINA_STABLE_PROFILE, status: 'fresh', sourceManifestSha256: null, filesCopied: 0, bytesCopied: 0, completedAt: new Date().toISOString(), projects: 0, conversations: 0, messages: 0, recoveryRecords: 0, externalProjectIds: [], resetAgentSessions: 0, disabledRoutines: 0, excluded: [] };
    const fresh = join(base, `.mokina-profile-fresh-${randomUUID()}`);
    await mkdir(fresh, { mode: 0o700 });
    try {
      await writeFile(join(fresh, 'profile-migration.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
      if (await exists(target)) fail('目标已被另一启动创建');
      await rename(fresh, target);
    } finally { await rm(fresh, { recursive: true, force: true }); }
    return report;
  });
}

/** Native profile maintenance stays in its owner; daemon data roots never infer Electron paths. */
export async function maintainMokinaRecovery(options: {
  namespaceBaseRoot: string; namespace: string; compact?: boolean; expand?: boolean;
}) {
  if (options.namespace !== MOKINA_STABLE_PROFILE) sourceAllowed(options.namespace);
  const base = await baseRoot(options.namespaceBaseRoot);
  return withLock(base, async () => {
    const profile = join(base, options.namespace);
    await assertDirectory(profile);
    await assertMokinaProfileQuiescent(profile, options.namespace);
    const recovery = join(profile, 'user-data/mokina-recovery');
    await assertDirectory(recovery);
    const store = createMokinaRecoveryStore(recovery);
    if (options.compact && options.expand) fail('不能同时整理和展开归档');
    return options.compact ? store.compact() : options.expand ? store.expand() : store.status();
  });
}
