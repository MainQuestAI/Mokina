# Mokina v0.3：OpenDesign 专题与复用建议

日期：2026-09-14

状态：官方资料与固定提交源码抽查完成；桌面和浏览器查看均遇到超时，未取得界面截图、实际编辑或运行验证。本文提出复用方向，不代表已选定技术底座。

## 1. 本轮裁决依据与结论

用户明确接受参考、调整乃至直接修改 OpenDesign、AionUi 的开源代码，目的是降低试错成本，尽快推出营销专业人士可用的版本。产品形态可以相似，不为独特外观重新造一套工作台。

因此修正此前“寻找差异性”的重心：先识别能直接沿用的产品能力，再判断营销工作所需的调整，最后决定代码复用方式。对话加成果、局部编辑、版本和品牌规则都不是 Mokina 独有概念，也不应该重新发明。

建议将 OpenDesign 列为**优先验证的底座候选**，AionUi 为主要对照。原因是 OpenDesign 已围绕成果制作、修改、版本、导出和品牌规则组织工作，与当前 Mokina 的成果协作方向相近。这个优先级不等于已证明它比 AionUi 更易维护或能更快发布。

## 2. 项目身份与证据边界

- 官方仓库：[nexu-io/open-design](https://github.com/nexu-io/open-design)，由[官方来源页](https://open-design.ai/official/)确认，排除搜索结果中的同名 Fork。
- 源码抽查固定在 `39d9eb593ba41037d1900e73f0e62489ef8ac5c1`；GitHub tree API 返回 `truncated: false`。只读相关文件片段，没有全仓库审计或执行其测试。
- 仓库根 [LICENSE](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/LICENSE) 标为 Apache-2.0。具体复用仍应保留上游声明、记录文件来源，并核对所用插件和依赖各自许可；未完成依赖许可审计。
- 官网当时列出 v0.22.2，但固定提交中的 `apps/web/package.json` 为 0.22.1；不将组件版本、发布包和本机安装版本混为同一个验证对象。
- 下文 D 为官方描述，C 为源码观察，M 为 Mokina 建议。没有实际交互通过项。

## 3. OpenDesign 已提供什么

### 3.1 不是单纯的设计师画布（D）

README 的产品路径是：首页输入需求及配置 → 项目 Studio 内持续对话 → 文件及预览 → 修改和导出；同一工作区覆盖原型、演示文稿、图片、文档与动画。品牌设计体系、技能和模板可以复用。[产品导览](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/README.md#product-tour)

官方也面向营销团队，重点包括品牌一致的落地页、社媒图卡和活动素材，并展示邮件、营销计划等模板。因此不能简单断言“它服务设计师、不服务营销”。当前公开路径更偏向设计成果生产，Mokina 应检验其能否同样顺畅处理访谈理解、策略讨论、文字排期与数据分析。[营销使用场景](https://open-design.ai/solutions/marketing/)

这些描述不证明所有生成结果已经符合品牌，也不证明每个模板都经过实际效果验证。

### 3.2 工作区、编辑和版本已有可借鉴实现（C）

| 观察 | 固定源码位置 | 对复用的意义 |
|---|---|---|
| 文件工作区接收标签状态、当前会话、评论、导出请求；标签状态由上层管理 | [FileWorkspace.tsx](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/FileWorkspace.tsx#L231) | 对话、文件与成果预览可以沿用既有组合，不另造页面导航 |
| 工作区标签按身份范围保存，并处理同一项目的重复标签 | [WorkspaceTabsBar.tsx](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/WorkspaceTabsBar.tsx#L105) | 有状态组织基础；Mokina 仍需映射到自身工作和项目关系 |
| 手工编辑有选定目标、草稿、保存/取消、撤销/重做以及浮动面板 | [ManualEditPanel.tsx](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/ManualEditPanel.tsx#L7) | 局部编辑交互不必重新发明 |
| 编辑目标和 patch 主要是文本、链接、图片、容器、样式及 HTML | [edit-mode/types.ts](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/edit-mode/types.ts#L94) | 能选 DOM 元素不等于能保证“只改第三条文案、日期渠道不变”；业务条目仍需稳定身份 |
| 文件版本面板分别记录选择的版本、正文版本、预览缓存和恢复确认 | [FileViewer.tsx](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/FileViewer.tsx#L3368) | 可以参考版本预览及交互；恢复当前文件不自动等于营销方案采用 |
| 版本记录包含来源、摘要校验值、父版本和恢复来源，内容快照使用 HTML 文件 | [project-file-versions.ts](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/daemon/src/project-file-versions.ts#L491) | 可评估底层版本机制复用，但本模块不能直接当成所有结构化营销成果的版本库 |
| 其他项目引用选取项目与目录，并作为上下文提供 | [ProjectReferenceModal.tsx](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/ProjectReferenceModal.tsx#L12)、[workspace-context.ts](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/workspace-context.ts#L3) | 已有上下文复用入口；这条路径不等于只携带指定版本的两条结论 |

### 3.3 必须弄清楚的一处版本语义（C）

当前实现明确区分历史卡的封面与点击目标：历史卡尽量显示当轮固定快照，点击则打开工作区最新文件；缺少快照时，相关卡片可以退回当前文件呈现。[ChatArtifactRef 契约](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/packages/contracts/src/api/chat.ts#L1202)、[前端引用解析](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/runtime/chat/artifact-refs.ts#L1)、[成果卡呈现](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/src/components/FileOpsSummary.tsx#L574)

这不是本轮认定的 OpenDesign 缺陷，而是它的工作方式。Mokina 可以让“继续编辑”打开当前稿，但“查看这次结果／引用这版结论”必须固定版本，界面明确区分两个动作。无法确认旧内容时不能将当前稿冒充历史依据。

仓库里同时存在一份 2026-09-01 的[版本语义审计稿](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/specs/current/chat-artifact-versioning-design.md)，开头标注待评审，部分描述与后续契约不同。本轮以读取的实现为当前证据，不把旧审计稿的问题列表当成现在尚未修复的缺陷。

## 4. 到底学什么、调整什么、补什么

“直接复用”在本表指优先保留现成交互和实现的候选，不代表已经完成代码移植或可直接通过 Mokina 验收。

| 处理方式 | 具体内容 | 面向营销人员的结果 | 主要参考 |
|---|---|---|---|
| 优先直接沿用 | 对话旁成果工作区、多标签、展开阅读、文件导入与导出入口 | 同一个地方讨论、阅读和修改，不反复跳页 | OpenDesign；AionUi 对照 |
| 优先直接沿用 | 本地文件管理、后台运行状态、取消/恢复框架 | 等待时可处理另一项工作，结果可找回 | 两者按实测结果选一个主底座 |
| 保留机制、调整入口 | 首页输入、模板和技能选择 | 默认“这次要解决什么问题”；访谈分析等示例可选，不必先决定输出是 HTML 还是图片 | OpenDesign 入口与 Mokina 目标契约 |
| 保留机制、调整内容 | 品牌设计体系与可复用方法 | 视觉规范之外，明确品牌事实、表达、受众背景和禁用承诺；每次可选择，不强制先完成品牌建档 | OpenDesign 设计体系；营销资料适配 |
| 保留编辑框架、增加业务视图 | 文档阅读、表格行编辑、分析结果 | 改正文、日期、渠道、CTA 或指标口径，而非默认面对 CSS 和 DOM 属性 | OpenDesign 编辑器；Mokina 结构化成果 |
| 改造版本操作语义 | 历史记录、版本预览与恢复入口 | 在需要时比较候选、指定采用和固定引用；简单手工修改不增加强制审批 | OpenDesign 版本机制；Mokina 采用契约 |
| 补齐业务契约 | 本次资料选择、运行依据、成果版本来源 | 能回答“这条结论根据什么”，换资料不改写旧成果来源 | 以 Mokina Spec 为准，检查上游已有能力 |
| 补齐业务契约 | 选定结论后接续 | 只带走所选版本的片段，原始分析保留；不默认附上整个项目目录 | 同上 |
| 本轮不优先搬入 | 多模型目录、插件市场、团队计费、复杂设计检查器 | 默认界面聚焦当前营销工作；有需要再展开，不删掉未来扩展可能 | 按用户任务决定，不以竞品菜单定义范围 |

后四项是 Mokina 的要求或调整建议，不是未经全仓库审计便认定 OpenDesign 没有相应能力。已有实现满足要求时直接复用。

## 5. OpenDesign 和 AionUi 如何分工参考

OpenDesign 的优势证据集中在“制作成果—工作面修改—版本—导出—复用品牌规则”；AionUi 前轮固定源码证据集中在“本地文件—持续会话—多标签预览—未保存编辑保护—恢复”。这说明两者各自适合优先检查的位置，不足以直接排名整体成熟度。[AionUi 证据与限制](Mokina-v0.3-开源同类产品交互调研.md#4-aionui工作现场与编辑状态)

建议先验证 OpenDesign 作为主底座，AionUi 作为对照和局部实现参考。不要先把两套会话、状态、运行时和存储系统合并；确定主底座后，再逐项吸收另一个项目中确实有价值的实现。

也不建议现在把“从现有 HTML 继续扩展”当成唯一技术路径。现有 Mokina 0.2.1 更适合作为行为基准、合成数据和回归案例；哪些模型或函数值得保留，要看与新底座的接口是否匹配，而非保留旧壳。

## 6. 从参考走到代码复用，还需一个有结果的验证

代码层面并非复制一个组件即可：`@open-design/web` 依赖同仓库的 contracts、host、platform、sidecar 等包，工作区还连接项目状态、提供方接口和协作上下文。[依赖清单](https://github.com/nexu-io/open-design/blob/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/apps/web/package.json)

优先评估“在隔离的上游副本里做最小营销适配”，再决定完整 Fork 还是抽取模块；不先把大型组件零散复制到现有单文件原型。是否更省试错，需要以下实际结果，不靠源码规模或功能数量推断：

1. **运行基础**：固定提交，可本地启动；核对数据位置、必要服务、许可与可关闭的上游专属接入。只使用用户已授权的本地模型配置，不购买或接入付费云服务。
2. **同一营销任务**：两份合成访谈 → 一份可读可改的备忘录 → 只修改第二方向 → 保留原稿 → 选该方向继续写邮件。观察是否需要修改核心会话/运行系统，还是可通过入口、渲染器和上下文适配完成。
3. **两项压力检查**：社媒第三条只改正文；CSV 实际计算并选两条结论接续。确保并非只对 HTML 预览友好。
4. **形成选型记录**：原样可用的模块、需要修改的接口、未满足的业务要求、上游依赖和保留方式，以及实际操作证据。OpenDesign 若出现实质阻碍，再在 AionUi 做同一任务对照，不并行开发两套产品。

完成后再确定底座。现阶段推荐验证顺序，不把“可以 Fork”误写成“已经决定 Fork”。本轮没有克隆、构建、安装、启动模型或更改 Mokina 产品代码。

## 7. 对接下来设计工作的直接影响

- 工作台形态可以直接借鉴 OpenDesign，不需要为了产品身份重新设计所有布局和交互。
- 第一张设计稿应是有真实营销内容的工作区：左侧工作列表、对话、访谈备忘录及一处选中修改状态，而非先画全套新导航或组件市场。
- 优先调整用户每天接触的入口、对象和动作：工作目标、资料、段落/条目、日期/渠道、版本和引用；用营销语言解释现成能力。
- 先跑完整工作，再决定哪些区别需要在 UI 中突出。无需在每张成果上堆满来源、审批和计划状态。
- 新 OpenDesign 设计项目用于管理设计资产，与“是否采用 OpenDesign 源码作为 Mokina 底座”是两个独立决定，不混为一项完成记录。

## 8. 本轮验证与限制

成功：官方源身份、公开产品路径、营销使用场景、上述固定提交的源码片段、依赖和版本语义核对。

未成功：本机 `/Applications/Open Design.app` 界面读取返回 `timeoutReached`；浏览器查看官方工作区参考图也超时并重置会话。没有看到图像像素，因此不报告配色、布局尺寸或截图走查通过。官方参考图可由后续正常浏览器会话继续查看：[文档工作区](https://raw.githubusercontent.com/nexu-io/open-design/39d9eb593ba41037d1900e73f0e62489ef8ac5c1/docs/screenshots/product-tour/studio-document.png)。

Node 原生 fetch 批量读取超时；本文使用成功的 curl 与网页读取结果，不将超时请求计入证据。未运行上游测试，未实测保存、取消、恢复或导出；不以存在测试文件代替通过。
