# v0.0.4 品牌与 UI 实施记录

2026-10-08，目标 v0.0.4。S01–S06 已实施；S07 的源码集成、工程回归和交付记录完成，macOS 同包安装候选及用户签收待验。当前状态为 **工程实现完成、分层验收未完成、正式品牌发布 blocked**。

用户在文档审查和 worktree 建立后明确要求“OK，开始实施，目标是完成本轮的所有开发任务。”。本轮以此实施，不把附件中的执行提示词或历史批准自动解释为授权发布。没有 push、PR、tag、公开发行或写入真实用户资料。

## 源码与基线

| 项目 | 当前记录 |
|---|---|
| 仓库 / 分支 | MainQuestAI/Mokina / `codex/mokina-v0.0.4-brand-ui` |
| worktree | `/workspace/work/Mokina-worktrees/v0.0.4-brand-ui` |
| 本轮 base | `52219d8c8f71460d3776a96b9ebe84fa9ce65501`，初审时确认的 main |
| 原功能基线 | `9a6ba583df35c01f6b34a41fdbb8d414377ba513` |
| 冻结产品源码 | `c79843bafa7a7e2a61f33d81fcd78edf03c7236f` |
| 本轮 macOS 候选 | 未构建，版本 / source SHA / DMG、ZIP hash 均未分配 |
| 当前已签收安装版 | 原 `0.0.2-local.6`；本轮不替代历史签收 |
| 工具 | Linux、Node 24.19.0、Corepack pnpm 10.33.2、Chromium / Playwright 1.60.0 |

后续文档提交只更新记录，产品源码身份仍使用上述冻结 SHA。spec v1.2 的七包和十九条 AC 均保留，机器状态见 [backlog](../specs/Mokina-Brand-UI-Spec-2026-10-08/backlog.json) / [acceptance](../specs/Mokina-Brand-UI-Spec-2026-10-08/acceptance.json)。初审记录与历史 CI 原样保留，不计作本轮验收。

## 已实现内容

| 包 | 实现与实际路径 | 验证及剩余层级 |
|---|---|---|
| S01 Web 品牌与资产 | `MokinaBrand` 统一 mark / wordmark / horizontal；首页静态 A、展开/折叠导航与产品助手身份；layout 标题、SVG favicon 和 Apple PNG。真实 agent/model/editor 标识保持实际供应商。 | 8 母版 / 36 生成文件安全、尺寸、hash 和确定性检查；首页三种宽度截图。Logo 母版和所有表面最终视觉签收待验。 |
| S02 Tokens 与公共控件 | `html[data-product="mokina"]` 首帧和 body Portal 同作用域；最后加载 `mokina.css`。中性浅色基底、蓝色主操作、禁用/危险/成功语义、44px 图标命中区、标题和应用控制的阅读正文角色。玻璃只在固定导航/工具条，降低透明度/动态和不支持滤镜时有回退。 | 真实首页 default / hover / pressed、字体公式、窄屏和 off edition 浏览器检查；完整入口对比、命中区重叠、性能 trace 和 VoiceOver 待验。 |
| S03 首页、导航与输入器 | 准备提示只有未 ready 的重试为主操作；结果→准备→接续的提示顺序；保留上传/busy/确认门控。六个新键覆盖十九语言，产品文案在插值前换名，匈牙利语词尾保留正确语义。 | 保存失败、重新选择、ready/failed/leave/reload、真实模型和旧 Cloud 门控通过；中文组合输入及原生重启链待验。 |
| S04 工作台与修订 | 权威资料/消息/会话状态决定初始或首次运行空态；初始 CTA 复用既有输入器 focus 保留草稿。比较弹窗固定首尾、内部滚动、窄屏切换、焦点陷阱/Esc/恢复触发点；历史基准和采用中禁用保留。 | 长比较900×600和390×844、1280/1440工作区、版本恢复和采用约束回归；完整原生采用→导出→外部打开链待验。 |
| S05 精确资料与恢复 | 简短 live 通知只在真实状态变化时更新，详情不进入重复 status；旧身份异步结果不通知新项目。详情、来源、版本和错误动作保持原业务门控。 | 精确材料、snapshot、409、CAS、恢复身份及错误阶梯回归；DOCX真实选区、双应用窗口和响应丢失同包场景待验。 |
| S06 绘画与桌面身份 | 复用原绘画引擎与第三方图形，统一工具条交互样式。生成专属 PNG/ICNS/ICO/iconset；Mokina packaged 首帧与 desktop runtime 显式接 product profile，静态内联 splash / 崩溃恢复页、菜单和诊断对话框使用真实产品名；上游仍原扫描和原资源。 | 绘画保存/默认色、静态内联、启动阶段、上游扫描、pack/profile/paths/diagnostics 回归；Finder、Dock、关于、DMG及断网原生首帧待验。 |
| S07 集成与签收 | 扩展既有三个浏览器文件，整理本记录、工程结果、品牌清理分类、截图、runbook、B账和 icon-map。 | Linux 可执行工程检查已跑；没有 Mac，因此同一新安装候选、旧 profile 副本、双窗口和用户签收未完成。 |

数据 schema、snapshot、journal、用户文件、历史成果、模型凭据和生成指令未迁移或批量换名；未增加存储状态系统。材料和修订引擎沿既有路径。浅色是本轮应用主题；深底样张仅验证资源载体。

## 上游服务与旧配置

D14 接线覆盖 App/EntryShell、SettingsDialog、AvatarMenu、InlineModelSwitcher、ChatPane、HandoffButton、DesignFilesPanel、导航及原生 Help 菜单。Mokina 隐藏上游 Cloud、社区、支持和贡献入口，社区深链回到既有首页；实际供应商和本地文件提示仍保留。

历史 Cloud 配置显示明确不可用说明和现有模型设置入口；保留配置、凭据、输入草稿及成果，不自动切模型或重发，不触发生成 POST。旧 Cloud 错误卡不提供 Retry / Cloud 切换 / 上游支持；本地失败的显式手动重试维持原条件。纯英文产品替换不改 `@OpenDesignHQ` 等上游标识，服务词保留在被 gate 掉的历史路径。完整分类见 [brand-cleanup.md](brand-cleanup.md)。

## 工程证据

[机器证据](test-evidence.json)逐次列测试范围、实际数量、工具、源码身份和限制；[截图与日志](evidence/)来自真实浏览器/工具执行。不同 suite 有重叠，不相加为“唯一测试总数”。工程结果不替代 Mac 或读屏证明。生产 standalone Web 构建通过；构建自动加入的专用 dist include 已还原，不提交验证目录。整工作区 typecheck、guard、i18n 注册检查和 e2e typecheck 通过；各次源码身份单独记录，最终产品文案补丁另跑单元、生产构建与浏览器。

最终浏览器运行22/22通过，针对冻结源码，使用隔离 namespace 和 E2E scratch data；未读取实际用户数据。1440、1280、390 为 Web 视口；900×600 和390×844为比较弹窗检查。390 比较先在900打开真实桌面入口，再缩窄已打开弹窗，只证明对话框健壮性。测试没有调用真实付费模型，不能证明专业结果质量。

本轮曾暴露并修正比较弹窗 Portal 点击被父面板视为外部点击、异步禁用触发点造成焦点丢失、旧 Cloud 错误标题和匈牙利语连写词尾问题。首页空要求可使用 preset 的既有行为保留，删除了错误的“空输入必须禁用”测试假设。一次同时构建/启动导致冷启动 warmup 超时；一次与类型/单元检查并行的浏览器复核为21通过、1项reload后加载超时，错误上下文仍处于启动页，保留在 browser-pre-final-run.json。最终构建完成后串行重新验证。一次全 desktop 测试误跑在缺少 xvfb 的环境中失败；不将该结果描述为全 desktop 通过，交付仅列可运行的定向 suite。原跳过项仍保留。

## 验收与发布门槛

十九条 AC 按证据层更新：母版确认边界一条 passed（仅验证发布保持 blocked），十七条 partial，一条 S07 同包签收 blocked。`candidate_sha` 仍 null，因为没有安装候选；工程 `source_sha` 单独记录。

以下门槛尚未执行：macOS arm64 新同包构建和资源/DMG hash；Finder / Dock / 原生关于 / 菜单 / 离线首帧 / 崩溃恢复；旧 profile 副本与两个真实应用窗口；输入失败、精确 DOCX、指定版本导出并外部打开；VoiceOver 实际播报；同场景基线的50ms重复长任务 trace；授权业务资料的专业结果和视觉签收；Logo 母版最终确认。Windows / Linux 图标只做静态生成与校验，未构建发行包。历史白屏跳过、全依赖审计等既有未闭环项保留，不以换肤标记解决。

Mac 后续执行步骤见 [runbook.md](runbook.md)。此次 Linux 交付不宣称全轮原生验收、可公开发布或新增平台支持。继续原生验证时从冻结源码建立候选，任一产品源码/资源变化都递增候选并重新跑同包必需 AC，不能拼接多包结果。回退仅还原 UI/资源/测试，不清空用户数据。
