# 切片 A 验收记录（N00 / N01 / N02）· 2026-10-06

分支：`codex/mokina-v0.0.3-a-entry`（基线 e3e8848e = origin/main = V0.0.2 标签目标）。
本文件只记录真实执行结果；所有命令均在macOS arm64 本机实际运行。

## N00｜主干与本地在研工作对齐

- 交付：`docs/mokina-v0.0.3/2026-10-06-N00-alignment.md`（提交 20f9afc7）。
- 核验：3 个 worktree、全部分支、零 tracked 修改、零未推送、零 stash；PR3 所述 V0.3 工作完整定位（方向文档 6 篇 + 设计文档 12 篇 + codex worktree 内在研代码 patch 33 文件 @OpenDesign 7395321，一行不在 main）。
- 裁决：V0.3 支线原样封存不应用；本轮继续 main 主线，版本 V0.0.3；local.6 包（源码 8950986e）与 main/tag（e3e8848e）身份已区分记录。
- 验收：N00-AC01/02/03 全 pass。未跑项：无。

## N01｜产品入口、版本与使用文档

- 交付：README 首屏重写（当前桌面版/开发入口/历史 Demo 折叠 + 版本身份表）、TODOS 标注 B2/B3/B4 已交付并保留 C4/C5/FR-02 原记录、Runbook 顶部当前状态摘要（原文保留）。
- 提交：e64e0d9b。
- 验收：N01-AC01 pass（文档结构）；N01-AC02 pass（依据 V0.0.2 已签收证据，签收包到首次任务无需数据库/storage/API 临时修路；本切片未重跑该流程，重跑在 N08）；N01-AC03 pass（README/Runbook/矩阵三处版本、平台、SHA、摘要一致）。

## N02｜首页到首个真实任务的一体化入口

### 代码改动（提交见本节末）

- `home-hero/chips.ts`：新增 `mokina-landing-page` 快捷入口（用户 pin，非自动默认；点击不启动 run）；加入 CREATE_RAIL_ORDER / HOME_TYPE_ROW_IDS / ONBOARDING_ARTIFACT_OMIT。
- `home-hero/chip-labels.ts`、`HomeHero.tsx`：新 chip 的文案；`HomeHero.tsx` 暂存文件 chip 上新增 Mokina 用途选择（附件/资料/素材，素材含角色+使用说明），仅 Mokina local edition 且扩展名匹配时出现。
- 新增 `runtime/mokina/home-material-snapshot.ts`：纯构建器 `buildHomeMokinaSelections`（整组纳入、24,000 字预算、超出/不可读显式排除、素材 30MiB 预算、part 归一 base groupId）+ `prepareHomeMokinaSnapshot`（复用项目内同一 daemon API `POST /api/projects/:id/mokina/context-snapshots` 与同一 `pending-context-snapshot` 绑定）。
- `HomeView.tsx`：index 对齐的 mokinaFilePlans 状态（删除文件同步清理）、提交载荷携带 `mokinaFilePlan`。
- `PluginLoopHome.tsx` / `EntryShell.tsx` / `App.tsx`：载荷字段透传；App 在上传完成后、auto-send 记录前冻结快照并把 `mokinaSnapshotId` 并入 auto-send context；快照失败不阻塞发送（退回纯附件）。
- `App.tsx`：上传部分失败时把失败文件交回 composer stash（下次回到首页可恢复重试）。
- `material-selection.ts`：扩展名模式提升为共享导出（面板与首页同一套判定）。
- 测试：新增 `tests/runtime/mokina-home-material-snapshot.test.ts`（7 项全过）；更新 `TypePillRow.more-order.test.tsx`（营销行 3 项）。

### 工程验证（全部实际运行）

- `pnpm --filter @open-design/web typecheck`：通过。
- `pnpm guard`：通过（含 web import isolation、test layout 等）。
- 定向 vitest（6 文件 109 项）：全过。基线已红的两项历史失败（`chips.automatic-default`、`HomeHero.rail` 的 Brand Kit 顺序断言）在本分支表现与 main 完全一致（已用 git stash 对照确认非本轮回归，归入 N07 的 22 项历史失败分类）。

### 真实产品验证（N02-AC01/AC03，隔离开发运行时 namespace mokina-n02）

Playwright 驱动真实浏览器走完：首页挂接 `brief.md`（标「资料」）+ `logo.png`（标「素材·品牌标识·页头品牌标识」）→ 模板选择器切「营销方案」输入任务 → 切「活动页」验证输入不丢（44 字保留）→ 提交。

服务端证据（`/tmp/mokina-n02-data` 隔离数据目录）：

- 快照 `.mokina/contexts/df698fa2….json`：items = `material-excerpt: brief.md · 13 个片段` + `asset: logo.png`，excluded 空。
- 回执 `.mokina/deliveries/4a623171….json`：`status: submitted`，`S1 inline-text` + `A1 staged-file`，与快照同 fingerprint 链。
- 素材字节冻结 `.mokina/blobs/c414cd0e…`（70B 与原件一致）。
- 真实 Codex run 产出 `shancha-first-purchase-plan.html`（HTTP 200，54,076 字节，可打开）；运行记录实际 Read brief.md / Read logo.png；成果正文引用「brief.md 第 19 行 品牌主色 #B3392E」「logo.png 与快照素材 SHA256 一致」。
- 截图：`/tmp/mokina-n02-home-plan.png`（首页选择态）、`/tmp/mokina-n02-project-result.png`（项目内成果与「Materials & background」绑定展示）。

结论：首页选定输入与项目内同一套快照/发送机制接通，真实 run 拿到同一批输入并生成可打开成果。N02-AC01 pass；N02-AC03 pass（切入口输入保留；PR3 受理语义相关代码路径未改动）。

### 未跑项

- N02-AC02「只讨论、不出稿」独立抽测：本切片验证了选择 chip 不启动 run、活动页 SKILL 契约为 discuss-first；「只讨论/改话术」开放任务抽测排入 N07（与计划第 6 节任务 C 一致）。
- 上传中途失败恢复的自动化用例：代码路径已实现（stash 交回），未写专项测试，留 N06/N07 补。
- 打包 app 内的 N02 链路：候选包验收在 N08 执行。
