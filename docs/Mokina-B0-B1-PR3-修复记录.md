# Mokina PR #3 修复记录

日期：2026-10-04。范围：B0+B1，保持 Draft。

固定审查 base：`33fa8434d14869ab4310d8b0f570116781d34c8d`；修复前 head：`58dbf1cf717e71d88daf9995195df72fde6ea84c`。沿用 `codex/mokina-v0.0.2-b0-b1`，没有改动预存 AGENTS、根部锁文件或 v0.3 资料。三组修复及收尾受理边界补强共四个提交，最终修复提交由 PR 提交列表给出；这份文件随最后一组提交保存，不填写自身尚未生成的 SHA。

## 当前行为

用户发送的请求先通过原有身份、AMR 与队列检查，再保存完整且有限的请求快照。准备和实际发送分阶段落盘。保存失败、超过上限或容量满时不 POST，撤回本轮乐观消息并保留输入。正文最多 64 Ki 字符；extras 复用现有 64 Ki 字符及条目限制，不能完整保留时拒绝发送，不静默截断。没有保存凭据或 File blob；不能恢复的临时内容提示重新选择。

每个请求独立存储，scope 包括原 workspace、项目和会话，每 scope 最多八条未解决记录，不淘汰旧请求。安全浏览器的原生 Web Locks 串行化跨标签新增；不支持 Web Locks 的载体使用逐请求存储的兼容路径，不能声称其跨标签容量检查具有同等互斥保证。没有按记录年龄删除或推断受理状态。

请求进入发送后失去本页拥有者，重开仍为待确认。普通重试和换模型重试先核对原请求，不产生新 POST。已受理但运行失败仍可明确发起新尝试；若新尝试的响应丢失，通过请求 ID 和原 user/assistant 消息身份关联，旧错误界面不能再创建第三次尝试。旧预览记录按相同输入保守阻止重发。GET 空结果、无权限或网络错误都不证明未受理。通用结构化 500/503（包括 INTERNAL_ERROR）也保持 unknown；daemon 可能已落盘 run 后才返回准备错误。只有 4xx 或两个明确受理前 503 拒绝码回到未发送分支。查询通过 provider 携带原 workspace 身份；确认受理后恢复原 run 与消息身份。创建阶段 30 秒超时结束本地忙碌态并保留 unknown，已受理后的流错误不会倒退为创建失败。恢复草稿需显式点击，已在编辑的新草稿优先保留。

可见行最多读八个条目，并明确完整、部分、截断、失败和无权限状态。只有完整成功才判断零个、唯一或多个正式成果。默认打开前按需补齐当前项目元数据；失败可就地只读重试。文件与版本元数据共用并发上限二的队列，前台优先；取消、失效、StrictMode 重挂载及身份切换有独立拥有者防止旧结果覆盖新读。完整 entries 更新包括次要成果，窗口重新聚焦复核。

版本摘要和入口查询使用既有 versions 接口的 `readOnly=true`，不为 legacy HTML 补建首版。默认旧调用保持兼容；contracts、HTTP 与 `od files versions --read-only` 同步，见[接口示例](../open-design/docs/project-file-versions-read-only.md)。候选、历史和 legacy 不能成为正式成果。选择后当前版发生变化，原生版本面板保留选择时的确切版本；目标不存在时显示错误，不替换目标。深链、tabs、路径和授权继续由原生入口处理。

off 构建关闭 Mokina 文案和摘要订阅。选择器复用现有 Dialog，Tab 循环、Esc 与关闭后焦点恢复；路由切换的卸载不抢新项目焦点。新操作目标至少 44px，焦点轮廓 2px，项目名最多两行，保留完整 accessible name。采用时间没有真实字段时不虚构；界面明确显示“版本时间”。原 B1 新增词条为十项，本轮再加七项，合计十七项，十九份 locale 与 Dict 同步；非中文新增文案沿原实现的英文回退，不宣称完成专业翻译。

## 审查逐项处置

| 问题 | 修复及直接证据 |
|---|---|
| R1 / C3 | 普通重试、换模型与发送边界核对原请求及消息身份；新尝试丢响应不会创建第三次尝试；GET 空结果和通用结构化 5xx 保持 unknown。ProjectView 重试测试、provider 测试及真实 daemon 丢失受理响应的浏览器记录 |
| R2 / C1 | prepared/dispatched 与本页拥有者；遗留 pending 分阶段恢复，旧预览不能冒充全文。send-request-state 测试与刷新/重开浏览器记录 |
| R3 / C2 / C4 | POST 前完整快照落盘；两个落盘阶段失败都撤回乐观消息并返回 restore-draft；前置拒绝与持久队列沿原结果语义。ProjectView/ChatPane/Composer 及 AMR 回归 |
| R4 / C5 | 截断、部分失败不判断准确总数或唯一；前台完整读取，失败可重试。0/1/2/9/12/120 集合与实际入口测试 |
| R5 | 独立请求拥有者与取消、失效后重读、次要 entries 更新。旧结果迟到、StrictMode、聚焦与身份隔离测试 |
| C6 | 原 workspace headers 与 p/c/requestId 精确查询；provider 单测、daemon workspace gate 与幂等回归 |
| I1 / I7 | 30 秒创建超时、接入取消、状态事件刷新提示，pending 不冒称 unknown，受理清理提示 |
| I2 | on/off 双重门控；非空最近项目的独立 off 生产页面验证 |
| I3 / I4 / I5 | 明确目标继续走原生授权路由；失败 resolver 不永久锁定；完整读取消除八项截断造成的错误打开 |
| I6 / I10 | files/versions 统一队列、前台优先、取消排队 promise、旧 finally 不清理新 controller |
| I8 / I12 | Dialog 键盘焦点、44px/2px、两行名称、正式身份和可核对版本时间；组件及双尺寸浏览器验证 |
| I9 / I11 | 请求独立存储、八条容量拒绝而不挤掉未知记录；保留旧预览，有限完整快照。未按年龄删除记录，符合本次明确方案 |
| I14 | 已批准 Spec、QA 和决策记录纳入 PR；保留原批准时点，更新当前实施状态与实际词条数量 |
| 新增只读查询问题 | real daemon HTTP 测试对比 readonly 前后版本存储和文件状态；CLI 实际命令测试；兼容旧 GET 补建行为 |
| I13 | SideChatTab / DesignSystemFlow 不在本次授权修复范围，未扩展 |

C/I 编号来自第二份审查，R1–R5 来自[绑定 `58dbf1c` 的独立审查](reviews/Mokina-PR3-review-58dbf1c.md)。以用户最终实施方案为当前要求，文档中的历史建议不扩大授权。

## 验证与证据层

所有命令在 `open-design/` 执行，Node v24.15.0、pnpm 10.33.2；生命周期仅用 `tools-dev` 与 `@/playwright/suite`，独立 namespace/data。日志保留在 [evidence/pr3-review-repair](evidence/pr3-review-repair/)。

| 层级 | 结果与证据 |
|---|---|
| 修复前失败 | 原 `58dbf1c` 上先留下四项失败，含容量淘汰、GET 空结果、部分失败误唯一、旧结果覆盖；[red-tests.txt](evidence/pr3-review-repair/red-tests.txt) |
| Web 全套 | 1,248 文件，12,726 passed / 8 failed / 1 expected fail / 11 skipped，无未处理错误；[web-full-final.txt](evidence/pr3-review-repair/web-full-final.txt)。后续小改动按受影响范围重跑，未再次重复全套 |
| 固定 base 对照 | 八项失败的测试名与 AssertionError 签名均匹配 `33fa8434`；从精确 base 的 git archive 执行六个文件，复用相同已安装依赖；[baseline-failures.json](evidence/pr3-review-repair/baseline-failures.json)、[base-8-failures.txt](evidence/pr3-review-repair/base-8-failures.txt)。不要求 main 通过尚不存在的 B1 测试 |
| 发送/入口/UI 定向 | 主修复四文件 56 passed；收尾 provider/宿主重试两文件 37 passed（[日志](evidence/pr3-review-repair/final-retry-attempt-identity-pass.txt)），覆盖已失败 run 的新尝试丢响应及结构化服务错误；[final-send-ui.txt](evidence/pr3-review-repair/final-send-ui.txt)。共享锁/焦点四文件 55 passed；版本/Composer 五文件 345 passed；最新身份隔离、reset 与 FileViewer 两文件 328 passed |
| daemon | 版本/CLI/资料/tabs/edition 六文件 31 passed；workspace gate / request idempotency 两文件 80 passed；[daemon-regression-final.txt](evidence/pr3-review-repair/daemon-regression-final.txt)、[daemon-identity-final.txt](evidence/pr3-review-repair/daemon-identity-final.txt) |
| contracts | 七十文件 719 passed；[contracts-tests.txt](evidence/pr3-review-repair/contracts-tests.txt) |
| 守卫/类型/词条 | guard、根级 typecheck、i18n:check 通过；[guard-attempt-identity.txt](evidence/pr3-review-repair/guard-attempt-identity.txt)、[typecheck-attempt-identity.txt](evidence/pr3-review-repair/typecheck-attempt-identity.txt)、[i18n-attempt-identity.txt](evidence/pr3-review-repair/i18n-attempt-identity.txt) |
| 开发服务浏览器 | 真实 daemon 响应丢失恢复双尺寸二项通过，导航/PR2 五项通过；JSON 保留原 run 受理信息与截图。生产构建另行验证，不混计 |
| 独立生产构建/浏览器 | on 10 passed / off 2 passed，0 failed / 0 flaky。双尺寸包含版本竞争、普通键盘、PR2、响应丢失恢复；另有真实空 GET 后递送原 POST、首页真实首发与接续固定摘录的可编辑草稿且不自动发送。[构建 ID 与环境](evidence/pr3-review-repair/production-builds.json)、[on JSON](evidence/pr3-review-repair/browser-on-attempt-identity.json)、[off JSON](evidence/pr3-review-repair/browser-off-attempt-identity.json)、[直接可查看截图](evidence/pr3-review-repair/production-screenshots/) |

完整初次失败输出保留：早期测试断言/类型问题已修复；一次大套件并行冷启动导致两个 worker timeout，这两个文件随后通过，最终全套无该错误。初次浏览器错误包括错误的重试 locator 与冷启动超时。新增生产版本竞争测试还捕捉到 URL 同步覆盖版本 ID，已修复原生打开衔接；新增接续入口测试先出现 JSON 端点已返回对象却再次读取 content 的断言错误，已修正测试断言。最终独立重跑结果在上表记录；不删除首轮记录或用重试次数伪装首次通过。延迟递送浏览器用例首轮误用了必须等待成功 POST 响应的辅助函数，与故意截留请求的前提冲突；改用真实输入/点击并明确等待空 GET 响应，首轮输出保留在 browser-on-attempt-identity-initial。截图复核发现 P01/P02 提前捕获页面加载态，补上页面就绪断言后重新生成截图。收尾新增回归还复现了旧输入消息 request ID 导致新尝试丢响应后可以再次发送的问题，先留下两次 provider 调用的失败输出，再通过原消息身份关联修复；[首次失败](evidence/pr3-review-repair/final-retry-attempt-identity.txt)、[最终通过](evidence/pr3-review-repair/final-retry-attempt-identity-pass.txt)。

故障注入使用真实 daemon POST 受理与 GET run 记录，浏览器分别拦截并丢弃返回响应、在真实受理后返回结构化 500。另一个用例先保留原 POST 内容而不递送，真实 GET 返回空时仍待确认，随后向 daemon 递送完全相同的原请求，再核对原 run；没有用新请求模拟重试。模型端使用既有 fake Agent。它证明请求恢复和真实运行身份，**不证明真实模型的营销专业质量**。AMR/workspace 权限为 provider 与 daemon 测试证据，没有宣称真实外部账户联调通过。没有桌面发布、B2/B3 或新版专业质量评估。

## 可审阅要求与后续门槛

[批准 Spec](specs/Mokina-B0-B1-开发Spec-2026-10-03.md)、[QA 计划](reviews/Mokina-B0-B1-QA-Test-Plan-2026-10-03.md)、[历史决策审查](reviews/Mokina-B0-B1-autoplan-2026-10-03.md) 与[原运行记录](Mokina-B0-B1-运行与验收记录.md)同 PR 可访问。历史批准记录保持原文；本轮实施授权来自当前用户明确请求。

保留 Draft；重新读取远端 head/base 和 checks 后，基于最终提交复审再决定 Ready。没有 CI 检查就记录“没有检查”，不能写“CI 全绿”。八项已证实基线失败不在此范围内顺手修改，也不把本轮工程回归等同 V0.0.2 或桌面交付完成。
