# PR #19 独立复审与处置

使用 claude-code skill 的工具禁用 review runner，模型 `claude-opus-5-5[1m]`，审查会话 `ae4e7079-ae2c-4b4b-8ba3-9471f12ef233`。完整 branch + working diff 静态审查完成，格式校验成功；没有把已有 CI 或 PASS 文档当成修复有效的证据。原始回执保留于本地 output/mokina-pr19-fixes-2026-10-12/review.log。

## 处置

- **来源保留 P2：不采纳自动删除策略。** 已确认的方案要求保留来源冲突检查，且此前明确保护存活正文可能引用的基线证据。现有协议只有来源的 sectionId 与可读引用，没有完整机器可读的使用关系，不能仅凭绑定章节被替换就证明其他正文不再引用。本轮把存活 footer 中仍引用基线 source ID 的情况补入回归；同 ID、不同摘要明确拒绝，不自动覆盖或删证据。证据检查不等于确认新正文的专业论证成立。更精确的引用归属需另行设计，不在此次正确性修复中靠文本猜测实现。
- **无效章节 P3：已复现修复。** GET 原来二次调用章节解析抛错，现只在同一受保护检查中生成 fields/sections；内容不支持返回200 editable:false及原因，真实读取故障仍500。服务和HTTP回归均覆盖。
- **noscript P3：已复现修复。** 该元素列入受控内容拒绝范围，避免不同脚本环境的解析差异。读取不可编辑，组合POST拒绝且不新增候选。
- **合法绑定、过期值覆盖缺口：已补。** total、remaining、8位精度hours的错误值均生成 BUDGET_SUMMARY 和 issues 状态。
- **嵌套归属假设：不成立。** readHtmlSections 验证内层锚点，但仅暴露最外层可替换章节；最外层 owner 与该入口一致。
- **采用后回执身份假设：已核实并补测试。** 采用保留原操作身份，另写 adoptionOperationId，未替换成采用操作ID；采用后继续编辑的比较链可排除双方已验证回执。

review-red.log 在修复前2项失败，确认了章节错误与 noscript 缺口；后续受影响后端与前端回归已复跑。独立审查是静态覆盖，行为与浏览器验收分别见 acceptance.md。

## 独立审查原文

## 审查结论

共 3 项可执行问题：1 个 P2、2 个 P3。另有 1 项回归覆盖缺口，列为 P3。指定的六个焦点中，root/descendant 可执行属性、trailing receipt 链和预算汇总写回，在本 diff 内没有发现可确认的缺陷。

---

**[P2] `open-design/apps/daemon/src/mokina/operations.ts:148`、`:155-158`：组合时保留了被替换章节自己的基线证据，导致同 ID 冲突误拒，并把证据错误归属到新章节**

- 复现 A（误拒）：同一 `plan.html` 的两个版本都声明 `{id:'research', sectionId:'strategy'}`，但上游资料更新后 `sha256` 或 `excerpt` 不同。以 `combine.sections=['strategy']` 组合，`existing && JSON.stringify(existing) !== JSON.stringify(source)` 会命中，返回 400 `Combined evidence source IDs conflict`。donor 和 base 是同一文件的不同版本，共享 source ID 是常态。偏偏"章节证据已变化"正是需要组合的场景，此时组合被硬拒。
- 复现 B（错误归属）：base 有 `{id:'base-source', sectionId:'strategy'}`，donor 的 strategy 章节没有证据。组合后 candidate 仍声明 base-source 支撑 strategy，冻结快照会把 base 的资料当作 donor 正文的依据。替换章节内嵌套 ID 绑定的 base 来源也会变成孤儿。这些多余来源还会占用 8 来源上限，引发误拒。
- 根因：`sources = [...a.sources]` 保留了全部基线来源。"其他存活章节可能引用"这个理由只适用于 `sectionId` 不在被替换子树内的来源。
- 修复方向：用 base 中所选章节及其后代的 `data-mokina-id` 集合，先剔除对应的 base 来源，再并入 donor 来源。
- 测试：`tests/mokina-operations.test.ts` 中的 "keeps base declarations that surviving chapters may still reference" 用的恰好是 `sectionId:'strategy'`，等于把上述错误行为写成了预期，需要改写。另需补"同 ID、不同 sha"的组合回归。

**[P3] `open-design/apps/daemon/src/mokina/artifact-operations.ts:20`：章节结构不合法的旧稿，GET 返回 500，而不是"不可编辑"**

- 复现：存在一个 `readHtmlSections` 会拒绝的版本（`readFields` 第一行把它当校验器调用，说明它会抛错，例如歧义章节）。`inspectOperationSupport` 的异常在 `:17` 被捕获，转成 `unsupportedReason`。但 `:20` 的 `readHtmlSections(base.content)` 在 try 之外，再次抛出无 code 的错误，路由 `routes/project/index.ts` 映射为 500 `INTERNAL_ERROR`。
- 影响：前端停在错误加 Retry 的循环里，永远看不到"请使用章节修订"的回退提示。这破坏了 review.md 声称的"GET 先返回不可编辑及原因"，也把内容问题误报成服务端故障。
- 修复方向：`sections` 的计算并入同一个 try，失败时返回 `sections: []` 和 `editable:false`。补一个路由级回归。

**[P3] `open-design/apps/daemon/src/mokina/controlled-content.ts:5`：`<noscript>` 内容绕过资源与可执行属性扫描**

- 复现：cheerio 默认 `scriptingEnabled: true`，`<noscript>` 内部按原始文本解析。`<noscript><img src="https://x/y.png"><a href="javascript:1">x</a></noscript>` 不会被 `[src]` 选择器或 `$('*')` 的属性遍历看到。document 模式和 chapter 模式都会放行，组合可以把它带入 candidate。
- 影响：前提是在脚本禁用的上下文中渲染，例如 sandbox 未开 `allow-scripts` 的预览、禁用 JS 的阅读器。此时会出现外部请求或 `javascript:` 链接，与"含资源成果不进受控编辑、冻结产物无外部请求"的边界不一致。JS 开启时浏览器不渲染 noscript，所以影响有限。
- 修复方向：`load(html, { scriptingEnabled: false })`，或直接把 `noscript` 列入拒绝选择器。补一条 descendant 用例。

**[P3] 回归缺口：`open-design/apps/daemon/src/mokina/version-evidence.ts:153-157` 的汇总"值不一致"分支没有测试**

- 现有 freeze 测试只覆盖非法序号（`1`、`-1`、`typo`、`00`、超大数）走 warnings 路径。
- 没有用例覆盖"绑定合法但文本过期"的情况，例如 `data-mokina-budget-total="0">999` 而计算值是 100.05。这正是 capture 的核心价值，也就是用户手改或旧稿导致汇总失真。
- 同样没有覆盖 `remaining`、`hours` 两类的比对，以及 hours 用 8 位精度的格式化。
- 建议补一条：合法绑定、错误数值，断言出现 `BUDGET_SUMMARY` 且 message 含期望值。

---

## 审查覆盖说明（outside review coverage）

- 仅基于所提供的 diff 做静态审查。未运行任何测试、构建或浏览器，也未读取 diff 以外的源码。绿色 CI 和文档中的 PASS 账本没有被当作修复有效的证据。
- 未见的依赖实现：`readHtmlSections` / `replaceHtmlSection`（是否返回嵌套章节，chapter.html 是 outer 还是 inner）、`readProjectFileVersion` 的错误 code、`createVersion` / `hasOperation` 的幂等与冲突语义、"采用"操作生成的版本条目字段、freeze 中 `sum` 的取整方式。依赖这些的判断我没有升级为 finding，以下列为未验证风险：
  1. 预算表归属和导航 owner 用 `parents(...).last()`（最外层），字段和 freeze 用 `closest`（最内层）。如果 `readHtmlSections` 允许选择嵌套章节，预算重算和新增链接校验可能漏掉嵌套章节。
  2. `comparisonBusinessContent` 遇到断链会整体返回原文。如果"采用"生成的版本带有 `operationId` 而不是纯 `restoreFromVersionId`，采用后再编辑的候选比较会出现 base 和 candidate 剥离不对称，把 receipt 误报为章节外变化。现有测试只覆盖了不带 operationId 的 restore。
- 根目录 `README.md` 按约定视为既有无关改动，不在审查范围内。docs、i18n 文案、CSS、截图、场景包 HTML 内容只做了浏览，没有逐项审查。
