# PR4 验收证据

产品 SHA `6fe5d5346a0031a2459d04925a53be8e428f4ad9`；候选 `0.0.2-local.3`。CI、功能、安装包、用户专业签收分别见 [验收矩阵](../PR4-acceptance-matrix.md)。

JSON 来自本机合成资料、最终 app 的正式 API/实际 renderer/desktop IPC、真实 Codex 模型或已安装的 PDF 工具；只有 ci-run.json 来自 GitHub Actions。browser-exports.json / marketing-browser.json 为外部 headless Chromium。exports.json 明确标记在原生 Save As 前截取 blob，因此不是原生保存验收。failed-fixtures.json 保留失败，未计为通过。

*-failures.txt 保存全量和精确 BASE 的名称、错误签名与定位。daemon-failure-comparison.json 对关联旧断言、BASE 重现及两个全量时序疑点分别分类。transfer-red/green 记录保存前置条件的原失败和修复后结果。

artifact-manifest.json 对应最终 app/DMG/ZIP，不因后续文档提交变化。源文件及生成 HTML/ZIP/截图在 `/Users/dingcheng/Mokina-PR4-QA/exports/`；交付包在该目录的 `releases/`。Finder、原生保存/PDF/取消与用户专业签收未完成。
