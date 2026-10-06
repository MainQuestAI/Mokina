# Mokina v0.3：Marketing 能力包与开源 Skill 候选清单

日期：2026-09-14。状态：研究候选，未安装、移植或执行。配套结论见[专业营销体系与分发增长补充调研](Mokina-v0.3-专业营销体系与分发增长补充调研.md)。

整合更新：最新方向与先后顺序见[产品方向收敛与专业质量体系](Mokina-v0.3-产品方向收敛与专业质量体系.md)。本清单是能力候选池，不是首版同时交付清单。

更正：用户说的是伊美尔客户，不是 Email 渠道。邮件相关条目仅为开源能力研究，不构成邮件优先的依据。当前先讨论产品形态与场景整合，暂缓交付样板及质量对照。

## 1. 选择原则

目标不是积累最多的 Skill，而是让首稿与完整交付具备可靠的专业起点。复用应覆盖：如何判断、需要什么输入、产生什么成果、怎样检查、怎样精修、何时不适用。

普通用户不需要先知道 STP、AIDA 或 Skill 名称。入口继续是目标与材料；后台推荐或选择适用方法，必要时让用户调整。直接编辑、解释、只分析数据，均不强制重走策略链。

开源 Skill 只作为研究对象与候选资源。它们内部的安装、发信、部署、联网或强制流程说明不构成本轮授权，也不自动成为 Mokina 的产品规则。

## 2. 已定位的主要来源

| 来源 | 固定提交 | 许可观察 | 建议用途 |
|---|---|---|---|
| [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills/tree/5b2c0007766c6a1cf1d53fd8fc73e979e0821022) | `5b2c0007766c6a1cf1d53fd8fc73e979e0821022` | 根 LICENSE 为 MIT | 主要实务候选：营销背景、写作、精修、Email、渠道与分析 |
| [anthropics/knowledge-work-plugins/marketing](https://github.com/anthropics/knowledge-work-plugins/tree/8f877b63d26c68c0c5528e82892fe32d016a8ddc/marketing) | `8f877b63d26c68c0c5528e82892fe32d016a8ddc` | marketing/LICENSE 为 Apache-2.0 | 品牌审阅、完整邮件序列、报告和连接器分层 |
| [wondelai/skills](https://github.com/wondelai/skills/tree/c172996495bed0fcd26896a9416b2093fd7073f0) | `c172996495bed0fcd26896a9416b2093fd7073f0` | 根 LICENSE 及抽查 Skill 标为 MIT | 理论组织参考；部分按经典商业书籍整理，来源与表达须再核对 |
| [nexu-io/open-design](https://github.com/nexu-io/open-design/tree/39d9eb593ba41037d1900e73f0e62489ef8ac5c1) | `39d9eb593ba41037d1900e73f0e62489ef8ac5c1` | 根 LICENSE 为 Apache-2.0 | 能力包组织、成果模板、工作面和精修机制 |

许可核验只覆盖表中根/局部文件，不是依赖和内容来源的全面审计。保留作者声明与修改记录；原书、图表、课程、品牌素材不因出现在 MIT 仓库就自动获得同样授权。本轮没有把第三方正文复制到本地能力库。

## 3. 源码抽查得到的实质发现

### 3.1 Marketing Skills 已不只是提示词清单

固定版本 `skills/**/SKILL.md` 共 50 个。抽查 `product-marketing`，它要求先利用已有背景，并维护文档版本与变更记录；`copywriting` 区分网页文案、Email、已有文案编辑等任务，读取背景后再补缺失信息；`copy-editing` 按清晰、语气、价值、证据等维度分轮检查；`emails` 明确主题、预览、受众条件、CTA、序列节奏等组成。

部分 Skill 有 `evals/evals.json`。本轮查看 copywriting 的用例，包含输入、期望结果和断言，是可用的测试起点，但不代表测试已执行或质量已通过。一些断言检查是否采用某种结构/公式，不能直接当作专业成稿质量判据。[K1][K2][K3][K4][K5]

### 3.2 Anthropic Email Skill 对“整套交付”有更明确的结构

`email-sequence` 除单封文案，还包括序列叙事、触发、分支、退出、重入与抑制条件。`brand-review` 有品牌原则、语气、术语与主张核对；`performance-report` 接受连接器数据或用户提供的数据。[K6][K7][K8]

需要改写的地方也很明确：模板内置的发送间隔、字符长度和行业基准，只能是可调整建议，不能自动变成客户事实或必达指标；没有连接器不能宣称已配置/发送。README 中的旧能力名与固定目录也有差异，接入时以实际存在的 Skill 为准。

### 3.3 理论型 Skill 能补框架，但需要去掉机械评分

Wondelai 的 `made-to-stick`、`storybrand-messaging`、`one-page-marketing` 分别组织信息记忆性、叙事和整体营销规划。抽查可见它们要求输出分数并朝 10/10 改进，个别说明又有“所有信息都按本框架”的倾向。[K9]

可取其问题分解和反例，不应把“套满框架/模型打满分”当作成果合格。尤其 Slogan 不能被迫同时包含完整故事、所有利益点和全部证据。

### 3.4 结合完整讨论后的补查与修正

重新读取固定版本后，适配清单需具体到规则，而不止停留在 Skill 名称：

- Corey `copy-editing` 的 Expert Panel Scoring 明确要求虚拟角色评分及达标后迭代。这部分不沿用为质量验收；分维度发现问题的方法可以保留。补数字、情绪与保证等建议受已确认事实和本次任务限制，不应自动添加。[K3]
- Corey `copywriting` 正文含有具体效果增益说法，本轮未核查其底层研究，不能迁为客户成果中的预制事实。其 evals 有“采用标题公式”等断言，只能作为方法遵循检查，不能替代中文文案的专业审阅。[K2][K5]
- Anthropic `email-sequence` 的序列结构有参考价值；示例图中点击与转化的关系要按本次目标重定义。若目标是预约完成，点击不是完成预约的证据。序列表、正文、流程图应共用本次转化定义。[K6]
- Anthropic `brand-review` 区分有品牌规范和无品牌规范的审阅。Mokina 无客户规范时可做通用检查，但不得声称“符合该品牌规范”；偏离项应定位到具体内容，模型意见与专业认可分开。[K7]

以上是本轮发现的移植要求，不是在断言这些开源 Skill 整体无效，也没有执行其评估用例。

## 4. 推荐能力包地图

下表“已有候选”仅说明路径/内容可定位，不代表完成全量审查；P0 是上一轮的研究分类，不是已确认的开发顺序。撤回以 Email 样板优先的建议；先明确专业方法如何进入统一工作区，再确定适配范围。

| 优先级 | Mokina 能力包 | 已有候选 | 专业成果 | 必须补齐或调整 |
|---|---|---|---|---|
| P0 | 营销背景与品牌表达 | Corey `product-marketing`；Anthropic `brand-review` | 受众、差异价值、主张证据、语气与禁用表达 | 品牌/项目隔离；已确认与推断分开；缺资料不强制全表问卷 |
| P0 | Email / 生命周期沟通 | Corey `emails`、`cold-email`；Anthropic `email-sequence` | 单封邮件或序列、主题/预览/正文/CTA、条件与节奏 | 单封/序列/冷邮件分开；中文与客户品牌适配；默认不发送 |
| P0 | 专业文案创作 | Corey `copywriting`；Anthropic `draft-content` | 可交付正文、备选标题、关键写作理由 | 不盲从所有网页章节；无证据不填数字、口碑与保证 |
| P0 | 文案精修 | Corey `copy-editing`；Anthropic `brand-review` | 定位到段落/条目的修改、理由、候选与差异 | 只改目标；保留非目标字段；不用虚拟评委分数宣布质量 |
| P0 | 首稿/成套交付检查 | 上述编辑与品牌方法 + Open Design 质量检查机制 | 具体问题、已修复项、仍需用户判断项 | 增加跨文档一致性和机械校验；区分内部自检与人工认可 |
| P0 | 市场与竞争研究 | Corey `customer-research`、`competitor-profiling`；Anthropic `competitive-brief`；本地 Market Research 作参考 | 有来源的竞争判断、市场结构、流量入口和机会 | 按当前问题确定口径；本项目不重新要求需求访谈；数据缺失不补造 |
| P0 | 定位与核心主张 | Corey `product-marketing`、`marketing-plan`；April Dunford 方法参考 | 竞争替代、受众选择、差异价值、定位理由 | 客户事实驱动；表达主张不能替代策略判断 |
| P0 | Slogan / 标题方向 | Corey `copywriting`；Wondelai `made-to-stick` | 多个不同创意方向及推荐、表达理由、应用样例 | 建立中文语义/节奏/品牌关联检查；区分品牌 Slogan、活动主题与标题 |
| P1 | Message House / FABE | 在已审阅的客户经验上形成自有包；外部定位/文案包辅助 | 信息层级、主张、利益点与证据映射 | 本轮未确认可直接采用的高质量完整开源包；仅相关任务启用 |
| P1 | GTM / 活动规划 | Corey `launch`、`marketing-plan`；Anthropic `campaign-plan` | 目标、受众、信息、渠道、阶段、交付及指标口径 | 不把新品上市当默认生命周期；已有定位可直接引用 |
| P1 | 社媒与内容排期 | Corey `social`、`content-strategy`、`ad-creative` | 可编辑文案及日期、渠道、目标、角度、CTA | 中文渠道专用规则需独立核对；不得把换渠道字段称为完成改写 |
| P1 | 营销分析与复盘 | Corey `analytics`、`attribution`、`ab-testing`；Anthropic `performance-report` | 数据口径、真实计算、分组表、结论、实验建议 | CSV 计算交给代码；统计关系不写成因果；所选结论才接续 |
| P2 | SEO / GEO / 获客增长 | Corey `seo-audit`、`ai-seo`、`free-tools`、`directory-submissions` | 诊断、优先级、内容机会、分发动作 | 没数据不报搜索量；外部发布和付费研究另按授权执行 |

这些包可以提供可选的专业预设，但不能成为固定场景路由。例如“先不写方案，解释一下选择理由”只回答解释，不因选过 GTM 包就制作新交付。

## 5. 最小能力包契约（建议，不是新增实现）

能力包不是只有一份角色扮演提示词。至少说明以下内容：

| 内容 | 需要回答的问题 |
|---|---|
| 身份与版本 | 采用哪个包、哪个版本，来自谁，Mokina 改了什么？ |
| 适用与排除 | 什么目标应该用？什么情况下不应触发？ |
| 输入 | 最低必要材料是什么？已有品牌背景如何复用？哪些缺失可显式假设？ |
| 专业方法 | 如何形成判断与取舍，而非只给标题目录？ |
| 成果结构 | 产出文档、表格、邮件、创意方向还是数据结论？ |
| 质量检查 | 哪些可用程序验证，哪些要专业审阅？ |
| 精修契约 | 修改哪个成果/版本/条目，必须保留哪些部分？ |
| 示例与反例 | 什么是好稿、什么是看起来完整但不可用的稿？ |
| 运行要求 | 需要搜索、计算、文件还是连接器？不可用时如何如实降级？ |

建议在 Agent Skills 标准兼容范围内组织：入口 `SKILL.md` + 按需读取的 `references/`，必要时附成果 schema、模板、检查脚本和评测案例。实际包格式应适配选定的 Open Design 插件机制，不先另造独立市场和运行时。[K10]

本次运行记录里引用实际加载的包与品牌规则版本；不是“已安装”就显示“已使用”。公共方法、客户事实、输出模板和质量检查各有独立职责；客户事实不能藏在公共 Skill 里。

## 6. 示例：把 Email 做成完整的专业交付包

本节仅保留为开源能力结构示例，不来自伊美尔客户需求，不是当前选定的产品入口、首发场景或执行任务。

以下为建议蓝本，不是本轮已实现功能或客户数据。

### 6.1 输入

- 沟通任务：欢迎、培养、召回、活动通知或冷邮件；不能混用。
- 受众状态与现有材料：已确认用户问题、服务事实、已有表达、历史邮件及可用数据。
- 目标与边界：希望采取的动作、允许的优惠/承诺、不做的内容、是否只制作不发送。
- 可选品牌规则和指定旧成果版本。

### 6.2 成果

- 总体叙事：为什么是这些内容，邮件之间如何递进。
- 每封邮件：稳定 ID、主题候选、预览、正文、CTA、受众条件与时机。
- 序列：入口、分支、退出和冲突抑制规则；只在用户要求序列时提供。
- 依据与缺口：哪些是已确认事实，哪些是方案建议。
- 导出：指定版本的文本、表格；若需要 HTML，另核对真实渲染和链接，不宣称邮件客户端兼容已通过。

### 6.3 三层检查

1. **事实与规则**：主张是否有来源，CTA 链接/优惠是否有效，未授权承诺是否出现，条件是否自相矛盾。
2. **单封质量**：主题与正文是否匹配，有没有明确读者价值，表达是否具体，是否符合品牌，不靠堆字或夸大吸引注意。
3. **整套质量**：是否重复催促，叙事是否推进，主题差异是否有意义，已转化用户是否退出，同一权益前后是否一致。

### 6.4 精修

用户说“第三封更简洁，其他保持不变”，需要绑定第三封的条目 ID 与基础版本。只改变请求范围内的文字，保持条件、日期、链接和其他邮件不变；检查与比较后由用户选择，不自动发送。

## 7. 示例：Slogan 不能只有“生成十句”

建议将其设计为四步专业过程：

1. **确定角色**：长期品牌 Slogan、阶段活动主题、产品利益标题或邮件主题，适用规则不同。
2. **形成创意方向**：围绕同一确认主张，探索不同表达路线，而非同一句换十种形容词。可用认知对比、具体场景、行动表达等方法，但不固定枚举模板。
3. **说明与筛选**：每个方向交付候选、核心含义、受众关联、使用情境和需注意的歧义。相同结论不得因为更押韵就被夸大。
4. **情境化精修**：放到广告标题、邮件主题、落地页首屏等实际位置查看。区分“不够短”“不够具体”“不属于这个品牌”等不同问题，再局部修改。

优先检查：主张准确、品牌关联、具体性、易理解、中文读感、适用长度和跨场景延展。是否真正更易记、更能转化，需要真实使用证据；产品不要伪造测试结论。

本轮没有确认一套可直接覆盖中文品牌 Slogan 全过程的开源 Skill。建议组合已核查的文案与信息表达方法，加上自有项目中的审阅规则和合成反例，而不是下载一个名称包含 slogan 的提示词就完成能力建设。

## 8. 接入时必须修改的通用规则

- **去掉强制建档**：Corey 的 product-marketing 默认鼓励先建背景；Mokina 应复用已有资料，仅补当前工作确实缺失的信息。
- **去掉强制满分**：Wondelai 的 10/10 与 copy-editing 的角色评分只能作方法素材，不作为用户可见合格证明。
- **去掉固定完整流程**：只改一句、只解释、只分析，不自动运行整套 GTM。
- **去掉示例即事实**：示例优惠、行业基准、时序和数字必须被标为建议或替换；不能自动进入客户成稿。
- **去掉平台偏见**：海外 SaaS、英文 CTA、英语字符数不是中文营销的通用标准。
- **分开方法与执行**：有邮件 Skill 不等于有邮件连接器；有连接器不等于获得发送权限。
- **保护既有成果**：版本、来源、采用状态和稳定条目 ID 由工作台保存，不能让每个 Skill 自己维护一套身份。
- **限制无收益精修**：修具体问题并保持已确认内容，达到标准或没有明确改善时停止，不无限循环自评分。

以上均为本项目的适配建议，不在本轮修改外部仓库或本地已安装 Skill。

## 9. 专业资产与市场入口如何共用

下表保留为后续公开资产的主题候选，不作为当前任务或首发场景：

| 主题 | 用户可以立即理解的价值 | 公开内容候选 | 留在工作台的完整能力 |
|---|---|---|---|
| 会员召回 Email | 不只写一封，而是写对一套 | 合成 Brief、完整首稿、精修示例、方法包说明 | 本品牌材料、条件编辑、版本与接续 |
| 定位到主张 | 把零散事实变成可沟通的价值 | 输入模板、取舍示例、主张证据表 | 客户真实资料、备选方案、后续内容 |
| Slogan / 关键文案精修 | 改善具体性与品牌感 | 典型坏稿、不同创意方向、修改理由 | 实际语境、局部候选、跨成果一致性 |

技能详情页、示例页和产品内蓝本应引用同一个已版本化能力包，防止对外宣传与真实运行分叉。是否开源、采用何种收费和分发形式，由主线程后续决定；本轮只提供研究建议。

## 10. 核验链接

- K1：[product-marketing](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/product-marketing/SKILL.md)。已抽查背景与版本维护逻辑。
- K2：[copywriting](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copywriting/SKILL.md)。已抽查输入、任务分流、正文与备选结构。
- K3：[copy-editing](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copy-editing/SKILL.md)。已抽查分轮编辑与评分部分。
- K4：[emails](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/emails/SKILL.md)。已抽查单封与序列结构。
- K5：[copywriting evals](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/skills/copywriting/evals/evals.json)。只读案例，未执行。
- K6：[Anthropic email-sequence](https://github.com/anthropics/knowledge-work-plugins/blob/8f877b63d26c68c0c5528e82892fe32d016a8ddc/marketing/skills/email-sequence/SKILL.md)。已抽查序列架构、单封内容、退出与抑制条件。
- K7：[Anthropic brand-review](https://github.com/anthropics/knowledge-work-plugins/blob/8f877b63d26c68c0c5528e82892fe32d016a8ddc/marketing/skills/brand-review/SKILL.md)。已抽查规则与品牌表达。
- K8：[Anthropic performance-report](https://github.com/anthropics/knowledge-work-plugins/blob/8f877b63d26c68c0c5528e82892fe32d016a8ddc/marketing/skills/performance-report/SKILL.md)。已抽查输入与报告组成。
- K9：[made-to-stick](https://github.com/wondelai/skills/blob/c172996495bed0fcd26896a9416b2093fd7073f0/made-to-stick/SKILL.md)、[storybrand-messaging](https://github.com/wondelai/skills/blob/c172996495bed0fcd26896a9416b2093fd7073f0/storybrand-messaging/SKILL.md)、[one-page-marketing](https://github.com/wondelai/skills/blob/c172996495bed0fcd26896a9416b2093fd7073f0/one-page-marketing/SKILL.md)。已抽查方法定位和评分要求，未逐份阅读全部引用资源。
- K10：[Agent Skills 规范](https://agentskills.io/specification)。用于包结构与按需加载参考。
- K11：[Corey LICENSE](https://github.com/coreyhaines31/marketingskills/blob/5b2c0007766c6a1cf1d53fd8fc73e979e0821022/LICENSE)、[Anthropic marketing LICENSE](https://github.com/anthropics/knowledge-work-plugins/blob/8f877b63d26c68c0c5528e82892fe32d016a8ddc/marketing/LICENSE)、[Wondelai LICENSE](https://github.com/wondelai/skills/blob/c172996495bed0fcd26896a9416b2093fd7073f0/LICENSE)。

未列为已通过项：安装兼容性、真实模型质量、连接器执行、中文渠道效果、生成数据准确性、客户评审、发布效果。上述候选和蓝本用于后续选型与能力设计，不替代这些结果。
