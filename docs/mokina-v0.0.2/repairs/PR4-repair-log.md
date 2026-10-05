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


## 最终候选与交付（R1–R7）

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
