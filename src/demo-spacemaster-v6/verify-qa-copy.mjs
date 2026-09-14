import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {productCopy} from './product-copy.mjs';
const sourceRoot=import.meta.dirname;
const output=path.resolve(sourceRoot,'../../output/demo-spacemaster-v6/qa-copy');
const checks=[],residual=[];
for(const dir of [sourceRoot,path.join(sourceRoot,'base')]){
 for(const name of fs.readdirSync(dir).filter(x=>x.endsWith('.js'))){
  const filename=path.join(dir,name),source=fs.readFileSync(filename,'utf8'),result=productCopy(source);
  new vm.Script(result,{filename});
  checks.push({name:'transformed syntax: '+path.relative(sourceRoot,filename),ok:true});
  result.split('\n').forEach((line,index)=>{
   if(/演示|模拟|示例/.test(line))residual.push({file:path.relative(sourceRoot,filename),line:index+1,text:line});
  });
 }
}
for(const value of ['lilith-spacemaster-demo-v6','6.0.0-spacemaster-demo','lilith-midea-integrated-v5','data-action="auto-start"','window.pendingBackup?.schema!==APP_VERSION']){
 assert.equal(productCopy(value),value);checks.push({name:'protected identifier: '+value,ok:true});
}
for(const [from,to] of [['流式演示速度','流程播放速度'],['演示交付规则','交付规则'],['请选择 SpaceMaster Demo V6 演示备份','请选择 SpaceMaster Demo V6 工作备份']]){
 assert.equal(productCopy(from),to);checks.push({name:'secondary control: '+from,ok:true});
}
assert.match(productCopy('外部调用为情景模拟；接口名称仅用于解释职责。'),/尚未接入实时服务/);
assert.match(productCopy('当前使用演示连接，不会写入真实 Content Library。'),/尚未接入真实 Content Library/);
assert.match(productCopy('已提供图片作为演示结果展示，制作与检查分开记录；候选不自动采用，图片未变不声称已完成像素修改。'),/已提供图片/);
checks.push({name:'service and supplied-image boundaries retained',ok:true});
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({checks,residual,scope:'Source transformation only. No HTML build or browser acceptance in this pass.'},null,2));
console.log(JSON.stringify({passed:checks.length,residualLines:residual.length,output},null,2));
