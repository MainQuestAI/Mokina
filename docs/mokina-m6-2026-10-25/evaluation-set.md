# M6 评估集登记（R16 专业评审输入）

日期：2026-10-25。基线 main `244c4592`（+`d7ccc135`/`46684a78`）。本文件登记 [M6 计划](../plans/mokina-m6-iteration-plan-2026-10-25.md) R16 的评审样本与协议；评审结论另记，本文不预填结论。

## 评审维度与硬失败（沿用路线图 §8）

五维：约束遵守、判断取舍、事实来源、行动可执行、成果可读。每项记录具体章节与理由。

硬失败（任一即阻断签收）：编造来源；违反禁止条件；预算超限/不守恒；把估算说成已实现。

## 样本登记

| # | 样本 | 来源与形态 | 评审重点 | 状态 |
|---|---|---|---|---|
| S1 | M2 方案成果（方向 A/B） | [plan.html](../mokina-m2-2026-10-11/evidence/plan.html)（冻结产物）+ [plan-quality.json](../mokina-m2-2026-10-11/evidence/plan-quality.json)；Q01–Q05 工程复算已完成 | 预算/禁投约束下的方向取舍是否有据、可执行；有条件候选不得评为已证明 | **待人工评审（自 M2 积压）** |
| S2 | M2 分析成果（CSV 复算） | [analysis.html](../mokina-m2-2026-10-11/evidence/analysis.html) + [analysis-quality.json](../mokina-m2-2026-10-11/evidence/analysis-quality.json) | 缺失/重复/单位处理、不做因果臆断、问题保留而非抹平 | **待人工评审（自 M2 积压）** |
| S3 | M3 受控编辑与组合样例 | [landing.html](../mokina-m3-2026-10-12/evidence/landing.html) → [landing-edited-version.html](../mokina-m3-2026-10-12/evidence/landing-edited-version.html)；[编辑回执](../mokina-m3-2026-10-12/evidence/real-edit-receipt.json)、[来源身份](../mokina-m3-2026-10-12/evidence/source-identity.json)、[模型运行](../mokina-m3-2026-10-12/evidence/model-run.json) | 受控字段编辑后业务语义是否成立；组合候选与原稿身份清楚；接续产物与来源一致 | 待人工评审 |
| S4 | M5 网页证据全链成果 | 在 R14 候选（0.0.5-local.1）上重跑：公开页读取→回执→选择摘录→固定 versionId→成果引用定位→离线指定版本导出；既有冻结证据见 [mokina-m5 evidence](../mokina-m5-2026-10-14/evidence/) 仅作参照 | 回执与成果引用是否足以支撑专业判断；读取限制的呈现是否诚实；引用可定位 | **待 R14 候选就绪后重跑并评审** |
| S5 | 约束变更任务（rubric task-B 变体） | [fixtures](../specs/Mokina-v0.0.2-Local-Preview-Spec-2026-10-04/fixtures/)（task-B.md、channel-performance.csv、expected-metrics.json） | 同资料改变预算/禁投/周期时，方案取舍随之改变而非换数字 | 可选二轮：S1 通过后验证约束敏感性 |

## 协议

1. S1–S3 为已冻结产物，可先行评审（不依赖候选包）；S4 在 R14 候选上重跑后评审，重跑样本即评审对象。
2. 评审在真实应用（R14 候选）与冻结 HTML 双轨进行：应用内验证引用定位/回执呈现，冻结 HTML 验证内容本身。
3. 记录沿用 [quality-rubric.json](../specs/Mokina-v0.0.2-Local-Preview-Spec-2026-10-04/fixtures/quality-rubric.json) 结构做一致记录；**不以自动总分代替专业结论**，rubric 只是记录载体。
4. 证明方法有效性（若做 M7a）才需要隐名配对评审；本轮签收评审不强制隐名。
5. 评审产出去向：本目录 `professional-review.md`，含每样本五维评语、硬失败清单（应为空或附修复复验）、签收结论或「带缺陷清单的明确边界」。

## 边界

- 人工专业结论不能由 AI 自评代替（M2 验收既定边界）；本登记只固定输入与协议。
- 评审人时间不可得时，M6 降级路径见计划 §5；本登记仍先行完成。
- 工程门禁（guard/CI/同包验收）与专业评审分开记录，互不替代。
