# Marketing Desktop 原界面原型 · 本轮验收

> 历史记录（0.2.0）：下文保留原实施验证，不再表示当前缺陷状态。随后 Review 发现四项反例，原“通过”不能覆盖它们；最新结果见 [0.2.1 修复验收](./Marketing-Desktop-0.2.1-修复验收.md)。

版本0.2.0，2026-09-14。此记录取代旧 v0.1 完成声明。用户最终产品评审尚未进行；内部验证不代表用户批准。

## 结果与证据边界

三条营销主线已通过真实 Chromium 页面操作；原 V6.2 首页、侧栏、输入框、计划侧面板、Canvas、版本比较路径保留。德国专业故事在同页完成21步；新产品QX-100只选官网，核对手工摘录后完成5项草稿批次，没有门店/电商或冰箱事实。

B＝实际浏览器操作/截图；D＝实际浏览器下载后检查文件内容；N＝本地状态/契约测试。N不代替页面验收。对重复回调、过期基础等不可凭截图证明的状态条件，明确使用N，不宣称连接过真实Runtime。

当前测试：V6.2 74项、通用营销21项；命令 `npm test`。本轮真实下载样本检查：`npm run verify:downloads`。打包命令 `npm run package` 在临时目录复制完整源码与资源，解压重建后再次测试并核对HTML哈希；结果写入 `output/marketing-v62-prototype-0.2.0/package-check.json` 及同目录TAP。这里不使用旧qa目录通过数作为本轮结果。

## 界面继承对照

均为本轮打开原HTML和迭代HTML取得，1440×900：

| 原V6.2 | 迭代版 |
|---|---|
| [首页](../output/playwright/v62-home-1440.png) | [首页](../output/playwright/marketing-home-final-1440.png) |
| [计划面板](../output/playwright/v62-plan-1440.png) | [品牌计划](../output/playwright/brand-plan-1440.png) |
| [对话与Canvas](../output/playwright/v62-canvas-1440.png) | [品牌采用与恢复](../output/playwright/brand-adopted-restored-1440.png) |
| [版本比较](../output/playwright/v62-compare-1440.png) | [品牌比较](../output/playwright/brand-compare-1440.png) |

已目视检查上述首页/计划/比较及1280社媒表格：侧栏宽度、原蓝白配色、标题/字体、对话/详情分栏、页签、返回与底部操作位置沿用原界面。新增资料/计划快捷按钮占用少量输入框下方空间；这不是新布局系统。长内容在原面板/表格内部滚动。

1280×800：[首页键盘焦点](../output/playwright/marketing-home-final-1280-keyboard.png)、[多交付计划](../output/playwright/multi-item-plan-1280.png)、[社媒表格](../output/playwright/social-calendar-1280.png)。未测试手机布局，本轮只验桌面原型。

## 三条完整流程

### 品牌

显式加载两份访谈，编辑排除项并保存计划（无成果），开始制作后打开原Canvas；“为什么不同时覆盖”仅解释；“保留方向，再补对照”创建另一份独立成果。指定方向段落人工修改成v2，原生并排比较、主动采用，刷新后仍为采用v2，旧v1保留。

页面实际修改内容：“方向保留：先面向年轻租住人群。前30天只验证小空间清单，后60天根据有效反馈调整，不增加第三个触点。”

输入变体另开工作，优先家庭，旧方案及来源不变；计划模式先讨论/保存，开始前无成果。证据：brand-*.png、plan-mode-no-generation.png、three-scenarios-backup.json。

### 社媒

显式加载3份输入，制作五条结构化内容。第三条缩短形成v2；读取并下载v1和v2，其他四行完全一致。再编辑第三条日期“下周四”形成v3、采用，下载文字v3。原版仍可选择。

另一个空浏览器选择社媒输入变体与自主模式，确认两项交付后生成一份社媒表、一份普通文档，均accepted=0。变体正文明确“不提供答疑或上门服务”。

证据：social-*.png、multi-item-plan-1280.png，下载social-v1.csv/social-v2.csv/social-v3.md、autonomous-and-late-return.json。

### 运营

通过浏览器文件选择器上传原四行operations.csv，真实计算总体5.25%→3.875%，下降1.375pp；实用6%→6.5%、产品3%→3%、实用曝光75%→25%；结构−1.50pp、组内+0.125pp。

只勾选mix结论，预览并确认另开工作；新工作携带分析v1的选中摘要，没有CSV或其他结论，完成三条内容计划提纲。

另上传非数值CSV，提示第2行impressions错误、成果为0；排除它，上传乱序月份CSV，手选八月/九月，再算出相同数值。

证据：operations-analysis-1440.png、analysis-followup-selection.png、followup-three-posts-1440.png、csv-invalid-row.png、csv-explicit-periods.png；operations-result.csv及csv-errors-and-periods.json。

## 原35项AC实际结果

本轮分类见[Spec](./Marketing-Desktop-Agent-Spec-v0.2-V6.2基线.md)。以下通过只指已调整的原型口径；含真实能力的剩余部分明确延期。

| AC | 结果/证据类型 | 实际检查 |
|---|---|---|
| AC-01 | 通过 B/D | [截图](../output/playwright/brand-adopted-restored-1440.png)；无项目品牌成果与采用版；未自动注入上市项目 |
| AC-02 | 通过 B/N | [截图](../output/playwright/brand-plan-1440.png)；计划保存无成果；既有交付 ID 保留 |
| AC-03 | 通过 B/N | [截图](../output/playwright/brand-variant-plan-explanation.png)；先定计划解释不新增版本；另做方案先加入计划 |
| AC-04 | 通过 B | [截图](../output/playwright/brand-plan-1440.png)；明确不做 FABE/MH 与上市；计划仍可执行 |
| AC-05 | 通过 B/D | [截图](../output/playwright/social-calendar-1280.png)；五条文字/排期无图片门槛 |
| AC-06 | 通过 B | [截图](../output/playwright/general-project-two-works.png)；只填名称创建一般项目，产品型号为空 |
| AC-07 | 通过 B/N | [截图](../output/playwright/csv-invalid-row.png)；非数值页内提示第2行；缺列/格式/零分母详见状态测试 |
| AC-08 | 通过 B/N | [截图](../output/playwright/brand-variant-plan-explanation.png)；解释和查看不新建版本、不改变采用 |
| AC-09 | 通过 B/D | [截图](../output/playwright/social-third-candidate-1440.png)；下载 v1/v2 仅第三条正文不同；v3日期修改单独保存 |
| AC-10 | 通过 B/N | [截图](../output/playwright/fixed-reference-versions.png)；同工作多文档；品牌独立对照；按成果/版本定位 |
| AC-11 | 通过 B | [截图](../output/playwright/project-all-work-scope.png)；当前工作只一份项目文档，项目汇总含A/B两份 |
| AC-12 | 通过 B/N；真实模型隔离延期 | [截图](../output/playwright/csv-explicit-periods.png)；排除无效CSV后只使用新CSV；旧来源保持 |
| AC-13 | 通过 B/D/N | [截图](../output/playwright/fixed-reference-versions.png)；两份普通文档分别固定社媒v1和v3 |
| AC-14 | 通过 B/N | [截图](../output/playwright/custom-input-no-fake-generation.png)；自有访谈真实读取，不补示例生成；撤回来源在本地被阻止 |
| AC-15 | 通过 B/D/N | [截图](../output/playwright/late-return-keeps-b.png)；A两项返回后B仍无成果/Canvas，B输入保留 |
| AC-16 | 通过 N；普通候选 B | [截图](../output/playwright/brand-compare-1440.png)；过期基础保留冲突候选；不覆盖采用版本 |
| AC-17 | 通过 B/D/N | [截图](../output/playwright/cancelled-run.png)；页面取消不新增；迟到/重复调用守卫由状态测试验证 |
| AC-18 | 通过 B/D/N；Runtime重连延期 | [截图](../output/playwright/interrupted-refresh.png)；刷新中断显示待重新执行，草稿及已有结果恢复 |
| AC-19 | 后续真实集成 | —；未接真实工具，不计本轮通过 |
| AC-20 | 通过 B/D/N | [截图](../output/playwright/file-artifact-roundtrip.png)；文件成果下载字节一致；未知kind的保存/导出/恢复另有状态测试 |
| AC-21 | 通过 B/D/N | [截图](../output/playwright/professional-completed-1440.png)；德国21步引导演示七类交付；新QX-100官网单渠道完整批次 |
| AC-22 | 通过 B/D/N | [截图](../output/playwright/professional-completed-1440.png)；两次固定内部提交，退回v2、通过v3；deliveries为0 |
| AC-23 | 通过 B/D/N | [截图](../output/playwright/operations-analysis-1440.png)；总体、分组、权重和分解正确，不虚构因果 |
| AC-24 | 通过 B/D | [截图](../output/playwright/analysis-followup-selection.png)；仅mix结论和v1摘要进入新工作；没有原CSV |
| AC-25 | 通过 B/N；泛化质量延期 | [截图](../output/playwright/brand-variant-plan-explanation.png)；品牌变体转家庭；社媒变体无答疑；未知请求保留原文 |
| AC-26 | 通过 B | [截图](../output/playwright/stop-no-followup.png)；实际输入“先到这里”后状态closed，任务数0、当前工作成果数0；未覆盖输入原文保留 |
| AC-27 | 通过 B | [截图](../output/playwright/file-artifact-roundtrip.png)；明确本轮选用/本地正文/情景演示，未宣称模型读取 |
| AC-28 | 通过 B/D/N | [截图](../output/playwright/backup-imported-twice.png)；原V6和含提交备份分别重复导入；版本/固定提交原样保持 |
| AC-29 | 通过 B | [截图](../output/playwright/marketing-home-final-1280-keyboard.png)；两尺寸首页/面板/表格；焦点Tab、关闭返回、输入/能力草稿恢复 |
| AC-30 | 通过 B/D/N；真实授权延期 | [截图](../output/playwright/multi-item-plan-1280.png)；自主模式仅做确认的两项，均未自动采用；无外部动作 |
| AC-31 | 通过构建/测试；包结果见报告 | —；本地直接源码组合，原HTML哈希不变；解压复建另记 |
| AC-32 | 通过 B/D/N | [截图](../output/playwright/workflow-owner-after-navigation.png)；能力草稿切会话后保存，job与成果仍绑定原工作 |
| AC-33 | 通过 B/N | [截图](../output/playwright/new-product-web-plan.png)；产品事实按原快照核验；普通CSV无需产品核对表 |
| AC-34 | 通过 B/N | [截图](../output/playwright/marketing-home-final-1440.png)；空状态没有产品项目/资料；快捷选择不发送，示例显式载入 |
| AC-35 | 通过 B/D/N | [截图](../output/playwright/professional-completed-1440.png)；内部草稿/评审与正式用途分离，未造CL回执 |

## 兼容、下载与专业证据

离线包已实际解压到独立临时目录，用该目录启动本地服务并在全新浏览器打开；首页、品牌选场景/载入资料/计划/制作均成功，项目数0、品牌成果1。见[解压首页](../output/playwright/unpacked-home-1440.png)、[解压后品牌结果](../output/playwright/unpacked-brand-result.png)。解压重建HTML与开发交付HTML的SHA256一致；不是仅检查ZIP列表。

下载样本位于 `output/playwright/downloads/`，全部为本轮合成QA数据，可安全用于复现：

- v62-original-backup.json → imported-twice.json：4项目、5会话、1成果、3运行保持数量，版本原样；没有为旧成果猜当前会话。
- professional-backup.json → professional-imported-twice.json：固定提交和成果所有版本深比较一致；相同ID不复制。
- professional-backup.json：七类专业交付（另有市场观察），21步完整故事，v2退回、v3通过均approvalScope=internal-review；deliveries=0。引导演示中的内部角色动作不是人类客户真实审批。
- new-product-backup.json：QX-100只有web渠道，strategy/fabe/mh/assets/web五项草稿，输入快照v1；没有缺资料时补入冰箱事实。
- custom-roundtrip.txt：与实际上传的合成自有文件逐字节一致。未知格式不解析、不伪造正文。
- three-scenarios-backup.json：三主线、一般项目、取消/中断、固定版本引用、独立job归属。
- autonomous-and-late-return.json：A两个已确认交付连续制作；切到B后结果归A，B画布不被抢占。
- social CSV：自动读取真实下载文件验证仅第三条正文差异，未按下载提示推断成功。

## 本轮修复记录

1. 停用上一轮独立重做界面，构建改为V6.2源码直接组合扩展。
2. 首次存储读取前配置独立键；禁止默认产品项目/示例注入。
3. 新成果和独立job固定thread归属；job保存不读取当前导航。
4. 模拟回调固定目标/计划/资料/操作者；取消、重复、迟到守卫。
5. 修复两层原render交接输入框时覆盖旧工作草稿的问题，实测A/B切换与刷新。
6. 恢复通用工作中的原独立能力页面，避免被通用任务计划页遮挡。
7. 修正专业项目创建按钮动作映射；原产品核验/单渠道制作可操作。
8. 还原原始CSV，新增具体错误与显式前后期；多个CSV不猜测。
9. 原文件保留和下载、固定引用版本、Plan快照排除项及旧备份幂等合并。
10. 修订Spec范围，旧报告加历史标记；所有旧结果不冒充本轮验证。

## 已知限制与待评审

- 未接模型：品牌/社媒只有基础与变体合成组合。自有资料可读取、固定引用和人工编辑，不能自动生成定制策略；超范围请求保留并提示。
- 缩短文案按钮是明确标注的确定性裁剪演示，复杂改写使用人工编辑候选，不代表模型语言质量。
- 真实工具故障、权限、Runtime重连/取消、账户授权、模型泛化、外部发布均延期；不计入完成数。
- 浏览器localStorage有容量限制，单文件最多3MB；大量文件需及时备份。PDF/Word/图片没有自动文本解析。
- 专业完整故事的重置会清空当前演示存储，有显式确认/备份入口；日常三场景无需使用重置故事。
- 本轮桌面Chromium已验证；其他浏览器、手机和实际客户权限环境未验。
- 用户对交互和示例内容的最终评审待进行；本报告不代替用户认可。
