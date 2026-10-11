# 版本证据与计算协议 v1

这些标记是可选的机械检查输入，不代替正文、业务审批或来源真实性核验。HTML 是唯一可写成果。用户要求交付时才写文件；修复已有成果沿指定 baseVersion 产生候选，不自动采用。

## 先读再声明

实际读取本方法、选中资料及报价，不用搜索摘要冒充全文。研究资料记录 URL、实际访问时间、支持摘录、页码/段落、时点和适用范围；无法访问正文时使用 summary 类型并说明限制。比较冲突来源，不删除不利依据。给每个关键结论在正文标出 source ID；推断单独标注。

把确实读取且用户选中的证据 UTF-8 字节保存到项目可见目录（如 evidence/），并计算实际 SHA-256。不要复制整个私人目录，不声明未读资料。方法文件也复制实际读取的版本并固定摘要；这是绑定记录，运行日志中的读取才是读取证据。每份最多512KiB，共最多8份/2MiB；长文用明确标注范围的摘录并写 limitation，不称全文。

成果中放一个 script[type=application/json]#mokina-evidence，正文保留对应章节与可读引用：

```json
{"schema":"mokina.evidence.v1","sources":[{"id":"quote","path":"evidence/quote.txt","sha256":"实际64位小写摘要","kind":"data","locator":"报价条目1–3","limitation":"用户提供的合成报价，不是采购承诺","sectionId":"budget"},{"id":"method","path":"evidence/method.md","sha256":"实际64位小写摘要","kind":"method","methodVersion":"0.0.2","locator":"完整方法","limitation":"方法绑定不证明模型理解","sectionId":"directions"}]}
```

kind 仅 full-text / summary / data / method。来源可选 url、accessedAt、excerpt；excerpt 必须逐字存在于冻结文本中。sectionId 必须对应成果里的 data-mokina-id。路径禁止绝对路径、隐藏文件和上级跳转。不能手写 #mokina-quality-snapshot 或 data-mokina-evidence-appendix，它们由宿主保存版本时生成。

## 可见数值就是计算输入

预算表使用 data-mokina-budget、data-budget-limit（总上限）、data-capacity-hours（内部总工时）。每个行动行 data-budget-item 必须有且仅有 data-quantity、data-unit-price、data-amount、data-hours 四个可见单元格。数字为纯十进制，单位放表头，不放数值单元格；单表单币种。data-hours 是该行总内部工时，不是单件工时，不能与外包工时混算。

数量、单价、工时及容量最多8位小数；展示金额与预算上限最多2位小数，单值不超过1e12，预算数值非负。宿主按十进制定点计算，每行 quantity×unit-price 四舍五入到分，再累加行金额；工时精确累加，不使用浮点容差。超精度输入明确报错，不截断。宿主复算总预算、剩余预算和总内部工时；显式展示未使用预算。不同方向各用一个预算表，不能把互斥方向合计。报价支持哪个单价、包含什么、不含什么，写在行内说明并引用源 ID。算术正确不证明报价真实、容量合理或ROI成立。

比例用可见 data-mokina-ratio 容器，内部 data-numerator、data-denominator、data-ratio-result。结果是小数不是百分数。0分母须显示“不可计算”，不得填0/无穷大。环比 numerator=本期−前期，denominator=前期；展示原期值与计算口径供人工复核。该标记只复算已提供数值，不证明它们来自哪个CSV行。

CSV 源可声明 csv:{"id":"record_id","amount":"amount","unit":"currency"}。宿主标记重复ID、缺失/非法金额、混合单位和不规则行；不静默去重或补0。干净数据只按单位求和，不跨币种汇总。CSV金额最多8位小数，单值绝对值不超过1e12；超出支持范围明确报问题，不静默截断。若需清洗，保留原始源和明确排除清单，再生成派生文件并分别声明；原始脏数据问题应保留为已知限制，而非假装不存在。

## 交付自查

保存后通过 `od files versions <project> <file> --read-only --json` 找到对应版本，再 `od files version-read <project> <file> <version> --json` 查看 quality。未知保存结果先查版本，不重新运行。问题绑定该版本；补足资料或修正文案后保存新候选。比例计算也计入完成的检查；只有表头的CSV报告CSV_EMPTY，无有效计算报告NO_CALCULATION。rules-clear 只说明这些规则无发现，不是专业批准。旧成果无标记时保持 unreviewed。
