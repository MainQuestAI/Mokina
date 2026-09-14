const demoImage=id=>MERGED_ASSETS.demoImages.find(f=>f.id===id);
const demoPayloads=new Map();
function loadDemoOriginal(id){
  if(window.DEMO_ORIGINALS?.[id])return Promise.resolve(window.DEMO_ORIGINALS[id]);
  if(demoPayloads.has(id))return demoPayloads.get(id);
  const promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='public/demo-spacemaster-v6/payloads/'+id+'.js';script.onload=()=>{script.remove();const data=window.DEMO_ORIGINALS?.[id];if(data)resolve(data);else reject(Error('图片内容不存在：'+id));};script.onerror=()=>{script.remove();demoPayloads.delete(id);reject(Error('原图未加载，请保留 HTML 旁的 public 文件夹后重试。'));};document.head.appendChild(script);});demoPayloads.set(id,promise);return promise;
}
async function demoDownload(id){try{const url=await loadDemoOriginal(id);download(id+'_'+demoImage(id).sourceName,Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),demoImage(id).mime);}catch(e){toast(e.message,true);}}
function demoView(a,v){const key=a.id+'|'+v.num;return S.imageViews[key]??={member:v.data.mainMember,compare:false,person:false};}
function demoCurrentMember(a,v){return v?.data.imageCollection?demoView(a,v).member:null;}
function demoFigure(id,label){const f=demoImage(id);const name=label?label+' · '+f.name:f.name;return `<figure class="demo-image-stage"><figcaption>${E(name)} · ${f.width} × ${f.height}${id==='PM04'?' · 待返修：分配器、厨房与文字发生变化':''}</figcaption><img src="${f.previewURL}" alt="${E(f.name)}" width="${f.width}" height="${f.height}"></figure>`;}
function demoReadableImageLayout(html){
  const template=document.createElement('template');template.innerHTML=html;
  const work=template.content.querySelector('.demo-image-work');
  work.querySelector(':scope>h2')?.remove();
  const stage=work.querySelector(':scope>.demo-compare,:scope>.demo-image-stage');
  const thumbs=work.querySelector(':scope>.demo-image-thumbs');
  const actions=thumbs?.nextElementSibling;
  if(stage&&thumbs){work.insertBefore(thumbs,stage);if(actions?.classList.contains('demo-image-actions'))work.insertBefore(actions,stage);}
  return template.innerHTML;
}
function demoMemberNotes(id){return ({K06:'背面文件已提供；没有实物背面参照，不标记结构真实性已确认。',K09:'原图文字：Side-by-Side-Kühlschrank / Einbaukühlschrank / Einfach ideal。安装方式声明待核验；当前像素未改。',K08:'原图文字：Side-by-side Refrigerator / Built-in Fridge / Simply ideal。',K10:'原图文字：Réfrigérateur Américain / Réfrigérateur encastré / Tout simplement idéal。法语，国家待选。',K11:'原图文字：ثلاجة ببابين متجاورين / ثلاجة مدمجة / ببساطة مثالية。阿拉伯语，国家待选；保留产品与 Logo 方向。',FT01:'空间区域高亮：474 L、305 L、169 L。数字为提供图片的转录，不写入本项目产品事实表。',FT02:'功能引线、温度检测；图上 ±0.5°C、0.1 秒为原图声明。',FT03:'Platinum Fresh：内部食品情境、功能图形与说明；原图不等于检测证据。',FT04:'Vario Box：6°C、2°C、−1°C 与食品分区；原图不证明同时三温区。',PM00:'替换成人与儿童；允许服装变化。要求保留产品、厨房、文案、构图和道具。',PM01:'人物、服装与道具变化；原文字消失，画面变为方图。',PM02:'人物、服装和杯子变化；厨房大体保留，原文字消失、画幅改变。',PM03:'人物、服装及部分姿态变化；原文字消失，画幅改变。',PM04:'待返修：冰箱右门新增分配器，厨房和窗外环境变化；原文字消失，超出只换人物的范围。'})[id]||'文件来自 Canva 提供的结果；产品身份依据用户确认。';}
function demoImagesHTML(a,v){
  const d=v.data,view=demoView(a,v),ids=view.person?d.items.filter(id=>id.startsWith('PM')):d.items.filter(id=>!id.startsWith('PM')),id=ids.includes(view.member)?view.member:ids[0];view.member=id;
  const variant=d.variants?.[id],compare=view.compare&&id!==(view.person?'PM00':d.items[0]);
  const thumbs=ids.map(mid=>{const f=demoImage(mid),selected=mid===id;return `<button data-action="demo-member" data-arg="${mid}" aria-pressed="${selected}" aria-label="查看 ${E(f.name)}"><img src="${f.previewURL}" alt=""><span>${E(f.name)}</span>${selected?'<span>正在查看</span>':''}${d.memberStates[mid]?.adopted?'<span>已采用</span>':''}</button>`;}).join('');
  return `<section class="demo-image-work"><h2>${E(a.title)}</h2><p>${E(d.summary)}</p>${a.kind==='scene'?`<div class="demo-image-actions">${button('厨房场景','demo-scene-mode','','sm')}${button('带人物内容 · 更换模特','demo-person-mode','','sm','person')}</div>`:''}${variant?`<p>${tag(variant.language,'blue')} ${variant.country==='DE'?'德国':'目标国家待选'} · 官网横幅 · ${id==='K09'?versionLabel(a,v.num)[0]:'参考候选，未批准'}</p>`:''}${compare?`<div class="demo-compare">${demoFigure(view.person?'PM00':d.items[0],'原图')}${demoFigure(id,'当前候选')}</div>`:demoFigure(id)}<div class="demo-image-thumbs" aria-label="图片成员">${thumbs}</div><div class="demo-image-actions">${button('查看大图','demo-source-image',id,'sm','expand')}${button(view.compare?'关闭对比':'加入对比','demo-compare','','sm','layers')}${button('讨论当前图片','demo-discuss','','sm','message')}${button('下载原图','demo-download',id,'sm','download')}${canWrite(a,false)?button('采用当前成员','demo-member-adopt','','sm','check'):''}</div>${a.kind==='productImages'?`<div class="demo-image-overview">${d.items.map(mid=>`<article><img src="${demoImage(mid).previewURL}" alt="${E(demoImage(mid).name)}"><h3>${E(demoImage(mid).name)}</h3><p>${d.memberStates[mid]?.status==='failed'?'文件暂不可用':'文件已提供'}</p>${button(d.memberStates[mid]?.status==='failed'?'恢复此成员':'查看','demo-member',mid,'sm')}</article>`).join('')}</div>`:''}<details class="demo-image-details" ${view.person?'open':''}><summary>画面内容与检查</summary><p>${E(demoMemberNotes(id))}</p>${view.person?`<p>保持项：产品 / 背景 / 文字 / 画幅 / 道具。没有候选被证明完全符合“仅换人物”的要求。</p>${button('仅返修这个候选','demo-repair',id,'sm','edit')}`:''}${(d.renderRequests||[]).filter(r=>r.member===id).map(r=>`<p>${tag('待渲染','amber')} ${E(r.instruction)} · 图片尚未更新</p>`).join('')}</details><details class="demo-image-details"><summary>来源、文件及谱系</summary><p>${E(d.note)}</p><p>${E(d.sourceContentType)} · ${E(d.businessRole)} · ${E(demoImage(id).sourceName)}</p><p>图片 v1 · SHA-256 ${demoImage(id).sha256}</p><p>派生关系：用户说明；真实生成 Run 未提供。${v.refs.map(r=>E(r.title)+' v'+r.revision).join(' → ')}</p></details><details class="demo-image-details" ${a.kind==='websitePoster'?'open':''}><summary>交付说明与版本</summary><p>${E(d.deliveryNote)}</p><p>Material v${v.num} · 图片 v${d.pixelRevision} · ${d.pixelChanges?'图片已更新':'图片未变'}</p>${canWrite(a,false)?button('修改交付说明','demo-edit-note','','sm','edit'):''}</details><div class="demo-image-actions">${button('检查当前版本','check',a.id,'sm','shield')}${a.kind==='websitePoster'&&a.accepted===v.num&&a.checks?.[v.num]?.passed?button('提交德语固定版','submit',a.id+'|'+v.num,'primary sm','lock'):''}${a.kind==='scene'?button('用于官网海报','generate-websitePoster','','sm','arrow'):''}</div></section>`;
}
contentHTML=function(a,v){if(v.data.imageCollection)return demoReadableImageLayout(demoImagesHTML(a,v));let html=DEMO_PREVIOUS.contentHTML(a,v);if(demoProject(project(a.projectId))&&['fabe','mh'].includes(a.kind))html+=`<section class="section"><h3>从主题制作卖点图</h3><p>主题与当前 v${v.num} 固定引用；四种图形表达保存在同一集合。</p>${['空间容量','温度检测','Platinum Fresh','Vario Box'].map((name,i)=>button(name+' · 制作卖点图','demo-feature',a.id+'|'+v.num+'|FT0'+(i+1),'sm','image')).join('')}</section>`;return html;};
const priorDemoBind=bindArtifactDiscussion;
bindArtifactDiscussion=function(section='',focus=true){priorDemoBind(section,focus);const a=artifact(S.canvas?.id),v=selectedRevision();if(v?.data.imageCollection&&S.contextSelection){const id=demoCurrentMember(a,v);Object.assign(S.contextSelection,{member:id,language:v.data.variants?.[id]?.language||null,title:a.title+' · '+demoImage(id).name,fileVersion:1});render();persist();if(focus)document.querySelector('#composer')?.focus({preventScroll:true});}};
const priorDemoHandle=handle;
handle=async function(action,arg=''){
  if(action==='restore-confirm'&&window.pendingBackup?.schema!==APP_VERSION)return toast('仅可恢复此独立演示版的备份。',true);
  if(action==='demo-download')return demoDownload(arg);
  if(action==='demo-source-image')return openDemoImage(arg);
  const a=artifact(S.canvas?.id),v=selectedRevision();
  if(action==='demo-feature'){
    const [aid,num,mid]=arg.split('|');if(!byKind('featureImages'))await generate('featureImages');const result=byKind('featureImages');if(!result)return;
    const rv=revision(result,result.pending||result.active);if(!rv.data.themeRef){rv.data.themeRef={artifactId:aid,revision:Number(num),member:mid};persist();}openCanvas(result.id);S.imageViews[result.id+'|'+rv.num]={member:mid,compare:false,person:false};render();return;
  }
  if(action.startsWith('demo-')&&v?.data.imageCollection){
    captureConversationDraft();const view=demoView(a,v);
    if(action==='demo-member'){if(!v.data.items.includes(arg))return;view.member=arg;if(v.data.memberStates[arg]?.status==='failed'){const data=clone(v.data);data.memberStates[arg].status='available';const next=addRevision(a,data,'仅恢复图片成员 '+arg,v.refs);openCanvas(a.id,next.num);}}
    if(action==='demo-person-mode'){view.person=true;view.member='PM01';view.compare=true;}
    if(action==='demo-scene-mode'){view.person=false;view.member='K07';view.compare=false;}
    if(action==='demo-compare')view.compare=!view.compare;
    if(action==='demo-discuss')return bindArtifactDiscussion('');
    if(action==='demo-member-adopt'){
      if(!canWrite(a))return;
      if(view.member.startsWith('PM')&&view.member!=='PM00')return toast('此候选还有超出范围的变化，请先保存返修要求；原图继续保留。');
      if(a.kind==='websitePoster'&&view.member!=='K09')return toast('其他语言保留独立参考候选，不随德国交付采用。');
      if(v.data.memberStates[view.member]?.selected)return toast('这张图片已选入当前集合候选。');
      const data=clone(v.data);data.memberStates[view.member].selected=true;
      const next=addRevision(a,data,'选用图片成员 '+view.member,v.refs);
      if(next){S.imageViews[a.id+'|'+next.num]={...view};openCanvas(a.id,next.num);toast('已选入集合候选。采用整份集合后才完成这项草稿交付。');}return;
    }
    if(action==='demo-repair'){bindArtifactDiscussion('',false);return modifySelected('仅返修 '+view.member+'：恢复原产品结构、厨房、文字和画幅，保留人物方案。');}
    if(action==='demo-edit-note'){bindArtifactDiscussion('',true);const input=document.querySelector('#composer');input.value='补齐交付用途与素材来源说明：用于德国官网创意评审；Canva / 用户提供，图片保持不变。';DRAFTS[S.threadId]=input.value;return;}
    if(S.artifactWorkspace?.discussionBound)bindArtifactDiscussion('',false);else{render();persist();}return;
  }
  return priorDemoHandle(action,arg);
};
async function openDemoImage(id){
  const f=demoImage(id);if(!f)return;const previous=document.activeElement;document.querySelector('.demo-image-dialog')?.remove();const el=document.createElement('section');el.className='demo-image-dialog';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label',f.name+'原图');el.innerHTML=`<div class="row"><strong>${E(f.name)} · ${f.width} × ${f.height}</strong><span class="spacer"></span><button class="btn sm" data-image-zoom>原始尺寸</button><button class="btn sm" data-image-close>关闭大图</button></div><div class="demo-original-scroll"><img src="${f.previewURL}" alt="${E(f.name)}"></div>`;document.body.appendChild(el);
  const close=()=>{el.remove();window.V6Overlays?.sync();window.V6Overlays?.restore(previous);};
  el.querySelector('[data-image-close]').onclick=close;el.querySelector('[data-image-zoom]').onclick=e=>{const img=el.querySelector('img');img.classList.toggle('actual-size');e.target.textContent=img.classList.contains('actual-size')?'适应窗口':'原始尺寸';};window.V6Overlays?.sync();el.querySelector('[data-image-close]').focus();
  try{const url=await loadDemoOriginal(id);if(el.isConnected)el.querySelector('img').src=url;}catch(e){if(el.isConnected)el.insertAdjacentHTML('beforeend',`<p class="demo-image-error">${E(e.message)}</p>`);}
}
documentText=function(a,v){if(!v.data.imageCollection)return DEMO_PREVIOUS.documentText(a,v);return '# '+a.title+'\n\n'+v.data.summary+'\n\n'+v.data.deliveryNote+'\n\n图片版本未变；文件来源为 Canva / 用户提供。\n'+v.data.files.map(f=>f.id+' · '+f.width+'×'+f.height+' · '+f.sha256+'\n'+demoMemberNotes(f.id)).join('\n\n');};
versionFiles=function(a,v,label){
  if(!v.data.imageCollection)return DEMO_PREVIOUS.versionFiles(a,v,label);
  const selected=label.includes('批准')?v.data.files.filter(f=>f.id===v.data.mainMember):v.data.files,files={};
  for(const f of selected){const raw=window.DEMO_ORIGINALS?.[f.id];if(!raw)throw Error('原图尚未加载：'+f.id);files[f.file]=Uint8Array.from(atob(raw.split(',')[1]),c=>c.charCodeAt(0));}
  files['content.md']=documentText(a,v);files['snapshot.json']=JSON.stringify({artifactId:a.id,kind:a.kind,revision:v,label,files:selected},null,2);
  files['preview.html']='<!doctype html><meta charset="utf-8"><title>'+E(a.title)+'</title><style>body{margin:32px;font:16px/1.6 sans-serif;color:#00284c}img{width:100%;height:auto;max-width:1400px}pre{white-space:pre-wrap}</style><h1>'+E(a.title)+' · v'+v.num+'</h1><p>'+E(label)+'</p>'+selected.map(f=>'<img src="'+f.file+'" alt="'+E(demoImage(f.id).name)+'">').join('')+'<pre>'+E(documentText(a,v))+'</pre>';return files;
};
async function preloadDemoFiles(versions){await Promise.all([...new Set(versions.flatMap(v=>v?.data.files?.map(f=>f.id)||[]))].map(loadDemoOriginal));}
exportOne=async function(id,num){const a=artifact(id),v=revision(a,num);try{await preloadDemoFiles([v]);return DEMO_PREVIOUS.exportOne(id,num);}catch(e){toast(e.message,true);}};
exportApproved=async function(id){const s=S.submissions.find(x=>x.id===id);try{await preloadDemoFiles([s?.snapshot]);return DEMO_PREVIOUS.exportApproved(id);}catch(e){toast(e.message,true);}};
exportProject=async function(pid=S.projectId){try{await preloadDemoFiles(S.artifacts.filter(a=>a.projectId===pid).flatMap(a=>a.versions));return DEMO_PREVIOUS.exportProject(pid);}catch(e){toast(e.message,true);}};
exportDraftBatch=async function(b){try{await preloadDemoFiles(b.items.map(i=>revision(artifact(i.artifactId),i.revision)));return DEMO_PREVIOUS.exportDraftBatch(b);}catch(e){toast(e.message,true);}};
const demoModalRender=renderModal;
renderModal=function(){demoModalRender();if(MODAL?.kind==='review'){const s=S.submissions.find(s=>s.id===MODAL.arg),a=s&&artifact(s.artifactId);if(s?.snapshot.data.imageCollection){const col=dockRoot().querySelector('.compare-grid>div');if(col)col.innerHTML=demoFigure(s.snapshot.data.mainMember)+'<p>'+E(s.snapshot.data.deliveryNote)+'</p><p>Material v'+s.revision+' · 图片 v1，图片未变</p>';const comment=document.querySelector('#review-comment');if(comment&&!s.reviewComment)comment.value='';}}};
