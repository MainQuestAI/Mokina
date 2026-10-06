# Mokina v0.3 · 跨工作接续视觉稿 v4

日期：2026-09-16。状态：可操作设计稿，待评审；不代表生产 Agent 实现。

## 本轮结果

当前 [visual.html](sketches/2026-09-15-context-to-strategy/visual.html) 已把“报告选段 → 接续预览 → 另开工作 → 左侧切回原工作”串在同一界面。左侧只列实际创建的本页工作，不再用两条不可操作的示意会话占位。

沿用 frontend-design 技能对应的现有组件、排版和面板层级；没有新增路由、iframe 或第二套工作台。上一轮完整保存在 [visual-v3.html](sketches/2026-09-15-context-to-strategy/visual-v3.html)，生产代码、旧演示数据及存储键未改。

## 交互规定

| 位置／动作 | 实际行为 |
| --- | --- |
| 报告选段 | 使用当前查看版本，不擅自取采用版或最新版；未选段落不携带 |
| 接续预览 | 展示选段正文、固定版本、必要目标和品牌要求；可填写下一项工作的目标 |
| 另开工作 | 明确确认后创建本页独立工作；只准备讨论，不自动发送、制作或复制整个计划 |
| 新工作背景 | 所选片段成为可查看、可排除的资料；原始产品与研究文件不自动复制 |
| 来源返回 | 定位原工作、成果和版本；查看不改变采用状态 |
| 来源后来有编辑 | 接续仍显示引用时正文，并提示来源版本后来有修改；不悄悄同步 |
| 左侧切换 | 恢复各自输入草稿、资料、计划及未保存调整、工作稿、查看／采用版本、标签、阅读位置和测算输入 |
| 后台示例完成 | 结果存回创建操作时的工作；左侧显示“新成果已就绪”，不改变当前工作或焦点 |
| 空白新工作 | 只需工作名称，不要求项目、SKU 或 Brand Kit；默认不选资料。合成示例需显式载入并选择 |

继承的品牌要求来自原工作实际选用的背景，不使用全局默认品牌规则冒充用户约束。引用的选用范围与历史引用记录分开：取消选用不删除固定记录，下一次讨论不再使用该引用。

## 建议评审路径

1. 从初始背景讨论，制作一个方向并深化，切到“阅读”。
2. 选中品牌故事，点击“带入下一项工作”；检查所选版本和正文。
3. 写下一项工作的目标，点击“另开工作”。先检查背景，再发送讨论；此时不自动制作新策略。
4. 在新工作写一段未发送文字；从左侧回到原工作，检查原阅读位置、原稿及采用状态。
5. 修改原稿，再回接续工作查看引用；应保留旧摘录并提示来源后来有编辑。
6. 新建空白工作；回原工作启动方向示例后立即切走。完成只提示原工作有新成果，当前输入不变。

## 实际浏览器验证

本轮均在真实浏览器执行，不以仅调用数据函数代替页面操作。

- `carry.browser-check.js`：32 项通过。包括指定查看版本、只带所选片段、空目标拦截、确认不发送、新工作讨论、来源后来编辑、来源定位、工作输入与计划隔离、阅读位置恢复、KPI 输入隔离、键盘切换、空白工作、后台结果归属、焦点不抢占、取消迟到及刷新边界。
- `plan.browser-check.js`：35 项回归通过；原 Plan 保存与执行、取消、引用、版本选择机制未退化。
- `journey.browser-check.js`：22 项回归通过；直接 Ask → Execute、A/B/组合、编辑、阅读、固定接续和本地 KPI 计算仍可操作。
- 接续预览和接续工作在 1440×900、1280×800 截图并检查；1280 下无整页横向溢出，计划／接续入口及发送动作可达。
- 新接续脚本全程无页面脚本错误。首次脚本因页面和弹窗各有一个“回到来源版本”而定位不唯一；改为定位弹窗内按钮后，完整重跑通过。

新增证据位于 `output/playwright/mokina-v0.3-three-states/`：

| 文件 | 内容 |
| --- | --- |
| `carry-preview-1440.png`、`carry-preview-1280.png` | 所选版本、正文与下一项目标预览 |
| `carry-work-1440.png`、`carry-work-1280.png` | 独立接续工作与原工作共存 |
| `carry-fixed-reference.png` | 原版后来有编辑，旧引用正文仍固定 |
| `carry-background-ready.png` | 后台完成仅更新原工作提示 |

## 启动和复现

```sh
cd /Users/dingcheng/Coding-Project/02-key-project/Mokina
python3 -m http.server 4189 --bind 127.0.0.1 --directory docs/designs/sketches/2026-09-15-context-to-strategy
```

预览地址：`http://127.0.0.1:4189/visual.html`。浏览器脚本需本地已有 `playwright-cli`：

```sh
playwright-cli -s=mokina-carry open http://127.0.0.1:4189/visual.html
playwright-cli -s=mokina-carry run-code --filename=docs/designs/sketches/2026-09-15-context-to-strategy/carry.browser-check.js
playwright-cli -s=mokina-carry run-code --filename=docs/designs/sketches/2026-09-15-context-to-strategy/plan.browser-check.js
playwright-cli -s=mokina-carry run-code --filename=docs/designs/sketches/2026-09-15-context-to-strategy/journey.browser-check.js
playwright-cli -s=mokina-carry close
```

## 当前边界

工作及成果保存在本页内存中，刷新重置；不是后台数据库或真实 Codex 会话。此轮只验证多个工作共用同一工作区、上下文接续和演示操作隔离，没有实现跨会话 Agent 调用、Fork、任务调度或操作系统通知。

新工作能保留目标、选用引用并继续讨论，但任意目标的真实分析与制作仍未接入。预置方向仅适用于已有合成示例，不能把接续标记当作生成新内容的依据。上传、文件导出、长期 Brand Kit 和真实 Skill 均不在本轮。

至此，可以整体评审“带入背景—讨论—计划—成果—版本—选段接续—多工作返回”这一条产品交互主线。下一步宜集中检查是否自然、信息是否充分，再明确真实执行的最小范围，不继续为每个状态增加独立页面。
