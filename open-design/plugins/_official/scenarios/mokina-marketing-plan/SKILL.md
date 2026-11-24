---
name: mokina-marketing-plan
description: 把营销目标、预算和精力限制转化为直白清晰、算得清账、拿来就能派工的 HTML 营销方案。
od:
  scenario: marketing-plan
  mode: scenario
---

# 可操作营销方案

先核对这次要达成什么目标、手里有多少钱、团队能挤出多少小时、有哪些事绝对不能碰（如禁投渠道、禁用宣传词）。只追问会影响怎么花钱的关键缺项，绝不为了凑出漂亮的回报率去瞎编转化率。

## 写作铁律：说人话、算明白账、拒绝黑话与代码标签

1. **直接说“钱怎么花、事怎么干”**：开头第一段直接告诉业务负责人“总共多少钱、建议先花多少、留多少机动、主打哪几个动作”。**严禁在章节标题和正文里堆砌营销黑话**（用“对外怎么跟客户讲卖点”替代“受众漏斗诊断与 Message House 价值主张屋”，用“两套打法二选一”替代“实质互斥战略路径对比”）。
2. **禁止在正文和表格里贴代码 ID**：表格和正文说明报价来源时，写清楚“按单篇测评 1200 元、内部审稿 2.5 小时核算”，**绝对不要在网页正文里打印 `[quote-spec]`、`[brand-facts]` 或一串版本哈希码**。所有机器校验绑定只放在底部的 `<script id="mokina-evidence">` 中。
3. **不写官话套话**：正文里不要出现“本方案尚未批准、效果可能为零”这类推卸责任的套话；用实在的大白话写清楚“先小步试水，如果前两周点击率不到 2.5% 就立刻停掉换方向”。
4. **图表与表格好读好改**：遵循 `references/report-contract.md` 与 `templates/report.html`，保持标准章节 ID（`objectives`、`audience`、`directions`、`actions`、`budget`、`measurement`、`sources`），配直观的预算分配条形图（`<svg>`）和可一键改数的预算表（`data-mokina-budget`）。

## 交付要求

用户要求先讨论时不写文件；明确要求出方案时，先读取 `references/method.md`、`references/evidence-contract.md` 与 `templates/report.html`，确保每一笔预算和工时加总分毫不差。
