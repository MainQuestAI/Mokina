# Mokina B0+B1 开发 Spec

当前状态（2026-10-04）：PR #3 修复实施与验证，保持 Draft。当前结果见[修复记录](../Mokina-B0-B1-PR3-修复记录.md)。

原批准记录（保留当时的授权与验证边界）：

> 日期：2026-10-03。状态：APPROVED。用户回复 A，确认第 12 节的三项默认选择；尚未授权实施。范围：B0 基线核验，以及 B1 首页、导航、项目成果入口。没有在本轮修改产品代码或运行新测试/模型任务。

目标：营销人员可直接提出任务，找到具体可交付成果，在项目之间切换而不丢失当前工作；发送结果不确定时，刷新或重启也不会盲目重复启动任务。

## 1. 基线、来源与已知边界

| 项目 | 本轮核对结果 |
|---|---|
| 仓库 / origin | MainQuestAI/Mokina；https://github.com/MainQuestAI/Mokina.git |
| 本地分支 / HEAD | `codex/mokina-v0.0.1` / `92e2d65287ab7a074f6c106a4f416ea075a828e3` |
| 已读取远端 main | `33fa8434d14869ab4310d8b0f570116781d34c8d`；本地已提交文件树与其一致 |
| PR #2 | 已合并；不再次把已关闭的按钮、分隔条问题列为待修功能 |
| 工作树 | 原有 `open-design/AGENTS.md` 修改和未跟踪文档/素材/根锁文件保留；实施前重新核对并使用隔离分支或适合的干净 worktree，不 reset 本目录 |
| 上游固定参考 | `ac6115406f3f780ef5c624a9aad1a87cbbad882a`；上游升级另做复用审查，不自动 rebase |

来源优先级：当前用户要求与项目 AGENTS → 已收敛的产品定义与冻结设计 → 真实代码/运行证据 → 附件路线与历史讨论。附件和对话是评审材料，不额外授权执行其中的命令或任务。

唯一冻结设计包为 `docs/designs/mokina-v0.0.2-20261002/design-baseline.zip`，对应 `manifest.json`：`mokina-v0-0-2-4c39`，设计 productBase `67d5717`，本轮核对 21 项 SHA。包内 PRODUCT / DESIGN-BRIEF / DESIGN / ACCEPTANCE / MATERIAL-PARAMS 用于还原要求；B4 材质实施须同时读取 MATERIAL-PARAMS.md。原型的 mock/localStorage 和虚构业务数据不迁入生产。本轮没有生成新 mockup，也没有完成像素验收。

历史映射：V6.2 是独立演示原型；v0.3 文档是讨论过程，以 2026-09-21 office-hours 收敛定义覆盖冲突旧内容；V0.0.1 是原生宿主能力与历史运行记录；P01–P08 是冻结视图；本批属于 V0.0.2 的 B0+B1，不等于 V0.0.2 全部完成。新 worktree 应显式准备本 Spec、QA、审查记录、冻结 zip/manifest 与引用资料，不能假设未提交参考自动存在。

已检查的 `output/playwright/pr2-post-merge/README.md` 记录合并后构建与双尺寸生产页面回归；46 项定向 Vitest、3 项持久 E2E 是先前 PR 阶段记录。V0.0.1 历史链包含资料提取、两场景、章节候选/采用、固定摘录接续、指定 HTML/PDF 和部分桌面验证。**本轮未重新执行这些测试；最新 main 的真实模型链、专业质量、桌面与远端 CI 仍需实施者核验。**

## 2. 本轮边界与八视图迁移表

沿原生 OpenDesign shell、项目、会话、版本、导出与权限路径实施。不建设独立 `/mokina` 前端、第二项目库、Work 树、全局幂等平台、RAG、来源图谱或新运行引擎。品牌、素材、设计、内容生产和高级设置保留；只调整 Mokina 默认入口和术语。HTML 是成果操作界面，原始 PDF/Excel/图片继续保留原格式。

| 冻结视图 | 既有基础与本轮任务 | 状态 / 批次 |
|---|---|---|
| P01 首页开始 | HomeView：直接输入、固定手动场景、真实资料/背景入口 | 部分适配；B1 |
| P02 项目目录 | EntryNavRail / RecentProjectsStrip：具体成果摘要、状态与打开规则 | 部分适配；B1 |
| P03 成果工作区 | ProjectView / FileViewer、PR2 工作区与草稿保护 | 已有待复验 B0；全面迁移 B4 |
| P04 资料选择 | 现有材料/Brand Kit 入口 | 真实入口 B1；解析/上下文依据 B2 |
| P05 单章修订与比较 | 现有章节候选、显式采用 | 链路 B0；完整视图 B3/B4 |
| P06 版本与导出 | 现有版本面板、指定版本 HTML/PDF | 链路 B0；完整视图 B4 |
| P07 接续确认 | 原生固定摘录与接续草稿 | 查证 B0；品牌/素材接续 B3 |
| P08 活动页成果 | 通用 HTML 成果工作区，无独立第八套路由 | 真实制作 B3；整体验收 B4 |

B0 将此表补成迁移记录：每行写源设计版本、实际入口、已有待复验/部分适配/需新增/后置、具体缺口、批次和证据路径。八页原型通过不代表八个生产视图完成；全部玻璃材质要求保留到 B4，不静默删除。

## 3. B0：先形成可复用基线

交付 `docs/Mokina-B0-B1-运行与验收记录.md`，包含以下结果；本轮 Spec 不提前填写通过状态。

1. 重新核对 main、工作树、实际服务/构建 SHA、edition 配置、Agent 与数据目录归属；记录已有失败的命令、环境、测试名、错误签名及与本批关联。受本批影响的失败必须修复。
2. 建立复用表：实际 list/files/tabs/version/status endpoint、od CLI、字段、权限、默认选择和旧项目条件。逐入口查 Home 创建+首发、既有会话发送、接续草稿的 projectId / clientRequestId / 受理记录 / 查询 / 持久化；不能从一个入口推断全部闭环。
3. 回放合成小资料→章节 HTML→单章候选→显式采用→指定旧/新版本 HTML/PDF。记录项目、run、版本、资料来源、产物路径/哈希；重开读回 HTML/资源，检查 PDF 实际页与内容可读。HTTP 成功、模型启动或浏览器夹具均不能替代真实产物。
4. 同一次真实任务另记专业评语：建议有取舍、依据可解释、下一步可执行；改变预算、人群或禁止渠道后建议符合约束。若修 Skill/reference，列明修改并执行合成 A/B 任务的约束与输入敏感性 eval。A/B/C 定义见原开发计划的[“三个持续使用的验收任务”](../reviews/Mokina-B0-B1-autoplan-2026-10-03.md#5-三个持续使用的验收任务)。工程链通过与专业质量通过分开记录；任务 C（开放式数据任务：小型 CSV 指标计算、变化解释与结论接续）仍为后续轻量抽测，不新建 BI。
5. 区分缺配置、认证/权限、网络、配额、模型拒绝和原因未知；每项写问题、可证实原因或未知、下一动作与原生设置/会话/文档锚点。记录 project/run/version/operation 身份，不记录凭据或敏感正文。不改全局模型配置及客户数据。
6. 分别记录 cold/prepared 环境前提、步骤数、可见 run 时间、真实 HTML 时间、失败与阻碍；当前未知。prepared 可见 run ≤5 分钟仅为诊断目标，不是发布硬门禁或模型速度承诺。不要增加遥测系统。
7. 在现有 README 原生指针与上游说明旁增加最小 Mokina fork 专属运行入口，避免拉错仓库；全面产品 README 在 B4。

核心代码回归先修。仅外部模型配置阻碍真实链时，独立 B1 是否允许继续/合并按 TASTE-2 决定；组合 B0+B1 未过只能标为部分完成。

## 4. B1 首页与真实入口

FR-01：主区顺序为简短任务提示、带可见 label 的输入、当前文字和附件/可选背景、资料/背景辅助入口与发送、两个手动场景及更多。输入是唯一主要起点；不要求先填项目名、Brand Kit、完整 Brief 或选 Skill。

FR-02：固定手动场景为“市场与竞品分析”“营销方案”。“更多”内“制作活动页”须经 B0 查证已有制作能力可运行；缺失则明确后置，不做假入口。通用/设计能力留在更多或高级入口。切换场景保留文本、附件和可用上下文；点击场景、资料或背景不能创建 run。确认式推荐 D8 已按 TASTE-1 确认后置，本轮不自动切换任务。

FR-03：资料/背景仅接入现有真实文件、材料或 Brand Kit 页/面板，展示已有范围和本次可选状态；“已选择”不等于“已进入模型/已理解”。选择与返回保留未发文字及当前可用附件。解析、上下文快照和依据视图交 B2。

FR-04：最近项目只放侧栏；首页不重复最近卡片墙。项目页复用现有 catalogue/list。项目行名称最多两行、成果摘要一行截断且有完整 accessible name/展开能力、状态固定占位。摘要基于真实成果；运行中仍可有正式稿，不能写成无成果。名称不能充当身份键。

## 5. 成果身份与打开规则

### 5.1 正式成果判定

| 状态 / 证据 | 计入 formalCount | 导航和显示 |
|---|---|---|
| 既有版本 `current:true` 且非 candidate，entry 可用且有权限 | 是，按 entry 去重 | 当前正式稿；包含正常首稿、手工修订和显式采用后的当前版本 |
| candidate 未采用 | 否 | 可明确预览，始终显示候选与版本 |
| 非 current 历史版本 | 否 | 可明确预览，始终显示历史与版本 |
| supportingFiles / 副本 | 否 | 文件入口；不因后缀或时间戳提升为成果 |
| legacy 仅 manifest.primary 或 metadata.entryFile，无可判定版本 | 否 | “旧项目入口（未确认采用）”；有效明确入口可访问，歧义留在文件/选择器 |
| 未读取 / 读取失败 / 权限未知 | 未知，不当作 0 | 加载或无法读取，提供只读核对 |

`manifest.primary`、complete 状态与最新写入 HTML 不是采用证据。读取目录不能创建版本补证据。B0 列出实际版本字段/优先级，沿用现有版本机制，不新增 adoptedAt 必填字段或采用机制。

### 5.2 打开优先级

```text
用户明确 projectId + 相对 entry + 可选 version
  ├─ 明确目标 → 校验权限/存在/路径 → 打开该目标，失效显示原因
  └─ 未指定目标 → 恢复仍有效的原生 tabs / active
                   ├─ 成功 → 打开，候选/历史标签保持可见
                   └─ 无有效 tabs → 成果读取已知？
                                      ├─ 未知/失败 → 加载/错误，不猜零
                                      ├─ 1 个正式 → 打开准确 entry/version
                                      ├─ 多个正式 → 项目内紧凑选择器
                                      └─ 0 个正式 → 项目真实状态/文件入口
```

失效 tabs/深链必须解释原因，提供重试或选择其他成果；不能静默跳到候选、最新 HTML 或错误项目。有效候选 tabs 可恢复，但不改项目摘要的正式身份。从候选工作区返回目录仍显示已保存的当前正式成果。

选择器不另造路由或卡网格；每项显示名称、正式/候选/历史文字状态、版本与可核对的采用时间，时间缺失不虚构。标题/选择器统一成果名称与版本标签，候选/历史提供打开正式稿入口。指定版本导出显示实际导出的版本，保留既有导出锁与机制。

## 6. 状态、草稿与发送恢复

### 6.1 读取五态

| 状态 | 页面行为 | 可用动作 |
|---|---|---|
| 首次加载 / 数据未知 | 行级占位；不显示未生成 | 等待或返回，不能猜成果身份 |
| 成功为空 | 已确认无正式成果，显示真实状态与文件 | 进入现有会话/文件，显式提出任务 |
| 成功有数据 | 显示准确摘要、版本和独立运行状态 | 打开准确目标 / 多成果选择 |
| 同身份后台刷新 | 保留仍有效的已知摘要并标更新中 | 已授权有效入口可继续用 |
| 部分或整体失败 | 单行就地无法读取；整体错误/返回，不清空为零 | 只读重试，不创建 run |

跨 workspace/account 必须撤去上一身份内容；同身份缓存不能跨权限变化沿用。缺摘要时区分未生成与无法读取。

### 6.2 跨项目不抢工作

FR-05：A 运行时切到 B，A 完成只更新 A 的状态或非打断提示；不导航、不切文件、不覆盖 B 标题/文字/附件/焦点。首页、项目、设置往返保持当前文件、章节、未发送文字和版本身份。

FR-06：草稿按原生 scope/project 容器恢复可持久内容；live File 句柄不能假称刷新后完整恢复，需要重选时明确提示，不用假附件占位。账户切换不把旧 payload 自动发送给新身份。快速 A→B、重命名/删除、无权限、离线和在途读取以现有 generation/authority 见证取消或丢弃旧结果。

### 6.3 三态提交及持久 unknown

```text
草稿 → 同 scope 保存稳定请求身份 + pending（写入失败：停在草稿，不 POST）
     → 现有发送单飞 / 原生 API
         ├─ 明确接受 → accepted + 原 run → 按原行为清输入/展示 run
         ├─ 明确未接受 → 保留输入 → 用户修正后可显式发送
         └─ 响应丢失/超时 → unknown + 保留输入与请求身份
                              ↓ 刷新/关闭重开/应用重启先恢复状态
                           只读查询原请求
                              ├─ 查到受理 → 恢复原 run，不再 POST
                              ├─ 明确未接受 → 回可发送草稿
                              └─ 不能可靠关联 → 待确认；同请求发送禁用
```

FR-07：不要把传输失败等同于未创建 run。已有 clientRequestId / IDEMPOTENCY_CONFLICT 是复用基础，仍需 B0 验证三条入口全链。必要请求状态元数据沿原草稿/待发/恢复容器补齐，不另建数据库；不持久化 File blob、凭据或无边界正文。

FR-08：unknown 不降级为普通未发草稿、不偷偷换 ID、不自动重发或循环忙等。显示“结果待确认”，仅提供核对发送结果的只读动作和对应项目入口。用户可继续其他任务；后来查明受理只更新原项目，不抢焦点。连点发送只启动一次。

FR-09：已有 run 失败显示真实失败，回对应会话查看/修正后显式重试；切项目再回来仍显示失败，不新增全局一键重跑。原请求/版本与新 run 分开记录。若查证需要全新通用幂等/查询平台，另提切片；保守持久 unknown 与禁用同请求重发仍是本轮必要条件。

## 7. 实现边界、资源与权限

```text
HomeView / EntryNavRail / 原项目 catalogue
  → 小纯解析函数（仅计算 navigation intent；不授予权限）
  → App 既有唯一授权 / scope / generation / router
  → ProjectView 原生 tabs / 草稿 / run 生命周期
  → FileViewer 原版本 / 候选 / 章节 / 导出
  → 原 provider → daemon HTTP 授权及安全路径 → 现有数据
```

| 修改边界 | 用途 / 不变量 |
|---|---|
| HomeView / EntryShell | 首页优先级、真实辅助入口；沿既有 mount/route 行为 |
| EntryNavRail / RecentProjectsStrip | recent/目录摘要与状态；复用列表、虚拟化与可见行读取 |
| `artifacts/mokina-project-entry.ts`（拟新增） | normalized metadata + scope + explicit target + tabs → direct/chooser/status/error；小纯 TS 函数，同供 sidebar/catalogue 调用 |
| App | 保留唯一授权/导航守卫，集成 intent；不建另一套 authority |
| ProjectView / `runtime/chat/composer-draft.ts` / provider | 三态持久化、恢复与同请求核对；沿既有结构最小补齐 |
| FileViewer / MokinaWorkspace 样式 | 标明成果版本、必要入口；保留 PR2 面板、居中指示与聊天裁剪守卫 |
| daemon / contracts / CLI | 仅 B0 证明现有契约不足才改；同 PR 全面补契约和示例 |

深链沿现有 projectId + 相对 fileName/version，daemon `authorizeProjectRequest`、`sanitizePath` / `resolveSafeReal` 校验继续生效。拒绝绝对路径、驱动器路径、遍历、NUL、编码绕过及逃逸 symlink；保留已授权 local 项目的原有访问。UI 校验不代替服务端授权；不可访问时不泄露旧 workspace 内容。

新成果元数据后台读取并发 ≤2；仅可见行/按需的小元数据，同 scope+target 请求合并，卸载/身份变化取消并释放，foreground 优先。缓存按 workspace+projectId+entry/version 隔离，有边界并随采用/删除/权限变化失效；有现成事件则复用，否则返回/聚焦只读复核。禁止列表预读全文/全部历史、无限缓存或全项目 fan-out。沿用既有后台队列理念，不为复用而强迫跨私有模块抽象。

诊断仅记既有 project/run/version/request 和决策分支、过期丢弃原因；不建遥测或新性能平台。新增 Dict 词条补齐现有 19 locale；UI 不显示内部配置项。用 CSS Modules / `@open-design/components`，不跨 app 导入私有实现；contracts 保持纯 TS，无客户端文件系统访问。

若纯 UI 已足够，不创造 API。若新增业务契约，web+daemon+contracts+od CLI 同 PR，给可复制最小 HTTP 请求/响应和 CLI `--daemon-url` / `--json` 示例、身份参数、默认选择、unknown/zero/candidate/history/error、兼容行为；长输入沿用现有 prompt-file。

## 8. 视觉、键盘与响应布局

沿冻结 DESIGN：中性玻璃导航、实底正文、青色主要动作、选中项中性薄填充；原生系统字体栈。正文 16px/1.65、辅助 ≥13px、控件约 14px，正文对比 ≥4.5:1；新控件目标 ≥44px，focus-visible 2px 且 ≥3:1。容器/控件圆角参考 16/8px；PR2 工作区现有 20px 不回退。不新增字体、品牌色或装饰卡墙。

生产 QA 尺寸 1440×900、1280×720；冻结原型 1280×800 不能替代本批短窗验收。导航参考 200–220px；协作栏沿现有默认 360px、范围 316–470px，分隔槽 16px，3×36px 指示双轴居中。短窗 Send/More 可见，工具条可换行，长列表/表格自身滚动；更窄窗口复用现 shell 折叠，不承诺完整移动端。

More 初始焦点在首个可用项，Arrow/Enter/Space 沿共享菜单，Esc 返回触发控件。成果选择器初始当前/首个可用项，关闭返入口；资料/背景返回原触发；触发被删除时落邻近稳定标题/目录，不掉到 body。后台完成用非打断 status/aria-live polite；错误有相关区域文字，不只用颜色。

过渡 160ms，内容默认可见；prefers-reduced-motion 关非必要过渡，减少透明度有清晰实底回退，文字/控件不参与折射。高级材质留 B4。实施后保存 P01/P02 两尺寸生产截图并复审；正式稿识别观察记首选、耗时、误选/困惑，不以“3 人/20 秒”作为未经验证的硬门槛，也不冒充客户验收。

## 9. 执行顺序与可重复检查

单一顺序工作流：B0 记录与字段核对 → 小判定函数及 G1 单测 → 现导航/五态接入 → 原生发送/草稿安全接入 → 完整宿主/两版构建及真实链验收。共享 Web 入口不并行修改；文档/合成材料可先准备，等接口结论再落地。不估算人力或承诺日期。

Node `~24`、pnpm `10.33.2` / Corepack；安装在 `open-design`，使用其锁文件，保留根部预存 untracked lock。生命周期仅用 `pnpm tools-dev`。数据位置遵 [Daemon data directory contract](../../open-design/AGENTS.md#daemon-data-directory-contract)：显式 `OD_DATA_DIR` 交 daemon，解析出的 `RUNTIME_DATA_DIR` 由 Agent 继承；namespace 本身不隔离数据。Web 与 CLI 必须指向同一指定 daemon。不另立具体数据目录示例规范。

以下为实施时命令模板，尚未在本轮执行。先设置获准空数据根目录、唯一 namespace、端口及 daemon URL 对应的 `MOKINA_QA_*` 变量；不要直接沿用客户目录。启动后核对 status/日志的地址、目录、Agent、edition 与构建身份，再执行合成任务。

```sh
cd open-design
corepack pnpm install --frozen-lockfile
OD_DATA_DIR="$MOKINA_QA_DATA_ROOT" corepack pnpm tools-dev start web --namespace "$MOKINA_QA_NAMESPACE" --daemon-port "$MOKINA_QA_DAEMON_PORT" --web-port "$MOKINA_QA_WEB_PORT" --no-env-file
corepack pnpm tools-dev status --namespace "$MOKINA_QA_NAMESPACE" --json
corepack pnpm tools-dev logs --namespace "$MOKINA_QA_NAMESPACE"
corepack pnpm guard
corepack pnpm typecheck
corepack pnpm i18n:check
corepack pnpm --filter @open-design/web test tests/artifacts/manifest.test.ts tests/components/EntryNavRail.recent-section.test.tsx tests/components/FileViewer.mokina-revision-recovery.test.tsx
corepack pnpm --filter @open-design/daemon test tests/project-tabs-state.test.ts tests/mokina-materials.test.ts tests/mokina-sections.test.ts tests/mokina-edition.test.ts
corepack pnpm --filter @open-design/web build
OD_DATA_DIR="$MOKINA_QA_DATA_ROOT" corepack pnpm tools-dev restart web --prod --namespace "$MOKINA_QA_NAMESPACE" --daemon-port "$MOKINA_QA_DAEMON_PORT" --web-port "$MOKINA_QA_WEB_PORT" --no-env-file
corepack pnpm --filter @open-design/e2e exec playwright test -c playwright.config.ts ui/mokina-workspace-actions.test.ts --workers=1
corepack pnpm tools-dev stop --namespace "$MOKINA_QA_NAMESPACE"
```

G1 拟新增 `apps/web/tests/artifacts/mokina-project-entry.test.ts`；G5 拟新增/扩 `e2e/ui/mokina-navigation.test.ts`，落地后将它们加入相应 package Vitest/Playwright 命令，同时扩 G2–G4 的现有行为测试。新 UI E2E 使用 `@/playwright/suite` 隔离生命周期和数据，不手写另一套 daemon 启动器。上面的现有测试名单只是复用起点，不代替六组新增覆盖。

Mokina 默认 on（Web `NEXT_PUBLIC_MOKINA_EDITION`、daemon `MOKINA_LOCAL_EDITION` 均以 `off` 关闭）。反向 OpenDesign 验收使用独立 Web 构建 `NEXT_PUBLIC_MOKINA_EDITION=off`、对应 daemon 运行配置 `MOKINA_LOCAL_EDITION=off`，记录实际值/构建 ID 与原首页、项目、发送。不能在同一已构建页面换 env 冒充两版；混配记为无效前提。

## 10. 验收矩阵与退出条件

详细 [QA Test Plan](../reviews/Mokina-B0-B1-QA-Test-Plan-2026-10-03.md) 包含 5 条 critical paths、8 个 edge cases 的 Value cards；测试计划已保存，但没有新增测试运行结果。

| 组 / AC | 必须保护的结果 | 验证层 |
|---|---|---|
| G1 / AC-01 | 深链→有效 tabs→一正式→多选择→零；current 非候选、legacy 未确认、unknown 不误零 | 小解析函数表驱动单测 + 真实入口集成 |
| G2 / AC-02 | 直接开始、不强填项目；明确拒绝保留草稿；连点一次 run；接受但丢响应后刷新/重启不第二 POST | Home/ProjectView/provider 行为测试 + 浏览器恢复 |
| G3 / AC-03 | A 完成不抢 B；B 可恢复草稿；快速切换、删除/重命名、账号/权限变化、tabs/版本失效和路径拒绝 | 既有 scope/restore/API 集成 + daemon 边界 |
| G4 / AC-04 | 五态；12/120 新 metadata、既有 500 行可见读取；≤2 并发、去重/取消、局部失败、采用后失效 | 请求级行为测试，不能仅断言常量 |
| G5 / AC-05 | 两尺寸普通 click/Tab/Enter/Space/Esc、focus/对比、资料往返；两版独立构建；PR2 面板草稿、分隔/聊天守卫 | 生产 CSS 完整宿主 Playwright + 截图/理解性观察 |
| G6 / AC-06 | 当前 main 的真实资料→HTML→候选→采用→指定 HTML/PDF，实际页和版本内容；专业约束单独结论 | 真实模型/实际产物读回，不计 mock 为通过 |

另覆盖返回页面时另一浏览器 tab 的采用变更、候选 tabs 恢复但摘要不误正式、unknown 无法关联仍禁用、pending 写入失败不发送、临时离线后只读恢复。只增有行为价值的覆盖，不删除既有版本、滚动、edition、路径守卫；不引入仅供测试的新生产架构。

B1 合入前，记录最终代码/构建 SHA、guard/typecheck/i18n、相关 package test/build、普通浏览器 AC 和两版结果，修复本批关联失败。现有测试、静态推理、mock 浏览器、真实模型、专业质量、桌面和客户验收分别标层级。B0 因外部配置阻碍的处理按 TASTE-2；未通过真实链不能宣称 B0+B1 或 V0.0.2 全部完成。

回退仅 revert 本轮 edition 显示/小解析/安全集成变化，保留原项目、manifest、tabs、版本和数据格式；不重置用户数据。本轮不需要数据库迁移、签名发布或部署新渠道。

## 11. 后续交接与审查结论

B2 接收实际资料/背景入口、endpoint/字段复用表、解析失败、上下文证据缺口与来源版本；B3 接收选定策略/品牌/素材→独立成果的真实约束；B4 接收八视图迁移与桌面/材质缺口。每轮在现验收记录记反复说明背景、反复修订和查找障碍，下一版本按实际重复任务排序；Meta Skill 仅对可解释重复偏好评估，不新采集系统。后置条目见 [TODOS](../../TODOS.md)。

| 阶段 | 已完成审查 | 结果边界 |
|---|---|---|
| CEO | 主审 + 独立 Codex + Claude Code；4/6 共识 | 接受 C1–C3，后置 C4/C5，跳过 C6/C7；三项 taste 已确认 |
| Design | 7 维度；计划最低分 6→9；1/7 双声音确认，6 项未知 | 是计划完整性评分；图像生成缺 API key，未形成新视觉稿/像素证据 |
| DX | 8 维度评分，计划最低分 6→8；另有六项双声音共识核对，3 项确认、3 项未知 | 共识核对与评分维度是两套统计；cold/prepared 时间未知，上手目标是诊断，不作速度保证 |
| Eng（最后） | FULL_REVIEW；5/6 确认；10 项问题映射入要求/测试 | 架构拆分继承 TASTE-3；工程条件待实施验证，不称已修代码 |

独立 Codex 四阶段均完成；Claude 四阶段均有本次有效完成输出（CEO 初次无有效结构输出，重试成功，初次仍单独记为 unavailable）。全部用各阶段冻结输入，不从先前成功借本次信用；原始输出与 modelUsage 留在 gstack 状态目录并附审查记录。评分不代表产品已验收。

跨阶段共同关注：准确区分正式/候选/历史；unknown 不能当未发送；project/scope 与异步身份保持；真实运行和 mock 证据分开；小范围复用而非重建平台。详见 [审查记录与 Decision Audit](../reviews/Mokina-B0-B1-autoplan-2026-10-03.md)。用户确认后保存本轮审查日志；Spec 批准与实施验证状态分别记录。

## 12. 三项已确认选择

| ID | 用户确认的选择 | 本轮未选择的替代及影响 |
|---|---|---|
| TASTE-1 | 确认式场景推荐 D8 后置，保留本轮两个手动入口 | 本轮纳入：增加确认/忽略/过期建议，重跑范围和工程审查 |
| TASTE-2 | 仅外部模型配置阻碍时允许独立 B1 通过自身验收后推进/合并；整体标 partial | B0 真实链先通过再允许 B1 合并；核心代码回归两种选择均先修 |
| TASTE-3 | B1 保持一个完整切片，最小补齐已有恢复/身份守卫 | 拆 B1a 导航、B1b 恢复契约；不能删除持久 unknown 和禁止盲重发的必要保护 |

用户于 2026-10-03T06:25:22Z 回复 A，确认上述三项默认选择。0 项未决选择、0 项 User Challenges。确认本 Spec 不等于授权启动实施、模型任务、提交或发布；这些动作按后续任务执行。
