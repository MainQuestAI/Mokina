# Mokina PR #3 独立审查

审查日期：2026-10-04 UTC。

## 裁决

**REQUEST_CHANGES / HOLD，保持 Draft，不建议现在标记 Ready 或合并。**

形成五项需要处理的代码/行为 finding：一项 P1（unknown 与旧重试路径未贯通），四项 P2（pending 刷新、存储失败草稿、元数据完整性、失效请求顺序）。另列并发声明、off 版非空项目与 Spec 可访问性核对，不虚增为已完整产品复现的缺陷。

- 仓库：MainQuestAI/Mokina。
- Base：`33fa8434d14869ab4310d8b0f570116781d34c8d`。
- Head：`58dbf1cf717e71d88daf9995195df72fde6ea84c`。
- 分支：`codex/mokina-v0.0.2-b0-b1`。
- 开始与结束读取一致：Open、Draft、未合并；两个提交，64 个变更文件。
- 本轮没有写入 GitHub，没有改变用户本地仓库或 PR 状态。

## 1. 范围与证据

检查了 PR 描述、文件列表、关键生产差异、完整 send-request-state 和 resolver、共享 summary store、ProjectView 的发送/恢复/重试衔接、provider 请求分类、相关 daemon 返回契约、关键测试与执行记录。没有把 64 个文件（尤其证据图片/PDF、所有翻译文件）逐一做完整运行验收。

独立执行 10 组 Node/TypeScript 隔离检查，包含 1 组对照。网络和组件依赖为受控 fixture。它们不是作者 Vitest 或实际浏览器/daemon 的重跑。源文件通过连接器取得，运行件为明确标注的转录模块和回调摘录；可用 `--repo` 对 Codex 本地的真实源码执行同样检查。

作者报告：Web 12701 通过、8 项与 main 相同的既有失败；E2E 共 5 项通过；guard/typecheck/i18n 与 on/off 构建通过。这些是作者证据，本轮没有独立复跑。PR 明确列出 unknown 恢复的浏览器故障注入尚未做。[S1][S8]

最新 head 的 GitHub Check Runs 为 0、commit statuses 为空；不能称 CI 全绿，也不以“没有 CI”直接认定测试失败。[S10]

## 2. Findings

### R1 / P1：unknown 仍能进入普通错误重试，并更换 clientRequestId

主要位置：`open-design/apps/web/src/providers/daemon.ts:1219–1222`；关联 `ProjectView.tsx:8691–8696`、`handleRetry`、`handleSend`。

网络 fetch 失败时，provider 先通知 `onRunCreateFailed({definitive:false})`，随后仍走 `emitRunStatus('failed')` 与原有 `handlers.onError`。新状态只增加待确认记录和提示，没有约束同一请求的旧错误重试路径。`handleRetry` 传递 retryOfAssistantId、替代 assistantMessageId 和 analytics，不携带原 clientRequestId；`handleSend` 因而采用 `meta?.clientRequestId ?? randomUUID()`。[S2][S3]

当服务端已经受理、仅响应丢失，而当前错误仍可重试时，点击普通重试会获得一个新请求身份。服务端“相同 clientRequestId 返回同一 run”的机制不能合并两个不同 ID。这是新增三态对现有发送链的整合缺口，不是在说本 PR 新增了旧重试按钮。

独立探针 S2 执行原 handleRetry 回调（可重试错误为明确 fixture），确实调用了 handleSend，meta 没有 clientRequestId；聚焦发送边界生成新 ID，同时存在旧 unknown 与新 pending。**本轮未启动实际 daemon 的两个 run；重复执行后果是上述路径的推导，完整浏览器故障注入需要 Codex 核验。**

建议：unknown 属于“是否受理待核对”，不是已确定失败。对同一逻辑请求的重试入口先核对并恢复原请求；仅在确认可以重试时维持原身份与兼容 payload。不要简单复用旧 ID 却改 assistant 身份导致幂等冲突，也不要冻结用户所有无关新任务。

验收：服务端创建 run 后故意丢弃 POST 响应；普通重试、刷新和核对均不能产生第二个逻辑任务；查询失败保持待确认；恢复后显示原 run。另测“GET 查询先返回，POST 后到达”的时序，不能把暂时未查到当成永不受理证明。

### R2 / P2：刷新后仅核对 unknown，遗留 pending 被静默跳过

位置：`open-design/apps/web/src/components/ProjectView.tsx:8458–8462`。

记录在 POST 前写 pending；只有原页面的成功/失败回调才清除或转 unknown。但恢复 effect 用 `.filter(record => record.status === 'unknown')`，不处理刷新、关闭窗口或进程中断时留下的 pending。[S2][S3]

探针 S1：写入 pending 后模拟新页面恢复，结果为 **1 条 pending 仍在、0 次受理查询、0 条待确认提示**。同一条记录改成 unknown 的对照立即发出查询并清除，说明不是查询 stub 不工作。

这不等于通用 reattach 在所有情况下都失效；它说明本轮新增的请求核对机制在最需要兜住的刷新窗口没有执行。

建议：恢复出来且已无本页在途请求拥有者的 pending 进入待核对；保留 clientRequestId，不能直接降为可发送草稿。当前页面正常等待中的 pending 与重启后的孤立 pending 分开。

验收：分别在“已写 pending、尚未发送”“请求已到 daemon、回执未到”“网络明确报错之前”刷新；确认记录可见、会按原 ID 核对、不重复 POST，不将用户正文凭空清掉。

### R3 / P2：持久化失败虽停止 POST，却没有把草稿还给输入框

位置：`open-design/apps/web/src/components/ProjectView.tsx:8684`；关联该文件 `handleComposerSend` 与 `ChatComposer.tsx` 的 ChatSendOutcome 处理。

新增代码在 savePendingSendRequest 写入失败时 return false，注释认为这会让输入框恢复。但实际外层 handleComposerSend 只有匹配 `amrGateBlockedRequestRef` 才返回 `restore-draft`，其他 false 路径返回 undefined。ChatComposer 要收到 `restore-draft` 才执行恢复。[S2][S3][S9]

S3 对存储 setItem 注入配额失败，执行持久化 helper 与实际 composer 回调：**POST 次数 0，返回 undefined，不是 restore-draft**。这是明确的返回契约错配。没有挂载输入框测量真实 DOM，不能把它称为已录像确认的前端清空；完整输入框表现需要 Codex 核验。

建议：将本轮新增“未受理且需保留输入”明确传递为 restore-draft，并保留正文、附件和引用；增加可理解的本地保存失败反馈。复用既有返回契约，不新造一套草稿库。不要把所有 false 都无差别重解释，避免破坏已排队等其他分支。

验收：只让 pending 键写失败，其他功能保持正常，普通点击发送后文字/附件/引用仍在，网络无 POST，恢复存储后可继续发送；不只断言 helper 返回 false。

### R4 / P2：被截断或读取失败的元数据被当作完整成果集合

位置：`open-design/apps/web/src/hooks/useMokinaProjectSummaries.ts:174–200`，关联 ProjectView 初始打开回退与 `artifacts/mokina-project-entry.ts`。

同一份轻量摘要同时驱动项目默认入口，但其读取集合并不保证完整：只取前 8 个 HTML；部分 versions 失败仍标整体 ok；全部 versions 失败时 summary.state 是 failed，外层 record.status 却仍硬编码 ok。ProjectView 恰好将 record.status 传给 resolver。[S4][S5][S3]

独立检查：

| 受控输入 | 实际输出 | 不符合之处 |
|---|---|---|
| 9 个均有正常 current 版本的 HTML | 只读前 8 个 versions；formalCount=8，选择器也只有 8 项 | 第 9 份成果被静默排除 |
| 两份成果，一份 versions 成功、一份失败 | 整体 ok，resolver 直接打开唯一已知成果 | 未知不等于不存在，尚不能判定唯一 |
| 全部 versions 失败 | record.status=ok、summary.state=failed，resolver 返回 workspace | 错把读取失败变成零成果回退 |

建议：明确集合 complete/partial/truncated/read-failed；轻量行摘要可以有限读取，但不可给导航作“唯一/零”的权威结论。用户真正打开项目时按需补齐必要元数据，或给出明确的未完整读取状态；传播实际失败，不硬编码 ok。保留有界并发，不需要在侧栏无界预取所有项目。

验收：0/1/2/9 项正常成果、混合读取失败、全部失败，以及恢复后重试。每个断言都同时检查摘要和实际打开 intent，而不是仅测试纯 resolver 的理想输入。

### R5 / P2：采用期间的失效事件可能被在途旧读取吞掉

位置：`open-design/apps/web/src/hooks/useMokinaProjectSummaries.ts:216–225,298–303`；另见 `writeRecord:105–118`。

evict 删除缓存后 refresh，但 requestRead 发现 inFlightProjects 已有同项目时直接返回。fresh 分支单独发出的 files 请求没有被用于重新获取 versions；旧版本读取没有作废，仍可写回已过时记录。[S4]

C1：旧 v1 versions 请求挂起 → 模拟服务端已采用 v2 并发失效事件 → 旧请求返回 v1。结果是 **缓存回到 v1、versions 总读取仅 1 次**；新结果没有被强制重读。此结论是实际 store 加异步 fixture 的模块级复现。

C2 还发现同一 store 的另一处陈旧数据来源：writeRecord 只比较摘要字段。主成果和计数相同、第二份成果 B 的版本改变时，新的完整 entries 被整个丢弃，B 仍停留旧版本。

建议：为项目读取绑定失效代次或明确请求所有者；采用/删除/重命名时使旧请求无权提交，并保证新状态会再读。区分“行文案没有变化”和“底层 entries 没有变化”，不能因摘要相同丢掉第二份成果的更新。只修本层状态，不另造缓存系统。

验收：采用/删除/重命名发生在旧 versions 尚未返回时，新状态始终最终获胜；再覆盖主摘要不变但次要成果更新、卸载后重订阅和并发失效。

## 3. 附加核对（不混入已完成的整应用复现）

### 3.1 并发 ≤2 的声明与代码不一致

readQueue 约束 versions，但 files 在 readProject 中直接调用。Q1 同时订阅 5 个可见项目，峰值 files 请求为 5。没有测得生产卡顿，不把它渲染成性能故障；应在本层修复时让承诺覆盖实际请求，或者准确收窄声明及测试。

### 3.2 off 版需要有非空最近项目的验证

EntryNavRail 新增 useMokinaProjectSummaries 的 enabled 是 open，没有明确的 MOKINA_LOCAL_EDITION 条件；artifactLine 也直接传给公共行组件。空首页 off 截图不能证明非空最近项目无新摘要/请求。源码衔接有明确疑点，但本轮未启动 off 构建，不登记为已浏览器确认的额外 finding。需要 Codex 核验并为 off + 有近期项目增加断言；若确实暴露，局部 edition 条件即可修复。[S11]

### 3.3 已批准 Spec 没有进入本次可读取的远端基线

固定 head 访问 PR 引用的 `docs/specs/Mokina-B0-B1-开发Spec-2026-10-03.md` 返回 404；PR 变更清单也未列入该文件。Files 中定向检索未找到相应版本。执行记录提到 Spec 等“未跟踪引用资料”已迁入工作树，但迁入不等于已提交。[S1][S8]

这不表示用户没有本地批准，只表示本次无法逐项核验六行判定表和 TASTE-1/2/3。请 Codex 核验并补入正式 Spec/验收表或固定、可访问的来源；不要再次要求用户重做定位决定。

## 4. 建议修复批次与 Ready 条件

保持 B0+B1 范围，分两组最小修复即可：

1. **发送闭环组**：pending 恢复、unknown/普通重试隔离、草稿返回契约，补一次完整浏览器网络故障注入矩阵。不能用同 ID 的 daemon 重放成功代替前端产生 ID 的验证。
2. **成果读取组**：完整性传播、失效代次、entries 更新，顺带核对真实并发和 off 非空项目条件。补 store→resolver→实际入口的联合测试。

最后重新绑定 head/base，补入可审阅 Spec，以普通浏览器操作确认已修复；重复执行现有相关测试并保留首次失败及差异结果。已报告的 8 项历史失败要与 main 对照，不应由本轮凭空认定已经修复或成为新增 blocker。

B0 真实链路回放是有价值的新增证据；活动页入口因当前链路不足而明确后置，没有必要为本次 Ready 临时扩成 B3。A/B 约束敏感性、开放 CSV、完整八视图、桌面发布仍按原计划推进，不与上述直接违反本 PR 声明的行为混为一类。

**当前未满足的不是“再写一份完成说明”，而是跨层行为本身及其故障态验证。保持 Draft；修复、补证据并复审后再决定 Ready。**

## 5. Sources（固定提交）

- [S1] PR #3 元数据与正文：https://github.com/MainQuestAI/Mokina/pull/3
- [S2] 发送持久化：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/runtime/chat/send-request-state.ts
- [S3] ProjectView：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/components/ProjectView.tsx
- [S4] 摘要 store：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/hooks/useMokinaProjectSummaries.ts
- [S5] 打开 resolver：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/artifacts/mokina-project-entry.ts
- [S6] provider：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/providers/daemon.ts
- [S7] 测试：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/tests/runtime/send-request-state.test.ts ；https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/e2e/ui/mokina-navigation.test.ts
- [S8] 作者记录：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/docs/Mokina-B0-B1-运行与验收记录.md
- [S9] 输入框契约：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/components/ChatComposer.tsx
- [S10] Check Runs：https://api.github.com/repos/MainQuestAI/Mokina/commits/58dbf1cf717e71d88daf9995195df72fde6ea84c/check-runs
- [S11] 通用 recent 入口：https://github.com/MainQuestAI/Mokina/blob/58dbf1cf717e71d88daf9995195df72fde6ea84c/open-design/apps/web/src/components/EntryNavRail.tsx

Source 支撑代码与作者声明；`probe-results.json` 支撑本轮受控实验，二者不要相互替代。
