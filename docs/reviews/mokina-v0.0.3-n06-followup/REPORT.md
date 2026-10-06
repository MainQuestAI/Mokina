# Mokina V0.0.3（PR #6 / PR #7）复审报告

- 复审范围：PR #6（N02 Home 资料暂存、N03 发送绑定交接、N04 品牌冻结、N05 接续素材/品牌）+ PR #7（N06 i18n/文案），另核对 N01 场景包是否在本 diff 内。
- 复审基准：主 checkout `/Users/dingcheng/Coding-Project/02-key-project/Mokina`，diff 范围 `e3e8848..ace21d01`（108 文件，+11655/-293）。
- 方法：通读关键改动源码、与基线（`git show e3e8848`）比对区分回归/遗留、脚本化核验 i18n、跑相关单元测试。e2e 未实际运行（只读复审，静态核对选择器）。

## 汇总

| 级别 | 数量 | 主题 |
| --- | --- | --- |
| P1 | 4 | N02 部分上传失败丢整份快照；N04 品牌读源分叉；N04 冻结路由无品牌读授权；e2e 选择器回归（测试缺陷） |
| P2 | 4 | i18n 残留硬编码 ×2；pending 快照清理竞态；续传重试重复上传 |
| P3 | 6 | journal 字段不一致、预算守卫竞态、workspaceContext 不一致、面板闪现、excluded 无 UI 面、基线遗留硬编码 |

总体判断：N03 发送绑定交接链路（恢复→引用→受理清理→重发）闭环成立，daemon 快照幂等/预算/冲突处理设计扎实；但 N02 与 N04 各有一条真实功能/安全缺陷，且 PR #7 的 e2e 更新引入了一个在任何 locale 下都不匹配的选择器，说明该 e2e 迁移后未跑绿。建议修复 P1 后放行。

## P1

### P1-1（N02）Home 部分上传失败时，整份 Mokina 快照被静默丢弃

链路：`App.tsx:3423` 起，部分上传失败时只把失败文件 re-stash 回 Home 暂存（`stashHomeComposerAttachments`），但 `App.tsx:3449-3456` 把**未按上传结果过滤**的 `input.mokinaFilePlan` 交给 `prepareHomeMokinaSnapshot`。在 `home-material-snapshot.ts:135-160`，素材（asset）计划的 digest 取自本地 `stagedFiles`（`App.tsx:3196-3199`，等于全部已选文件，不过滤上传成败），因此上传失败的素材仍会生成 selection；daemon 冻结时读不到项目文件（`context-store.ts:315-320` 返回 `文件不存在`），`prepareMokinaContextSnapshot` 在 `context-store.ts:513-514` 直接以 409 终止**整个** POST。web 端 `home-material-snapshot.ts:237` 收到非 ok 即返回 null，`App.tsx:3457-3462` 仅 `console.warn`。

后果：一个文件上传失败 → 用户精选的全部资料/素材/品牌快照整份丢失，发送以普通附件继续，且无任何 UI 提示。与「不可冻结项应进 excluded 并给出原因」的设计（`buildHomeMokinaSelections` 自身的 excluded 语义）相违。

建议：按 `failedNames` 过滤传入的 plans（失败文件记入 excluded 并提示），或让 daemon 把缺失项降级为 excluded 而不是整单 409。

### P1-2（N04）品牌冻结端读源与详情路由分叉：团队版 `user:` 品牌冻不住

详情路由 `GET /api/design-systems/:id`（`design-systems.ts:661-676`）经 `readAvailableDesignSystem`（`design-systems/server-services.ts:460-484`）读取：对 `user:` 前缀 id 先试**团队工作区根** `teamResourceWorkspaceRoot(USER_DESIGN_SYSTEMS_DIR, workspaceId)`（含 `exactTeam` 短路），再回退 canonical 用户根（含 `designSystemUserReadOptions` 绑定过滤）。

而冻结端（`routes/project/index.ts:7318-7365`，N04 新增）的回退链只有：工作区项目镜像（需注入 `listAllDesignSystems`/`readDesignSystemWorkspaceTextFile` 且有 workspaceId）→ `DESIGN_SYSTEMS_DIR` → `USER_DESIGN_SYSTEMS_DIR`（含 `user:` 前缀）。**不覆盖 team-scoped 根、不处理 `exactTeam`**。

后果：团队工作区中仅存在于 team-scoped 根的 `user:` 品牌（无项目镜像时），详情接口能读、面板能取 digest，冻结端却报「品牌来源不存在」（missing）或因读到不同来源而 SOURCE_CHANGED，N04 在团队场景不可用。

### P1-3（N04）冻结路由对品牌来源不做读取授权，绕过 `authorizeDesignSystemRead`

`POST /api/projects/:id/mokina/context-snapshots`（`routes/project/index.ts:7287-7291`）只做 `authorizeProjectRequest(..., { mode: 'write', capability: 'writeFiles' })`——校验的是**项目**写权限。品牌字节读取（`readDesignSystem` 回调）没有任何品牌侧门控：无 `authorizeDesignSystemRead`（详情路由 `design-systems.ts:663` 有），也无 `designSystemUserReadOptions` 绑定检查（`server-services.ts:475-479` 的 canonical 用户根读取有）。

后果：任何对某项目有写权限的调用方，可凭 design-system id 把本无权读取的（其它 workspace 的）品牌 `DESIGN.md` 内容冻进该项目快照，等于经快照接口 exfiltrate 受门控资源。与 P1-2 同源：冻结端应复用详情路由的读路径（含授权），而不是另写一条更宽的新链。

### P1-4（PR #7 测试缺陷）e2e 选择器在任何 locale 下都不匹配

提交 `c33ab447`（"update e2e click targets after N06 i18n migration"）把 `e2e/ui/mokina-workspace-actions.test.ts:105` 的选择器从 `创建接续项目（不发送）` 改为 `Create continuation project（不发送）`。但实际文案：

- en（`en.ts:5567`）：`Create continuation project (no send)`（半角括号、英文后缀）
- zh-CN（`zh-CN.ts:5998`）：`创建接续项目（不发送）`
- zh-TW（`zh-TW.ts:6005`）：`建立接續專案（不發送）`

按钮文案就是 `t('fileViewer.mokina.createContinuation')`（`FileViewer.tsx:5317`），无 e2e mock 覆盖（已查 `e2e/lib`）。新选择器是英文标签拼中文全角括号后缀，**三个 locale 都不匹配**；同一文件其余选择器仍为中文（`修订章节`、`继续制作` 等），说明套件跑 zh locale，该行确定性超时失败。此缺陷同时证伪了「e2e 已随 i18n 迁移更新」的验证声明——迁移后未跑绿。产品代码本身无问题，修一行选择器即可。

## P2

1. **i18n 残留（N04 新增）**：`MokinaContextPanel.tsx` 新增的 `<option value="">不使用品牌规则</option>` 未走 i18n，而同文件其他串已在 N06 迁移——N06 范围内自相矛盾。
2. **i18n 残留（N02 新增）**：`HomeHero.tsx` 新增下拉项 `附件/资料/素材/品牌标识/主视觉/辅助素材/使用说明` 及 aria-label 硬编码中文。与 Home chip 既有硬编码模式一致，但与 N06「文案入 i18n」方向不一致，建议同批补齐。
3. **pending 快照清理竞态**：`clearPendingMokinaSnapshotIfCurrent` 是 check-then-act（读 localStorage → await 删 durable → 删 localStorage），与 `writePendingMokinaSnapshot`（先写 durable 再写 localStorage）交错时，受理清理可能误删用户刚冻结的新绑定。窗口极小（需清理 in-flight 时用户恰好完成新冻结），但后果是新绑定静默丢失。
4. **接续上传重试可能重复上传**：`FileViewer.tsx` 重试路径 `fetchProjectFiles(...).catch(() => [])`，列表失败时按空集合处理 → 已传文件被重传（daemon 侧重命名为 `hero-1.png` 之类，digest 校验仍通过，不会双冻结，只污染项目文件列表）。

## P3

1. `FileViewer.tsx` 接续流写 `MOKINA-CONTINUATION.json` 后的 `storeJournal('snapshot-saved')` 未展开 `contextSnapshotId`（与前两处 journal 写入不一致）；崩溃重试会新发 snapshot id，浪费但无害（daemon 幂等按 fingerprint 去重）。
2. 品牌预算前端守卫依赖 `continuationBrandPreview.chars`，预览未加载完时为 0 可绕过；daemon 413 兜底，仅影响提示时机。
3. `MokinaRunEvidence.tsx`：`fetchChatRunStatus(runId)` 未传 workspaceContext，而快照 fetch 传了——团队工作区下可能鉴权失败；receipt 拉取无重试（时序上 receipt 在准备期写入，可接受）。
4. `MokinaContextPanel.tsx`：品牌目录加载中且无资料文件时，面板会先闪现再消失。
5. Home 快照的 excluded 项（unreadable/budget）写进了 pending snapshot 记录，但没有任何 UI 面呈现给用户，用户不知道哪些文件没进快照。
6. 基线遗留（非本次回归，已用 `git show e3e8848` 确认）：`FileViewer.tsx:4419/4421/4606` 的 `请先选择至少一个章节。` 等硬编码中文。

## 核对记录

### i18n（N06，方向正确、数据干净）

- 脚本核验：`types.ts` 含 187 个 mokina 相关 key（正则兼容单/双引号）；**19/19 个 locale 文件与 `types.ts` 完全一致**；代码中 165 个 `t('...mokina...')` 引用全部存在。
- zh-TW 此前缺漏已修复（如 `fileViewer.mokina.actionRevision: "修訂章節"`）。
- en 的 `createContinuation`/`adoptCandidate` 为纯英文（`en.ts:5567-5568`），无中英混杂（复审前摘要中的猜测已证伪）。
- 残留硬编码见 P2-1/P2-2、P3-6。

### daemon 快照存储（N05，设计扎实）

- `prepareMokinaContextSnapshot`（`context-store.ts` ~475 起）：同 fingerprint → `reused: true`；同 snapshotId 不同选择 → 409 `MOKINA_SNAPSHOT_CONFLICT`（web 端 `FileViewer.tsx:4547` 清 journal 提示重发）；预算守护在 daemon（摘录 >24,000 UTF-16 / 素材 >30MiB → 413）；项目文件读不到 → 整单 409（见 P1-1 的连带影响）。

### N02/N03 发送绑定交接（闭环成立）

- `ChatComposer`：`restoredMokinaSnapshotRef` 在队列取回（restoreDraft）时从 `meta.context.mokinaSnapshotId` 恢复，发送优先用原 id；`reset()` 在除 `restore-draft` 外的所有结果清空 ref → 无陈旧双重绑定。
- `ProjectView`：受理即清——`onRunCreateAccepted`（:8746）与迟到对账 `reconcileAcceptedSendRun`（:8495）均调 `clearPendingMokinaSnapshotIfCurrent`（带 id 比对）；`resendPendingSendRecord` 透传 `snapshot.extras.context`；send-recovery 记录（:9165）已含 `mokinaSnapshotId`。
- Home 自动发送：`App.tsx` 把 `homeMokinaSnapshotId` 写入 `od:auto-send-context:` sessionStorage，走同一发送管线 → 同样被受理清理覆盖。
- 普通刷新恢复的草稿不持久化 mokinaSnapshotId，靠 `withPendingMokinaSnapshot` 重绑 pending key，语义正确。

### N06 其他

- `contracts/src/api/chat.ts` +6 行：`ChatRunStatusResponse.mokinaContext?: MokinaContextDeliveryReceipt | null`，纯加字段，无兼容性问题。
- `useMokinaProjectSummaries.mokinaArtifactLineFromRecord` 追加候选后缀（`mokina.entrySummary.candidates`），`candidateCount` 取自既有 summary 记录字段，empty/legacy 态也拼接（可接受）。

### N01 场景包

- 本 diff 范围（`e3e8848..ace21d01`）不含 `plugins/_official/scenarios/mokina-*/SKILL.md` 改动（三个场景包文件均为既有），SKILL.md 内也无 `docs/reference/rebrands/*/REBRAND.md` 引用，无需核对。

### 测试执行

在 Node 24（仓库要求 `~24`）下运行：

- web（`apps/web`）：`npx vitest run tests/runtime/mokina-pending-context-snapshot.test.ts tests/runtime/mokina-home-material-snapshot.test.ts tests/components/MokinaContextPanel.brand.test.tsx tests/components/MokinaRunEvidence.test.tsx tests/components/file-viewer-continuation-v2.test.ts` → **5 文件 24/24 通过**。
- daemon（`apps/daemon`）：`npx vitest run tests/mokina-context-store.test.ts tests/mokina-context-routes.test.ts` → **2 文件 20/20 通过**（含 409 冲突、SOURCE_CHANGED、413 预算、404 发布等用例）。
- 注：首次在 Node 22 下跑 daemon 测试时 `better-sqlite3` 因 NODE_MODULE_VERSION 不匹配（137 vs 127）加载失败，属本地环境 Node 版本问题，切到 Node 24 后全绿，非产品回归。
- e2e（Playwright）未运行；静态核对发现 P1-4。

## 结论

功能主线（N03 绑定交接、N05 幂等快照、N06 i18n 数据）质量良好，相关单元测试全绿。但存在 4 条 P1：N02 部分上传失败会静默丢失整份快照、N04 品牌冻结在团队场景读源分叉且缺少品牌读授权门控、PR #7 的 e2e 迁移引入了必挂的选择器。**建议修复 P1-1～P1-4 后放行**；P2 建议本迭代内一并处理（两条 i18n 残留与 N06 目标直接相关）；P3 记录跟踪即可。
