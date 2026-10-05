# PR4 修复记录

本记录保留各实施阶段的证据边界；最新状态以末尾「最终候选」及验收矩阵为准。

固定输入：HEAD 7135b52fe5c03537fbc000ec0686df01692a26f4；BASE df4a0b2699cd2b37df2099b38da8fe8375d14b41。

## A：R1 / R2

- 入口：renderer recovery facade、send-request-state、App 恢复屏障、desktop recovery store、FileViewer revision intent。
- 原失败：facade 连续 A/B/C 写未留下 C；冲突无返回值；旧 origin 遮蔽 durable 记录。红测见本次执行的 mokina-r1-red.log。
- 修复：完整 mutation 按 key 排序，不盲目重试 CAS；发送准备和 dispatched 写入等待 durable；启动先恢复；容量满明确失败；原成果在创建子项目与 POST 前持久保存 intent，受理后先更新 job 再清 receipt。
- 定向验证：web 4 文件 44 项通过（新增最终用例另计）；desktop store 定向通过；web typecheck 通过。
- 证据边界：本节为 Vitest/类型检查，未完成实际 IPC、Finder 或真实模型验收。
- 待收口：最终安装包重启、跨 origin、实际故障注入在 C3 统一执行。

## B：R3 / R4 / R6

- 入口：context-store 校验与暂存、两条 prompt、OD Next task-input snapshot、recovery-package、资料选择面板、导入 journal。
- 原失败：真实 prepare→export→import 后正式 reader 拒绝新项目快照（红测）。
- 修复：冻结字节实际复制并核对；OD Next 纳入既有任务附件快照；回执只报告已提供条目。恢复封装保留原内容和指纹，生产 reader 校验新归属；导入重新计算内容摘要。导入操作绑定归档摘要，UI 保存身份并支持明确副本。
- 验证：daemon 三文件 23 项通过；web 三文件 12 项通过；daemon/web typecheck 通过。
- 边界：当前为生产 helper、HTTP route、组件测试；实际安装包与真实模型在 C3 验证。原项目删除后可读/可再次导出已通过 helper 测试。

## C：R5 / R7，及 A/B 联合验收修正

- PDF：固定 Poppler 26.03.0 arm64 工具、递归 dylib、exe-relative CMap 资源、许可与来源声明、逐文件 SHA256。非系统加载路径改为 @loader_path 并 ad-hoc 签名；实际 sandbox 禁止 /opt/homebrew 和 /usr/local 读取，中文/英文/多页文本均成功。此时证据为随包资源，不代替最终安装包验收。
- Cache：schema 12 包含 PDF manifest 摘要；每次 materialize（含 cache hit）校验资源字节。
- CI：根 .github/workflows/ci.yml，任意 PR base 与手动触发；Ubuntu 24.04、Node 24、pnpm 10.33.2；guard、全仓 typecheck、i18n、定向组件/daemon/desktop/tools-pack 与真实 daemon + fake Agent 浏览器回归。远端状态另记。
- 联合验收发现并修复：恢复核对已持久 runId 而面板仍持旧 intent 的竞态；只复用全部归属匹配的原请求，冲突不授权覆盖。红测明确拒绝，绿测通过；真实 daemon 丢响应后恢复、候选收集与界面显式采用通过，POST 总数 1。
- 保留 Web 同步 localStorage 路径；只有提供 durable bridge 的桌面入口等待恢复屏障。冻结 snapshot 的本地绑定在 durable 保存后才更新。
- 当前定向结果：关联 Web 六文件 372 项；恢复新增四文件 58 项；daemon 四文件 30 项；tools-pack 两文件 18 项通过。guard、全仓 typecheck、i18n 通过。
- 浏览器：13 项分别通过（完整运行 12 通过、修订项的旧断言失败；修正为核对已采用正文后，单项通过）。最终 SHA 上将重跑并记录统一结果。
- 全 Web 首轮：1260 文件，12813 项，17 失败。9 个本轮关联失败已修复/更新并定向通过；其余 8 个在精确 BASE df4a0b2 重现，见失败对照。最终全量结果另记。

## 精确 BASE 失败对照

以下八项在 BASE 与本轮全量的测试名称和错误签名一致；没有把历史失败描述为通过。

|测试|错误签名|
|---|---|
|state/config: defaults reporting on and mints an installationId when the install never opted out|expected false to be true|
|HomeHero.rail: leads the create group with the Brand Kit chip and its own action discriminator|expected mokina-market-analysis to be create-brand-kit|
|i18n/locales: keeps locale dictionaries aligned with English keys and placeholders|zh-CN.homeHero.title expected [] to equal [word]|
|campaigns/deepseek-v4-flash-ui-contract: keeps the built-in campaign entry visible across entry tabs and project detail|EntryShell source does not match topRightSlot regex|
|campaigns/deepseek-v4-flash-ui-contract: keeps every CMS touchpoint host on the home view|CMS touchpoint source expectation mismatch|
|HomeHero.scenario-cards: uses the fixed ten-item Home creation hierarchy in product order|Mokina chips differ from upstream ten-item hierarchy|
|chips.automatic-default: marks every first-level output type as a product-owned automatic scenario|Mokina analysis chips differ from upstream automatic defaults|
|chips.automatic-default: binds exactly the plugin the daemon re-derives from the chip metadata|mokina-market-analysis expected example-web-prototype mapping|

BASE comparison uses a git archive of the exact BASE into an isolated temporary checkout; node_modules reuse does not change baseline src or tests. Evidence logs retain the full failures.


## 联合验收追加：R1 持久化完成门槛

- 原失败：接续 journal 在 IPC 未完成时已创建项目；发送恢复转存后立即消费 receipt；清理快照/发送记录先移除 localStorage，IPC 失败后恢复入口消失。
- 红测 `/tmp/mokina-transfer-red.log`：3 个失败，包括延迟 IPC 时已观察到创建项目 POST。
- 修复：接续 prepared/checkpoint/clear 全部等待桌面结果；发送 receipt 的正文和完整 extras 转存成功后才恢复并消费；异步清理失败保留原卡片与绑定；发送容量已满且没有请求身份时禁止受理。新输入或路由切换发生于异步转存期间，保留原 receipt。
- 全 daemon 904 文件：894 通过、7 失败、3 跳过；11960 通过、18 失败、15 跳过。导出旧断言及恢复包旧非幂等断言属于关联行为，已更新为 VERSION_NOT_FOUND 和同身份重试成功。其他失败正按精确 BASE 逐项对照，未将全量描述为通过。
- CI 0b3042aaa31dd4852dbeeba54cb704d056437289 已成功：https://github.com/MainQuestAI/Mokina/actions/runs/37298777628 。追加修复后的 HEAD 及安装包需重新验证。


## 阶段候选 local.3（历史，已由 local.5 替代）

| 提交 | Review ID / 修改入口 | 原失败及修复结果 | 证据类型 |
|---|---|---|---|
| e951cd8 | R1/R2：renderer/desktop recovery、send identity、FileViewer intent | 队列/CAS、桌面权威恢复、POST 前持久保存、未知 run 身份核对通过 | Vitest、typecheck |
| 2d5c6bb | R3/R4/R6：素材投影、两条 prompt、恢复封装/reader、import journal | 正式 reader 拒绝恢复快照的红测修复；真实 prepare 夹具，素材字节/摘要与幂等导入通过 | helper、route、组件 |
| 0b3042 | R5/R7 及关联回归：包内 PDF、缓存、根 CI | 递归 arm64 工具不再依赖 Homebrew；实际资源验证、远端 CI 通过 | sandbox、二进制校验、CI |
| 6fe5d5 | R1 联合修正：接续、发送 receipt/extras、快照清理 | 延迟 IPC 原失败三项；修复后保存前置、失败身份保留、竞态检查通过 | 定向回归、全量对照、最终 CI |
| 后续文档提交 | R1–R7：实施记录、矩阵、Runbook、证据 | 只整理已验证结果和未完成项，不改变 final candidate 的产品代码 | 实施记录及安装包/真实模型证据 |

产品代码 SHA：6fe5d5346a0031a2459d04925a53be8e428f4ad9。远端 CI [37303305689](https://github.com/MainQuestAI/Mokina/actions/runs/37303305689) 成功：guard、全仓 typecheck、i18n、关联包测试、13 项真实 daemon + fake Agent 浏览器测试全部通过。旧 CI 0b3042 另存为阶段结果，不替代最终 SHA。

最终定向：Web 7 文件 185 项、另 4 文件 64 项；关联 daemon 2 文件 50 项；desktop 2 文件 32 项通过。最终 Web 全量 12818 项：12798 通过、8 失败、1 expected failure、11 skipped；八项与精确 BASE 名称/错误签名一致。daemon 全量 0b3042 的 18 失败中，关联旧断言两项在最终 SHA 更新并定向通过；其他 14 项在精确 BASE 重现，两个 brand 用例全量失败但 BASE/HEAD 单独运行通过，仍保留环境/时序疑点。详细名称、签名和分类见 evidence；未声称全量通过。

同 SHA 构建 local.3 app/DMG/ZIP，重新安装核对版本并在源码之外实际目录运行。实际 IPC/模型已验证：丢失 202 后同一修订 run 恢复并显式采用，只有一次执行；资料面板选入 SVG 和摘录后冻结，替换/删除源资料，legacy 与完整 OD Next task 都使用冻结 A 的真实字节；恢复 reader、删除源项目后继续运行及再次导出导入；导入成功响应丢失、重启和列表刷新失败仍复用同项目，明确副本才新增；真实营销方案及活动页文件生成。多 HTML 的额外文件先未成为正式入口，显式补写 index.html 后 deliverableValid=true，此失败与修正一并保留。

最终包 PDF 正式 reader：中文/英文/多页成功，扫描件明确无 OCR、损坏 unreadable、10 MB+1 返回 400。25 个已安装工具二进制无 Homebrew/开发目录引用，受限 sandbox 仍成功。主实例停止/重启期间另一个实例存活；恢复记录完全一致，reader 200，全局 Codex 配置摘要不变。

历史/当前/未采用候选的 HTML/ZIP 来自最终 app 实际选版导出，在原生 Save As 前截取内容。三组 HTML/解压 ZIP 与活动页通过外部 headless Chromium 打开检查。此证据不覆盖原生保存/取消或 PDF 导出。Finder 启动、原生 HTML/ZIP/PDF 保存/取消和 PDF 目视验收受 Mac 锁屏阻止，保持未完成；用户专业签收未执行，工程收口未宣告，PR 未合并。详见 [验收矩阵](PR4-acceptance-matrix.md)、[Runbook](../runbook.md) 与 [证据索引](evidence/README.md)。


## 原生收口发现并修复：R6 正常入口与 CLI

2026-10-05 Mac 解锁后，从 Finder 启动 local.3 成功。正常首页/全部项目不能打开 NewProjectModal：导入控制虽已接通，但唯一新建按钮位于未激活的旧 projects 视图。新增两项正常 rail 组件测试均先失败，再将 Mokina 本地侧栏的 New project 接到已有 onNewProject，并保留调用方 disabled 门槛；不新增工作台。相关 28 文件 199 项通过。

同时实际 Node 子进程执行帮助中声明的 `od mokina recovery import/export` 均 exit 2；修复分发后又暴露未导入 fs 及默认 operationId 的 randomUUID。已使用 node:fs/promises 与 node:crypto 的正式导入。四个 CLI 子进程测试核对 multipart 输入、原 operation/target、写出的服务端字节和省略可选 operation 的 UUID，连同恢复 routes 共 7 项通过。红/绿证据在 evidence/native-*。测试的 ZIP 字节为 CLI 传输夹具，生产恢复包校验仍由现有真实 prepare/route 用例验证。

上述两类回归加入根 CI。产品候选将重新构建为 local.4；local.3 保留为阶段证据，不代表新候选已通过原生验收。专业签收仍单独进行。


### R4 追加：恢复版本正式读取（local.4 原生验收）

Finder 启动 local.4 后，从可见新建项目入口和 macOS 文件选择器导入有效恢复包。归档明确记录 v3 当前、v4 未采用候选，但正式 GET 和原生版本面板把 v4 同时标记为当前与候选。导入重建 manifest 未写 `schemaVersion: 2`，正式 reader 按旧版规则选最后一项。追加 production reader 的 prepare/create → export → import → list → re-export 行为回归，先失败后修复；导入 manifest 采用正式 v2 布局。恢复、CLI、版本存储 4 文件 34 用例通过。local.4 仅保留为失败发现证据，下一候选 local.5 重新构建并验收。


## local.5 工程收口（R1–R7）

| 提交 | Review / 修改入口 | 原失败与修复后结果 | 证据类型 |
|---|---|---|---|
| a51be059 | R6：EntryNavRail、daemon CLI、根 CI | 正常 rail 的两个入口红测、CLI 分派和默认 UUID 红测；复用已有 onNewProject，接通 recovery 分派与实际 fs/crypto，199 项组件相关回归及四项 CLI subprocess 通过 | 先红后绿；实际源码 CLI；CI |
| 033c57df | R4：recovery-package 导入版本 manifest | 原生 local.4 把 v4 候选当 current；production reader 回归先失败；schemaVersion 2 修复后四文件 34 项通过，local.5 原生正式 GET 保留 v3 current、v4 unadopted | 原生失败保存；生产 reader 红转绿；typecheck/CI |
| 后续文档提交 | R1–R7：矩阵、Runbook、最终包证据 | 更新为 local.5 已证实结果及限制；不改变最终产品代码，不触发用户专业签收，不自动合并 | 功能、安装包和专业签收分栏 |

从 `033c57dfe08b1ca42fa8a883bfde522bd3326ed1` 重建 local.5 app/DMG/ZIP。DMG 408,013,900 bytes，SHA256 `40e2b1799fab254f5af6af8cffba976548cbe5e83fb9e334d666df9a991ea2bb`；ZIP 405,038,728 bytes，SHA256 `28a4200d0d7a4c4d32b99adae1d4438940b6e47ba63962a85f99ea05be560b77`。最终交付 `/Users/dingcheng/Mokina-PR4-QA/releases/0.0.2-local.5/`。PDF 资源 manifest 与已验资源一致，最终安装副本再次验证 25 个 Mach-O、受限 sandbox、中英文两页、扫描/损坏/超限正式 reader。

同一最终包已从 Finder 启动，正常新建入口经原生选择器导入恢复包。原生资料面板准备实际 A 后替换原件 B；legacy 真实生成 index 并复制 A。strategy 修订在真实 daemon 受理后丢 202，刷新原成果从恢复入口找回唯一原 run，收集候选并显式采用；预算及渠道与原版一致。再选 strategy/budget 创建下游草稿，用户显式发送后实际生成活动页；日期、地址、联系方式保留待确认。OD Next 通过现有 automatic scenario 的完整 task completed，素材复制为相同 A；临时 active 模式已恢复原 off。

历史 v1、当前 v3、未采用 v4 各经实际 macOS Save As 保存 HTML/ZIP/PDF（九文件），三类取消均未误写文件或改当前稿。六组 HTML/ZIP 外部 Chromium 打开无脚本错误/缺图；三个六页 PDF 分别在 macOS Preview 打开并渲染核对全部 18 页。PDFium 文本提取为零，保留此边界，不宣称搜索/复制文字已验收。

安装包预捆绑 CLI 实际导出完整项目、导入新身份，正式 reader fingerprint 一致。删除已备份的合成源项目后，源返回 404、目标 reader 200，真实 run `f030c6a6-4476-4506-832f-ac384f46748a` succeeded 并落盘 HTML 和相同 A；再次导出、导入第二代目标仍正式可读。同 operation/target/archive 重试返回原项目。原生 Cmd Q 停止本实例全部记录 PID 和自己的 daemon，既有 Open Design 四 PID 存活；Finder 重开后未发送草稿一致、恢复 reader 和版本 200、Codex 全局配置摘要相同。

产品 SHA CI [37317607651](https://github.com/MainQuestAI/Mokina/actions/runs/37317607651) 成功，含 13 项真实 daemon 浏览器回归。Web 在 a51be059 全量（最终未改 Web）12800 pass、8 BASE fail、1 expected failure、11 skipped；daemon 全量保留的 14 BASE 与两个时序疑点如前述。新关联回归通过，不将全量套件写成绿色。工程收口完成，用户专业签收未执行。逐项证据见 [矩阵](PR4-acceptance-matrix.md) 与 [final-local5](evidence/final-local5/README.md)。
