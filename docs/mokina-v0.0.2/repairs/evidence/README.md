# PR4 验收证据

当前交付：产品 SHA `033c57dfe08b1ca42fa8a883bfde522bd3326ed1`，候选 `0.0.2-local.5`。R1–R7 与本机 arm64 安装包工程验收已收口；用户专业签收未执行，PR 未合并。当前文件见 [final-local5](final-local5/README.md)，逐项层次和全量失败边界见 [验收矩阵](../PR4-acceptance-matrix.md)。

native-entry-red/green、native-cli-red/default-red/green 是原生收口补修的 R6 回归；native4-import-version-red.json 保留 local.4 正式 reader 错把候选当当前的原失败；final-local5/version-reader-red/green 是对应生产 reader 回归。web-local4-failures.txt 对应最后 Web 代码，八项与精确 BASE 名称/错误签名相同。

下列为 local.3 阶段及原修复故障注入证据，保持原身份以便复核，不作为 local.5 原生保存验收。其相同修复代码的失败 IPC/跨 origin/导入重试等证据在当前矩阵引用；新的 source/build/native 文件位于 final-local5。

## 阶段 local.3 证据（历史）

产品 SHA `6fe5d5346a0031a2459d04925a53be8e428f4ad9`；候选 `0.0.2-local.3`。CI、功能、安装包、用户专业签收分别见 [验收矩阵](../PR4-acceptance-matrix.md)。

JSON 来自本机合成资料、最终 app 的正式 API/实际 renderer/desktop IPC、真实 Codex 模型或已安装的 PDF 工具；只有 ci-run.json 来自 GitHub Actions。browser-exports.json / marketing-browser.json 为外部 headless Chromium。exports.json 明确标记在原生 Save As 前截取 blob，因此不是原生保存验收。failed-fixtures.json 保留失败，未计为通过。

*-failures.txt 保存全量和精确 BASE 的名称、错误签名与定位。daemon-failure-comparison.json 对关联旧断言、BASE 重现及两个全量时序疑点分别分类。transfer-red/green 记录保存前置条件的原失败和修复后结果。

artifact-manifest.json 对应阶段 local.3 app/DMG/ZIP，不因后续文档提交变化。源文件及生成 HTML/ZIP/截图在 `/Users/dingcheng/Mokina-PR4-QA/exports/`；交付包在该目录的 `releases/`。Finder、原生保存/PDF/取消与用户专业签收未完成。
