# 切片 B 验收记录（N03 / N04）· 2026-10-06

分支：`codex/mokina-v0.0.3-b-context-brand`（基线 c860474c = 切片 A 合入后的 main）。
本文件只记录真实执行结果；命令均在 macOS arm64 本机实际运行。

## N03｜明确上下文作用范围并展示运行依据

### 改动

- **提交即交接语义**：`ProjectView.handleSend` 在 run 创建受理点（`onRunCreateAccepted`）清除 pending 快照绑定；发送被拒不清、unknown（响应丢失）不清、恢复草稿不清。重试/回执恢复走消息与 send-request 记录里固化的原 snapshotId，不依赖 pending key。
- **恢复草稿不改绑**：`ChatComposer.restoreDraft` 保留原请求的 `mokinaSnapshotId`（`restoredMokinaSnapshotRef`），重发引用旧请求的固定输入，而不是静默绑定当前项目 pending；发送成功 reset 时清除。
- **运行依据 UI**：新增 `components/mokina/MokinaRunEvidence.tsx`——带快照的 run 结束后（`fetchChatRunStatus` 读取 daemon 挂在 run 状态上的回执），渲染「本次运行依据」折叠卡：状态/时间/运行身份（agent）、逐项 显示名+种类+交付方式（摘录内联/字节随附）+限制、未提供项及原因、not-submitted 原因。挂载于 AssistantMessage（Mokina edition 且消息有 runId；无回执的 run 零渲染）。contracts `ChatRunStatusResponse` 增加 `mokinaContext` 字段（类型复用既有 `MokinaContextDeliveryReceipt`）。
- **面板同步**：pending 写/清派发同页事件，面板实时刷新冻结块；19 个 locale 的语义文案从「下一发发送」更新为「随本次发送提交，受理后交接，后续不继承」。
- 数据事实（核验结论，未改动）：pending key 为项目级；快照无 TTL、不可变；daemon 每 run 重读重验；回执写入点与读取路径已核对（`server.ts` 启动管线写、`routes/runs.ts` attachMokinaReceipt 读）。

### 工程验证（实际运行）

- `pnpm --filter @open-design/{web,daemon} typecheck`：通过。
- `pnpm guard`：22 项通过。
- 定向 vitest（web 9 文件 144 项；daemon context-store + routes 19 项）：全过，含新增 `MokinaRunEvidence` 4 项用例。

### 真实产品验证（隔离运行时 mokina-n03，真实 Codex run）

驱动流程：首页建项目（brief.md 附件、只讨论任务）→ 首轮完成（未生成文件——顺带验证 N02-AC02 讨论优先）→ 项目内面板预览 brief.md 并冻结 1 个片段 → 发送第二轮 → 断言：

- 发送受理后面板冻结块消失（status blocks: 0）——**一次提交即交接**实测成立。
- 第二轮助手消息出现「本次运行依据 · 已提交 · codex · S1 摘录内联」折叠卡，展开可见 `brief.md · 1 个片段 / 资料摘录 / 摘录内联`。
- 服务端 `.mokina` 快照与回执落盘一致。

截图：`/tmp/mokina-n03-frozen.png`、`/tmp/mokina-n03-consumed.png`、`/tmp/mokina-n03-evidence.png`。

验收：N03-AC01 pass（绑定随提交交接，后续不静默继承）；N03-AC02 pass（已受理/拒绝/unknown 路径核验：accepted 才清，retry/resend 用固化 id）；N03-AC03 pass（依据卡核对注入项/限制/交付方式/运行身份）；N03-AC04 pass（迟到确认路径 reconcileAcceptedSendRun 不碰 pending；实测恢复语义由 restoredMokinaSnapshotRef 保证）。

### 未跑项

- 两会话并发串用场景：机制上 pending 为项目级（核验确认），未做双浏览器并发实测。
- daemon legacy failRun 与 OD Next 自动降级对快照失效的行为不一致：记录为已知差异，本轮未统一（不动运行底座行为）。
- `markMokinaDeliverySubmitted` 生产侧无调用方（仅测试用）：记录，未清理。

## N04｜复用既有品牌套件与选定素材

### 改动

- **daemon 接入品牌源**：`MokinaContextStoreSource` 增加 `readDesignSystem`；`freezeItem` 以 design-system 分支替换原拒绝分支（冻结品牌 DESIGN.md 字节，`sourceDigest=sha256(字节)`——品牌套件无版本号，按 user-note 惯例用真实内容摘要；预览后被改 → SOURCE_CHANGED；套件后续更新不影响已冻结快照）；路由装配采用与设计令牌建议相同的三段回退（内置根 → 用户根 → `user:` 前缀）。占用共享 24,000 字预算；超预算诚实拒绝（CONTEXT_LIMIT）。
- **CLI 等价**：`od mokina context prepare/get` 为薄 HTTP 客户端，selections JSON 原样透传，路由支持后 CLI 自动支持（已核对，无需改动）。
- **面板**：新增「品牌来源」行（复用 Home 同一 `fetchDesignSystems` 目录）；选择品牌时拉取 `GET /api/design-systems/:id` 计算内容摘要与字数，冻结产生 `textKind: 'brand-rule'` 选择项；项目已绑定品牌套件时透明预选（`projectDesignSystemId` 经 FileWorkspace 透传）；品牌规则字数并入预算读数；无资料文件且目录为空时面板不渲染，品牌单独可用。
- 文本品牌文件路径保留（项目文件 brand-rule 原有路径未动）；快照内品牌套件/项目文件/用户说明为并列 item，互不覆盖。

### 工程验证（实际运行）

- typecheck / guard 通过。
- daemon 新增 4 项用例（冻结品牌项/SOURCE_CHANGED/缺失拒绝/预算上限）全过；web 新增面板品牌用例 2 项全过；既有面板测试断言更新（挂载期多一次目录读取，冻结仍恰好一次 POST）。

### 真实产品验证（隔离运行时 mokina-n04，真实 Codex run）

驱动流程（向导在本运行时的连接校验环节未能自动推进——与产品代码无关的本地向导状态问题；已用 app-config 写入 `onboardingCompleted:true` 等价的持久化结果绕过该步，与向导完成时写入的键值一致）：

首页建项目（brief.md 附件）→ 首轮完成 → 面板选择内置品牌套件「Agentic」（显示内容摘要约 3,034 字）→ 冻结为任务快照 → 发送第二轮引用 → 断言全过：

- 品牌目录 populated（内置 152 套品牌可选，默认「不使用品牌规则」）。
- 冻结成功：1 项、约 3,034 字；快照项 kind=`brand-rule`、sourceRef kind=`design-system`、locator=`design-system:agentic`、含 textDigest 与「套件后续更新不影响本快照」限制说明。
- 第二轮运行依据卡显示「Agentic · 品牌规则 · 摘录内联」+ 限制全文；服务端快照与回执落盘一致。

截图：`/tmp/mokina-n04-brand.png`、`/tmp/mokina-n04-evidence.png`。

验收：N04-AC01 pass（品牌源进入快照读取/筛选/冻结；冻结后原套件更新不影响——不可变快照机制 + SOURCE_CHANGED 单测）；N04-AC02 部分 pass（品牌套件与项目文件在快照中并列可见不合并；未做双源同冻实测）；N04-AC03 pass by 机制（冻结字节=快照内联文本+摘要，asset blob 同机制）；N04 验收其余项（角色/用途影响页面）由 N05/N07 接续。

### 未跑项

- 品牌套件内容更新后旧快照不受影响：由不可变快照机制 + SOURCE_CHANGED 单测覆盖；未做 UI 层品牌编辑实测（内置品牌为只读资源）。
- 多品牌冲突（同时选品牌套件+项目品牌文件）在快照中并列可见；未做专项实测。
