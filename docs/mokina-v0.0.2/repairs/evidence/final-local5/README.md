# 最终候选 local.5 验收证据

产品代码 `033c57dfe08b1ca42fa8a883bfde522bd3326ed1`；版本 `0.0.2-local.5`；macOS arm64。工程收口通过，专业签收 pending。源码/构建/安装/包摘要见 [artifact-manifest](artifact-manifest.json)，结论边界见 [acceptance-status](acceptance-status.json)。后续纯文档提交不改变包。

| 文件 | 证据层次与用途 |
|---|---|
| ci-product-sha.json | GitHub Actions，实际产品 SHA 033c57，success；不是本地测试推定 |
| version-reader-red.txt、version-reader-green.txt、daemon-typecheck.txt | 生产版本 reader 红转绿、四文件 34 项回归和 daemon 类型检查 |
| import-green.json、postexport.json | local.5 正式 API：v3 current / v4 unadopted，导出取消后身份不变 |
| selected-context.json、original-changed.json、generation-request/status/proof.json | 原生面板资料选择、冻结、原件换 B；legacy 真实运行及实际 A 字节 |
| revision-lost.json、revision-recovered.json、candidate-before-adoption.json、adopted.json | 真实 daemon 受理后故意丢 202；原成果刷新找到唯一同 run，收集候选、显式采用；未改章节一致 |
| odnext-active.json、odnext-status.json、odnext-proof.json、odnext-mode-restored.json | 实际 automatic scenario 的完整 OD Next task、production 产物、A 字节；原 off 配置恢复 |
| landing-draft/start/status.json、final-products.json | 原生选择 strategy/budget 接续，不自动发；显式发送后实际活动页，未知日期/地址/联系方式保留待确认；源删除后恢复继续运行的实际 HTML/素材 |
| run-f030c6a6-4476-4506-832f-ac384f46748a.json | 恢复项目源删除后真实 run succeeded，包含实际提交回执与落盘路径 |
| bundled-cli-export/import/reexport/reimport.json、restored-source-deleted-run.json | 最终 app 嵌入运行时和预捆绑 CLI，无源码执行；恢复包正式 reader 保留指纹；同操作重试与第二代恢复 |
| native-exports.json、native-observations.json | CUA 原生菜单、macOS Save As/Cancel 实际九文件；外部 Preview 三个六页 PDF。观察记录为实际 AX 窗口及操作，不是 stub |
| external-browser.json、generated-browser.json | 外部 headless Chromium，实际 HTML/解压 ZIP 六组，以及四组真实产物；正常展开活动页预算后读取 |
| pdf-all-pages.png、v1-pdf-first.png、v3-pdf-last.png、v4-pdf-last.png | 实际导出 PDFium 渲染；18 页目视及候选标记对照。PDFium textChars=0，不作为文字搜索/复制证据 |
| pdf-resource.json、pdf-reader.json、pdf-oversized.json | 安装包 25 个 PDF Mach-O 依赖/受限 sandbox 和正式资料 reader 正负例；与 PDF 成果导出入口分开 |
| restart-before/quit/after.json、finder-restarted-process.json | 原生 Cmd Q 后本实例停止，既有 Open Design PID 存活；Finder 双击先验证启动再绑定 app；草稿、快照、版本恢复与全局配置摘要一致 |
| failures-and-corrections.json、odnext-start.json | 本次产品红测及夹具构造失败分别保留，未将错误 pluginId 或旧端口算产品成功 |

真实模型营销/OD Next/活动页/恢复产物及原生导出文件保留在 `/Users/dingcheng/Mokina-PR4-QA/exports/native-local.5/`；生成的外部打开副本只恢复原相对素材路径，没有改动模型 HTML 字节。最终 DMG/ZIP 位于 `/Users/dingcheng/Mokina-PR4-QA/releases/0.0.2-local.5/`。原生 app 安装副本与数据均在源码目录外；工程资料均为合成数据。

全量失败对照在父目录保留。用户业务专业签收、公开发行签名/公证、跨平台及 PDF 搜索/复制文字不在本次通过结论内。
