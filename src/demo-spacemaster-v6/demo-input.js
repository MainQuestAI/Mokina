/* Present each scripted human request in the real composer before submitting it. */
let demoInput=null;
const inputRender=render,inputSendPrompt=sendPrompt;
render=function(bottom=false){
  inputRender(bottom);
  document.querySelector('.main')?.classList.toggle('demo-composing',!!demoInput);
  if(demoInput&&demoInput.threadId===S.threadId){
    const composer=document.querySelector('#composer'),dock=composer?.closest('.composer-dock,.home-input');
    if(composer){composer.value=demoInput.value;composer.readOnly=true;composer.setAttribute('aria-label',PEOPLE[S.actor].name+'正在输入');}
    if(dock){
      dock.classList.add('demo-typing');dock.insertAdjacentHTML('afterbegin',`<div class="demo-input-label">${icon('edit')}${E(PEOPLE[S.actor].name)}正在输入</div>`);
      const send=dock.querySelector('[data-action="send"]');if(send)send.disabled=true;
      const scroll=dock.closest('.chat-scroll');
      if(scroll){const frame=dock.getBoundingClientRect(),view=scroll.getBoundingClientRect();scroll.scrollTop+=frame.top-view.top-Math.max(18,(view.height-frame.height)/2);}
    }
  }
};
async function autoTypeInput(text){
  if(!S.auto?.active)return;
  if(MODAL)closeModal();
  const id=S.threadId,oldDraft=DRAFTS[id]||'';
  S.contextSelection=null;S.view='chat';S.inspectorOpen=false;
  if(S.canvas&&S.artifactWorkspace){S.artifactWorkspace.chatVisible=true;S.artifactWorkspace.discussionBound=false;}
  demoInput={threadId:id,value:''};DRAFTS[id]='';render(true);
  const trace=window.__LILITH_QA_TIME_SCALE?(window.__DEMO_INPUT_TRACE??=[]):null;
  try{
    await autoWait(400);
    const chars=Array.from(text);
    for(let i=0;i<chars.length;i++){
      await autoWait(48);
      if(S.threadId!==id)throw new Error('AUTO_STOPPED');
      demoInput.value=chars.slice(0,i+1).join('');DRAFTS[id]=demoInput.value;
      const composer=document.querySelector('#composer');if(composer){composer.value=demoInput.value;composer.scrollTop=composer.scrollHeight;}
    }
    if(trace)trace.push({text,threadId:id,composer:document.querySelector('#composer')?.value,hasSelection:!!document.querySelector('.selection-chip'),phase:'typed'});
    await autoWait(600);
  }catch(e){DRAFTS[id]=oldDraft;const composer=document.querySelector('#composer');if(composer?.dataset.threadId===id)composer.value=oldDraft;throw e}
  finally{demoInput=null;render(true)}
}
sendPrompt=async function(text){if(S.auto?.active)await autoTypeInput(text);return inputSendPrompt(text)};
const demoHandle=handle;
handle=function(action,arg=''){if(demoInput&&action==='send')return;return demoHandle(action,arg)};
async function autoRequest(text,action){
  await autoTypeInput(text);if(!S.auto?.active)throw new Error('AUTO_STOPPED');
  clearComposer();addMsg('user',text);render(true);return action();
}
// Escape folds only the inspector; it must not close an artifact beneath it.
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.inspectorOpen&&!isBlockingModal(MODAL?.kind)){e.preventDefault();e.stopImmediatePropagation();handle('inspector-close')}},true);
