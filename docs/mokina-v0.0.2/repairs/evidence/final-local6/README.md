# local.6 工程验收（2026-10-06）

**RR1–RR5 与本机 arm64 安装包工程收口完成，用户专业签收未执行；PR 不自动合并。** 产品源码 `8950986e41e5047c56aab4d3ba9fda900902aa9a`，`1ae0c139` 仅调整普通拒绝 receipt 浏览器测试和证据。app、DMG、ZIP 均为同一 `0.0.2-local.6`；身份及摘要见 [artifact-manifest.json](artifact-manifest.json)。local.5 保留为历史证据。

| 证据 | 证明范围 |
|---|---|
| ci-product.json | 产品检查点 PR HEAD 1ae0c139、实际 merge 1e992789；远端 guard/typecheck/i18n、265 定向与 14 真实 daemon/假 Agent 浏览器通过。最终文档 HEAD 检查另在 PR 正文记录 |
| full-suite-comparison.md/json | web 12809 普通通过、8 失败、1 expected failure、11 skipped；daemon 11987 通过、14 失败、15 skipped；22 个失败均在修复前及精确 BASE 同名同签名重现。本轮无新增或未解释时序失败；BASE 对照仅重跑失败文件 |
| finder-launch.json、native-fixture.json、native-generation.json | 同 DMG 安装副本由 Finder 打开；正常创建/上传 MD、SVG，素材与摘录选择、冻结、真实 Codex 生成。冻结 A 后换 B，实际素材仍为 A |
| native-rejected-before-refresh/ended.json、native-lost-202.json、native-adoption.json、native-adoption-content.json | 真实 daemon 受理前 404/not-accepted/runCount=0；刷新原成果保留要求，显式结束后新身份；新尝试实际 202 丢响应，刷新核对同 run，收集 v4 并显式采用。预算与渠道不变 |
| native-delete-before-cleanup/after-reload.json、desktop-ipc-before/after.json | Host 删除成功后故意保留本地旧缓存，renderer 重开不复活；删除事实与旧 CAS 拒绝、五类合法键在 CLI profile 重开保留。跨 origin、失败 IPC、容量及旧缓存确认为定向 harness 证据 |
| native-long-path-accepted/after-reopen/continuation.json | 201 字符相对文件路径，含子目录、中文、空格，revision key 254 字符；实际 IPC 保存 accepted；退出/Finder 重开仍同 run，正常入口收集候选并从所选 strategy 建接续草稿，runCount=0。五类键的 IPC 与此一条复杂路径完整 UI 流程分别记录 |
| native-continuation-before-quit/after-reopen/success.json | v4 选择 strategy、budget 创建活动页草稿；退出/Finder 重开内容相同且未自动运行，明确发送后真实 Codex 成功生成活动页 |
| native-exports.json | 采用前 v2 历史、v3 当前、v4 未采用各经 macOS Save As 导出 HTML/ZIP/原生 PDF，共九份；三种取消未写文件；外部原生 Chrome 打开 3 HTML 与 3 解压 ZIP，Preview 打开 3 PDF（各四页）。候选新增句仅 v4。未验证 PDF 正文搜索/复制 |
| native-recovery-overlap/source-deleted.json、native-restored-snapshot-status.json、native-recovery-byte-proof.json、native-second-generation-recovery.json | 原生导出及文件选择器导入；一条真实 UI 请求重叠四次同身份 POST 返回一个目标；删除合成源项目后正式 reader 指纹不变；显式 context.mokinaSnapshotId 真实 Codex succeeded，暂存与复制 SVG 摘要等于 A；原生再次导出后第二代正式导入/reader 仍完整 |
| native-final-state.json、native-long-path-quit-isolation.json、native-final-quit-isolation.json | 测试运行均终态；原生退出仅停止本实例，11 个既有其他桌面 PID 保留，全局 Codex config/auth 摘要不变。保留未发送的长路径接续草稿 |
| recovery-api.json、api-restored-run-status.json、api-frozen-asset-proof.json | 独立 CLI QA profile 同包四次重叠、竞争 409、非法 400、正式 reader/真实运行/再次恢复，以及冻结 A 的字节验证；不混记为 Finder UI 流程 |
| pdf-resource.json、api-pdf-reader.json | 包内 25 Mach-O 不引用 Homebrew/开发目录；禁外部工具 sandbox 中英两页文本；正式 reader 扫描不做 OCR、损坏 unreadable、超限 400 |

## 作用域与保留产物

安装：`/Users/dingcheng/Mokina-PR4-QA/out/mac/namespaces/mokina-local/install/Applications/Mokina.app`。Finder portable 默认 profile：`~/Library/Application Support/Mokina/namespaces/mokina-local`；独立 CLI QA profile：`/Users/dingcheng/Mokina-PR4-QA/runtime/mac/namespaces/mokina-local`。原始日志在 `/Users/dingcheng/Mokina-PR4-QA/evidence/native-local.6`，九份原生导出与恢复 ZIP 在 `/Users/dingcheng/Mokina-PR4-QA/exports/native-local.6`。最终退出了验收实例，安装 app 与文件保留供用户使用。

Finder 流程源 `60198b4d…` 已按验收要求删除，原生恢复 ZIP 保留；目标 `d0baee72…`、二代 `529956e4…` 均可读。活动页 `cce77046…` 真实运行成功；长路径接续 `96c9c886…` 为未发送草稿。所有输入为合成资料。

## 失败与证据边界

第一次 API prepare 使用未规范化素材名，未启动 run，按正式文件名修正。原生首轮生成夹具只要求 id，未要求既有章节契约 data-mokina-id；保留原 v1/v2，真实 follow-up 仅补标注成为 v3，再开始修订，未改产品代码。长路径复制夹具先缺相对 SVG，补齐同目录资源后产生完整 v2；修订仍按已冻结 v1 的选章校验，原当前稿未覆盖，候选为 v3。

恢复运行夹具首次把 mokinaSnapshotId 放在请求顶层，没有交付回执；这次运行不计为冻结快照通过。改为生产字段 context.mokinaSnapshotId 后独立运行 succeeded，提交回执与 A 字节已核对。二代导入 helper 首次字符串替换破坏 JS 的 POST 文本，解析失败未发请求，改为结构化 JSON 参数后正式导入通过。ZIP 外部检查首次假定 index 在根目录，按真实嵌套条目修正。CUA Chrome connector/全局 inventory 超时后改用原生 Chrome；应用重开初次 AX 绑定超时，已启动进程再次绑定成功。工具失败不计产品通过。

首次退出的 peer 比较包含 Agent 自己的临时 helper，按进程归属排除后 11 个用户桌面 PID 保留；原清单留在原始证据，修正说明见 native-quit-isolation.json。最终另一次退出完整核对通过。

服务并发测试用可控完成信号；包内 HTTP 并发是实际 Promise.all 重叠；拒绝/丢响应为原生点击触发真实 daemon，网络夹具只作用一次 POST。PDF 仅确认原生打开与可见内容，不宣称可搜索/复制文字。工程结果不替代营销策略/预算/页面质量专业签收，也不包含公开发行签名、公证或跨平台验收。
