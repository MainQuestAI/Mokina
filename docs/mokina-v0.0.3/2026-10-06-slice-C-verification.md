# 切片 C 验收记录（N05 / N06）· 2026-10-06

分支：`codex/mokina-v0.0.3-c-continuation-workspace`（基线 eab025c8 = 切片 B 合入后的 main）。

## N05｜接续时完整携带选定策略、品牌与素材

### 改动（`FileViewer.tsx` 为主）

- 接续面板新增：素材选择（源项目素材文件 + 角色 + 使用说明）与品牌要求（宿主品牌套件目录，含字数预览）。
- `continueFromSelectedSections`：创建目标项目后、写 `MOKINA-CONTINUATION.json` 前，把选定素材字节从源项目读出并上传到目标项目、连同品牌规则（DESIGN.md 摘要）一起 POST 目标项目的 context-snapshots，成功后 `writePendingMokinaSnapshot` 绑定目标项目（首条显式发送即引用，受理即清语义沿用 N03）；快照失败抛错进既有 catch，journal 保留 checkpoint 与同一个 snapshotId（daemon 幂等），重试不建副本。
- `buildMokinaContinuationV2` 增加可选 `contextSnapshotId`；journal 类型增加同名字段——**JSON 只在快照真实冻结后写入，id 存在 ⇒ 字节已冻结**。
- 未选章节/会话/目录/品牌库不继承（沿用既有语义：prompt 只含选定章节、新会话、designSystemId 默认 null）。

### 工程验证

- web typecheck、guard（22 项）通过；接续 v2/修订恢复/候选比较 3 套件 27 项全过；新增构建器用例 1 项（with/without snapshotId、journal 往返）。

### 真实产品验证（隔离运行时 mokina-n05，真实 Codex run）

驱动流程：活动页场景真实生成可寻址成果（6 个 data-mokina-id 标记）→ 版本面板接续区选定 1 个章节 + logo.png（素材）+ Agentic（品牌）→ 创建接续项目 → 全链 pass：

- 目标项目 `3b9e2192…` 的 `MOKINA-CONTINUATION.json` 含 `contextSnapshotId=7f4f1cef…`。
- 目标项目快照含 `asset:logo.png` + `brand-rule:Agentic · 品牌规则`。
- **删除源项目 logo.png 后**，目标项目发送仍成功交付冻结输入：回执 `logo.png · staged-file` + `Agentic · inline-text`，依据卡可见限制说明。
- 截图：`/tmp/mokina-n05-continuation.png`、`/tmp/mokina-n05-evidence.png`。

验收：N05-AC01 pass（选章+LOGO+品牌一次携带，目标草稿核对固定来源无需重传）；N05-AC02 pass（源删除后快照独立运行，实测）；N05-AC03 pass（源 current 身份入 JSON v2，候选身份沿用 versionState 字段）；N05-AC04 pass by 机制+回归（journal 复用 target/operation/snapshotId、createProject 幂等、RR 恢复 27 项绿）。

未跑项：接续后“成功再接续建第二个同名项目”属发起新接续而非故障副本，语义已确认留档未改；接续快照的 sections-mode（源 HTML 整页冻结）未做（选章已由 JSON+prompt 固定，素材/品牌由快照承载）。

## N06｜成果工作区的日常操作收口

### 改动

- **未处理候选提示（实质缺口）**：`useMokinaProjectSummaries` 行摘要在有未处理候选时追加 `· {n} 个待采用候选`（新键 `mokina.entrySummary.candidates`），rail 行零改动；空成果但存在候选也能提示。
- **i18n 迁移与术语统一**：版本面板/工具栏/`fileVersionSourceLabel`/action-unavailable/`MokinaMaterialPicker` 的全部用户可见硬编码中文迁入 73 个 `fileViewer.mokina.*` 键（types.ts + 19 locale）；入口 tooltip 统一为「版本与导出」；版本语境统一 当前稿/候选稿/历史稿，候选徽标统一为「候选稿」。
- 行为逻辑零改动（纯文案/提示）。

### 工程验证（subagent 实施 + 本代理复核）

- web typecheck、guard 通过；mokina-summaries / 修订恢复 / 接续 v2 / 项目条目 4 套件 57 项全过（新增候选计数用例 3 项）；FileWorkspace/版本下载套件 121 项复核通过。
- 既有失败 1 项确认非本轮引入：`tests/i18n/locales.test.ts` placeholder 对齐（en `homeHero.title` 含 `{word}`，zh-CN 无），HEAD 即如此，归入 N07 分类。

### 真实产品验证

- N06 文案与候选提示在 N05 真实驱动截图中实际呈现（"Versions & export"、"Selected: v1 · Current draft"、采用前不变确认文案等）。
- 1280×720 布局：既有 e2e（mokina-workspace-actions）覆盖本轮未改布局结构；未重跑 e2e（时间成本），留 N08 打包验收一并跑。

未跑项：e2e 全套重跑（N08）；其余历史失败分类（N07）。

## 合并前审查与修复（2026-10-06，独立 subagent 审查 PR #7）

审查结论：无 BLOCKER，5 项 MAJOR 需修复。已全部修复并复验（typecheck 0 错 / 44 项定向测试 / guard 22 项全过）：

| 级别 | 问题 | 修复 |
|---|---|---|
| M1 | 重试重复上传素材，daemon 改名堆积孤儿文件（hero-1.png） | 上传前列出目标项目已有文件并跳过同名；冻结时 daemon 仍重验 digest |
| M2 | uploadProjectFiles 失败被吞，报错滞后误导 | 消费返回值的 failed 列表，立即抛出真实错误 |
| M3 | 目录加载一次性 guard 在请求前置位，瞬态失败永久空目录 | 移除 ref-guard，依赖 continuationPanelAvailable/projectId 触发；失败不置位 |
| M4 | zh-TW 新键混入简体、其余 locale 英文占位 | zh-TW 全部正体化（已核验 0 简体残留）；其余 locale 英文占位为过渡态并在 PR 声明（此前这些界面显示中文，英文占位不构成回退），后续走翻译交付稿 |
| M5 | 接续编排逻辑零自动化测试 | 部分处理：journal 快照 id 往返用例已有；全编排自动化测试记为 N07 待办（本次两次真实链路实测覆盖成功路径） |
| M7 | 前两处 journal 写入丢失 contextSnapshotId | 三处 checkpoint 统一透传既有 id |
| M8 | 改选后重试必现 409 且不可恢复 | 409 CONFLICT 时清除 journal 并给出可操作提示 |
| M9/M6 | 素材/品牌 excluded 静默 | 冻结成功后面板提示未纳入项 |
| M10 | 新错误路径硬编码中文 | 8 个新键进 i18n（types.ts + 19 locale），含面板 clearFailed |
| M11 | 品牌字数无客户端预算校验 | 章节+品牌字数发送前校验 |
| M12 | 品牌预览竞态/0 字闪示 | 序号守卫 |

未修 MINOR（评估后留后续）：raw 读取缓存策略（ETag 已兜底）、orphan -1 文件被资料候选展示（治本靠 M1 已修）、NIT 级代码风格。
