# Mokina B0+B1 运行与验收记录

日期：2026-10-03。批次：V0.0.2 B0（合并基线确认与真实链路回放）。对应 Spec：[Mokina-B0-B1-开发Spec-2026-10-03](specs/Mokina-B0-B1-开发Spec-2026-10-03.md)（状态 APPROVED，TASTE-1/2/3 已按默认确认）。工程链通过与专业质量通过分栏记录；mock/静态证据与真实运行证据分层标注。

## 0. 环境与身份

| 项 | 值 |
|---|---|
| 实施工作树 | `/Users/dingcheng/Coding-Project/02-key-project/Mokina-worktrees/v0.0.2-b0-b1`（隔离 worktree，未 reset 既有目录） |
| 分支 / 基线 | `codex/mokina-v0.0.2-b0-b1`，基于 origin/main `33fa8434d14869ab4310d8b0f570116781d34c8d`（PR #2 合并提交） |
| Node / pnpm | v24.15.0（fnm）/ 10.33.2（corepack，packageManager 字段） |
| QA 数据根 | `/Users/dingcheng/Coding-Project/02-key-project/Mokina-worktrees/qa-data/b0-b1`（实施前为空；daemon `OD_DATA_DIR` 显式指定，Agent 继承；namespace `mokina-b0b1` 本身不隔离数据） |
| 端口 / 服务 | daemon 18613 / web 18614（`--no-env-file`，未沿用任何客户目录；上一轮 mokina-v002 的 18603/18604 未复用） |
| Edition | daemon `MOKINA_LOCAL_EDITION` 未设置 → Mokina on（`isMokinaLocalEdition = env !== 'off'`）；Web 构建未设 `NEXT_PUBLIC_MOKINA_EDITION` → on |
| 构建身份 | daemon/web 0.22.1，channel=development；dev 启动后 `tools-dev restart web --prod` 重启为生产构建 |
| Agent | codex（用户级 `~/.codex/auth.json`；daemon 不改写 `CODEX_HOME`，`app-config.ts:218` 透传） |

### 环境问题记录

| 问题 | 原因 | 处理 |
|---|---|---|
| `pnpm typecheck` 首次失败：engines.pnpm 报 "Got: 10.30.1" | typecheck 脚本内裸调用 `pnpm`，PATH 命中 Homebrew pnpm 10.30.1（低于要求的 >=10.33.2） | `corepack enable --install-directory <worktree>/open-design/.tmp/corepack-bin pnpm` 生成 10.33.2 shim 置于 PATH 后重跑通过。属环境问题，非代码回归；B1 命令模板建议前置该 shim 或全局对齐 pnpm 版本 |

## 1. 基线核对（Spec §3.1）

- 工作树基于 origin/main `33fa843`，与远端一致；未跟踪引用资料（Spec、QA 计划、autoplan 审查记录及证据、冻结 zip/manifest、TODOS、V0.0.1/v0.3 资料、pr2-post-merge Playwright 证据、根 pnpm-lock.yaml）已显式迁入；`open-design/AGENTS.md` 本地修改（Mokina 产品原则，1 hunk）与源 worktree diff 逐字节一致。
- 冻结设计包 `docs/designs/mokina-v0.0.2-20261002/design-baseline.zip` 21 个文件 SHA256+字节数与 manifest 全部一致（逐项解压验证）。
- GitHub 无 CI check run（与 pr2-post-merge 记录一致）；不声称远端 CI 验收。
- 既有失败命令：除上述 PATH 引发的 typecheck 环境失败外，未发现其他失败记录；pr2 阶段 46 项定向 Vitest + 3 项持久 E2E 为先前轮次记录，本轮未重复计入。

## 2. 复用表（Spec §3.2）

### 2.1 daemon HTTP 端点（实测 base `http://127.0.0.1:18613`，本地回环直接信任）

| 用途 | 端点 / 方法 | 关键字段与行为 | 证据 |
|---|---|---|---|
| 项目列表 | `GET /api/projects` | 本地 200；`{"projects":[]}` 起步 | 实测 |
| 创建项目 | `POST /api/projects` | body `{id(safe id), name, skillId?, designSystemId?, pendingPrompt?, metadata?, customInstructions?, skipDiscoveryBrief?}`；**创建即返回 conversationId**（Home 首发「创建+首发」复用点） | routes/project/index.ts:3855 + 实测 |
| 项目详情 | `GET /api/projects/:id` | 实测可用 | routes/project/index.ts:5011 |
| 文件列表 | `GET /api/projects/:id/files` | 返回名称/大小/mime；**managed 项目磁盘目录按需创建**（sqlite 先有行，首次写文件才有目录） | routes/project/index.ts:6510 + 实测 |
| tabs 读/写 | `GET/PUT /api/projects/:id/tabs` | `{tabs: string[], active: string\|null, browserTabs: []}` + `hasSavedState`（可区分「无保存 tabs」与「未知」）；读走 `authorizeProjectRequest(mode:'read')`，写走 `enforceWorkspaceProjectMutation(writeFiles)` | routes/project/index.ts:5593,5601 + 实测 |
| 版本列表 | `GET /api/projects/:id/files/(.+)/versions` | 仅 HTML；**空历史+写权限时引导基线版本**（`ensureCurrentProjectFileVersion`，source='manual'）——与 B1「读取不补证据」不冲突：仅针对真实存在的 working 文件，不为 legacy manifest 制造证据 | routes/project/index.ts:7253 |
| 创建候选 | `POST .../files/(.+)/candidates` | body `{baseVersionId, sectionId, replacementHtml, operationId, prompt?}`；`replaceHtmlSection` 字节级单章替换；candidate=true 不推进 working 文件 | routes/project/index.ts:7329 + 实测 |
| 显式采用 | `POST .../versions/:versionId/adopt` | body `{expectedCurrentVersionId, operationId}`（乐观并发）；成功后版本携带 `adoptionOperationId`，原 current 降为历史 | routes/project/index.ts:7367 + 实测 |
| 创建/恢复版本 | `POST .../versions`、`POST .../versions/:versionId/restore` | `CreateProjectFileVersionRequest {prompt?, label?, source?, parentVersionId?}`；restore 为 source='restore' | routes/project/index.ts:7397,7492 |
| 指定版本内容 | `GET .../versions/:versionId` | 返回 `{version, content, frozenContent?}`（自包含 HTML 快照供历史预览/导出） | routes/project/index.ts:7577 + 实测 |
| 创建 run | `POST /api/runs` | body=ChatRequest（agentId、message、currentPrompt、priorTranscript、projectId、conversationId、sessionMode('design'\|'chat'\|'plan')、userMessageId/assistantMessageId/**clientRequestId**、skillId(s)、attachments、model…）；受理 202 返回 `{runId, reused, resumed}`；**幂等：同 clientRequestId 重放返回同一 runId 且 reused:true**；clientRequestId 关联不同逻辑请求 → 409 IDEMPOTENCY_CONFLICT | routes/runs.ts:939,2498,3040 + 实测 |
| run 查询 | `GET /api/runs/:id` | status 轮询 | 实测 |
| 素材读取 | `GET .../files/:name/material` | `readMokinaMaterial`：.md/.txt/.csv 文本分组提取、.pdf pdftotext、10MB 上限、sha256 contentDigest | mokina/materials.ts；routes/project/index.ts:7239 |

### 2.2 版本契约（B1 §5.1 判定直接复用，无需新增字段）

`packages/contracts/src/api/files.ts:109` `ProjectFileVersion`：`current: boolean`、`candidate?: boolean`、`source: 'ai'|'manual'|'restore'`、`promptSource?`、`baseVersionId`、`operationId`、**`adoptionOperationId`**（采用证据已存在）、`contentDigest`、`parentVersionId`、`origin`、`createdAt`、`version`、`label`。Spec §5.1 明确不新增 adoptedAt 必填字段——契约已满足。

### 2.3 三条发送入口的身份与持久化

| 入口 | 身份（clientRequestId） | pending/草稿持久化 | 备注 |
|---|---|---|---|
| Home 创建+首发 | `home-auto-send-<digest(projectId)>`（稳定、可重放），userMessageId/assistantMessageId 派生同键 | **sessionStorage**：`od:auto-send-first/prompt/attachments/context/<projectId>` + AMR gate witness 键；用后即清（sessionStorage 不跨浏览器重启，恢复语义由 B1 补齐处） | ProjectView.tsx:1398-1464 |
| 既有会话发送 | 通用发送 per-send `randomUUID()`；question-form 回答按出现身份 `qf-answer-<digest>` 派生 | 草稿正文 localStorage `od:chat-composer:draft:<projectId>:<conversationId>`；附件/引用/上下文 extras 同键 `:extras` 后缀（上限：extras 64KB、quotes 20×1000 字符、attachments 50） | ChatComposer.tsx:367,328,6713；ChatPane.tsx:2617；composer-draft.ts |
| 接续/修订（PR2） | 修订作业 `MokinaRevisionJob {runId, revisionProjectId, baseVersionId, sectionId}` | localStorage `mokina:revision:<projectId>:<fileName>`，带空位锁（`storeMokinaRevisionJobIfVacant`/`clearMokinaRevisionJobIfCurrent`）；接续 action 为内存态 handoff `{action:'revision'\|'continue'}` | FileViewer.tsx:9,3349-3390,3492 |
| daemon 幂等底座 | `createOrReuse` 按 clientRequestId 返回首个 run | runs 表 + clientUserMessageId/assistantMessageId 归属校验 | ProjectView.tsx:1421 注释；routes/runs.ts:3040 |

### 2.4 daemon 安全与权限（B1 深链沿用）

- `authorizeProjectRequest`（read/write 模式）+ `enforceWorkspaceProjectMutation`；`sanitizePath`/`resolveSafeReal` 拒绝遍历/绝对路径/逃逸 symlink（projects.ts:1467-1480 resolveExistingPrefix 逻辑）。
- 只读成员读取共享项目镜像时，版本列表**不会**为不存在的 working file 造基线（7253 段注释明确：飞书 recvq56vFjQKfT）。

### 2.5 od CLI

- bin：`@open-design/daemon` → `od`；`--daemon-url`/`--json` 支持（daemon-url.ts 解析顺序：flag → OD_DAEMON_URL → sidecar → tools-dev status）。
- 子命令（`od --help`）：`tools live-artifacts/deliverable-syntax/directions/connectors/design-systems`、`artifacts create`、`mcp`、`research search`、`plugin <list|info|install|uninstall|apply|doctor|replay|trust>`。

## 3. 真实链路回放（Spec §3.3/§3.6）——已完成

设置：合成资料 `晨光茶饮-品牌与产品资料.md`（1084 字节，含预算 50 万、禁止小红书信息流、人群占比 ≥60% 三项可校验约束）；项目 `mokina-b0-replay-1`；agent=codex；sessionMode=design；生产构建服务（web 18614 / daemon 18613）。

### 3.1 执行序列与结果

| 步骤 | 动作 | clientRequestId / runId | 可见耗时 | 结果 |
|---|---|---|---|---|
| 1 | 创建项目+对话 | — | <1s | `POST /api/projects` 202，返回 conversationId |
| 2 | 真实任务：读资料→写章节 HTML「预算分配与渠道优先级.html」 | `b0-replay-1-req-001` / runId `d99b6ac0` | **201s** | succeeded；产物 10039 字节，sha256 `fb923c60…d31b`；自动建版本 v1（source=ai，current=true）；artifact.json `{status:"complete", exports:["html","pdf","zip"]}` |
| 3 | **幂等重放**：同 clientRequestId 重复 POST | 同上 | <1s | 返回**同一 runId**，`reused:true`，HTTP 202——运行中重复提交不创建第二 run（§6.3「连点只启动一次」的 daemon 侧证据） |
| 4 | 真实任务：第二章节「传播内容与排期.html」+ 章节契约写入提示 | `b0-replay-2-req-001` | 218s | succeeded；14830 字节，sha256 `0983a0cd…0a3a`；v1（source=ai，current=true）。**发现：产物使用 `data-od-id` 而非 `data-mokina-id`**（见 §3.3） |
| 5 | 真实任务：为该文件补 `id`+同值 `data-mokina-id` 属性（仅加属性，不改内容） | `b0-replay-3-req-001` | 64s | succeeded；7 个顶层章节获得寻址属性；**自动生成 v2（current=true），v1 降为历史** |
| 6 | 真实任务：单章修订——只产出 `schedule-section` 替换元素写入独立文件 | `b0-replay-4-req-001` | 156s | succeeded；替换文件 5508 字节，单根 `<section id data-mokina-id>` |
| 7 | `POST …/candidates`（base=v2，sectionId=schedule-section，replacementHtml=模型产物，operationId=b0-cand-001） | — | <1s | 候选 v3 `bf7f2b43`：**candidate=true，current=false**，baseVersionId=v2；字节级章节替换（其余章节不变） |
| 8 | `POST …/versions/v3/adopt`（expectedCurrentVersionId=v2，operationId=b0-adopt-001） | — | <1s | **v3 current=true，candidate 清除，`adoptionOperationId=b0-adopt-001`；v2 降为历史** |
| 9 | `GET …/versions/:id`（旧 v2 / 新 v3） | — | <1s | 均返回 `content` + `frozenContent`（自包含历史快照） |
| 10 | 指定版本 PDF 导出（Chromium 真实渲染） | — | 各 <10s | v2 历史版 5 页 678KB；v3 正式版 7 页 701KB；pdftotext 读回标题/约束/排期表均可读 |

### 3.2 版本演进核验（真实模型产出，非 mock）

| 版本 | 状态 | source | 证据 |
|---|---|---|---|
| v1 `271e920d`（排期文件） | current=false（历史） | ai | run2 直接产出 |
| v2 `47ecb450` | current=false（被采用后的降级历史） | ai | run3 编辑后自动建版 |
| v3 `bf7f2b43` | **current=true，adoptionOperationId=b0-adopt-001** | ai（候选→显式采用） | 候选/采用端点返回体 |
| v1 `53263241`（预算文件） | current=true（正常首稿） | ai | run1 直接产出 |

单章修订内容核验：v2 排期为相对周（「上线前一周」「第 1–2 周」）；v3 排期为具体日期区间（`2026/10/05–10/09` 等）+ 每日/阶段预算上限——修订精确落在 `schedule-section`，其余章节字节级未变（`replaceHtmlSection` 保真替换）。

### 3.3 发现与边界（如实记录）

1. **章节寻址依赖场景 Skill 契约**：裸 run（不挂场景 Skill）的产物不含 `data-mokina-id`；上游官方系统提示（`packages/contracts/src/prompts/official-system.ts:63-65`）驱动模型使用 `data-od-id`，模型在用户消息与系统提示冲突时遵循后者。run2 即便在提示中写入契约仍产出 `data-od-id`。`data-mokina-id` 的规定来源是场景插件 report-contract（V0.0.1 链路经 UI 场景管线注入）。**对 B1 的含义**：FR-02 的「制作活动页」等入口必须经场景能力发起（正符合 FR-02 的要求）；B1 不需要改 daemon sections 逻辑，但 G6 类验收须注意该前提。
2. **本轮未通过 UI 重放场景管线**（Home 场景卡 → apply-scenario → discovery/generate 管线）：上述回放经 daemon HTTP 驱动，版本/候选/采用/导出机制全部真实；场景表单交互与 B1 的 Home 改造属后续验证。
3. managed 项目磁盘目录按需创建（sqlite 先有行）；对 B1 的 recent/摘要读取无影响（元数据经 API）。
4. `GET versions` 在「working 文件存在但空历史 + 写权限」时会引导基线版本（source=manual）；只读成员不会。与 Spec §5.1「读取目录不能创建版本补证据」不冲突：该行为针对真实存在的 working 文件，不制造 legacy 证据。

### 3.4 证据归档

`docs/evidence/mokina-b0b1-replay/`：4 次 run 的请求体、受理响应、v2/v3 版本元数据、三个真实产物 HTML、替换章节文件、两份指定版本 PDF 及 `SHA256SUMS.txt`。

## 4. 专业质量评语（Spec §3.4，与工程链分栏）

对象：run1 产物「预算分配与渠道优先级.html」（本轮唯一完整方案章节产物；run2–4 以结构/机制验证为主）。

- **建议有取舍**：预算分配（美团 40% / 微信私域 20% / 抖音 18% / 写字楼定点 12% / 制作 6% / 监测 4%）以历史 ROI 排序（2.1 > 1.4 > 0.9），并明确「梯媒 0.9 → 本季不安排梯媒预算，但写字楼定点属新测试、不能沿用梯媒结果证明效果」——区分了历史渠道与新增测试的论证边界。
- **依据可解释**：每个排序均引用资料数据（晨光青提 42% 销量占比、复购率 31%→35%、价格带）；末节明确「产品价格、销量占比、历史 ROI 及复购率来自资料文件；预算金额、渠道排序与执行办法为本章节建议」——资料与建议分层。
- **下一步可执行**：分批释放（首轮 20%、观察两周）、暂停条件（人群占比 <60% 暂停扩量）、调拨规则（同步更新预算表、总额不超 50 万）。
- **约束敏感性**：产物内约束一致性核对通过——总额恰好 500,000 元；小红书信息流 0 元且含绕道禁令（代理商/达人/内容加热）；人群要求展开为「城市/年龄/职业/性别」四条件核验并设暂停线。**Spec 要求的合成 A/B 约束敏感性 eval（改变预算/人群/禁止渠道后重跑对比）尚未执行，记为待办**，不冒充已通过。
- 结论：**专业质量（本样本）达到 Spec §3.4 的定性要求**；A/B eval 未跑，不计作通过项。

## 5. 阻碍与未知（Spec §3.5）

| 类别 | 项 | 可证实原因 | 下一动作 |
|---|---|---|---|
| 无外部阻碍 | 模型链路全程可用（codex 用户级认证），未出现缺配置/配额/模型拒绝/网络阻断 | — | TASTE-2 未触发；B0+B1 无需 partial 标记 |
| 未知 | 「首次真实 HTML 时间」受任务复杂度影响；本轮样本 201s/218s | 单样本，未做基准 | B1 验收时按同任务复测 |
| 未知 | 远端 CI（GitHub 无 check run） | 与 pr2 记录一致 | 保持不声称远端验收 |
| 待办 | Spec §3.4 合成 A/B 约束敏感性 eval | 本轮未执行 | B1 实施期间补跑并记入本记录 |
| 待办 | 场景管线 UI 全流程重放（Home 场景卡 → discovery/generate） | 本轮经 daemon HTTP 驱动 | B1 G5/G6 验收覆盖 |

## 6. cold/prepared 计时（Spec §3.6）

| 指标 | 值 | 备注 |
|---|---|---|
| 冷环境依赖安装 | 33s（`pnpm install --frozen-lockfile`，Node 24.15.0） | 空数据根 + 无 node_modules |
| dev 启动到双服务 running | <1min（tools-dev start） | 命令序列：install → start → status → logs |
| 生产构建 | `pnpm --filter @open-design/web build` 约 3min | 后 `restart --prod` 即生产态 |
| 真实 HTML 产物可见时间 | 201s / 218s / 64s / 156s（四次 run） | **全部 ≤5 分钟诊断目标内**；为诊断值，非发布门禁或速度承诺 |
| 失败与阻碍 | 无（4/4 run 一次受理、一次成功；无重试） | — |

## 7. 八视图迁移记录（Spec §2，B0 补全）

源设计版本：冻结包 `docs/designs/mokina-v0.0.2-20261002/design-baseline.zip`（manifest `mokina-v0-0-2-4c39`，21 项 SHA 已核验）。证据路径中的行号为当前 main 检出。

| 视图 | 实际入口（main） | 状态 | 具体缺口 | 批次 / 证据 |
|---|---|---|---|---|
| P01 首页开始 | `HomeView.tsx`（直接输入 + 场景 chips；Mokina edition 下默认场景 chip `mokina-market-analysis`，HomeView.tsx:1961-1962）；创建+首发复用 `POST /api/projects` 的 `pendingPrompt` 与 sessionStorage auto-send 键组 | 部分适配 | 首页不重复最近卡片墙、资料/背景辅助入口的真实接入、场景切换保留文本与附件——B1 改造点；确认式推荐 D8 已确认后置 | B1；本记录 §2.3 |
| P02 项目目录 | `EntryNavRail.tsx` / `RecentProjectsStrip.tsx`；`GET /api/projects`、`GET /api/projects/:id/tabs`（`hasSavedState` 标志可区分「无保存 tabs」与「未知」）；现有 500 行可见读取测试 | 部分适配 | 项目行成果摘要（formalCount 判定）与状态占位需 B1 新解析函数 `artifacts/mokina-project-entry.ts`；候选/历史/legacy 显示规则 | B1；§2.1/§2.2 |
| P03 成果工作区 | `ProjectView.tsx` / `FileViewer.tsx`（20688 行）；PR2 面板动作、草稿保持、指示条 3×36px 居中、聊天裁剪守卫（本轮 e2e `mokina-workspace-actions` 3 项通过，生产 CSS 双尺寸） | 已有待复验（本轮已复验通过） | 深链/多成果选择器/失效原因展示为 B1 新增；八页完整迁移与玻璃材质 | B1 最小接入；全面迁移 B4；本记录 §3 |
| P04 资料选择 | `mokina/materials.ts`（.md/.txt/.csv 文本分组提取、.pdf pdftotext、10MB 上限、sha256 contentDigest）；`readMokinaMaterial` 挂接 routes/project/index.ts:75 + `GET .../files/:name/material` | 真实入口已有 | 选择→发送的上下文快照、解析失败展示、依据视图（本轮未接） | 入口 B1；解析/依据 B2；本记录 §2.1 |
| P05 单章修订与比较 | `POST .../files/(.+)/candidates`（baseVersionId+sectionId+replacementHtml+operationId）+ `replaceHtmlSection`（mokina/sections.ts，`data-mokina-id` 寻址、字节级保真替换）+ FileViewer 修订作业恢复 | 链路已验证（§3 回放） | **发现：裸任务（不挂场景 Skill）的产物不含 `data-mokina-id`，单章修订不可寻址**；章节标记规则由场景插件 report-contract 规定（plugins/_official/scenarios/mokina-marketing-plan/references/report-contract.md:4） | B0 链路；完整视图 B3/B4；§3.3 |
| P06 版本与导出 | versions/candidates/adopt/restore 端点组 + `ProjectFileVersion` 契约（current/candidate/adoptionOperationId/frozenContent）+ artifact.json `exports:["html","pdf","zip"]` | 链路已验证（§3 回放） | 指定版本导出 UI 与导出锁保持为既有能力；PR2 已覆盖面板层 | B0 链路；完整视图 B4；§3 |
| P07 接续确认 | FileViewer `MokinaActionRequest{action:'continue'}`（内存 handoff）；修订作业 localStorage 恢复键 `mokina:revision:<projectId>:<fileName>`；草稿 extras 机制可承载接续草稿 | 查证完成 | 品牌/素材接续与固定摘录冻结为独立成果——B3 范围；本轮仅核实承载机制存在 | 查证 B0；接续制作 B3；FileViewer.tsx:9,3349-3390,3492 |
| P08 活动页成果 | 通用 HTML 成果工作区（无独立第八套路由，与冻结设计一致）：任意 .html 文件走 FileViewer + versions + artifact.json 元数据 | 结构一致 | 活动页真实制作（通用能力的具体产出质量）未在本轮回放；验收在 B4 | 真实制作 B3；整体验收 B4；§3.3 |

**B0 结论（迁移记录）：** 八视图中 P03/P04/P05/P06/P07 的既有基础与承载机制在当前 main 上经真实运行核验存在且可用；P01/P02 为 B1 的直接改造面。关键新发现：单章修订依赖场景 Skill 的章节标记契约，裸 run 不产生可寻址章节——B1 接入「制作活动页」入口时须按 FR-02 经场景能力发起，不做假入口。

## 8. B0 退出结论

- 核心代码回归：guard / typecheck / i18n:check 全部通过；定向 Vitest web 44 项 + daemon 8 项全部通过；生产构建成功；e2e `mokina-workspace-actions` 3 项（双尺寸）通过。**无本批关联失败需要修复。**
- 真实链（G6 工程链部分）：资料→章节 HTML→单章候选→显式采用→指定版本 HTML/PDF 全部经真实模型与真实产物读回验证通过；幂等重放（同 clientRequestId 单 run）在 API 层证实。
- 专业质量：单样本定性达标；A/B 约束敏感性 eval 为待办（见 §5）。
- TASTE-2 未触发（无外部模型配置阻碍）。
- **B0 可标记完成（A/B eval 待办与场景 UI 重放待办不阻塞 B1 开始，按 TASTE-3 单切片推进）。**

## 9. B1 实现与验收（2026-10-03 补记）

实现范围（Spec §4–§8，分支 `codex/mokina-v0.0.2-b0-b1`）：

| 组 | 交付 | 验证 |
|---|---|---|
| G1 | `apps/web/src/artifacts/mokina-project-entry.ts` 纯判定（§5.1 正式判定 + §5.2 打开优先级 + 行摘要）；ProjectView 打开回退按 intent（1 正式直开 / 多正式 `MokinaEntryChooserDialog` 选择器 / 0 正式与 legacy 落文件入口 / 读取未知等待不猜零）；OpenDesign 版（off）保持原 selectPrimaryProjectFile 路径 | 表驱动单测 18 项；e2e `mokina-navigation` 双尺寸（单正式自动打开 ✓、多正式选择器选择 ✓、深链失效不静默回退 ✓） |
| G4 | `apps/web/src/hooks/useMokinaProjectSummaries.ts` 共享元数据 store：可见行订阅、全局并发 ≤2 队列、订阅级取消（含「取消被 registry 吞成空数组」的过期写防护与新读让位）、采用/删除/重命名事件失效 | rail 单测 20 项（含失效复核）；发现并修复与封面扫描共享请求的 pin 冲突（onboarding 回归） |
| G2 | `runtime/chat/send-request-state.ts` 三态持久化；streamViaDaemon 增 `onRunCreateAccepted/onRunCreateFailed({definitive})` 回调；handleSend POST 前落 pending（写失败停草稿不 POST）；unknown 只读核对（GET /api/runs 按 clientRequestId 幂等底座）；composer 底部「结果待确认」非打断提示 + 只读核对按钮 | 状态模块单测 7 项（含配额写失败、跨 scope 隔离、8 条上限）；daemon 幂等（同 clientRequestId reused:true）在 B0 已实测 |
| FR | FR-01/02：直接输入 + 两手动场景已就位，「更多→制作活动页」按 B0 发现后置（TODOS 记录，不做假入口）；FR-03：HomeHero 工作目录行新增「资料/背景」入口 → 既有设计系统视图（Home 保持挂载不丢草稿）；FR-04：recent 行成果摘要一行截断（5 词条 ×19 locale） | P01 截图（见 evidence） |
| G5 | `e2e/ui/mokina-navigation.test.ts`（新增）+ `mokina-workspace-actions` 既有 3 项 | **e2e 5/5 通过**（双尺寸，suite 隔离生命周期）；P01/P02 生产截图 ×2 尺寸存 `docs/evidence/mokina-b0b1-b1/` |
| 两版 | Mokina on：最终生产构建 + 18613/18614 实测；off：独立 `NEXT_PUBLIC_MOKINA_EDITION=off` 构建 + `MOKINA_LOCAL_EDITION=off` daemon（18615/18616），home 无 Mokina chips、无资料入口、hero 为原版 Prototype，截图存证 | 不能同一构建换 env 冒充；off 首次验证曾误用 dev 模式服务（无效前提），改 --prod 后通过 |

### B1 过程中修复的自引入问题

1. `MokinaEntryChooserDialog.module.css` overlay z-index 90 → 160（app-scrim-layer 地板 150 硬门槛）。
2. 元数据 store 与封面扫描共享 `sharedCancellableGet` 请求时以无信号身份 pin 住废弃扫描的 abort——补订阅级 AbortController（可取消读者身份）。
3. StrictMode 重挂载下 registry 把「订阅取消的 abort」吞成空数组 → store 误写「确认空目录」→ 打开回退误走零正式分支（e2e dev 模式确定性复现）；修复：被中止/过期的读取不落记录 + 新读在途时旧读让位。
4. ProjectView 元数据 hook 改为仅在打开回退真正需要时订阅（不干扰既有测试桩请求序列，亦是 Spec「按需」要求）。

### 回归与基线失败声明

- 本批后全套 web Vitest：**12701 passed / 8 failed**——8 项与干净 HEAD（stash 后）完全一致，均与本批无关：`deepseek-v4-flash-ui-contract` ×2、`i18n/locales`（zh-CN.homeHero.title 占位符，main 既有）、`state/config.test mergeDaemonConfig`、`HomeHero.rail`、`HomeHero.scenario-cards`、`chips.automatic-default` ×2。
- guard ✓（期间清理了 B0 遗留在 `e2e/.tmp` 的临时脚本——E2E 布局检查项）；typecheck ✓（含 contracts 重建）；i18n:check ✓；daemon 定向 4 文件 8 项 ✓。

### G6 真实链（B1 增量）

对 B0 真实回放项目（真实产物、真实端点）核对判定输入：`预算分配与渠道优先级.html` formal v1（正常首稿）；`传播内容与排期.html` formal v3 + `adoptionOperationId=b0-adopt-001`（显式采用），与 B0 记录一致——resolver/摘要的真实输入在当前 main 构建上复验通过。发送三态的 daemon 幂等底座（同 clientRequestId 重放 reused:true、无第二 run）为 B0 实测。

### B1 遗留与边界

- e2e 环境侧栏默认折叠：recent 摘要的浏览器级断言由单测覆盖（20 项），e2e 保留 P01 截图作视觉证据；rail 展开态的行摘要人工目验通过（本节截图）。
- unknown 恢复流程的浏览器级端到端（断网→刷新→核对）未在本轮注入故障演练；由状态单测 + daemon 幂等实测组合覆盖，标注为部分层级证据。
- 任务 C 开放 CSV 抽测、A/B 约束敏感性 eval：仍为待办（§5）。
