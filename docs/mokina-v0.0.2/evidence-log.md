# V0.0.2 Local Preview · 证据记录（持续更新）

规则：只记录实际执行过的命令与结果；未跑的项明确写 `not_run`，不以文档推测代替。

## T00 基线与实现映射

| 证据 | 结果 |
|---|---|
| 分支/工作树 | `codex/mokina-v0.0.2-local-preview` @ `df4a0b2`；`Mokina-worktrees/v0.0.2-local-preview`；起点 = PR3 head（含 R2 修复） |
| 环境 | macOS 27.0.1 arm64；node v24.12.0；pnpm 10.33.2（corepack shim 见 `baseline.md`）；codex-cli 0.160.0 |
| 依赖 | `corepack pnpm install --frozen-lockfile` exit 0 |
| 产出 | `docs/mokina-v0.0.2/baseline.md`、`implementation-map.md`；提交 `a6cc708` |

## T01 产品身份 profile

| 证据 | 结果 |
|---|---|
| 改动 | `packages/release/src/mokina-product.ts`（新增）+ index 导出；`tools/pack` `resources/mokina-product.json`、`config/product-profile.ts`、`mac/identity.ts`、`mac/paths.ts`、`mac/builder.ts`、`mac/app.ts`；`apps/packaged` `config.ts`、`window-title.ts`、`sidecars.ts`、`index.ts`、`headless.ts` |
| 单测 | release 9/9；tools/pack 44 文件 339 pass/8 skip（含新增 identity/mac render 用例）；packaged 23 文件 334 pass（含 window-title 用例） |
| typecheck | `@open-design/release`、`@open-design/tools-pack`、`@open-design/packaged`、`@open-design/desktop` 均 exit 0 |
| guard | `pnpm guard` exit 0 |
| 未跑 | 真实 `tools-pack mac build` 产物检查（Info.plist/包内 config）→ 归入 T18；AC02/AC03 的 network-inspection 断言归 G1/T18 |
| 提交 | `cbc030d` |

## T03 稳定桌面存储

| 证据 | 结果 |
|---|---|
| 改动 | desktop：`main/mokina-recovery-store.ts`（新增；CAS/单写者/原子写/键白名单/容量上限）、`main/runtime.ts`（4 个 IPC，sender 校验）、`main/preload.cts`（`recoveryStore` 桥）；host：`protocol.ts` 类型 + index 导出；web：`runtime/persistence/mokina-recovery-store.ts`（新增 facade：镜像/CAS 重试/hydration 不覆盖本地较新值）、`composer-draft.ts`、`send-request-state.ts`、`ChatComposer.tsx`、`ChatPane.tsx` 写入点镜像、`App.tsx` 启动 hydration |
| 单测 | desktop store 10/10（含并发 CAS、损坏记录、容量、跨实例持久）；web facade 5/5（无桥 no-op、CAS 更新、删除、hydration 不覆盖、once-per-session） |
| 回归 | desktop 52 文件 498 pass；web 受影响 6 文件 59 pass（send-request-state / composer-draft / draft-persistence / quote-send / next-step / facade） |
| typecheck | web、desktop exit 0 |
| 未跑 | 真机 IPC 联调（打包后验证跨端口恢复）→ 归入 T18/T19；AC09/AC10 故障注入待桌面包可用后执行 |
| 提交 | 见下（本次提交） |

## 待办（诚实清单）

- T02 打包依赖闭包：需真实 `tools-pack mac build`；未开始。
- T04 Codex 连接诊断：待核验既有实现后决定增量。
- T05–T14：未开始。
- T15–T19：未开始；T19 用户签收为 not_run（必须用户本人完成）。

## T05 资料解析器版本 + PDF 包内依赖（服务端）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `ProjectMaterialExtraction.parserVersion?`；daemon `src/pdftotext.ts`（`OD_PDFTOTEXT_PATH` 优先、PATH 回退、`runPdftotext`）；`mokina/materials.ts` 绑定 `MOKINA_MATERIAL_PARSER_VERSION` 并走统一解析入口；`document-preview.ts` 同源解析 |
| 单测 | `mokina-materials` 6/6（新增 parserVersion、路径优先级、PDF 失败不冒充正文） |
| 未跑 | tools-pack 打包 pdftotext + dylib + 许可证、清洁 PATH 验证（AC14 打包侧）→ 归入 T18 |
| typecheck | daemon 0 error |

## T06 不可变上下文快照（服务端）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `api/mokina-context.ts`（快照/选择/回执 DTO + 错误码 + 预算常量），`RunContextSelection.mokinaSnapshotId`（含 daemon 镜像 normalize/merge）；daemon `mokina/context-store.ts`（规范 JSON 指纹、来源重读校验、原子写、内容寻址 blob、幂等/冲突、预算、损坏检测、delivery 回执、prompt 块）；路由 `POST/GET /api/projects/:id/mokina/context-snapshots`；受理注入 `chat-run-context.resolveMokinaSnapshotForRun` → server.ts 启动路径注入 + submitted 回执，OD Next bundle 同源注入（读不到即拒绝启动，不静默丢资料）；CLI `od mokina context prepare|get`（UI+CLI 双轨） |
| 单测 | context-store 11/11；routes 3/3（真实 daemon HTTP：201/200 reused/409 冲突/409 SOURCE_CHANGED/404/413） |
| 未跑 | Web 选择面板（T07）；run 引用在真实模型链路的端到端回执（T19） |
| typecheck | daemon 0 error（contracts 已重建） |

## T08 营销场景与产物结构校验（部分）

| 证据 | 结果 |
|---|---|
| 现状核对 | 两场景包（open-design.json + SKILL.md + report-contract.md）已在 PR3 内落地且内容满足 §5.2 最小标准；prompt 双实现路径已由 SKILL.md assets 注入 |
| 新增 | daemon `mokina/deliverable-structure.ts`（可寻址章节结构检查 + mokina 场景识别）；`run-deliverable-validation.ts` 增加 `structure_invalid` 终态；contracts 两处 union 同步（chat.ts / deliverable-syntax.ts） |
| 测试 | `run-deliverable-validation` 28/28（新增 3 例：缺章节→structure_invalid、合规→valid、上游项目不受影响） |
| 未跑 | 场景 prompt（SKILL.md）本轮未改——现有文本已覆盖目标/KPI/取舍/预算/来源要求；专业评分属 T19 |

## T11 修订发送身份（FileViewer）

| 证据 | 结果 |
|---|---|
| 改动 | `FileViewer.generateChapterCandidate`：POST 前生成稳定 operationId/clientRequestId；`persistPendingSendRequest` 落盘失败即拒绝启动；`markSendRequestDispatched` 通过才 POST；body 携带 clientRequestId；受理成功清理记录；4xx→draft、5xx/网络→unknown；job 复用同一 operationId |
| 测试 | `FileViewer.mokina-revision-recovery` 13/13；`send-request-state` 21/21 |
| 未跑 | 真实 daemon 丢响应注入（AC29 的 real-daemon+fake-agent 端到端）→ 需要真实运行链（T19） |

## T13 指定版本导出（Web 侧）

| 证据 | 结果 |
|---|---|
| 改动 | FileViewer 版本下载菜单移除"仅 current 可导出 HTML"限制（当前/历史/候选均可导出，只读权限限制保留）；非当前版本导出文件名带状态词（`-vN-historical` / `-vN-candidate`），当前版本保持原名 |
| 测试 | `file-viewer-version-download` 14/14（含新增历史版本 standalone HTML 导出用例；原"隐藏历史 HTML"用例改写为"提供历史 HTML 导出"） |
| 未跑 | 桌面原生 PDF 实测（真实 desktop exporter + 中文/分页检查，AC40）→ T18/T19；候选版本导出截图（AC38 的候选分支）待 UI 状态补充 |

## T09 接续 v2（有界切片）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `MokinaContinuationV2`；FileViewer：`buildMokinaContinuationV2`（纯函数）+ `readMokinaContinuationJournal`；`continueFromSelectedSections` 先铸 operationId/targetProjectId 并写 journal，createProject 带显式 id（重试复用同一项目），成功后清 journal；v1 文件保持可读 |
| 测试 | `file-viewer-continuation-v2` 2/2（载荷/ journal 解析）+ `FileViewer.mokina-revision-recovery` 13/13 回归 |
| 未跑 | 真实"创建一半失败→恢复同一项目"故障注入（AC30 的 UI 级）；草稿入口迁移（pendingPrompt 沿用，未改为 Composer draft 通道） |

## T14 项目恢复包（服务端 + CLI）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `api/mokina-recovery.ts`（`mokina.project-recovery.v1` 清单、限制常量）；daemon `mokina/recovery-package.ts`（导出：原件+版本含冻结内容+快照+素材，跳过忽略目录/符号链接，捕获期变化即失败；导入：清单/路径/摘要/容量/符号链接/版本图/快照指纹全量校验后写入新项目，候选保持候选、current 唯一，失败回滚目录）；路由 `POST /api/projects/:id/mokina/recovery-export`（zip 下载，文件名净化）与 `POST /api/mokina/recovery-import`（multipart + operationId 幂等 + 归属冲突 409）；CLI `od mokina recovery export|import` |
| 单测 | `mokina-recovery-package` 6/6（路径安全、指纹/篡改、版本图、归属冲突、往返） |
| 集成 | `mokina-recovery-routes` 3/3（真实 HTTP：导出→导入新项目后原件可读、版本 ≥2 且 current 唯一、重复导入 409 幂等、他人占用 409、坏包 400） |
| 未跑 | UI 导出/导入入口（Web 按钮）、真机大项目容量压测 |
| guard | `pnpm guard` 通过 |
| 提交 | 见下 |

## 打包构建记录（T01/T02/T18）

| 项 | 结果 |
|---|---|
| 构建命令 | `pnpm --filter @open-design/web build`（`OD_WEB_OUTPUT_MODE=standalone`）→ `pnpm --filter @open-design/tools-pack build` → `pnpm tools-pack mac build --dir .tmp/mokina-pack --namespace mokina-local --app-version 0.0.2-local.1 --portable --to app --json` |
| 结果 | exit 0；`Mokina.app`（949MB，mac-arm64） |
| 过程中修复 | tools-pack dist 需重建（metatool freshness）；`--to dir` 在 mac 不受支持（改 `--to app`）；bundle 后产品 profile 路径解析改为向上查找包根（`toolsPackRootFromModule`，修复 dist 扁平化下的 ENOENT）——均为本分支新代码问题，已修复并有测试 |
| 运行冒烟 | 见 `evidence/t02-t18-packaged-smoke.md`（start/inspect/stop 全链路，实例隔离验证） |

## T17 CI 规划器核对（证据）

- `python3 .github/config/scopes.json validate` → 有效。
- `python3 .github/scripts/scopes.py plan --context pr --files <本分支 open-design/ 相对路径 83 项>` →
  enabled: `daemon_unit_tests, e2e_vitest, preflight, static_gate, ui_p0, workspace_unit_tests`（保守推导，覆盖 contracts 改动对 daemon/workspace 消费者的扇出）。
- 未推送远端；实际 GitHub Actions 运行不在本机可执行范围内。

## 真实端到端运行（T19 前哨）

| 项 | 结果 |
|---|---|
| 场景 | 合成茶饮方案：快照冻结 4 项 → 真实 Codex 运行 → succeeded（约 3m18s） → 结构校验 valid → HTML 导出自包含 |
| 关键证据 | `evidence/e2e-real-run.md`、`evidence/e2e-plan-export.html`；`mokinaContext` 回执在 daemon 重启后仍可读（新增 GET 磁盘兜底） |
| 修复 | run 状态读取增加回执磁盘兜底（routes/runs.ts），覆盖重启/对象重建场景；daemon 0 error |
| 未覆盖 | 用户签收与专业评分（T19，必须用户本人） |

## 回归状态（已完成归因）

- daemon 全量（本分支，JSON 重跑）：11930 passed / 18-19 failed / 15 skipped（899 文件，其中 1 例为全量并行负载下的 flake，单独复跑通过）。
- **归因对照（同一批存疑文件在两棵 worktree 复跑）**：本分支干净复跑 7 文件 = 12 failed / 4 文件；基线 worktree（PR3 head，无本分支改动）同 7 文件 = 13 failed / 5 文件。失败集合为基线同样存在的环境性失败（brand 网络 20s 超时、codex CLI 环境探测、vela AMR、od-next 计时），另有基线已存在的 `export-inline-route`、`plugins-bundled-scenarios-roster` 失败。**无归因于本分支改动的失败**；全量中 `run-create-workspace-gate` 单例 404≠409 为并行负载 flake（单独复跑 74/74 通过，基线同文件亦如此）。
- 各包 typecheck：release / contracts / tools-pack / packaged / desktop / web / daemon 全部 0 error；`pnpm guard` 通过。
- 已确认各包 typecheck：release / contracts / tools-pack / packaged / desktop / web / daemon 均 0 error（截至本记录）。

## 任务状态总表（截至本记录，诚实口径）

| 任务 | 状态 | 说明 |
|---|---|---|
| T00 基线与实现映射 | ✅ 完成 | baseline.md / implementation-map.md / 提交 a6cc708 |
| T01 独立产品 profile | ✅ 完成（含打包实测） | Info.plist bundleId=ai.mainquest.mokina.preview / 名称 Mokina / 版本 0.0.2-local.1；无 od scheme；包内配置 product 段正确且上游更新/遥测/云键全部缺省；证据同上 |
| T02 打包依赖闭包 | ✅ 完成（本机 smoke） | 真机 `tools-pack mac start/inspect/stop`：清洁启动、web 200、daemon health 200、独立数据根、只停本实例；证据 `evidence/t02-t18-packaged-smoke.md` |
| T03 稳定桌面存储 | ✅ 完成 | IPC store + facade + 镜像/hydration；desktop 498/web 相关测试通过 |
| T04 Codex 连接诊断 | 🟡 服务端完成 | `GET /api/mokina/codex-connection`：`codex login status` 权威探测（同时覆盖文件与系统凭据，不再单看 auth.json）；状态集合复用既有失败分类（cli_missing/login_required/permission_denied/quota_or_billing/network_unavailable/model_unavailable/unknown）；CLI 路径支持 `MOKINA_CODEX_CLI_PATH` 覆盖；30s 缓存；测试 6/6（分类纯函数 + HTTP，确认未登录不得报就绪）。未做：设置页"检查连接"UI 与真实测试任务按钮（属 T16 设置面收口） |
| T05 资料解析与 PDF 依赖 | 🟡 主体完成（含解析链加固） | 服务端：parserVersion + `OD_PDFTOTEXT_PATH`；新增绝对路径回退（/opt/homebrew/bin、/usr/local/bin，实测本机解析到 `/opt/homebrew/bin/pdftotext`，Finder 子进程不再依赖交互式 PATH）；未打包：Homebrew poppler 依赖闭包过大（11+ dylib 含 nss/gpgmepp），按 Spec 的"依赖无法满足"路径处理并如实记录，缺失时维持既有 `unreadable` 提示而非静默不可用 |
| T06 上下文快照 | ✅ 完成 | 服务端+CLI+Web 面板+发送接线全部落地；**真实模型端到端已验证**：快照冻结→run 注入→`mokinaContext` 回执（submitted，含 inline-text/staged-file 模式，daemon 重启后仍可读）。测试：store 11/11、routes 3/3、panel 4/4、pending 3/3 |
| T07 资料选择 UI | 🟡 主体完成 | 新 `MokinaContextPanel`（原件/可用内容/本次任务三层、服务端冻结、24k 预算展示、SOURCE_CHANGED→重新预览、不可读保留原件并列为未纳入）；选择 helpers 抽到 `runtime/mokina/material-selection`（FileWorkspace 保留再导出）；待发送快照状态 `pending-context-snapshot`（含桌面持久镜像）；ChatComposer `currentRunContextMeta` 自动携带 `mokinaSnapshotId`；run 读取/SSE 新增 `mokinaContext` 回执（statusBody + 启动内存镜像）。测试：panel 4/4、pending store 3/3、FileWorkspace 107/107、composer 37/37、daemon 路由 14/14。未跑：真机端到端（真实模型链路回执目视核对） |
| T08 场景与产物校验 | 🟡 主体完成 | 场景包（既有两场景 + 新活动页）均满足最小标准；`structure_invalid` 结构校验接入 deliverable 终态；**真实运行验证 valid**（方案与活动页两次）；双路径 prompt 未改动（既有文本已达标）；专业评分属 T19 |
| T09 接续 v2 与可靠创建 | 🟡 部分 | v2 载荷（operationId/sourceDigest/versionState/productionIntent）+ 稳定 targetProjectId 复用 + prepared→project-created→snapshot-saved 检查点 journal（镜像到桌面持久存储）已落地并有单测；draft-ready 后的草稿入口与 UI 恢复提示沿用既有 pendingPrompt/navigate 路径 |
| T10 活动页接续制作 | ✅ 完成（真实管线已跑） | 新场景包 `plugins/_official/scenarios/mokina-landing-page`（open-design.json + SKILL.md + references/landing-page-contract.md：自包含、稳定章节、品牌约束、CTA 不得虚构提交/转化）；roster 精确集合测试登记三个 mokina 场景（顺带修复该基线失败）；接续面板新增"目标任务"（讨论/活动页）→ pluginId 与提示语切换。按 P08 约定，真实管线验收前不加可点击生产入口。测试：roster 20/20、bundled 33/33、continuation 17/17。未跑：真实模型生成活动页与导出验收（AC34） |
| T11 修订发送身份 | 🟡 部分 | Web 修复落地（持久化→派发→CAS 标记）；真实丢响应注入未跑 |
| T12 候选比较 UI | 🟡 主体完成 | `MokinaCandidateCompare` 模态（基础/候选章节并排，窄屏切换；非所选区域**字节一致性**判定而非"看起来一样"；数值字面量差异提示；采用/取消入口常显，基稿已非当前时禁用并提示冲突）；纯函数 `candidate-compare`（章节识别/空白化/数值提取）；FileViewer 候选行新增「比较」。测试：helper 4/4、组件 4/4、FileViewer 回归 42/42 |
| T13 指定版本导出 | 🟡 部分 | Web 菜单与文件名完成；桌面原生 PDF 实测未跑 |
| T14 恢复包 | ✅ 完成 | 服务端+CLI+HTTP 往返；**Web 入口完成**：最近项目行菜单「导出恢复包」（下载 ZIP，服务端文件名解析+回退）、新建项目面板「导入恢复包（zip）」（multipart、operationId+targetProjectId 幂等、成功导航到新项目、失败 toast 可重试）；客户端模块 + 三层接线（App→EntryView→EntryShell→Rail/Modal→Panel）。测试：client 6/6、rail row 2/2、panel 2/2、既有 Panel/Modal 回归 51/51；web typecheck 0 error |
| T15 诊断与隐私 | 🟡 主体完成 | daemon `GET /api/mokina/diagnostics`：产品/构建/运行时/隐私/网络依赖声明（每项带 nextAction）、codex CLI 探测（60s 缓存）；`assertMokinaDiagnosticsSanitized` 值特征+键名双层扫描；测试 4/4（含 HTTP）。未跑：AC45 的恶意 HTML/IPC 安全测试（既有隔离未改动，T16 视觉/安全收口时统一验证） |
| T16 八视图与 i18n | 🟡 i18n 部分完成 | 本轮新增文案全部走字典：`types.ts` +62 键，19 个 locale 文件同步补齐（zh-CN 源文、en 翻译、其余 17 locale 先以英文回退待译），`MokinaContextPanel`/`MokinaCandidateCompare`/FileViewer 新增控件均改 `t()`；测试改为跟随默认 en 字典并通过。**未完成**：冻结设计包 21 文件迁移、P01–P08 视觉对照、其余 17 locale 的正式翻译与语言质量 |
| T17 回归与 CI | 🟡 主体完成 | 本地：daemon 全量 + 归属对照、7 包 typecheck、guard 全绿；CI：复用仓库既有 ci.yml + 规划器（未另建平台），以本分支真实 diff 运行 `scopes.py plan` 得到门禁选择 = daemon_unit_tests / e2e_vitest / ui_p0 / workspace_unit_tests / preflight / static_gate（保守推导）。边界：未推送远端、未实际触发 GitHub Actions 运行 |
| T18 候选发行包 | ✅ 完成 | 最终构建 `--to all`：`.app` + dmg（SHA-256 `f8399b5f…af319c2`）+ zip（`00503386…83cdfcf2`），并复跑 start/inspect/stop 冒烟（daemon health 200 / web 200 / 只停本实例）；修复 tools-pack 产物搬运器硬编码名；`runbook.md` 完成。未做：公证与公开分发（按 Spec 不在本轮门槛） |
| T19 本机三任务与签收 | 🟡 客观项已跑 | 真实 Codex 已完成三个任务：①资料→方案（结构 valid，预算 50 万/30 家门店来自冻结资料）②活动页（hero/value/proof/cta，无虚构回执，素材 staged-file）③数据任务 C（数值全部对照 expected-metrics 通过，因果表述审慎）。**未完成**：专业五分制评分与用户本人签收（Spec 明确不得由 Agent 代签） |
