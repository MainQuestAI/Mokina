# N07｜全量测试失败分类与处理决定 · 2026-10-06

基线：`docs/mokina-v0.0.2/repairs/evidence/final-local6/full-suite-comparison.md`（V0.0.2 签收时 8 Web + 14 daemon 历史失败，全部 same-name-and-signature-in-both）。
本轮复测：切片 C 分支工作树（= 即将合入的 main 内容），Node 24.15.0 / pnpm 10.33.2，全量套件实跑。

| 包 | 本轮结果 | 结论 |
|---|---|---|
| web | 12829 通过 / **8 失败** / 11 跳过（1263 文件） | 与基线**同集合、同签名**，0 新增 |
| daemon | 11992 通过 / **14 失败** / 15 跳过（905 文件） | 与基线**同集合、同签名**，0 新增 |

## 逐项分类（22 项）

### A. 默认产品差异（Mokina 相对上游的产品决定，非缺陷；不修，N07-验收口径内）— 8 项

| 测试 | 差异原因 |
|---|---|
| web …/HomeHero.rail.test.tsx | Mokina 把营销入口排在轨道首位，上游断言 Brand Kit 首位 |
| web …/HomeHero.scenario-cards.test.tsx | 同上：创建层级以营销入口为首（本轮再加 landing-page 第三项） |
| web …/chips.automatic-default.test.ts ×2 | 营销 chip 为用户 pin 而非 automatic-default（设计如此） |
| web …/campaigns/deepseek-v4-flash-ui-contract.test.ts ×2 | 上游 campaign 入口在 Mokina edition 不存在 |

### B. 真实能力/环境问题（非本轮代码可修；不修）— 12 项

| 测试 | 归因 |
|---|---|
| daemon …/brand-prefetch.test.ts ×1、brand-routes.test.ts ×5 | 浏览器抽取测试夹具 20s 超时（本地无头浏览器环境时序，修复前/BASE 同签名） |
| daemon …/codex-model-preflight.test.ts ×2、codex-model-capability-preflight.test.ts ×2 | 本机 Codex CLI 版本/鉴权探测环境（0.160.0 与夹具假设的旧稳定版不符） |
| daemon …/integrations/vela.routes.test.ts ×4 | AMR 分析镜像端点（上游遥测，Mokina 不恢复遥测——计划非目标 5） |

### C. 上游断言漂移（内容/默认值决定，非代码缺陷；记录，不修）— 2 项

| 测试 | 归因 |
|---|---|
| web …/i18n/locales.test.ts | zh-CN `homeHero.title` 无 `{word}` 占位符（Mokina 中文文案决定；**本轮新增 90 键占位符全部对齐，仅此历史键红**） |
| web …/state/config.test.ts | 上报默认关闭的产品决定（V0.0.2 既有） |

## 本轮修改命中的文件核验

切片 A–C 改动的测试面（home-material-snapshot / pending-context-snapshot / evidence / context-panel 品牌 / continuation v2 / summaries / FileWorkspace 等）在全量中**全部通过**；历史失败文件均未被本轮修改触碰（chips.ts 的 chips.automatic-default 失败为语义性产品差异，已在 A 类声明，非本轮 N02 新增入口引入——基线同签名）。

## 处理决定

- 0 项真实回归；不修、不 skip、不恢复上游遥测（计划非目标 5 遵守）。
- A 类如需转绿，须改上游断言承认 Mokina 产品差异——超出本轮范围，留待上游对齐议题。
- B 类环境项随本机 Codex/浏览器环境升级自然失效或另行处理。
- 22 项维持基线对照口径：后续切片回归判定以"集合不扩大、签名不变"为准。
