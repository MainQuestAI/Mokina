import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, symlink, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateMokinaProfile, prepareMokinaStableProfile, assertMokinaProfileQuiescent } from '../../src/main/mokina-profile-migration.js';
import { createMokinaRecoveryStore } from '../../src/main/mokina-recovery-store.js';

const sourceNamespace = 'mokina-local-v004-1';
const stable = 'mokina-local';
const quiet = { assertQuiescent: async () => undefined };
let base: string;
let source: string;
let target: string;
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
async function snapshot(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function walk(dir: string, prefix: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(join(dir, entry.name), `${relative}/`);
      else result[relative] = digest(await readFile(join(dir, entry.name)));
    }
  }
  await walk(root, ''); return result;
}
async function put(relative: string, value: string) {
  const path = join(source, relative);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, value);
}
async function fixture() {
  await mkdir(join(source, 'data/projects/p1/.file-versions'), { recursive: true });
  const db = new DatabaseSync(join(source, 'data/app.sqlite'));
  db.exec(await readFile(new URL('../fixtures/mokina-v004-schema.sql', import.meta.url), 'utf8'));
  db.prepare('INSERT INTO projects (id,name,metadata_json,created_at,updated_at,pending_prompt) VALUES (?,?,?,?,?,?)').run('p1','中文项目',JSON.stringify({baseDir:join(source,'data/projects/p1')}),1,1,'继续写计划');
  db.prepare('INSERT INTO projects (id,name,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?)').run('external','外部项目',JSON.stringify({baseDir:join(base,'external-user-folder')}),1,1);
  db.prepare('INSERT INTO conversations (id,project_id,created_at,updated_at) VALUES (?,?,?,?)').run('c1','p1',1,1);
  db.prepare('INSERT INTO messages (id,conversation_id,role,content,position,created_at) VALUES (?,?,?,?,?,?)').run('m1','c1','user','保留预算 500 元',0,1);
  db.prepare('INSERT INTO agent_sessions (conversation_id,agent_id,session_id,cwd,updated_at) VALUES (?,?,?,?,?)').run('c1','codex','old-cli',join(source,'data/projects/p1'),1);
  db.prepare('INSERT INTO routines (id,name,prompt,schedule_kind,schedule_value,project_mode,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run('timer','旧定时任务','制作','cron','* * * * *','new',1,1,1);
  db.close();
  await put('data/projects/p1/page.html','<html>正式成果</html>');
  await put('data/projects/p1/.file-versions/v1.html','<html>历史版本</html>');
  await put('data/app-config.json', JSON.stringify({locale:'zh-CN',agentCliEnv:{codex:{HOME:join(base,'external-home'),CODEX_HOME:join(source,'data/connectors/codex')}}}));
  await put('data/runs/r1/state.json',JSON.stringify({id:'r1',projectId:'p1',conversationId:'c1',clientRequestId:'request-1',status:'running'}));
  await put('data/runs/r1/agent-process-42.json','{"pid":42}');
  await put('data/runs/r1/agent-stdin-a.prompt','临时提示');
  await put('user-data/session/Local Storage/untrusted','{"od:auto-send-first:p1":"1"}');
  const recovery = createMokinaRecoveryStore(join(source,'user-data/mokina-recovery'));
  await recovery.put('od:revision:draft:p1:c1:page.html',{recordId:'draft-original-id',value:JSON.stringify({instruction:'中文草稿尚未发送',fileName:'page.html'})});
  await recovery.put('od:send-request:r1',{recordId:'pending-original-id',value:{status:'unknown',clientRequestId:'request-1',runId:'r1'}});
  await recovery.put('od:continuation:deleted',{recordId:'d1',value:{status:'pending'}});
  await recovery.delete('od:continuation:deleted','d1');
}
beforeEach(async () => { base = await mkdtemp(join(tmpdir(),'mokina-r04-')); source=join(base,sourceNamespace); target=join(base,stable); await fixture(); });
afterEach(async () => { await rm(base,{recursive:true,force:true}); });

describe('offline stable profile migration', () => {
  it.each(['string-schema', 'invalid-tombstone', 'empty-record-id'])('rejects %s recovery records before publishing a profile',async malformed=>{
    const key='od:revision:draft:p1:c1:page.html';
    const file=join(source,'user-data/mokina-recovery',`${digest(key).slice(0,40)}.json`);
    const value=JSON.parse(await readFile(file,'utf8'));
    if(malformed==='string-schema')value.schemaVersion='2';
    if(malformed==='invalid-tombstone'){value.schemaVersion=2;value.deleted=true;delete value.previousRecordId;}
    if(malformed==='empty-record-id')value.recordId='';
    await writeFile(file,JSON.stringify(value));
    const before=await snapshot(source);
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('schema/身份');
    expect(await snapshot(source)).toEqual(before);await expect(stat(target)).rejects.toMatchObject({code:'ENOENT'});
  });
  it('copies current v004 schema, files, versions, settings and drafts without altering the source or resending unknown work', async () => {
    const before = await snapshot(source);
    const result=await migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet);
    expect(result).toMatchObject({status:'migrated',projects:2,conversations:1,messages:1,recoveryRecords:3,externalProjectIds:['external'],resetAgentSessions:1,disabledRoutines:1});
    expect(await snapshot(source)).toEqual(before);
    expect(await readFile(join(target,'data/projects/p1/.file-versions/v1.html'),'utf8')).toBe('<html>历史版本</html>');
    const db=new DatabaseSync(join(target,'data/app.sqlite'),{readOnly:true});
    expect(db.prepare('SELECT pending_prompt,metadata_json FROM projects WHERE id=?').get('p1')).toEqual({pending_prompt:'继续写计划',metadata_json:JSON.stringify({baseDir:join(target,'data/projects/p1')})});
    expect(db.prepare('SELECT metadata_json FROM projects WHERE id=?').get('external')).toEqual({metadata_json:JSON.stringify({baseDir:join(base,'external-user-folder')})});
    expect(db.prepare('SELECT count(*) AS n FROM agent_sessions').get()).toEqual({n:0});
    expect(db.prepare('SELECT enabled FROM routines').get()).toEqual({enabled:0}); db.close();
    const recovery=createMokinaRecoveryStore(join(target,'user-data/mokina-recovery'));
    expect(await recovery.get('od:revision:draft:p1:c1:page.html')).toEqual({ok:true,result:{found:true,record:{recordId:'draft-original-id',value:JSON.stringify({instruction:'中文草稿尚未发送',fileName:'page.html'})}}});
    expect(await recovery.get('od:send-request:r1')).toEqual({ok:true,result:{found:true,record:{recordId:'pending-original-id',value:{status:'unknown',clientRequestId:'request-1',runId:'r1'}}}});
    expect(await recovery.get('od:continuation:deleted')).toMatchObject({ok:true,result:{found:false}});
    expect(JSON.parse(await readFile(join(target,'data/runs/r1/state.json'),'utf8'))).toMatchObject({status:'running',clientRequestId:'request-1'});
    expect(await stat(join(target,'user-data/session')).catch(()=>null)).toBeNull();
    expect(await readdir(join(target,'data/runs/r1'))).toEqual(['state.json']);
    expect(JSON.parse(await readFile(join(target,'data/app-config.json'),'utf8'))).toEqual({locale:'zh-CN',agentCliEnv:{codex:{HOME:join(base,'external-home'),CODEX_HOME:join(target,'data/connectors/codex')}}});
  });
  it('refuses an existing target, including an empty directory, without merging', async () => {
    await mkdir(target); await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('禁止覆盖或合并'); expect(await readdir(target)).toEqual([]);
  });
  it('cancellation creates no target; next launch can migrate; later launches reuse the stable identity', async () => {
    const choose=vi.fn(async()=>null);
    expect(await prepareMokinaStableProfile({namespaceBaseRoot:base,choose},quiet)).toBe('cancelled');
    expect(await stat(target).catch(()=>null)).toBeNull();
    expect(await prepareMokinaStableProfile({namespaceBaseRoot:base,choose:async()=>sourceNamespace},quiet)).toMatchObject({status:'migrated'});
    expect(await prepareMokinaStableProfile({namespaceBaseRoot:base,choose},quiet)).toBe('existing'); expect(choose).toHaveBeenCalledTimes(1);
  });
  it('requires explicit fresh-start choice when a supported old profile exists', async () => {
    const before=await snapshot(source); expect(await prepareMokinaStableProfile({namespaceBaseRoot:base,choose:async(sources)=>{expect(sources).toEqual([sourceNamespace]); return 'fresh';}},quiet)).toMatchObject({status:'fresh'});
    expect(await readdir(target)).toEqual(['profile-migration.json']); expect(await snapshot(source)).toEqual(before);
  });
  it('keeps an interrupted stage invisible and safely rebuilds it on retry', async () => {
    const before=await snapshot(source);
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},{...quiet,afterCopy:async()=>{throw new Error('power-loss');}})).rejects.toThrow('power-loss');
    expect(await stat(target).catch(()=>null)).toBeNull(); expect(await snapshot(source)).toEqual(before);
    expect(JSON.parse(await readFile(join(base,'.mokina-profile-migration.json'),'utf8'))).toMatchObject({status:'interrupted'});
    expect(await migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).toMatchObject({status:'migrated'});
    expect(await stat(join(base,'.mokina-profile-migration-stage')).catch(()=>null)).toBeNull();
  });
  it('refuses source mutation during copy and never publishes a stale snapshot', async () => {
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},{...quiet,beforePublish:async()=>put('data/projects/p1/page.html','编辑期间更改')})).rejects.toThrow('来源已变化');
    expect(await stat(target).catch(()=>null)).toBeNull();
  });
  it('rechecks writers after copy, including a writer that started while staging was built', async () => {
    let calls=0; await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},{assertQuiescent:async()=>{ if(++calls===3) throw new Error('writer-active'); }})).rejects.toThrow('writer-active'); expect(await stat(target).catch(()=>null)).toBeNull();
  });
  it('excludes concurrent migrations/first starts from racing for the same target', async () => {
    let entered!:()=>void; let finish!:()=>void; const ready=new Promise<void>(resolve=>{entered=resolve;}); const gate=new Promise<void>(resolve=>{finish=resolve;});
    const first=migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},{...quiet,afterCopy:async()=>{entered();await gate;}}); await ready;
    await expect(prepareMokinaStableProfile({namespaceBaseRoot:base,choose:async()=> 'fresh'},quiet)).rejects.toThrow('另一个迁移'); finish(); await first;
  });
  it('rejects unsupported schema, corrupt database, and symlink payloads rather than creating an empty project list', async () => {
    const db=new DatabaseSync(join(source,'data/app.sqlite')); db.exec('PRAGMA user_version=99'); db.close();
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('user_version');
    await writeFile(join(source,'data/app.sqlite'),'broken sqlite');
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow();
    await rm(source,{recursive:true,force:true}); await fixture(); await symlink(join(base,'external-user-folder'),join(source,'data/projects/shortcut'));
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('符号链接'); expect(await stat(target).catch(()=>null)).toBeNull();
  });
  it('rejects unknown data and corrupt recovery records without dropping them', async () => {
    await put('data/new-unknown-store.json','{}'); await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('未支持的数据项'); await rm(join(source,'data/new-unknown-store.json'));
    await put('user-data/mokina-recovery/.profile-state','{broken'); await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).rejects.toThrow('JSON 损坏'); expect(await stat(target).catch(()=>null)).toBeNull();
  });
  it('refuses arbitrary source names or versioned targets', async () => {
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace:'../../anything'},quiet)).rejects.toThrow('不支持来源');
    await expect(migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace,targetNamespace:'mokina-local-v2'},quiet)).rejects.toThrow('版本无关');
  });
  it('recovers the OS mutex and invisible stage after an actual SIGKILL', async () => {
    const { spawn } = await import('node:child_process');
    const migrationUrl = new URL('../../dist/main/mokina-profile-migration.js', import.meta.url).href;
    const child = spawn(process.execPath, ['--input-type=module', '-e',
      `const {migrateMokinaProfile}=await import(process.argv[1]); await migrateMokinaProfile({namespaceBaseRoot:process.argv[2],sourceNamespace:'mokina-local-v004-1'},{assertQuiescent:async()=>{},afterCopy:async()=>{console.log('stage-ready');await new Promise(()=>{setInterval(()=>{},1000);});}});`, migrationUrl, base], { stdio: ['ignore','pipe','pipe'] });
    let stderr = ''; child.stderr.on('data', chunk => { stderr += chunk; });
    await new Promise<void>((resolve,reject)=>{ child.stdout.once('data',()=>resolve()); child.once('error',reject); child.once('exit',()=>reject(new Error(stderr))); });
    child.kill('SIGKILL'); await new Promise<void>(resolve=>child.once('close',()=>resolve()));
    expect(await stat(target).catch(()=>null)).toBeNull();
    expect(await migrateMokinaProfile({namespaceBaseRoot:base,sourceNamespace},quiet)).toMatchObject({status:'migrated'});
    expect(await stat(join(base,'.mokina-profile-migration-stage')).catch(()=>null)).toBeNull();
  });
  it('detects a real open source SQLite handle on macOS', async () => {
    if(process.platform!=='darwin') return;
    // Another process is needed: the migrator excludes its own PID.
    const {spawn}=await import('node:child_process');
    const child=spawn(process.execPath,['--input-type=module','-e',`import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync(process.argv[1]); console.log('ready'); setInterval(()=>{},1000);`,join(source,'data/app.sqlite')],{stdio:['ignore','pipe','pipe']});
    await new Promise<void>((resolve,reject)=>{child.stdout.once('data',()=>resolve());child.once('error',reject);});
    try { await expect(assertMokinaProfileQuiescent(source,sourceNamespace)).rejects.toThrow('仍被进程占用'); }
    finally {child.kill(); await new Promise<void>(resolve=>child.once('close',()=>resolve()));}
  });
});
