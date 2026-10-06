# Mokina v0.3 开源同类产品交互调研

日期：2026-09-14

状态：两轮通用调研完成，追加 OpenDesign 专题与复用方向修正；安装实测与视觉走查待进行。本文是设计讨论输入，不是开发验收结论。最新结论见 [OpenDesign 专题与复用建议](Mokina-v0.3-OpenDesign专题与复用建议.md)。

## 1. 结论与范围

前两轮建议以 AionUi 为工作区组织的主要参考。补查 OpenDesign 后，修正为：OpenDesign 与 AionUi 是主要参照和代码底座候选，优先验证 OpenDesign 的成果工作区是否能承载营销工作；LibreChat、Cherry Studio、Goose 作为专项参考，Eigent、OpenWork 作为补充。优先级表示验证顺序，不表示产品质量排名或已选定底座。

本轮只研究开源产品及其开源部分，不比较纯商业产品，不研究企业付费功能。用户已明确接受直接修改开源项目，目标是减少试错、尽快做出营销人员可用的版本；不为差异化另造工作台。当前尚未最终选择或 Fork 仓库、安装应用或接入真实模型。不能因为产品宣传支持某能力，就认定该能力在指定版本中已经可用。

Mokina 的设计对象仍是营销人员的桌面工作环境：目标与资料直接进入工作，在同一个工作区讨论、制作、修订和接续。保留工作、成果、版本、固定依据等业务契约；不继承美的客户外壳，也不把首页改成模型或助手目录。

用户已明确后续改用 OpenDesign MCP、新建项目重新设计。旧 Figma 与 HTML 保留为参考。本轮仅调研和落文档，未创建新设计项目、未修改产品 UI。

## 2. 证据怎么读

| 标记 | 含义 | 能证明什么 |
|---|---|---|
| D | 官方文档、仓库说明或发布记录 | 作者描述的能力、操作路径和限制；不等于现场运行 |
| C | 本轮读取的固定提交源码片段 | 该提交存在相应状态和处理分支；不等于已执行测试 |
| I | 社区 Issue 或建议 | 用户需求和问题线索；不等于官方已确认缺陷或已实现功能 |
| M | 针对 Mokina 的推导与建议 | 本轮设计判断，等待方案评审，不描述竞品能力 |
| V | 本轮实际页面操作、截图或文件验证 | 本轮尚未取得，不用 D/C 代替 |

公开文档按访问日期记录；除明确固定提交的链接外，分支和网页会变化。未做统一安装版本对齐，不提供星数排名或“谁更成熟”的量化分数。第一轮只有文档级判断，本轮补充了 AionUi 状态源码、LibreChat 接续/记忆、Goose 权限/恢复等证据。

## 3. 项目筛选

| 项目 | 与 Mokina 的关系 | 优先研究位置 | 本轮排除的方向 |
|---|---|---|---|
| [AionUi](https://github.com/iOfficeAI/AionUi) | 直接参考：桌面对话与本地文件工作 | 对话旁预览、标签、编辑保护、工作范围 | 多运行底座与多 Agent 配置中心 |
| [LibreChat](https://github.com/danny-avila/LibreChat) | 相邻参考：持续对话与独立成果 | Artifacts、项目归属、Fork、记忆控制 | 把聊天分支当作成果采用，把完整聊天复制当作片段接续 |
| [Cherry Studio](https://github.com/CherryHQ/cherry-studio) | 相邻参考：桌面信息组织与设计体系 | 内容优先的工作面、共享组件、状态规范 | 助手和模型目录主导营销工作入口；企业版 |
| [Goose](https://github.com/aaif-goose/goose) | 直接参考：本地执行和重复工作 | 权限、过程折叠、会话状态、Recipes | 把技术配置与完全自主权限设为营销用户的默认要求 |
| [Eigent](https://github.com/eigent-ai/eigent) | 专项参考：复杂任务分工 | 单 Agent 与多 Agent 工作形式 | 默认把调度和分工展示放在成果之前；云端付费服务 |
| [OpenWork](https://github.com/different-ai/openwork) | 专项参考：能力与工作流复用 | 桌面/核心工作空间、可共享能力 | 企业控制台和组织权限平台 |

开源范围提示：OpenWork 当前 README 明确区分 MIT 的桌面/核心代码和 `ee/` 的另行许可部分，本轮仅看前者；Cherry Studio 仅看社区部分。代码复用时还需核对选定提交与具体文件许可，本文不构成采用代码的授权判断。[OpenWork 许可范围](https://github.com/different-ai/openwork#licensing)、[Cherry Studio 仓库](https://github.com/CherryHQ/cherry-studio#-license)

## 4. AionUi：工作现场与编辑状态

### 4.1 文档能确认的交互（D）

预览模块将文件放进多标签面板，支持分栏及比例调整。Markdown、代码、HTML 有编辑路径；Office、PDF 等查看器不能据此称为通用 Office 编辑器。文档还描述了保存快捷键和关闭时的未保存提示。[预览模块说明](https://github.com/iOfficeAI/AionUi/blob/main/packages/desktop/src/renderer/pages/conversation/Preview/README.en.md)

对照路径可安排为：从对话打开成果 → 打开第二个文件 → 切换标签 → 编辑文本 → 关闭或返回。重点观察同一成果是否重复打开，以及编辑后关闭的处理。此路径来自文档，尚未实际操作。

### 4.2 本轮新增的源码证据（C）

固定提交：`6744099b279b991c17e31c243f0920477bd31cb6`。通过 GitHub 树接口取得提交标识，并读取该提交的 `PreviewContext.tsx` 相关片段，未克隆、构建或运行测试。

| 观察 | 固定位置 | 设计含义与边界 |
|---|---|---|
| 保存预览状态时保留编辑内容、原内容和未保存标记 | [L322 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L322) | 恢复草稿不应把它显示成已经写入文件 |
| 切换范围时保存离开范围的状态，再加载进入范围的标签与面板状态 | [L932 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L932) | 可参考按工作恢复工作现场；仍须追踪调用者才能确定其范围是否等同于 Mokina 的工作 |
| 标签可按 ID 更新元数据，不以当前标签替代目标 | [L143 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L143) | 后台更新与前台焦点需要分离 |
| 文件保存携带已知修改时间；流式更新遇到保存中或未保存编辑会跳过 | [L1096 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L1096)、[L1226 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L1226) | 有并发编辑保护设计；不能只凭分支存在认定全部保存竞争已解决 |
| 持久化范围数量上限为 12；文本保存有 80,000 字符限制 | [L220 起](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L220)、[L320](https://github.com/iOfficeAI/AionUi/blob/6744099b279b991c17e31c243f0920477bd31cb6/packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx#L320) | 不应把预览缓存概括为完整、无条件的业务草稿恢复 |

### 4.3 不应误读的证据（I）

Smart Canvas 提案讨论了长文协作中的整篇重写、上下文切换和段落级建议接受/拒绝。它说明这类需求存在，但不能用来断言当前 AionUi 完全没有局部编辑，也不能把提案计入已交付功能。[Issue #3148](https://github.com/iOfficeAI/AionUi/issues/3148)

### 4.4 对 Mokina 的建议（M）

借鉴对话旁工作面、就地打开、未保存提示、切换后的现场恢复。Mokina 要进一步明确“成果 ID＋基础版本＋片段 ID”，并把候选和已采用分开。成果即使导出为文件，用户也不应靠文件名猜测正在改哪一版。

后台完成只更新所属工作并显示可见提示，不自动切走用户当前工作。草稿恢复属于业务保存责任，不只依赖预览缓存。数据量超限必须显式提示或使用适当存储，不能静默丢弃。

## 5. LibreChat：项目、成果、接续是不同对象

### 5.1 项目是组织方式，不是制作流程（D → M）

文档路径是侧栏 Projects → New project → 名称和可选说明。既有对话可以更换或解除项目归属；删除项目不会同时删除其中对话。[Projects](https://www.librechat.ai/docs/features/projects)

Mokina 可借鉴项目归属的轻量表达，在输入附近显示可移除的项目标记。一般营销工作不需要先填写产品型号，也不能因填写产品信息自动进入上市方法。项目里的全部资料与本次选用资料仍须分开。

### 5.2 成果不必埋在聊天中（D → M）

Artifacts 提供独立呈现区域，可通过后续消息迭代；官方发布记录提到版本管理改进。其文档重点包括 HTML、React、SVG、Markdown 和 Mermaid，不能据此扩写为已经具备完整营销文档的审阅采用系统。[Artifacts](https://www.librechat.ai/docs/features/artifacts)、[v0.8.1 发布说明](https://www.librechat.ai/changelog/v0.8.1)

Mokina 可借鉴内容与消息分开显示。候选、查看、采用、导出四种状态仍按自身契约设计，不能由面板当前显示哪个版本来隐式决定采用。

### 5.3 Fork 不等于选取成果后继续工作（D → M）

LibreChat 从消息菜单发起 Fork，可选择携带可见消息、相关分支或更多消息，确认后创建新对话，原对话不变。它主要控制的是消息复制范围。[Forking Chats](https://www.librechat.ai/docs/features/fork)

Mokina 的接续单位应是用户选中的成果片段及固定版本。例如只带走访谈备忘录的第二方向，预览摘要和引用，再确认“写两版邮件”。不复制整串访谈讨论，不把已排除的服务事实重新带入。需要复用的是选择范围和确认的清晰度，不是整套 Fork 对话框。

### 5.4 记忆控制可参考，但要落实到业务范围（D → M）

LibreChat 的 User Memory 是可管理的结构化记录，区别于完整聊天历史检索；包含手动管理、对话内开关和可选自动提取，并支持 Agent 分区。[User Memory](https://www.librechat.ai/docs/features/memory)

Mokina 可将“记住简洁表达”设计成可确认、可停用的偏好。范围应向营销人员解释为“我自己／某个品牌／本次工作”，而不直接沿用 Agent 分区。一次采用只说明当次选择，不证明策略有效，也不自动写成长期偏好。

## 6. Cherry Studio：设计系统要管状态，不只是配色

本轮核对的设计规范固定提交为 `3cb467ea630ca55909b25e43948f09bce34084ea`。规范强调内容优先、中性工作面、颜色表达稳定语义，以及通过共享组件统一状态。全局规则、组件细节和页面组合各有归属，避免每页再造一套规则。[固定版本 DESIGN.md](https://github.com/CherryHQ/cherry-studio/blob/3cb467ea630ca55909b25e43948f09bce34084ea/DESIGN.md)

对 Mokina 的建议（M）：

- 统一按钮、标签、抽屉、提示、表格条目、版本选择器和输入区的行为与状态，三个营销场景只改变成果内容。
- 区分用户选中、键盘焦点、候选待比较、已采用、输入无效、运行失败；不能全部用一个彩色边框表示。
- 收窄窗口时优先折叠辅助区域，保留正文、输入和关键动作；表格按自身区域滚动。
- 阅读长文靠标题、行距、留白和工作面建立层级，避免层层卡片套卡片。

这里借鉴的是体系组织方法。尚未完成竞品像素级观察，也未批准 Mokina 的字体、配色和圆角，不能把上述建议标成完整视觉方案。

## 7. Goose：协作方式、执行权限、展示密度不能混为一谈

### 7.1 权限与展示分开控制（D）

Goose 文档列出自主、人工确认、智能确认和仅聊天等权限模式，可以在会话中切换。文档同时指出部分读写分类依赖模型判断；不能把模式名称当成所有底层动作的确定性安全保证。[权限模式](https://goose-docs.ai/docs/guides/managing-tools/goose-permissions/)

执行细节另有 Concise/Detailed 展示方式，控制工具记录默认折叠或展开，用户仍可逐条切换。[过程展示](https://goose-docs.ai/docs/guides/managing-tools/adjust-tool-output/)

### 7.2 复用方法与开始执行分开（D）

Recipes 将目标、说明和工具等组织为可重复工作。创建界面区分 Save Recipe 与 Save & Run Recipe；高级配置按需展开。[Reusable Recipes](https://goose-docs.ai/docs/guides/recipes/session-recipes/)

### 7.3 工作切换与恢复（D）

会话管理文档描述侧栏切换、后台处理中/完成/错误的提示、历史恢复，以及会话导出。导入会创建新会话 ID，这与 Mokina 旧备份去重合并的要求不同。[Session Management](https://goose-docs.ai/docs/guides/sessions/session-management/)

### 7.4 对 Mokina 的建议（M）

“协作／先定计划／自主完成”是用户怎么与 Agent 工作；“能否写文件、发布或访问外部系统”是权限；“是否展开执行记录”是展示。三个维度应分开，尤其不能把自主完成解释成自动采用和发布。

默认展示与用户目标相关的进度和需要决定的事情，技术记录可以展开。重复工作可保存成“下周内容排期方法”，但保存本身不运行、不自动安装能力。恢复历史和导入备份须依 Mokina 自身身份与引用契约，不直接照搬竞品的复制语义。

## 8. Eigent 与 OpenWork：专项参考，不增加本轮平台范围

Eigent 官方仓库同时描述单 Agent 工作和多 Agent 分工，而非所有工作都必须进入多 Agent 队伍。可参考复杂工作如何解释分工，但是否让过程占据主画面，仍需结合具体工作观察。[Eigent 仓库](https://github.com/eigent-ai/eigent)

OpenWork 的桌面与核心能力强调工作流和能力复用。可继续研究“同一工作方法如何复用于不同工作空间”，不把企业控制台、组织分发与权限管理纳入 Mokina 本轮。[OpenWork 仓库](https://github.com/different-ai/openwork)

Mokina 的默认用户是执行营销工作的人。主工作面优先回答“做出了什么、根据什么、接下来哪里需要我决定”，分工和工具细节按需查看。这是产品取舍，不是对多 Agent 技术价值的否定。

## 9. 三层综合判断

### 9.1 可借鉴的共同基础

在本次样本中，持续会话、工作组织、独立内容呈现、可展开执行记录和复用入口分别已有公开实现或文档。Mokina 不需要为了建立产品身份重新发明每个基础控件，但要把它们组织成面向营销成果的连续工作。

### 9.2 不应跟随的扩张

多个样本突出多 Agent、连接器、工作流共享和自动化。它们说明产品关注面在扩展，不构成 Mokina 必须同时增加多底座、企业控制台或能力市场的理由。也不以仓库 README 的宣传密度推断真实使用质量。

### 9.3 Mokina 必须满足的营销工作要求

以下不是排他性差异点，也不要求重新实现竞品已经具备的能力。营销人员反复处理的是“哪份成果、哪段表达、基于什么事实、哪一版被选择”。因此新 UI 的关键关系应是：

目标与本次资料 → 持续讨论／按需计划 → 成果工作面 → 定位片段修订 → 比较与采用 → 选择部分成果接续。

其中解释不新增版本，保存计划不制作，查看不采用，采用不发布，接续不复制整个项目。以上来自 Mokina 已有产品契约，不是本轮新发明的审批流程。

## 10. 对 v0.3 Spec 的设计输入

对照文件：用户提供的《Mokina v0.3 开发规范.md》，Spec `0.3.0-draft.1`（2026-09-14）。以下 AC 编号来自该文件第 11 节，不是旧 v0.2 的 35 项 AC。建议尚未批准，本文不修改 Spec 或宣称 AC 通过。

| 编号 | 优先级 | 具体设计输入 | 对应 AC | 评审时实际怎么验证 |
|---|---|---|---|---|
| M01 | P0 | 输入始终留在当前工作；项目可空，方法按需选 | 02–06 | 输入会员访谈目标，不选项目直接讨论；追问不另开工作 |
| M02 | P0 | 对话与成果自适应分栏，来源/计划局部展开 | 40–41 | 打开来源后返回，正文位置、选中段和输入草稿保留 |
| M03 | P0 | 显示修订目标的成果、基础版本和片段 | 15–18 | 两份同类成果都存在时修改第三条，不能猜最新一份 |
| M04 | P0 | 本次资料选择与旧成果固定依据采用不同面板状态 | 09–14 | 排除服务事实后，新操作变化，旧成果来源仍只读可查 |
| M05 | P0 | 选择固定片段后预览必要摘要，一次确认创建接续工作 | 19–21 | 只携带第二方向；取消不创建；缺失片段明确停下 |
| M06 | P0 | 后台工作不抢焦点；草稿保持未保存状态 | 32–34、41 | A 执行时在 B 输入，A 完成只提示；重开后 B 草稿仍在 |
| M07 | P1 | 保存计划、开始执行及能力就绪分别表达 | 06–08、23–25 | 保存只保存；未保存修改遇到开始时可选择，不丢稿 |
| M08 | P1 | 偏好保存是可跳过的提议，明确品牌或个人范围 | 26–28 | 采用邮件后可拒绝保存偏好，工作仍正常结束 |
| M09 | P1 | 统一控件状态及窄窗口折叠顺序 | 40–41 | 在两种桌面尺寸下检查表格、抽屉、焦点与按钮可达 |
| M10 | P0 | 设计证据适配用户已决定的 OpenDesign 管理方式 | 42–43 | 新项目实际创建后记录项目/成果定位、可修改源、交互和截图；不能将旧 Figma 验收直接改成通过 |

AC42 原文仍要求 Figma 状态 ID 与连线回读。后续应在 Spec 中显式修订为适配新设计工具的验收要求，不保留过时工具条款，也不取消真实设计回读、交互与视觉检查。本文只标出变更需求。

## 11. 下一轮对照实测清单（全部待验）

使用合成资料，避免将真实客户资料输入竞品。记录产品版本或提交、操作系统、窗口大小、是否连接真实模型，以及每一步的可观察结果。功能不存在、访问受阻、需要外部接入，应分别记录，不用预写演示代替。

| 测试 | 优先对象 | 具体操作 | 需要保存的证据 |
|---|---|---|---|
| V01 无前置任务 | AionUi、Eigent | 不选专用助手，提交访谈分析目标 | 从入口到首轮讨论的路径及前置要求 |
| V02 多成果阅读 | AionUi、LibreChat | 打开两份同类成果，切换、关闭、重新打开 | 标签身份、选中版本、正文位置 |
| V03 本地草稿 | AionUi | 编辑但不保存，切工作再返回，再重启 | 草稿正文、未保存标识；大文本限制的实际提示 |
| V04 同时编辑 | AionUi | 本地编辑时让 Agent/外部编辑器修改同一文件 | 是否覆盖、冲突提示、可恢复的双方内容 |
| V05 片段修改 | AionUi、LibreChat | 选中第三条，仅缩短正文 | 修改范围、其他字段是否变化、原稿是否可查；无能力则记不适用 |
| V06 版本操作 | LibreChat | 查看旧版，修改、导出并回看新版 | 查看、候选、采用是否有区别；无采用概念如实记录 |
| V07 接续范围 | LibreChat、Goose | 从一条消息接续或复制会话 | 实际携带哪些消息、资料、配置；是否能固定成果片段 |
| V08 方法复用 | Goose | 保存 Recipe，不运行，再明确运行 | 保存动作不触发执行、参数预览及新会话位置 |
| V09 后台返回 | AionUi、Goose | A 执行时进入 B 编辑，等待 A 返回 | B 焦点与草稿、A 状态提示、返回后的成果归属 |
| V10 权限与取消 | Goose、Eigent | 查看确认请求、拒绝，运行中取消 | 取消请求和实际停止的区别，已有产物是否保留 |
| V11 偏好范围 | LibreChat | 增加记录，切对话/Agent，停用或移除 | 应用范围、当前关闭状态、旧结果是否保持 |
| V12 桌面适配 | 四个主参考 | 1440×900、1280×800，长文和宽表格 | 主工作面、来源面板、键盘焦点、关闭返回的截图 |

原建议先完成 AionUi 和 LibreChat 的 V01–V07。追加 OpenDesign 后，优先级调整为专题文档中的底座验证：先用同一条营销工作检查 OpenDesign，AionUi 作为对照，再按缺口选择专项补测，不必先完成所有竞品实测。上述清单仍是后续工作输入，本轮没有安装应用或完成这些测试。

## 12. 来源定位与限制记录

前文链接为对应结论的直接来源。补充以下复查入口：

- [AionUi 固定提交树](https://github.com/iOfficeAI/AionUi/tree/6744099b279b991c17e31c243f0920477bd31cb6)：本轮只抽查预览状态模块，未做全仓库审计。
- [AionUi 官方首页参考图](https://raw.githubusercontent.com/iOfficeAI/AionUi/main/resources/homepage.png)、[文件生成参考图](https://raw.githubusercontent.com/iOfficeAI/AionUi/main/resources/file_generation_preview.png)：来自官方 README 的素材定位，仅供后续视觉查看，不作为本轮截图证据，也不保证与安装版本一致。
- [Cherry Studio 设计系统](https://github.com/CherryHQ/cherry-studio/blob/3cb467ea630ca55909b25e43948f09bce34084ea/DESIGN.md)：本轮核对规范，不声称已检查所有组件实现和可访问性。
- Goose 原 `block.github.io/goose` 文档入口已引导到 [goose-docs.ai](https://goose-docs.ai/)，本文使用可访问的新文档链接。

访问限制：AionUi 预览文档关联的旧 Workspace 文档路径读取失败，目录请求亦受限；未据此判断工作区功能不存在。LibreChat 的错误猜测路径未返回正文，已通过官方导航找到 `/docs/features/fork`。这些失败不影响已列出的成功来源，但未取得的内容不计入证据。

本轮交付边界：六个项目筛选、四个主参考深入分析、固定源码片段、十项设计输入、十二项待实测清单。未完成浏览器/桌面实测、视觉方案批准、OpenDesign 新项目创建、代码底座选择及 Runtime 集成。后续补测应追加结果与证据，不将本文中的 D/C/I 标记整体替换为通过。
