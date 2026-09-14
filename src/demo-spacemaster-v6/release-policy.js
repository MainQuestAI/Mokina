/* Visible boundaries belong to the work, not to inferred permissions or hidden defaults. */
const V62_RULES = [
  {title:'按本次范围完成任务',status:'当前交互规则',text:'官网、门店和电商分别按交付计划选择。只做一个渠道，不要求补做另一个渠道。保存计划不会开始执行。',source:'https://my.feishu.cn/docx/TFFydpI3yoawiEx53o3cqMAYnLo'},
  {title:'草稿、采用与正式使用分开',status:'当前交互规则',text:'允许连续制作内部草稿。选用成员不等于采用集合；采用不等于批准。正式使用前核对真实性、授权、市场和声明，并提交规定的固定版本。',source:'https://my.feishu.cn/docx/NsXpdAnYKo9b3KxwJ0PcmhH4npb'},
  {title:'CL 写回范围',status:'首期实施边界',text:'描述建议经人工核对后，仅交接 CL 允许的文字描述字段。原标签、关系和正式状态仍由 CL 管理；新文件走 CL 原生上传审批。没有目标系统证据时显示待交接，不报入库成功。',source:'https://my.feishu.cn/base/HinAbzS9kan8xzsDgBTcDdYsnHd'},
  {title:'项目、国家与语言',status:'组织规则待确认',text:'使用稳定项目 ID 和显式产品、市场、语言、渠道。项目是否按产品×市场×渠道拆分、编码映射与首期语种仍待业务确认；不会按对话关键词自动改归属或继承其他市场的批准。',source:'https://my.feishu.cn/wiki/A6k8wVqmtirnuckeIr0c6U5un6f'},
  {title:'审批系统与正式闭环',status:'接口与责任待确认',text:'内部创意评审不等于产品可正式传播。企业策略审批的组合粒度、具体审核人和外部回调仍需组织确认；入库、发布、巡检分别保留状态与回执。',source:'https://my.feishu.cn/wiki/A6k8wVqmtirnuckeIr0c6U5un6f'},
  {title:'版本固定与来源失效',status:'当前交互规则',text:'执行使用固定事实与引用版本。普通资料更新留给下一版；明确撤权、过期或失效会阻断相关正式使用。重试只恢复失败工作，不生成重复审批。',source:'https://my.feishu.cn/docx/Yswedr5o7okUonxzYeMcGmr2nzh'}
];
const V62_POLICY_PREVIOUS={renderModal,handle,planPanelHTML,taskRow,decisionCompletion};
taskRow=function(task){
  const html=V62_POLICY_PREVIOUS.taskRow(task);
  return task.status==='working'&&task.internalReview?.status==='approved'?html.replace('>进行中<','>待正式使用确认<'):html;
};
decisionCompletion=function(task){return task?.maturity==='approved'?'完成条件：正式使用审批完成；内部创意评审不替代正式批准':V62_POLICY_PREVIOUS.decisionCompletion(task);};
const v62PriorScopeReason=v62ScopeReason;
v62ScopeReason=function(a,v,scope='formal-use'){
  const reason=v62PriorScopeReason(a,v,scope);if(reason)return reason;
  return scope==='internal-review'?'':'正式审批的系统、责任范围与回执合同尚待确认。请准备交接资料；内部创意评审不代替正式使用审批。';
};
planPanelHTML=function(plan){return V62_POLICY_PREVIOUS.planPanelHTML(plan)+`<details class="section"><summary>本次规则与适用范围</summary><p class="small muted">计划按所选渠道执行；内部创意评审与正式使用、CL 接收、渠道发布分别记录。</p>${button('查看规则来源与待确认项','v62-policy','','ghost sm','info')}</details>`;};
renderModal=function(){
  if(MODAL?.kind!=='v62-policy')return V62_POLICY_PREVIOUS.renderModal();
  dockRoot().innerHTML=modalFrame('规则来源与适用范围',`<p>当前版本 6.2。现行规则与组织待确认项分别列出，未确认项不会自动放开正式操作。</p>${V62_RULES.map(r=>`<section class="section"><div class="row wrap"><h3>${E(r.title)}</h3>${tag(r.status,r.status.includes('待确认')?'amber':'')}</div><p>${E(r.text)}</p><a class="btn ghost sm" href="${E(r.source)}" target="_blank" rel="noopener noreferrer">查看来源 ${icon('arrow')}</a></section>`).join('')}`,button('返回工作','panel-close','','sm'));
  mountDock();
};
handle=function(action,arg,...rest){if(action==='v62-policy')return showModal('v62-policy');return V62_POLICY_PREVIOUS.handle(action,arg,...rest);};
window.V62Policy={version:RELEASE_VERSION,rules:V62_RULES,scopeReason:v62ScopeReason};
