# PR4 修复记录

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
