# Mokina 营销成果 HTML 约定

- 单个自包含 HTML 文件，内联 CSS、图表数据和静态 SVG。不要引用外链或项目外会漂移的资源；无法内联时明确说明，不能声称历史版本可独立交付。
- 每个可修改的顶层章节同时使用稳定且唯一的 `id` 与同值 `data-mokina-id`，如 `scope`、`findings`、`evidence`、`implications`、`limits`。这些章节之间不得嵌套；内部锚点只用普通 `id`。ID 不随标题措辞改变。
- 引用在对应判断附近标出来源 ID（如 `[src-1]`）；来源章节与 `#mokina-evidence` 记录文件或网页、定位、访问时间、实际摘录，以及“原文”“摘要”“数据”的区分。
- 数值写明单位和时间口径；缺失、空值、公式无缓存值和估算不得混为零或既定事实。
- `@media print` 保持正文、卡片、表格、SVG 图表和来源可读，设置 `break-inside: avoid` 防止关键卡片与表格行在分页时被截断。图表同时给出文本或数据表支撑。

## 受控成果操作与富媒体共存契约

- **可编辑语义字段**：策略条目与核心结论使用纯文本叶子元素，例如 `<p data-mokina-field="positioning" data-mokina-kind="strategy" data-mokina-label="核心定位主张">…</p>`；研究矩阵单元格使用同一字段标记及 `data-mokina-kind="matrix"`。字段 ID 全文唯一且稳定；可编辑叶子元素内部纯文本不嵌套子标签。
- **静态 SVG 图表与内联样式完全支持**：章节内支持使用静态内联 `<svg>` 绘制竞争象限图、漏斗图、柱状对比图，以及使用静态内联 `style` 属性（如 `style="width: 68%"`）制作数据条形图。静态 `<svg>` 内部严禁包含 `<script>`、`<foreignObject>`、`<iframe>`、`on*` 事件或外部链接。
- **预算与比例计算标记**：预算表沿 `evidence-contract.md` 的数量、单价、金额和工时标记；需要同步显示的总金额、余额和工时分别用 `data-mokina-budget-total="0"`、`data-mokina-budget-remaining="0"`、`data-mokina-budget-hours="0"` 的纯文本叶子元素。比例计算使用 `data-mokina-ratio` 容器及 `data-numerator`、`data-denominator`、`data-ratio-result`。
- **跨阶段固定接续**：研究 → 策略 → 活动页使用固定版本/片段接续，下游保留品牌事实、核心发现、KPI 口径与约束条件；缺失信息使用 `<span class="badge-pending">待确认：…</span>` 清晰标记，不替用户编造。
