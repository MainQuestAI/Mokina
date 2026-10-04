# 真实端到端运行证据（T19 前哨 / AC25 类）

日期：2026-10-05　｜　环境：本机 dev 栈（tools-dev web，隔离数据根 `.tmp/mokina-qa-data`，namespace `mokina-local-qa`，daemon :18613 / web :18614）

## 执行内容

1. 创建项目 `mokina-e2e-de9ec8c7`，绑定场景 `mokina-marketing-plan`。
2. 写入合成资料 `brief.md`（品牌：晨光茶饮；渠道限制：禁止短视频、可用门店联合/企业微信/地推；目标：四周新增 30 家门店合作；预算：50 万且门店活动 ≥60%）。
3. `GET /files/brief.md/material`：`status=read`、`parserVersion=mokina-material/1`、8 个 section 分组。
4. `POST /mokina/context-snapshots`：**201**，4 个冻结条目，fingerprint `8dda89d4…`。
5. `POST /api/runs`（agentId=codex，真实模型，`context.mokinaSnapshotId`）：**202**，runId `1fd6ed0e-…`。
6. 轮询至终态：**succeeded**（02:40:31 → 02:43:49，约 3 分 18 秒）。
7. 运行状态：`deliverableValid=true`、`deliverableValidation=valid`（营销场景结构校验通过）。
8. `mokinaContext` 回执（daemon 重启后仍可读，磁盘兜底生效）：
   ```json
   {"runId":"1fd6ed0e-…","snapshotId":"1225a7bb-…","fingerprint":"8dda89d4…",
    "includedItemIds":["S1","S2","S3","S4"],
    "itemDelivery":[{"itemId":"S1","mode":"inline-text"}, …, {"itemId":"S4","mode":"inline-text"}],
    "status":"submitted","submittedAt":"2026-10-04T18:40:23.694Z"}
   ```
9. 产物 `plan.html`：7 个稳定章节 `objectives/audience/directions/actions/budget/measurement/sources`；包含资料中的 50 万预算与 30 家门店目标（这些数字只存在于 brief，证明冻结资料确实进入模型输入）。
10. `POST /export/html` 独立导出：7392 字节、1 个内联 `<style>`、**0 个外部 http(s) 引用、0 个 daemon bearer 链接**；导出件见 `e2e-plan-export.html`。

## 覆盖与边界

覆盖：T05（parserVersion/分组）、T06（快照冻结 + run 注入 + 回执 + 重启持久）、T08（结构校验 valid 终态）、T13（指定版本 HTML 导出自包含）。
未覆盖（仍属 T19/专业验收）：用户本人在交付包上的签收；专业评分（A/B 五分制）；预算反事实与强制渠道约束的单独打分；活动页真实生成。

---

## 追加：真实活动页运行（T10 真实管线）

- 项目 `mokina-landing-d924a51a` 绑定场景 `mokina-landing-page`。
- 快照 2 项：`strategy.md` 固定摘录（inline-text）+ `logo.svg` 冻结素材（**staged-file**）。
- 真实 Codex 运行 `50a7dad5-…`：**succeeded**（约 2m36s），`deliverableValidation=valid`，回执 `status=submitted`。
- 产物 `landing.html`（6563 字符）：顶层章节恰为 `hero/value/proof/cta`；CTA 标注预览交互，**未出现"提交成功/已发布/真实转化"**；内联了 logo 素材的品牌色与文字。导出件：`e2e-landing-export.html`。
- 结论：活动页薄场景（T10）真实管线跑通，结构契约与"不虚构回执"要求均被真实产物满足。
