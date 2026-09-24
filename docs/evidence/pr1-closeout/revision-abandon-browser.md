# PR #1 复审收口：章节修订异常退出浏览器证据

2026-09-24，在 macOS、Node 24.15.0、`NEXT_PUBLIC_MOKINA_EDITION=on` 下，从当前工作树启动独立 Web/daemon 和数据根。用原生项目及文件 API 创建合成 `review.html` v1；页面经 Playwright CLI 打开，未使用组件替身。原文件 SHA-256 为 `d7429bc4e6fbe198269c417ffb0fda6cc9688dba7427cec00a141dc0e001531a`，当前版本 ID 为 `0c14d29f-60cb-4764-8b2d-4b97878c017e`。

| 场景 | 浏览器与 API 观察 | 页面快照 |
| --- | --- | --- |
| 成功运行未写替换文件 | 用浏览器路由仅模拟 `/api/runs/run-missing` 返回 `succeeded`，独立项目的原生文件 API 对 `MOKINA-REPLACEMENT.html` 返回 404。页面提示“模型未写出…”，恢复记录仍在；关闭再打开版本面板仍可保存或放弃。点“放弃本次结果”先显示确认，点“返回继续保存”不清记录。 | [确认前](missing-result-confirm.yml) |
| 成功运行产生无效章节 | 用浏览器路由仅模拟 `/api/runs/run-invalid` 返回 `succeeded`；替换文件由原生文件 API 保存为错误章节。原生候选 API 返回 HTTP 400，页面显示 `replacement must contain exactly one complete chapter: strategy`，恢复记录仍在。确认放弃后，本地恢复键清除。 | [400 与确认](invalid-result-confirm.yml)、[放弃后](invalid-result-abandoned.yml) |
| 放弃后重新生成 | 选择同一章节并填写新要求，“生成候选”重新可用。项目创建和原章节快照使用原生 API；浏览器路由仅模拟新运行创建返回 `run-b` 及其 `running` 状态。新的本地恢复记录拥有新 `runId` 和 `operationId`。 | [新修订运行中](new-revision-running.yml) |

两次放弃后重新读回，`review.html` 的 SHA-256 仍为 `d7429bc4e6fbe198269c417ffb0fda6cc9688dba7427cec00a141dc0e001531a`，版本列表仍只有 current v1。受控 `run-*` 是浏览器异常路径测试值，不是实际 Codex 运行 ID；此前真实 Codex 主链证据仍按验收记录保留。

浏览器还发现修订区的多个按钮共同继承 `position: sticky` 时互相覆盖，导致“放弃”挡住“保存”。仅对 AI 修订区改为普通布局后，两按钮的可点击区域分离，原生 400 场景中的“保存”和“放弃”都能点击。
