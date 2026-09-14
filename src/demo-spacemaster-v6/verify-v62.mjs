import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'output/demo-spacemaster-v6/qa-v62');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checks=[];
function check(name,ok){checks.push({name,ok:!!ok});if(!ok)throw Error(name);}
const tests=fs.readdirSync(path.join(root,'tests')).filter(f=>/^v62-.*\.test\.(cjs|mjs)$/.test(f)).sort().map(f=>'tests/'+f);
check('all V6.2 domain suites are present',tests.length>=5);
const run=spawnSync(process.execPath,['--test',...tests],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'domain-tests.tap'),(run.stdout||'')+(run.stderr||''));
check('Node domain and source tests pass; no browser was launched',run.status===0);
const passed=Number(run.stdout.match(/# pass (\d+)/)?.[1]||0);
const entry=path.join(root,'Lilith SpaceMaster Demo V6.html'),html=fs.readFileSync(entry,'utf8');
check('release title and version identify V6.2',html.includes('<title>Lilith SpaceMaster V6.2</title>')&&html.includes('content="6.2.0"'));
check('V6 storage and backup schema retained',html.includes("const STORAGE_KEY='lilith-spacemaster-demo-v6'")&&html.includes("const APP_VERSION='6.0.0-spacemaster-demo'"));
for(const [index,match] of [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].entries()){new vm.Script(match[1]);check('compiled script parses '+index,true);}
for(const name of ['project-input','decision-refinement','workflow-branches','release-policy'])check('compiled extension present '+name,html.includes(fs.readFileSync(path.join(import.meta.dirname,name+'.js'),'utf8').split('\n')[0]));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/demo-spacemaster-v6/manifest.json'),'utf8'));
for(const image of manifest)check('original image unchanged '+image.id,sha(path.join(root,'public/demo-spacemaster-v6',image.file))===image.sha256);
const baseline=JSON.parse(fs.readFileSync(path.join(root,'output/demo-spacemaster-v6/workspace-baseline.json'),'utf8'));
for(const [file,hash] of Object.entries(baseline))check('historical V5 unchanged '+file,sha(path.join(root,file))===hash);
const files=fs.readdirSync(import.meta.dirname,{recursive:true}).filter(x=>/\.(?:js|mjs|css)$/.test(x));
const sourceHashes=Object.fromEntries(files.map(file=>['src/demo-spacemaster-v6/'+file,sha(path.join(import.meta.dirname,file))]));
for(const file of tests)sourceHashes[file]=sha(path.join(root,file));
const result={version:'6.2.0',at:new Date().toISOString(),checks,domainTestsPassed:passed,htmlSha256:sha(entry),sourceHashes,browser:{status:'not_run',reason:'Browser URL policy blocked the prototype. No alternate browser or URL was used.'},visual:{status:'not_run'},offlineOpen:{status:'not_run'},story:{status:'domain_only',note:'Chapter lifecycle and decision contracts tested; full rendered story not run.'}};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({domainTestsPassed:passed,staticChecks:checks.length,htmlSha256:result.htmlSha256,browser:result.browser.status}));
