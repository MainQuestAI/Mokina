# Mokina v0.0.4：开发文档初审与 worktree 起点

2026-10-08，Asia/Shanghai。结论：最新 main 与附件基线一致，开发 worktree 已建立；版本入口及文件清单已补齐，S01/S02 可作为后续实施起点。产品尚未实施，运行验证与视觉签收均待执行。

## 本轮任务和证据边界

本轮用户明确要求基于最新基线审查品牌焕新开发 spec，目标版本 v0.0.4，并建立开发 worktree。附件中的“请实施”、历史审批、工具调用与评审结论作为文档输入读取；本轮执行范围为文档审查、版本/基线对齐及本地 Git worktree 建立。本文不是新候选的验收记录。

附件原件为 `Mokina-Brand-UI-Spec-2026-10-08.zip`，spec revision 1.1，SHA-256：`17a0ac69cc897f1d52e7df58f7c856d3fa095a821dad48d7bb534186a4055c95`。原件和解包快照保留在本次执行环境的 attachments 与 work 目录。仓库中的活动副本已同步附件，并整理为 revision 1.2；产品目标版本是 0.0.4，两种版本号分别表示文档修订和产品版本。

## 开发现场

| 项目 | 本轮核实值 |
|---|---|
| 仓库 | MainQuestAI/Mokina |
| 最新 main / 实际 base | `52219d8c8f71460d3776a96b9ebe84fa9ce65501`，PR12 合并提交 |
| 远端复核 | 已连接 GitHub 工具 GET `https://api.github.com/repos/MainQuestAI/Mokina/branches/main`，与本地同 SHA |
| 原始功能基线 | PR11 merge `9a6ba583df35c01f6b34a41fdbb8d414377ba513` |
| base Git tree | `2c25b3e6e69a0f5485fc9aca63ce0ced98242641`，与 PR12 head `810ca2e6` 相同 |
| 实际新分支 | `codex/mokina-v0.0.4-brand-ui` |
| 新 worktree | `/workspace/work/Mokina-worktrees/v0.0.4-brand-ui` |
| 原 worktree | `/workspace/Mokina`，仍在 `work` 分支 |
| 工作状态 | 仅文档未提交改动；HEAD 保持实际 base |
| 运行环境 | Linux；Node v24.19.0；工程要求 Corepack / pnpm@10.33.2 |

Git fetch 和 ls-remote 因环境代理 `proxy:8080` 连接失败，未声称拉取成功；远端身份通过 GitHub 工具实时读取。main 对 PR11 的 `open-design/`、原型源码、public、scripts、tests 和根 package.json 差异为空；PR12 增加的是规格与治理文档。

根 package.json 的 0.2.1 是历史 HTML 原型版本，open-design 各包的 0.22.1 是宿主工程版本；本轮不将这些包统一改为 0.0.4。Mokina 安装候选应在构建时明确 app version，并登记产品源码与资源 hash；当前未创建安装候选。

## 初审发现与处置

| 编号 / 优先级 | 依据与影响 | 本轮处置 |
|---|---|---|
| R01 / P1，实施入口 | 附件 backlog.development_version、sources.development_baseline 及执行提示词仍为 v0.0.3，分支名为 v0.0.3-brand-ui；直接执行会与用户目标不一致。仓库副本还有七个未同步的 v1.1 基线元数据文件。 | 已同步附件，再把活动 README、执行提示词、QA 分支说明与机器元数据统一为 v0.0.4 / 新分支。保留原 PR11/12、v0.0.3、local.11 及原审查记录。 |
| R02 / P2，文件责任 | 01/07 要求核查裸 button 与共享 Button 两种 CSS，但 backlog 的 S02 source_paths 未列 primitives.css 和 packages/components/src/button.module.css；S01 又列 primitives。只按机器清单实施容易遗漏 hover/pressed 级联。 | 已补列 S02 文件并明确：S02 负责共享按钮样式，S01 只盘点品牌消费点，共享文件串行修改。主要现有目标由 41 个增至 42 个。 |
| R03 / P2，接线前检查 | 现有 layout.tsx 的 html/body 没有产品作用域属性；mokina-edition.ts 是编译期布尔 gate；ProjectView 的 workspaceLayout 类只覆盖项目。不能假设首页、设置和 body Portal 已有统一 Mokina 样式作用域。 | 已在 S02 列出只读定位文件及首帧/Portal 要求。后续 S02 必须明确挂载方式，与 S01 layout、S03 App 串行协调，并验证 edition off；本轮未添加属性或改 CSS。 |
| R04 / P2，验收能力 | S02-AC04 要求真实 VoiceOver；S03/S05/S06/S07 涉及 macOS 新候选、双原生窗口、真实旧 profile、外部打开及用户签收。当前 Linux 环境无法给出这些 macOS 原生证明，历史 local.11 也不是本轮候选。 | 保留全部 not_run，不继承历史通过。按 S07 在同一 v0.0.4 新候选上补齐；不阻塞文档审查或 worktree 建立。 |

以上是开发起点发现；未重开附件中 A 方向、浅色范围、七包结构和已有业务保护契约。D3–D17 的历史批准作为设计来源记录保留，母版最终 hash 与本轮视觉/专业签收仍是实施后的单独证据。

## 与源码核对的关键点

- packaged/src/index.ts:321 在 sidecar 启动前调用 createSplashWindow()，activeConfig.product 已在同一启动流程可用。S06 必须贯通首个 splash 调用者，保留真实启动完成与最小展示时间；只改 Web 或主窗口标题不足以覆盖首帧。
- providers/daemon.ts 中 readVelaLoginStatus、fetchAmrModels、fetchAmrWalletSnapshot 均有 Mokina 提前返回。本轮没有据 App 的调用推断新增 Cloud 请求，也没有运行网络行为验证。
- primitives.css 与共享 button.module.css 的 primary hover 仍有旧中性色；这是既定 S02 的改动对象。只修改默认背景或普通全局变量不足以证明 D9 三态与旧 accent 配置隔离。
- MokinaWorkspace.module.css 的 split-chat-slot 保留 overflow:visible；换肤不得向长 transcript 重加 backdrop-filter 或裁切层。
- 指定版本导出、未知结果不重发、恢复 operationId/identity/CAS、客户正文保护继续作为行为边界。存在测试文件与读到源码不能计为本轮通过。

## 首轮实施安排

| 顺序 | 包 | 具体起点与交接 |
|---|---|---|
| 1 | S01 | 候选 SVG 单一来源、MokinaBrand、favicon/apple 派生格式、各身份消费点与 1x/2x 样张。候选接线可先准备；发布前确认母版 hash。 |
| 1 | S02 | 先定位全应用/Portal 作用域，再做 token 别名、两种按钮级联、图标命中区、标题/正文角色、减少透明度/动态与长文 trace 基线。与 S01 的共享文件串行协调。 |
| 2 | S03 | 首页静态标识、真实输入器、提示顺序与主次、上游服务入口清理；保护首次准备落盘失败后的草稿/附件与同目标重试。 |
| 3 | S04 | 初始/首次运行空态、版本身份、比较三区布局与焦点；保护取消/保存失败及指定版本导出。 |
| 4 | S05 | 精确资料、409、未知/拒绝/缺资源区分、接续与窗口/会话隔离；通知接线继续遵守 D12。 |
| 5 | S06 | 绘画内容保护、packaged 首帧静态 A、Mokina profile 专属桌面资源与上游扫描兼容。 |
| 6 | S07 | 锁定单一源码/资源候选，完成真实 macOS、VoiceOver、旧 profile、双窗口、品牌清理与用户独立签收。 |

实现与定向产品检查均在 open-design/ 进行，按其 AGENTS.md 与相应目录指南执行。新 worktree 尚未安装依赖、启动 runtime 或分配数据目录；本轮只建立源码及文档起点。运行前使用 Corepack 安装冻结锁文件依赖，生命周期沿 tools-dev；OD_DATA_DIR 按 open-design/AGENTS.md 的唯一契约显式配置。本轮没有改变运行数据或历史成果。

## 本轮实际验证

| 检查 | 结果 / 范围 |
|---|---|
| 附件 validate_spec.py | PASS：7 包、19 AC、B01–B20、拓扑依赖、8 SVG 与包内 hash |
| manifest 完整性 | PASS：SHA256SUMS 覆盖所有包内文件（清单自身除外），无漏项或多项 |
| 原型参照指纹 | PASS：sources.json 列出的 11 个 bundled 文件逐项一致 |
| 原始目标与新增清单 | PASS：附件 41/41 可定位；活动 S02 清单补齐后 42/42 可定位 |
| 03 所列 Vitest 路径 | PASS：11 个 Web + 3 个 daemon 文件存在；仅路径检查，未执行测试 |
| 8 SVG 扩展检查 | PASS：解析/viewBox；无 script/image/foreignObject、事件属性或外部 href/src |
| 本轮 v1.2 validate_spec.py | PASS：仍为 7 包、19 AC、B01–B20、无环依赖、8 SVG 与更新后的 hash |
| 开发元数据一致性 | PASS：目标 0.0.4、新分支、实际 HEAD/base 一致；7 not_started、19 not_run、无候选证据 |
| Git diff --check | PASS：文档差异无空白错误 |
| guard / typecheck / 产品回归 | not_run：本轮只改开发文档，未宣称产品 ready |
| 浏览器 / trace / macOS / VoiceOver / 用户签收 | not_run |

未新增业务测试、测试框架或 CI 规则。后续改产品代码时，执行 03/07/08 的定向验证及 AGENTS.md 必需检查，记录实际基线失败；不使用根 npm test 证明原生产品通过。

完整机器记录见同目录 development-baseline.json；活动 spec 入口为 ../specs/Mokina-Brand-UI-Spec-2026-10-08/README.md。本轮文档改动留在新 worktree 供审查，未 commit、push、创建 PR 或发布。
