# Mokina PR #3 R2 修复记录（发送闭环与成果入口）

日期：2026-10-04。范围：B0+B1，保持 Draft。方案见[修复方案 R2](Mokina-B0-B1-PR3-修复方案-R2-2026-10-04.md)，对应第二轮审查（对 head `53da96c`）的 P1-1、P1-2 与 P2-1～P2-3。

固定边界：base `33fa8434d14869ab4310d8b0f570116781d34c8d`；本轮起点 `53da96c`（第一轮修复后 head）。本轮提交（按序）：
后续追加：`4812a62` test(mokina): 浏览器轮（dev 10 passed；生产 16 passed，含双尺寸导航；round-1 用例对准 R2 提示条动作）。

| 提交 | 内容 |
|---|---|
| `bfe85b1` | docs: R2 修复方案 |
| `d67af24` | test(mokina): F1 红测（14 failed / 13 passed，[red-tests.txt](../open-design/docs/evidence/pr3-review-repair-r2/red-tests.txt) 同目录证据） |
| `af74e51` | docs(spec): FR-08/FR-09 收窄为「禁用自动重发」，补 R2 验收项 |
| `61b1c4e` | fix(mokina): F1 发送闭环 |
| `0157543` | test(mokina): F2 红测（3 failed / 21 passed） |
| `92b7033` | fix(mokina): F2 成果入口（含 F2.1 组件级红测移除，见下） |

## 审查逐项处置

### P1-1 「待确认」死路 — 已修（61b1c4e）

- 显式出口：unknown 记录上有完整快照且无需重选上下文时，提供〔重新发送〕——先只读核对（查到受理直接走统一恢复，不发 POST），查不到以**原 clientRequestId + 已存完整快照**走正常发送管线；服务端按既有幂等裁决（同内容 202 reused 复用原 run，不同内容 409 → 转可编辑草稿并保留完整正文）。所有 unknown/draft 记录提供〔放弃这条〕（附「服务端可能已受理」提示），仅清除本机记录并解除重试拦截。
- 重发的守卫放行是一次性的（meta.explicitResend），普通重试与换模型的拦截不变；快照保存以 `allowExisting` 重写同 ID 记录（不计容量）。
- 挂载对账与重发核对提取为共享的 `reconcileAcceptedSendRun`，恢复行为只有一份实现。
- 8 条上限只统计 in-flight（pending）；unknown/draft 不再阻断新发送。新增每 scope 24 条软上限：到顶不拒发、不淘汰，仅降级为无可恢复快照。
- 大小上限（正文 >64Ki、批注 >20、附件 >50、extras 收窄/超限）不再拒发：保存返回三态 `saved / skipped / failed`，只有存储写异常（`failed`）保留「撤回乐观消息、还草稿、不 POST」（Spec §10 原义）；`skipped` 照常发送并写预览凭据（丢失响应仍可按 clientRequestId 核对恢复），提示「刷新后无法自动恢复」。

### P2-1 首次打开标记 — 已修（92b7033，验证分层见下）

`hasAppliedInitialPrimaryOpenRef` 后置到 workspace 分支真正找到主文件之后（与非 Mokina 分支既有顺序一致）。文件列表晚到或为空时 effect 保持可重入，首个正式成果/唯一正式成果出现后仍会自动打开。

**验证诚实记录**：组件级红测（`ProjectView.mokina-initial-open-empty.test.tsx`，红测提交内）在 jsdom 中无法驱动文件到达——chokidar/coalesced 文件重取路径（`useCoalescedCallback` + `refreshProjectFiles`）在 harness 中不回流到 `projectFilesSnapshot`（多轮插桩：effect 存活、store 重读启动，但快照不更新），且 run 完成路径的 turn-artifact 自动打开会掩盖标记行为，无法构造有区分度的断言。该测试随修复提交移除；本项验证层级为代码走查（与非 Mokina 分支同序）+ ProjectView 全量回归（1759 passed）+ **浏览器验收（空项目首开）留待 F2.4 浏览器轮**，不宣称已完成浏览器复核。

### P2-2 旧项目「未确认采用」不显示 — 已修（92b7033）

摘要订阅增加 `entryHints`（来自项目自带 `metadata.entryFile`，daemon 两条列表路径均已返回，无新增请求）；提示变化触发一次复核（走既有 ≤2 队列）。旧项目行显示「entryFile · Legacy entry (adoption unconfirmed)」。

### P2-3 截断显示失败态 — 已修（92b7033）

store 记录保留 `htmlCount`（HTML 总数）；`truncated` 与 `partial` 拆分：截断显示「共 {count} 个 HTML · 未完整读取」（中性 `truncated` 态，无 `is-unreadable`），部分读取失败仍为失败文案。新增词条 `mokina.entrySummary.htmlCount`（{count} 占位），Dict + 19 locale 同步，`i18n:check` 通过。

### P3 三项 — 按方案仅记录

聚焦重读、明确拒绝后的重复发送、跨标签页误判：本轮未改动；P3-2 的生产构建实测随浏览器轮执行。

## 验证与证据层

所有命令在 `open-design/` 执行；**Node v24.15.0**（与第一轮一致）、pnpm 10.33.2。日志在 [evidence/pr3-review-repair-r2](../open-design/docs/evidence/pr3-review-repair-r2/)。

| 层级 | 结果 | 证据 |
|---|---|---|
| F1 红测（修复前） | 14 failed / 13 passed | red-tests.txt |
| F1 定向绿 | 5 文件 66 passed | f1-targeted-green.txt |
| F1 ProjectView+chat runtime 扫描 | 114 文件 1,406 passed | f1-pv-sweep.txt |
| F2 红测（修复前） | 3 failed / 21 passed | f2-red-tests.txt |
| F2 + 回归扫描 | 152 文件 1,759 passed | f2-sweep.txt |
| typecheck（web） | 0 error（F1、F2 各一次） | f1/f2-typecheck.txt |
| i18n:check | 通过（F1、F2 各一次） | f1/f2-i18n.txt |
| guard | 通过（61b1c4e 与最终 head 各一次） | f1-guard.txt、r2-guard-final.txt |
| Web 全套（v24.15.0） | 1,249 文件：**12,747 passed / 8 failed**（名单与第一轮 [baseline-failures.json](evidence/pr3-review-repair/baseline-failures.json) 的 8 项既有基线失败完全一致，零新增）/ 1 expected fail / 11 skipped | r2-web-full.txt |
| 浏览器 · 开发构建故障注入 | 10 passed / 0 failed（R2 六项 + round-1 恢复用例） | r2-e2e-dev.txt |
| 浏览器 · 生产构建（OD_WEB_PROD=1, server output） | **16 passed / 0 failed**，含 1440x900 / 1280x720 双尺寸导航与 R2 六项 | r2-browser-production.txt、[汇总](evidence/pr3-review-repair-r2/r2-browser-summary.json)、附件（JSON+截图）browser-attachments/ |

环境备注：首次全套在 Node v22.22.3 下跑出第 9 项失败（FileWorkspace design-system 下载，undici `Response.stream` 行为差异）；该失败在 53da96c（本轮改动前）同样复现，且在 v24.15.0 下消失（21/21），确认为环境差异而非本批回归，证据见 r2-web-full.txt（v24 终版）。

## 与验收清单的对照（审查 F1/F2 第 4 点）

| 验收项 | 本轮状态 |
|---|---|
| 服务端没收到请求时，从待确认走到重发成功 | 组件测试 ✅ + **浏览器 ✅**（真实 daemon：两次 POST 同一 clientRequestId、唯一 run、无重复用户消息；r2-resend-never-received.json） |
| 服务端已收到时重发，不会多出第二个任务 | 组件测试 ✅ + **浏览器 ✅**（查询先行恢复，postCount 恒为 1、单 run；r2-resend-after-terminal.json） |
| 409 转可编辑草稿、保留完整正文 | 组件测试 ✅（重发路径） |
| 连续 9 次断网后仍能发新消息 | store 层 ✅（unknown 不占 in-flight 容量）+ **浏览器 ✅**（放弃/恢复路径解除拦截后照常发送；r2-discard-recovery.json） |
| 100K 正文、25 条批注发送成功 | 组件测试 ✅ + **浏览器 ✅**（100Ki 照常 POST、全文落库、无 saveFailed；r2-oversize-send.json；25 条批注为组件层覆盖） |
| 空项目首个生成文件自动打开 | **浏览器 ✅**（生产构建；r2-empty-first-open.json） |
| 旧项目显示「未确认采用」 | 组件测试 ✅ |
| 12 个 HTML 项目侧栏不显示失败 | 组件测试 ✅（中性计数、无 is-unreadable） |

## 保持 Draft 的复审入口

以最终提交（4812a62 或更新）为准重读 base/head 差异。PR 上没有 CI 检查——结论只能写「已执行本地命令」，不能写「CI 全绿」。八项既有基线失败不在本批范围。证据文件（截图/PDF）此后单独存放或只提交摘要加哈希，避免 PR 体积继续膨胀（方案 §6 第 5 条）。
