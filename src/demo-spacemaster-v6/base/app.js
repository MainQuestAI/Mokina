function clearComposer(){if(thread())DRAFTS[thread().id]='';const c=document.querySelector('#composer');if(c)c.value='';}
async function sendPrompt(text){text=String(text||'').trim();if(!text)return;if(S.runId)return toast('当前工作尚未结束。你可以先暂停、取消，或等待结果。');closeModal();clearComposer();addMsg('user',text);S.view='chat';render(true);const lower=text.toLowerCase();if(/你是谁|介绍.{0,3}自己|认识.*lilith/.test(lower)){addMsg('assistant','我是 Lilith，你的 AI 工作伙伴。我可以协助研究、分析、整理资料和制作内容，也针对产品上市与市场沟通做了专业适配。\n\n你可以交给我一个问题，也可以和我一起建立一个上市项目。当前页面使用离线情景引擎，不会假装调用了实时模型。');render(true);return}
if(/创建|建立|新建|筹备|变成.*项目/.test(text)&&/项目|上市|空间/.test(text)&&!/(不用|不要|不必|无需|先不|不先|不需要).{0,4}(创建|建立|新建|建)/.test(text))return createProject();
if(/确认.*(清单|范围)|清单.*确认/.test(text)){if(project())return showModal('scope',S.projectId);}
if(/审批|批准|审核|提交/.test(text)){let a=artifact(S.canvas?.id)||byKind('pop');if(!a)return toast('还没有待审核物料。');if(S.actor==='reviewer')return showModal('review');return showModal('submit',a.id+'|'+a.active);}
if((/为什么|依据|解释|是否|是不是|有哪些问题|怎么理解/.test(text)||/(不要|不必|无需|先不|别).{0,4}(修改|改稿|重写)/.test(text))&&S.canvas){let a=artifact(S.canvas.id),v=selectedRevision();return runWork('ask',async()=>({text:'当前讨论的是 '+a.title+' v'+v.num+'。\n\n这一方向把可核对的产品能力与工作假设分开：570 L 和 Counter Depth 是附件中的产品记录；“厨房升级”是本演示选择的使用场景假设，不是消费者研究结论。我们因此不写人群占比、竞品排名或节能提升。\n\n本次只回答问题，没有生成新版本。'}));}
if(/修改|改成|改为|缩短|更短|重写|改一下|换掉|调整/.test(text)&&(S.canvas||S.contextSelection))return modifySelected(text);
if(/FABE|fabe|价值推导|价值体系/.test(text))return generate('fabe');
if(/message house|信息屋|\bmh\b|传播主张/.test(lower))return generate('mh');
if(/POP|pop|线下物料|门店物料/.test(text))return generate('pop');
if(/官网.*(内容|页面)|产品页/.test(text))return generate('web');
if(/电商/.test(text)&&/内容|详情/.test(text))return generate('ecom');
if(/策略/.test(text))return generate('strategy');
if(/素材|产品图|图片|场景图/.test(text))return generate('assets');
if(/市场|研究|竞品|厨房.*场景/.test(text))return generate('research');
if(/纪要|整理|总结|摘要/.test(text)||attachedIds.length){const tid=S.threadId,pid=S.projectId,up=attachedIds.map(id=>S.uploads.find(x=>x.id===id)).filter(Boolean);const raw=up.filter(x=>x.text).map(x=>x.name+'\n'+x.text).join('\n\n')||text;attachedIds=[];return runWork('notes',async()=>{let d={title:up.length?'本地资料 · 工作摘要':'会议与工作摘要',summary:'依据本次输入整理；未添加外部事实。',sections:[{id:'notes',title:'输入内容与工作安排',body:raw.slice(0,10000)+(raw.length>10000?'\n（预览保留前 10,000 字符；完整原文见资料页。）':''),label:'用户输入',sources:[]}]};let a=newArtifact('notes',d,pid,[],tid);return{artifactIds:[a.id],text:'已将输入整理为一份可查看、可引用的工作成果。这是浏览器中的规则化整理，未调用实时模型。'};});}
addMsg('assistant','当前是离线交互 Demo，还不能像真实通用 Agent 一样处理任意问题；我不会用固定回答冒充模型完成了这项工作。\n\n你可以继续试用本故事中的市场查询、创建 SpaceMaster 项目、生成策略／FABE／信息屋、查找素材、制作 POP，或上传文本进行整理。',{action:project()?'generate-strategy':'create'});render(true);persist();}
async function handle(action,arg=''){const parts=String(arg).split('|'),[id,n,third]=parts;const a=artifact(id);const num=Number(n);switch(action){
case 'new-chat':if(S.runId)return toast('请先结束或取消当前执行。');newChat();return;
case 'mobile-nav':S.mobileNav=!S.mobileNav;render();return;
case 'project':goProject(id);return;
case 'thread':{let t=S.threads.find(x=>x.id===id);if(!t)return;S.threadId=id;S.projectId=t.projectId;S.canvas=null;S.view='chat';S.contextSelection=null;render();persist();return;}
case 'nav':closeModal();S.view=id;S.canvas=null;S.mobileNav=false;render();persist();return;
case 'send':return sendPrompt(document.querySelector('#composer')?.value);
case 'prompt':return sendPrompt(SCENE_PROMPTS[id]||id);
case 'identity':case 'about':case 'guide':case 'settings':case 'role':case 'context':case 'scope':case 'source':case 'capabilities':case 'capability':case 'run-detail':case 'tool-detail':case 'compare':case 'point-detail':case 'edit-point':case 'edit-material':case 'asset-detail':case 'task-detail':case 'check-detail':case 'deliveries':case 'link-project':case 'uploaded':return showModal(action,arg);
case 'modal-close':closeModal();return;
case 'pause':S.paused=!S.paused;render();persist();return;
case 'cancel-run':CANCEL_TOKEN++;S.paused=false;if(S.auto)S.auto.active=false;closeModal();render();return;
case 'generate':closeModal();S.view='chat';return generate(id);
case 'next':if(id==='enter-project'){goProject(n);showModal('scope',n);return}if(id.startsWith('generate-'))return generate(id.slice(9));if(id==='create')return sendPrompt(SCENE_PROMPTS.create);if(id==='check')return checkArtifact(n||S.canvas?.id);if(id==='submit'){const aa=artifact(n)||artifact(S.canvas?.id)||byKind('pop');if(aa)return showModal('submit',aa.id+'|'+(Number(third)||aa.active))}if(id==='review')return showModal('review');if(id==='deliverables'){S.view='tasks';S.canvas=null;render();return}return;
case 'confirm-scope':{let p=project(id);if(scopeDraft&&!p.scopeConfirmed){p.channels=[...scopeDraft.channels];p.tier=scopeDraft.tier||p.tier;}const selected=[...document.querySelectorAll('[data-scope-kind]:checked')].map(e=>e.dataset.scopeKind);confirmScope(id,selected.length?selected:undefined);scopeDraft=null;return;}
case 'open-artifact':closeModal();openCanvas(id,num||null);return;
case 'close-canvas':S.canvas=null;render();persist();return;
case 'toggle-run':S.expandedRuns=S.expandedRuns||[];S.expandedRuns=S.expandedRuns.includes(id)?S.expandedRuns.filter(x=>x!==id):[...S.expandedRuns,id];render();return;
case 'canvas-tab':S.canvas.tab=id;render();persist();return;
case 'select-section':{closeModal();if(!a)return;const v=revision(a,num);let sec=v.data.sections?.find(x=>x.id===third)||v.data.points?.find(x=>x.id===third);S.contextSelection={artifactId:id,revision:num,section:third,title:sec?.title||a.title};if(innerWidth<850)S.canvas=null;S.view='chat';render();document.querySelector('#composer')?.focus();persist();return;}
case 'clear-selection':S.contextSelection=null;render();return;
case 'adopt':closeModal();adopt(id,num);return;
case 'check':return checkArtifact(id);
case 'submit':return showModal('submit',arg);
case 'submit-confirm':return submitArtifact(id,num);
case 'review-task':{const s=S.submissions.findLast(x=>x.taskId===id&&x.status==='pending');return showModal('review',s?.id||'');}
case 'review':return showModal('review',id);
case 'review-return':return reviewDecision(id,'returned',document.querySelector('#review-comment')?.value);
case 'review-approve':return reviewDecision(id,'approved',document.querySelector('#review-comment')?.value||'批准此固定版本。');
case 'retry-ingest':closeModal();await ingest(id,true);showModal('deliveries');return;
case 'set-role':if(S.runId)return toast('执行期间不能切换责任身份，请先结束或取消本次运行。');S.actor=id;closeModal();render();persist();return;
case 'transfer':requestTransfer(id);return;
case 'accept-transfer':acceptTransfer(id);return;
case 'filter':S.filters.domain=id;render();return;
case 'save-settings':S.settings.theme=document.querySelector('#pref-theme').value;S.settings.density='comfortable';S.settings.speed=Number(document.querySelector('#pref-speed').value);closeModal();render();persist();return;
case 'save-context':{let p=project(id);let name=document.querySelector('#ctx-name').value.trim();if(!name)return toast('项目名称不能为空。',true);p.name=name;p.goal=document.querySelector('#ctx-goal').value;log('更新项目上下文',name);closeModal();render();persist();return;}
case 'save-material':{if(!a||!canWrite(a))return;const base=revision(a,num),d=clone(base.data);d.headline=document.querySelector('#mat-headline').value.trim();if(!d.headline)return toast('请填写主标题。',true);d.subtitle=document.querySelector('#mat-subtitle').value;d.summary=document.querySelector('#mat-summary').value;d.template=document.querySelector('#mat-template').value;d.image=document.querySelector('#mat-image').value;d.customImage=S.uploads.find(x=>x.id===d.image)?.dataURL||null;const v=addRevision(a,d,'人工编辑文案与视觉方案',base.refs);if(!v)return;closeModal();S.canvas.num=v.num;addMsg('assistant','已保存人工编辑为 v'+v.num+' 新候选。你可以完整比较，再采用这一版。',{artifactIds:[a.id]});render(true);persist();return;}
case 'save-point':{if(!a||!canWrite(a))return;let base=revision(a,num),d=clone(base.data),p=d.points.find(p=>p.id===third);p.title=document.querySelector('#point-title').value.trim();p.benefit=document.querySelector('#point-benefit').value.trim();p.short=document.querySelector('#point-short').value.trim();p.selected=document.querySelector('#point-selected').checked;if(!p.title||!p.benefit)return toast('主题与利益点不能为空。',true);if(!d.points.some(p=>p.selected))return toast('至少保留一个入选主题。',true);let v=addRevision(a,d,'人工调整价值主题与入选范围',base.refs);if(!v)return;closeModal();S.canvas.num=v.num;render();persist();return;}
case 'toggle-asset':{const item=assetItem(id),aa=artifact(n),base=revision(aa,Number(third));if(!canWrite(aa))return;if(!item.eligible&&!base.data.items.includes(id))return toast('型号或使用条件未满足，不能纳入集合。',true);const d=clone(base.data);d.items=d.items.includes(id)?d.items.filter(x=>x!==id):[...d.items,id];if(d.items.length<2)return toast('素材交付至少保留两项可用素材。',true);const v=addRevision(aa,d,'调整素材集合',base.refs);closeModal();S.canvas={id:aa.id,num:v.num,tab:'content'};render();persist();return;}
case 'link-project-confirm':{const p=project(n);if(!p||!a)return;if(!p.contextArtifacts.includes(id))p.contextArtifacts.push(id);log('已引用前期工作成果',a.title+' v'+(a.accepted||a.active),p.id);p.contextRefs=p.contextRefs||[];if(!p.contextRefs.some(x=>x.id===a.id))p.contextRefs.push({id:a.id,revision:a.accepted||a.active});closeModal();goProject(p.id,false);addMsg('assistant','已将“'+a.title+'”引用到项目上下文，原独立成果继续保留，没有复制成新的业务任务。');render(true);persist();return;}
case 'refresh-sources':{if(!a||!canWrite(a))return;closeModal();return generate(a.kind);}
case 'retry-run':{let r=S.runs.find(x=>x.id===id);if(!r)return;S.threadId=r.threadId;S.projectId=r.projectId;S.contextSelection=r.savedSelection||null;S.canvas=r.savedCanvas||null;S.view='chat';S.paused=false;if(r.kind==='create')return createProject();if(r.kind==='modify')return modifySelected('恢复中断的修改');if(r.kind==='check')return checkArtifact(S.canvas?.id);if(r.kind==='ask')return sendPrompt('解释当前成果的依据');return generate(r.kind);}
case 'attach':document.querySelector('#file-input').click();return;
case 'detach':attachedIds=attachedIds.filter(x=>x!==id);render();return;
case 'summarize-upload':attachedIds=[id];closeModal();return sendPrompt('整理这份本地资料，保留原始输入。');
case 'authorize-upload':{let u=S.uploads.find(x=>x.id===id);if(!u)return;u.eligible=true;u.license='上传者确认仅供演示';log('记录图片演示用途',u.name+'，不作为真实授权认证。');closeModal();render();persist();return;}
case 'export-one':return exportOne(id,num||artifact(id)?.active);
case 'export-approved':return exportApproved(id);
case 'export-project':return exportProject(id||S.projectId);
case 'export-png':return exportPng(id,num);
case 'export-trace':download('Lilith_执行记录.json',JSON.stringify({simulation:true,runs:S.runs,activity:S.activity},null,2),'application/json');return;
case 'export-backup':download('Lilith_SpaceMaster_V6_备份.json',JSON.stringify(S,null,2),'application/json');return;
case 'reset':return showModal('reset');
case 'reset-confirm':resetState();return;
case 'auto-start':if(S.auto?.active)return toast('完整故事正在播放；可以暂停、查看详情或停止。');if(S.projects.length||S.artifacts.length)return showModal('auto-confirm');closeModal();return startAuto();
case 'auto-confirm':closeModal();return startAuto(true);
case 'auto-stop':if(S.auto)S.auto.active=false;S.paused=false;toast('已结束自动演示，保留当前工作。正在运行的单项工作会继续完成。');render();persist();return;
default:toast('这个操作尚未配置：'+action,true);}
}
function resetState(){CANCEL_TOKEN++;S=makeState();attachedIds=[];Object.keys(DRAFTS).forEach(k=>delete DRAFTS[k]);clearComposer();closeModal();persist();render();}
async function handleFiles(files){for(const f of files){if(f.size>3*1024*1024){toast('单个文件请控制在 3 MB 内，避免本地保存超限。',true);continue}const u={id:uid('upload'),name:f.name,size:f.size,mime:f.type,created:now(),projectId:S.projectId};if(/^image\/(png|jpeg|webp)$/.test(f.type)){u.type='image';u.dataURL=await new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});u.eligible=false;u.scope='用户上传';u.license='使用条件待确认';u.desc='本地图片已读取。未进行图像内容识别或商业权利核验。';}else if(/\.(txt|md|csv|json)$/i.test(f.name)){u.type='text';u.text=await f.text();}else{u.type='file';u.text=null;}S.uploads.push(u);attachedIds.push(u.id);log('已添加本地资料',f.name+(u.text?' · 文本可读取':u.type==='image'?' · 图片可预览':' · 只登记文件信息，不解析正文'));}persist();render();toast(storageWarning?'存储空间不足，请导出工作备份。':'文件已添加。文本可直接整理；其他格式会明确标注读取范围。',storageWarning);}
document.addEventListener('click',event=>{const b=event.target.closest('[data-action]');if(!b||b.disabled)return;event.preventDefault();Promise.resolve(handle(b.dataset.action,b.dataset.arg||'')).catch(e=>{console.error(e);toast('操作未完成：'+e.message,true)})});
document.addEventListener('input',event=>{const e=event.target;if(e.id==='composer')DRAFTS[thread().id]=e.value;if(['mat-headline','mat-subtitle','mat-summary','mat-template','mat-image'].includes(e.id))updateEditPreview();});
function updateEditPreview(){if(MODAL?.kind!=='edit-material')return;let [id,n]=MODAL.arg.split('|'),a=artifact(id),v=revision(a,Number(n)),d=clone(v.data);d.headline=document.querySelector('#mat-headline').value;d.subtitle=document.querySelector('#mat-subtitle').value;d.summary=document.querySelector('#mat-summary').value;d.template=document.querySelector('#mat-template').value;d.image=document.querySelector('#mat-image').value;d.customImage=S.uploads.find(x=>x.id===d.image)?.dataURL||null;document.querySelector('#edit-preview').innerHTML=posterSvg(d);}
document.addEventListener('change',event=>{const e=event.target;if(e.id==='speed'){S.settings.speed=Number(e.value);persist()}if(e.id==='version-select'){S.canvas.num=Number(e.value);render();persist()}if(e.dataset.scopeChannel){scopeDraft.channels=[...document.querySelectorAll('[data-scope-channel]:checked')].map(n=>n.dataset.scopeChannel);scopeDraft.selected=rulesFor(scopeDraft.channels,scopeDraft.tier).filter(r=>r.category!=='推荐').map(r=>r.kind);renderModal()}if(e.id==='scope-tier'){scopeDraft.tier=e.value;scopeDraft.selected=rulesFor(scopeDraft.channels,scopeDraft.tier).filter(r=>r.category!=='推荐').map(r=>r.kind);renderModal()}if(e.dataset.scopeKind){scopeDraft.selected=[...document.querySelectorAll('[data-scope-kind]:checked')].map(n=>n.dataset.scopeKind)}if(['mat-template','mat-image'].includes(e.id))updateEditPreview();if(e.id==='file-input'){handleFiles([...e.files]).catch(err=>toast(err.message,true));e.value='';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(MODAL)closeModal();else if(S.canvas){S.canvas=null;render()}else if(S.mobileNav){S.mobileNav=false;render()}return}if(e.key==='Tab'&&MODAL&&isBlockingModal(MODAL.kind)){const nodes=[...document.querySelectorAll('#modal-root button:not(:disabled),#modal-root input:not(:disabled),#modal-root select:not(:disabled),#modal-root textarea:not(:disabled),#modal-root summary')].filter(x=>x.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}if(e.target.id==='composer'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();handle('send')}if(!MODAL&&e.key==='n'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.metaKey&&!e.ctrlKey)handle('new-chat');});
