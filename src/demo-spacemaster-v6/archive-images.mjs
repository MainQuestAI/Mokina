import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const dest=path.join(root,'public/demo-spacemaster-v6');
const canva=['正视图','左视45','右视45','左侧 90','右侧 90','背视180','场景图','banner-设计图-1698x568','翻译-德语','翻译-法语','翻译-阿拉伯语'];
const ft=['3a679614-1b62-4f94-8784-9dd2e1e7aeb3','63f9a7e6-1605-4690-ab7a-5339530ca179','a3e417db-16ef-4250-8be0-989117c19151','d00a969d-63f9-4e9a-a954-43e0ac8b5a00'];
const pm=['原图.png','南美1.jpg','东南亚1.jpg','东南亚2.jpg','东南亚3.jpg'];
const files=[...canva.map((n,i)=>({id:'K'+String(i+1).padStart(2,'0'),source:'/Users/dingcheng/Downloads/生图/'+n+'.png',name:n,origin:'Canva 提供'})),...ft.map((n,i)=>({id:'FT0'+(i+1),source:'/var/folders/6g/c6q7pcvx6l1bz9fmqfnfhzch0000gn/T/codex-clipboard-'+n+'.png',name:['空间容量','温度检测','Platinum Fresh','Vario Box'][i],origin:'用户提供'})),...pm.map((n,i)=>({id:'PM0'+i,source:'/Users/dingcheng/Downloads/换人种+卖点图+icon/换人种/'+n,name:i?'模特候选 '+i:'人物原图',origin:'用户提供'}))];
for(const f of files)if(!fs.existsSync(f.source))throw Error('Missing supplied image: '+f.source);
fs.mkdirSync(path.join(dest,'originals'),{recursive:true});fs.mkdirSync(path.join(dest,'previews'),{recursive:true});
for(const f of files){
  const ext=path.extname(f.source);f.file='originals/'+f.id+ext;f.preview='previews/'+f.id+'.jpg';
  const bytes=fs.readFileSync(f.source);f.sha256=crypto.createHash('sha256').update(bytes).digest('hex');
  const previous=fs.existsSync(path.join(dest,f.file))?fs.readFileSync(path.join(dest,f.file)):null;
  if(previous&&!previous.equals(bytes))throw Error('Archived original differs: '+f.id);
  fs.copyFileSync(f.source,path.join(dest,f.file));
  const info=spawnSync('sips',['-g','pixelWidth','-g','pixelHeight',f.source],{encoding:'utf8'});if(info.status)throw Error(info.stderr);
  f.width=Number(info.stdout.match(/pixelWidth: (\d+)/)[1]);f.height=Number(info.stdout.match(/pixelHeight: (\d+)/)[1]);f.bytes=bytes.length;
  const result=spawnSync('sips',['-s','format','jpeg','-s','formatOptions','82','-Z','1400',f.source,'--out',path.join(dest,f.preview)],{encoding:'utf8'});if(result.status)throw Error(result.stderr);
  f.sourceName=path.basename(f.source);delete f.source;f.relationBasis='user-described';
}
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(files,null,2)+'\n');
console.log(JSON.stringify({count:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),dest}));
