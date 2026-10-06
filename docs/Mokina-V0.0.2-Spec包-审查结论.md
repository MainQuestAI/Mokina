# Mokina V0.0.2 Spec 包审查结论

日期：2026-10-04
审查对象：`Mokina-v0.0.2-Local-Preview-Spec-2026-10-04.zip`（SHA-256 `eebc0b5c…521e5e`，SHA256SUMS 全部通过）
结论：**规划方案整体可作为开发输入，源码声明抽查全部属实；但 PR3 基线在 Spec 撰写当天已漂移 9 个提交，其中包含对发送状态机的语义修改，T00 重钉基线不是形式步骤而是必须实质执行；另有 5 处验收门禁映射缺陷需要在实施前修正。**

## 1. 证据范围与边界

- 已通读包内全部 12 篇文档、Codex 执行提示词、`backlog.json`/`acceptance.json`/`sources.json`、4 份 JSON Schema、`mokina-local.ts`、全部 examples 与 fixtures。
- 在干净 venv 中安装 jsonschema 后复跑 `scripts/validate_spec.py`：**通过**，输出与包内 `VALIDATION.md` 声明一致。
- 通过 gh 与本地 git（origin = MainQuestAI/Mokina）核查 PR3 实时状态，并在固定 SHA `53da96c` 上抽查 Spec 的关键源码声明。
- 未运行 Mokina 产品、未构建、未做全仓审计；本结论是对规划包的审查，不是产品验收。

## 2. 最新 PR 基础情况核查（本次审查的核心外部事实）

| Spec 声明 | 实时核查结果 | 结论 |
|---|---|---|
| PR3 open / draft / 未合并 | 今日核实：OPEN、isDraft=true、未合并，mergeStateStatus=CLEAN | 属实，仍成立 |
| PR base `33fa8434` | 与 origin/main HEAD 一致（PR2 合并点），main 未越过 PR3 base | 属实 |
| 规划基线 `53da96c` 为 PR3 head | **已漂移**：PR3 head 现为 `df4a0b2`，更新于 2026-10-04（Spec 落款日当天） | 需重钉 |
| PR3 无 GitHub checks | `gh pr checks`：no checks reported | 属实 |
| PR3 测试 12,726 pass / 8 fail / 1 expected fail / 11 skipped 为作者声明 | PR 正文原文一致，且 PR 正文自己写明"不能称全套全绿" | 引用忠实 |

基线漂移内容（`53da96c..df4a0b2`，9 个提交，即 PR3 的 "R2 修复轮"）：

- 代码改动集中在 `send-request-state.ts`（+56）、`ProjectView.tsx`、`EntryNavRail.tsx`、`useMokinaProjectSummaries.ts`、19 个 locale 文件及配套测试；约 2.1 万行是证据日志。
- 语义变化：pending 发送新增**显式重发/丢弃出口**；in-flight 容量口径调整；**oversize 硬门改为 preview-only 收据**；B0+B1 Spec 的 FR-08/FR-09 被收窄为"仅禁止自动重发"。
- **对 Spec 的影响**：Spec §6.4 的发送状态表和 T03/T11 所依赖的"PR3 受理语义"描述的是 R2 之前的状态。变化方向与 Spec 目标一致（显式新尝试、禁止自动重发），不构成否定，但 T00 必须按 Spec 自己的要求重读 R2 后的实现，并更新 §6.4 的语义描述；oversize 口径变化与 §6.4"payload 服从既有容量限制"的衔接要在 T03 确认。
- 缓冲事实：`FileViewer.tsx`、`materials.ts`、`packages/contracts` 在 R2 delta 中未改动，Spec 的 S10/S11/S12 行锚与 S06/S07/S08 声明在当前 head 仍然有效。

## 3. 源码声明抽查（固定 SHA `53da96c`，全部属实）

| Spec 声明 | 抽查结果 |
|---|---|
| `generateChapterCandidate()` POST `/api/runs` 不携 clientRequestId，runId 返回后才存 job（S10，Spec 列为本轮优先修复） | 属实。POST body 仅含 agentId/projectId/conversationId 等；operationId 在响应后生成 |
| `materials.ts` 七类解析、10MiB 单件、150,000 字符总量、8,000 片段、pdftotext（S06） | 属实，逐条在代码中命中 |
| `RunContextSelection` 无快照字段（S08） | 属实 |
| 版本面板 HTML 导出按钮受 `selectedVersion.current` 限制（S12） | 属实 |
| candidates/adopt/`expectedCurrentVersionId`/`replaceHtmlSection` 已有（S07） | 属实，位于 daemon 侧（project-file-versions、routes/project、mokina/sections） |
| createProject 支持调用方显式 ID 且幂等（S11 接续恢复的前提） | 属实，web `state/projects.ts` 注释明确"idempotent, never a duplicate project" |
| 冻结设计 manifest 21 文件、项目 `mokina-v0-0-2-4c39`（S16） | 属实 |
| 两个手动场景插件与 `report-contract.md` 存在（S09） | 属实 |
| TODOS.md 将 B2/B3/B4 后置、FR-02 不做假活动页入口（S05） | 属实 |
| 19 个 locale（AC47） | 属实，目录实测 19 个文件 |

## 4. 包内一致性核查

通过项（含我独立重算，非仅复述其校验器）：

- 任务 DAG 无环；20 任务 × 57 验收用例双向互链无缺失；R01–R24 均有任务承接；文档 08/09 表格与 backlog/acceptance JSON 逐格一致。
- TS 契约与 4 份 JSON Schema 字段一致；24,000 UTF-16 预算、20 条目上限落入 schema（maxItems=20）；示例指纹、摘录摘要、恢复包字节校验均可复算通过；任务 C 的期望值可由 CSV 独立重算（Decimal），且 expected-metrics 未泄进任务输入。
- 证据纪律合格：全部 AC 为 not_run、任务为 planned，无伪造的"已通过"。

发现的缺陷：

1. **P1｜基线已漂移且涉及发送语义**（见第 2 节）。Spec 已预见并写了 T00 重钉，但 §6.4/§5.3 的描述文本仍按 R2 前语义写成，实施时须先更新，否则 T03/T11 会按过期状态机理解"既有容量限制"与重发出口。
2. **P2｜5 处验收门禁与任务门禁倒挂**：AC16、AC23 挂在 G2 但链接 T15（G5）；AC41、AC42 挂在 G4 但链接 T15（G5）；AC28 挂在 G3 但链接 T17（G5）。门禁退出时这些用例的依赖任务尚未到收口切片，G2/G3/G4 将无法干净退出。修正方案任选其一：把这些 AC 改挂最迟任务门禁；或把 T15 中快照权限/恢复包防篡改等检查前移到对应切片（AC 主题本就属于 G2/G4）；或在 AC 上显式标注"G2 初验 / G5 终验"。包内校验器不检查此维度。
3. **P3｜9 个 AC 的需求标注越出其链接任务的需求集**（如 AC07/AC12 标 R17 但不链 T03/T12/T19，AC54 标 R06 但链 T00/T17）。每个需求仍至少有一个正确锚定的 AC，覆盖没有洞，但追溯噪声会在按需求查证据时误导。建议实施前清理或注明为"附加证据"。
4. **P4｜轻微文档失准**：§5.1 引用的 `docs/prompt-composition.md` 实际路径为 `open-design/docs/prompt-composition.md`；§4.4 快照条目字段列表写 `selection`，契约与 schema 实际为 `locators`（文本）/blob 字段（素材），`ContextSelection` 是请求侧类型。不影响实施，建议顺手修正。

## 5. 与 V0.0.1 复审结论（2026-09-23）的对照

上轮要求的八项修正全部有承接：候选不推进 current（R12/T11/T12 + 原生 CAS）；指定版本导出用 frozenContent、缺冻结资源必须警告（R16/T13/§7.1）；资料"上传≠解析≠选入≠注入≠理解"（R07–R09/§2.3/§4.6）；场景绑定要核对双实现路径而非只改 prompt 文件（T08/§5.1）；选择性接续只带固定摘录（R13/T09/§5.5）；停用上游更新/遥测/商业入口并按真实出站检查（R02/T01/T04/AC03/AC55）；旧能力按块迁移已完成（materials.ts 等已在仓内）；完成标准区分源码可复现与真实桌面（G1/G6 真实 Mac、不宣称公证分发）。

一处**有意的口径收窄**需要知晓：V0.0.1 复审要求选择性接续"不挂接原项目目录、不恢复原 session"并核验工具读取范围；本 Spec §4.6 明确将其定位为**应用层主动传递契约，而非新增硬隔离沙箱**，并要求"不能在 UI 宣称建立了新的硬隔离安全边界"。这是更诚实的表述，但严格程度上低于上轮复审的字面要求，属于有披露的范围决策，实施与验收时按本口径执行即可，不必回溯伪装成硬隔离。

## 6. 规划质量评估

优点：桌面纵向切片提前到 S1（纠正了把打包/数据隔离留到最后的风险）；故障注入用例覆盖丢响应、半创建、迟到输出等真实失败面；契约全部加法且向后兼容；预算常量与既有代码（24,000 字符章节上限）对齐；拒绝 mock 抵扣真实验收、用户签收不由 Agent 代签。

风险：G5 收口偏重（T15 安全、T16 八视图/i18n、T17 回归终验同门退出），结合第 4 节的门禁倒挂，G5 存在挤压风险；T19 用户签收是唯一"已交付"路径，排期需预留用户时间；本轮 24 需求/20 任务体量不小，建议按切片独立合并的策略严格执行，不要为了赶 G6 把 S5 内容降级。

## 7. 结论与建议

1. **通过，附条件。** Spec 包的事实基础经抽查全部属实，包内一致性好，可直接作为开发输入。
2. 实施前先做两件事：把规划基线重钉到 PR3 当前 head（`df4a0b2`，或 T00 执行时的最新值）并按 R2 语义更新 §6.4；修正第 4 节 P2 的五处门禁映射。P3/P4 可并入 T00 一并清理。
3. T00 产出的 implementation-map 应把"PR3 R2 修复轮差异核对"列为第一项；Spec 的 S02–S18 来源 URL 仍钉在旧基线上，逐条核对时注意行锚可能漂移（本轮实测 FileViewer/materials/contracts 未动）。
4. 本审查未重跑产品测试、未验证 PR3 的 8 项既有失败签名；这些仍是 Spec 内 T00/T17 的待办，不由本结论替代。
