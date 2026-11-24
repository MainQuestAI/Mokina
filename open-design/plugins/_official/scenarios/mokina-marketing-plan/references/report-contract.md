# Mokina 营销成果 HTML 约定

- 单个自包含 HTML 文件，内联 CSS、图表数据和静态 SVG。不要引用外链或项目外会漂移的资源；无法内联时明确说明，不能声称历史版本可独立交付。
- 每个可修改的顶层章节同时使用稳定且唯一的 `id` 与同值 `data-mokina-id`（营销方案标准章节：`objectives`、`audience`、`directions`、`actions`、`budget`、`measurement`、`sources`）。这些章节之间不得嵌套；内部锚点只用普通 `id`。ID 不随标题措辞改变。
- 引用在对应判断附近标出来源 ID；来源表记录文件或网页、定位、访问时间、实际摘录，以及“原文”“摘要”“数据”的区分。
- 数值写明单位和时间口径；缺失、空值、公式无缓存值和估算不得混为零或事实。
- `@media print` 保持正文、卡片、表格、SVG 图表和来源可读，设置 `break-inside: avoid` 避免关键卡片与表格行被分页截断。

## 受控成果操作与富媒体共存契约

- **策略与矩阵可编辑字段**：策略条目使用纯文本叶子元素，例如 `<p data-mokina-field="direction" data-mokina-kind="strategy" data-mokina-label="核心策略方向">…</p>`；矩阵单元格用 `data-mokina-kind="matrix"`。字段 ID 全文唯一且稳定；可编辑叶子节点内部不嵌套子标签。
- **静态 SVG 图表与内联样式完全支持**：章节内支持静态内联 `<svg>`（如漏斗图、预算/工时占比可视化图）以及静态内联 `style` 属性（如 `style="width: 65%"`）。静态 `<svg>` 内严禁包含 `<script>`、`<foreignObject>`、`<iframe>` 或 `on*` 事件。
- **预算表与联动汇总标签**：预算沿 `evidence-contract.md` 的数量、单价、金额和工时标记。需要同步显示的总金额、未分配余额和总工时分别使用 `data-mokina-budget-total="0"`、`data-mokina-budget-remaining="0"`、`data-mokina-budget-hours="0"` 的纯文本叶子元素（值对应预算表在全文的零起始序号）。不要在未标记正文中硬编码重复预算总额，确保用户改表后全文数值保持一致。
- **跨阶段固定接续**：研究 → 策略 → 活动页使用固定版本/片段接续，下游保留品牌事实、优惠条件、KPI 定义、时间与 CTA 约束；缺失信息标记待确认，不替用户编造。
