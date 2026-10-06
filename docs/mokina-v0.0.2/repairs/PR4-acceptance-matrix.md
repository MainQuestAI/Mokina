# PR4 修复验收矩阵

上轮 R1–R7 的 local.5 成功路径与证据保留为历史结果。2026-10-06 复审新增 RR1–RR5，本轮工程收口重新置为未完成，需新候选 local.6 通过全部复验。用户营销专业签收未执行；PR 未合并。全量套件保留的 BASE 失败及两个时序疑点另列，没有将全量套件表述为绿色。

输入 HEAD `7135b52fe5c03537fbc000ec0686df01692a26f4`；精确 BASE `df4a0b2699cd2b37df2099b38da8fe8375d14b41`；最终产品代码 `033c57dfe08b1ca42fa8a883bfde522bd3326ed1`。日期：2026-10-05。[候选 manifest](evidence/final-local5/artifact-manifest.json) · [工程状态](evidence/final-local5/acceptance-status.json)。后续仅文档提交不改变本候选包。

## 功能验证

证据位于 [evidence](evidence/README.md)，`final-local5/` 为本次候选。其他文件保留此前相同修复代码的故障回归和精确 BASE 对照。跨 origin、失败 IPC 等 harness 证据不替代原生安装包验收。

| Review / 验收点 | 结果与证据类型 | 证据 |
|---|---|---|
| R1 保存为 POST 前置；A/B/C、写后删除、旧身份不能删除新记录 | Vitest 红转绿；同 key 完整读改写排队、CAS 冲突明确失败 | transfer-red.txt、transfer-green.txt；产品 SHA CI |
| R1 权威恢复、旧缓存迁移、跨 origin、容量不足 | bridge/desktop store 回归通过；local.5 原生重开恢复草稿；跨 origin 为 harness | final-local5/restart-before.json、restart-after.json；CI |
| R1 草稿/extras 转存与发送/快照/接续删除 | 等待关键异步结果；失败保留入口，竞态及路由切换回归通过 | transfer-green.txt；CI |
| R2 丢 202→原成果刷新→同 run→候选→显式采用 | local.5 原生入口、实际 IPC、真实 Codex 通过；同 clientRequestId 仅一次执行；未修订预算/渠道一致 | final-local5/revision-lost.json、revision-recovered.json、candidate-before-adoption.json、adopted.json |
| R2 job 保存/清理失败、未知 runId、新尝试、晚到结果 | 定向组件/请求回归通过；失败保留身份，切换后不覆盖成果 | 产品 SHA CI；修复记录 |
| R3 素材选择及两条 prompt 的实际字节 | local.5 面板选择 SVG/摘录；冻结 A 后换 B；legacy 和完整 OD Next task 复制的 177 字节均为 A。原生角色 hero，OD Next 夹具 logo，均为 asset 并有使用说明 | final-local5/selected-context.json、generation-request.json、generation-proof.json、odnext-status.json、odnext-proof.json |
| R3 缺失 blob | 安装包故障注入在 Agent 启动前失败、not-submitted，无 staged-file 成功回执；最终 SHA 同投影回归通过 | missing-blob.json；CI |
| R4 正式 reader、源项目删除后运行及再次恢复 | local.5 包内 CLI 和真实模型通过；源 404、目标快照 200、fingerprint 一致；继续运行复制 A，第二代恢复仍可读 | final-local5/bundled-cli-export.json、bundled-cli-import.json、restored-source-deleted-run.json、final-products.json、bundled-cli-reimport.json |
| R4 恢复版本 current/candidate 身份 | local.4 原生暴露错误；正式 reader 红转绿；local.5 保留 v3 current、v4 unadopted | native4-import-version-red.json；final-local5/version-reader-red.txt、version-reader-green.txt、import-green.json |
| R4 篡改、伪造指纹、缺失引用、错误归属 | 真实 prepare 夹具的生产校验器/HTTP 回归通过 | 产品 SHA CI；daemon-associated-green.txt |
| R6 丢成功响应、刷新失败、重启重试、副本 | 实际 app 故障注入普通重试仅一个目标，明确副本另建；local.5 可见入口及原生文件选择器导入；包内 CLI 相同操作再导入返回原项目 | import-lost.json、import-restart-copy.json；final-local5/import-green.json、bundled-cli-reimport.json |
| R6 正常入口与文档 CLI | normal entry 两项红转绿，相关 28 文件 199 项通过；CLI 实际源码 subprocess 四项通过，最终包 CLI 导出/导入成功 | native-entry-red.txt、native-entry-green.txt、native-cli-red.txt、native-cli-green.txt；final-local5/bundled-cli-*.json |
| R5 包内 PDF 依赖与解析 | local.5 25 个 Mach-O 无 Homebrew/开发目录引用；资源 manifest 不变；禁止访问外部工具仍读取中文、英文、两页文本 | final-local5/pdf-resource.json |
| R5 扫描件、损坏、超限 | local.5 正式 reader：扫描无 OCR、损坏 unreadable、10 MB+1 明确拒绝 | final-local5/pdf-reader.json、pdf-oversized.json |
| R7 根 CI 与真实 daemon 回归 | 托管 Ubuntu、Node 24、pnpm 10.33.2；guard/typecheck/i18n/定向测试及 13 项真实 daemon + fake Agent 浏览器回归成功 | [37317607651](https://github.com/MainQuestAI/Mokina/actions/runs/37317607651)，测试 SHA 033c57；final-local5/ci-product-sha.json |

## 最终安装包验证

全部使用 source SHA 033c57 的 local.5，同一 DMG 安装副本位于源码外实际目录。app 无源码、pnpm 或开发服务依赖；生成仍依赖已有 Codex CLI、账号和网络。

| 项目 | 状态 | 证据及边界 |
|---|---|---|
| 最终代码重建 app/DMG/ZIP，DMG 安装 | 通过 | final-local5/artifact-manifest.json；源码 SHA、local.5、大小及 SHA256 固定 |
| Finder 原生启动及退出后再次启动 | 通过 | Finder 双击后先核对进程再绑定 app；final-local5/native-observations.json、finder-restarted-process.json |
| 资料→真实营销成果→修订恢复/采用→选章接续活动页 | 通过 | 同一源项目选择资料生成 index；strategy 丢 202 后恢复采用；选 strategy/budget 建下游草稿，显式发送后生成活动页。final-local5/landing-draft.json、landing-status.json、final-products.json |
| v1 历史、v3 当前、v4 未采用：HTML/ZIP/PDF 原生保存 | 通过 | macOS Save As 九个实际文件，无对话框覆盖；HTML/解压 ZIP 六组外部 Chromium 打开；候选标记仅 v4。final-local5/native-exports.json、external-browser.json |
| HTML/ZIP/PDF 取消导出 | 通过 | 原生 Cancel 未写 cancel-probe 文件；仍选 v4、当前 v3 不变。final-local5/native-exports.json、postexport.json |
| 三个 PDF 外部打开与目视 | 通过 | macOS Preview 分别打开 v1/v3/v4，均六页；18 页渲染目视核对中文、LOGO A、预算和候选差异。final-local5/native-observations.json、pdf-all-pages.png。PDFium 未提取到文本，不证明可搜索/可复制文字 |
| 恢复包新项目，删除源项目后继续运行及再次恢复 | 通过 | source 03982314… 删除前已备份；源 404、目标 reader 200；真实 run succeeded，实际 HTML 及 A 落盘；再导出、导入仍保留 fingerprint |
| 退出重开、只停止本实例、全局配置保持 | 通过 | 本实例全部记录 PID（含旧 web 子进程）退出，自己的 daemon 停止；既有 Open Design 四 PID 存活；Finder 重开后草稿相同、快照/版本 200；Codex config 摘要相同。final-local5/restart-*.json |
| 真实产物外部打开 | 通过 | marketing、OD Next、restored、landing 无 JS 错误/缺图；活动页预算正常展开后可见。OD Next 本例专验素材字节，未以可见预算作业务质量签收。final-local5/generated-browser.json |

## 全量结果与专业签收

最终 Web 代码全量（a51be059，033c57 未改 Web）：1260 文件，1254 通过、6 失败；12820 用例，12800 通过、8 失败、1 expected failure、11 skipped。八个失败名称和错误签名均在精确 BASE 重现，见 web-local4-failures.txt、web-base-failures.txt 和修复记录。

daemon 全量在 0b3042：904 文件，894 通过、7 失败、3 skipped；11960 用例通过、18 失败、15 skipped。关联历史导出/重复导入两个旧断言已修复并定向通过（50 项）。其余 14 个失败名称在精确 BASE 重现；两个 brand 用例仅全量失败，BASE/HEAD 单独均通过，保留全量环境/时序疑点，未认定为已证明的历史失败。见 daemon-failure-comparison.json。追加 R4/CLI/正式版本 reader 四文件 34 项通过，产品 SHA 远端检查成功。

用户专业签收：**未完成**。营销策略、预算与页面质量由用户单独评估，模型写文件、工程检查和页面可打开不替代专业签收。公开发行签名、公证和跨平台验收不属于本机 arm64 预览的完成声明。

## 失败保留

local.3 正常入口/CLI 断点、local.4 current/candidate 错误均在原生使用中发现并补回归修复，旧候选不作为最终交付。此前 symlink、错误 prompt 字段及旧安装副本失败见 failed-fixtures.json；本次错误 OD Next pluginId、CLI 夹具参数、重启旧端口与折叠预算断言见 final-local5/failures-and-corrections.json。失败与修正分开，没有将首次失败计为通过。
