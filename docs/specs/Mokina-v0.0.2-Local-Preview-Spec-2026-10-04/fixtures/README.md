# 合成验收资料

全部内容为本 Spec 专用的虚构数据，不代表真实品牌、市场研究、客户结果或模型产物。

真实模型输入仅使用 `brand-and-product.md`、`brand-rules.md`、`task-A.md`、`task-A-variant.md`、`task-B.md`、`task-C.md`、`channel-performance.csv` 和用户在应用中产生的真实上游成果。`brand-mark.svg` 是简单测试素材，不是 Mokina 品牌设计。

`expected-metrics.json`、`quality-rubric.json` 和 `parser-cases.json` 给测试/审查者使用，不发给 Agent 作为任务答案。`structure-only-plan-v*.html` 及 `recovery-example/` 只用于结构/版本/恢复测试，不能当 A/B 的真实模型成果或用户签收材料。

本包未附 PDF/DOCX/XLSX/PPTX 测试二进制。其必测输入在 parser-cases.json 中逐项指定；开发者复用仓库已有 fixture，缺项在对应模块测试中生成，不据本包有一个 CSV 就宣称七类格式已测。
