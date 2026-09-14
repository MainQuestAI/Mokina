// Static archive verification only; does not open the prototype in a browser.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..'),out=path.join(root,'output/demo-spacemaster-v6');
const result=JSON.parse(fs.readFileSync(path.join(out,'qa-v62/package-checks.json'),'utf8'));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(result.version!=='6.2.0')throw Error('Wrong package version');
if(hash(result.entry)!==result.htmlSha256||hash(path.join(root,'Lilith SpaceMaster Demo V6.html'))!==result.htmlSha256)throw Error('Release HTML is stale');
if(hash(result.archive)!==result.zipSha256)throw Error('Archive hash changed');
const zip=spawnSync('unzip',['-t',result.archive],{encoding:'utf8'});
if(zip.status!==0)throw Error(zip.stderr||zip.stdout);
console.log(JSON.stringify({version:result.version,archiveIntegrity:'passed',htmlSha256:result.htmlSha256,zipSha256:result.zipSha256,browser:'not_run',offlineOpen:'not_run',visual:'not_run'}));
