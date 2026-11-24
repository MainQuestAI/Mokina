# 活动页版本证据与公开参数计算协议 v1

这些标记用于宿主核验活动页引用的品牌事实、上游策略摘录与公开产品参数完全真实可溯源。HTML 是唯一可写成果。

## 1. 证据绑定（`#mokina-evidence`）
- 实际读取上游固定来源或用户选入资料，将读取的 UTF-8 字节保存到项目可见目录（如 `evidence/`），计算真实 64 位小写 SHA-256。
- 在页面底部 `</body>` 前放置唯一的 `<script type="application/json" id="mokina-evidence">`，声明 `1–8` 个来源（`full-text` / `summary` / `data` / `method`），每个来源的 `sectionId` 必须对应页面中的顶层 `data-mokina-id`（如 `hero`、`value`、`proof`、`cta`），`excerpt` 必须逐字存在于冻结源文本中。
- 不能手写 `#mokina-quality-snapshot` 或 `data-mokina-evidence-appendix`，它们由宿主在保存版本时自动生成。

## 2. 消费者可见数值计算（禁止泄露内部预算表）
- **严禁在活动页可见正文使用 `data-mokina-budget` 内部采购预算表**：活动页展示给外部客户，暴露内部预算与员工工时将触发宿主 `AUDIENCE_LEAK_INTERNAL_BUDGET` 质量问题。
- **使用面向客户的公开参数比例（`data-mokina-ratio`）**：在 `#proof` 或 `#value` 章节中，使用可见的 `data-mokina-ratio` 容器（内部包含 `data-numerator`、`data-denominator`、`data-ratio-result`，结果填写十进制小数，最多 8 位小数）展示面向客户的真实产品参数比值、规格性价比折算或公开样本结构占比。这样既保证 `record.calculations` 完成确定性数值核验（避免 `NO_CALCULATION`），又让每一个可见数字都为客户转化服务。

## 3. 交付后版本质量自查
- 保存后通过 `od files versions <project> <file> --read-only --json` 与 `od files version-read <project> <file> <version> --json` 核验 `quality.status === "rules-clear"`，确认无 `AUDIENCE_LEAK_INTERNAL_BUDGET`、`SOURCE_UNAVAILABLE` 或算术偏差。
