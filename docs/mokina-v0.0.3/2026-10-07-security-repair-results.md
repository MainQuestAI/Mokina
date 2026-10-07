# Mokina V0.0.3：本轮安全依赖处置

日期：2026-10-07。这是 R1 的实施与剩余风险记录，不是发布安全签收。

## 1. 实际审计结果

命令均为 `pnpm audit --prod --json`，Node 24.15.0 / pnpm 10.33.2。原始报告保存在 `/private/tmp/mokina-v003-qa.zt5jxC/r1-evidence`，不包含客户 profile 或资料。

| 报告 | 身份 | critical | high | moderate | low | exit |
|---|---|---:|---:|---:|---:|---:|
| baseline-audit.json | 从 `413c15b265a08df6956896f1b76a32234b64d3b6` 的完整锁文件取得 | 4 | 70 | 57 | 13 | 1 |
| final-audit.json | 本轮实际安装后的锁文件，2026-10-07 05:48:48 UTC | 0 | 7 | 4 | 1 | 1 |

SHA-256：baseline `2deaef824a9b26e655fbf19d1e62276eae848afcf97606293051bf76f84fa326`；final `78f9b933ad1339be255e43259adf1a4615b037e4c27fca005b6cfb6eb8c55146`。报告字节数分别为 701594 和 29504。audit 数量不是可利用漏洞数量；最终 exit 仍为 1，不记安全完成。

## 2. 已落地的兼容升级

- Web：Next 16.2.6 → 16.3.6；DOMPurify 3.4.2 → 3.4.16。
- daemon：MCP SDK 1.29.0 → 1.31.0；multer 2.2.0 → 2.4.0；PostCSS 8.5.15 → 8.5.23；undici 7.29.0 → 7.29.1。
- 打包 owner：electron-builder 26.8.1 → 26.15.0，仍在 26.x 内；配套 app-builder-lib/builder-util-runtime 由 owner 带入，不单独强制升级内部 API。
- 既有全局覆盖的兼容版本：brace-expansion 5.0.12、fast-uri 3.1.8、hono 4.13.7、ip-address 10.7.1、PostCSS 8.5.23、protobufjs 8.6.6、qs 6.16.0、undici 6.28.1/7.29.1。
- 新增明确旧版本的覆盖：adm-zip 0.6.0 → 0.6.1；xmldom 0.8.13 → 0.8.15 / 0.9.10 → 0.9.12；baseline-browser-mapping 2.10.23 → 2.11.0；body-parser 2.2.2 → 2.3.0；fflate 0.4.8 → 0.4.9；form-data 4.0.5 → 4.0.6；js-yaml 4.1.1 → 4.3.2；lodash-es 4.17.21 → 4.18.0；Mermaid 11.16.0 → 11.16.1；nanoid 3.3.3 → 3.3.18。
- 明确 owner/range 的覆盖：Express 的 proxy-addr → 2.0.8；sharp ^0.35.0 → 0.35.5；source-map-js → 1.2.2。

覆盖移除条件：对应 owner 的正常依赖解析已包含安全版本时，删除该覆盖并复验。nanoid 3 的升级不等于 nanoid 4 已修复；没有运行 `audit fix --force`，也没有直接把 nanoid 4/image-size 1 改为不兼容主版本。

## 3. 剩余告警逐项处理方向

| 依赖 / 告警数 | 路径与当前证据 | 结论与下一步 |
|---|---|---|
| nanoid 4.0.2：3 high、1 moderate | Web → Excalidraw → mermaid-to-excalidraw；当前 owner 的已查调用为不带 size 的 `nanoid()`，没有在这些调用处接受负数、零或非整数 size | 未关闭。owner 最新已查版本仍固定 4.0.2；需要针对其真实转换流程验证升级到 5.x 的兼容性，不能用 nanoid 3 补丁冒充修复 |
| image-size 1.2.1：2 high | daemon → pptxgenjs 4.0.1；已查该发行版 dist 和 daemon 源码未出现 image-size 导入/调用，但依赖仍被声明并安装 | 未关闭。补丁下界 2.0.3，需要核对上游 owner 或确证包内可达解析路径；未执行畸形 JXL/HEIF/ICNS 利用测试，不宣称不可利用 |
| braces 3.0.3：1 high | daemon → chokidar 3；项目 watcher 传入解析后的目录，但尚未设置 disableGlobbing | 未关闭；当前公告无补丁。下一步针对真实含花括号目录/深嵌套模式复现，确认是否可仅禁用 watcher 的 glob 解析，保留普通项目文件监听；不先改监控行为 |
| http-cache-semantics 4.2.0：1 high | tools-pack → electron-builder → app-builder-lib → @electron/get → got/cacheable-request | 工具链开放项，公告无补丁。核对下载缓存是否涉及跨用户共享、候选是否实际包含此链；不能用工具依赖分类消除本机打包风险 |
| OpenTelemetry core 2.2.0/2.7.1：1 moderate | Web → posthog-js → exporter/resources | 未关闭。补丁下界 2.8.0，优先核对 PostHog owner，避免孤立升级与 SDK 耦合版本；待确认 baggage 输入和包内路径 |
| sprintf-js 1.1.3：1 moderate | daemon → hyperframes → onnxruntime-node → global-agent → roarr | 无补丁开放项。需要核对可控格式精度与实际代理日志路径；不以非主流程为理由清除 |
| KaTeX 0.16.47：1 low | Web → mermaid-to-excalidraw → Mermaid → KaTeX | 未关闭。补丁在 0.18.2，需要 owner/渲染兼容核验；不在本轮静默跨 0.x minor 升级 |

这些是路径与适用性初筛，不是安全豁免。新候选只用于隔离验收，不能因 critical 清零记为可公开发布。

## 4. 安装与回归证据

首次本轮末段安装下载出现 ECONNRESET，单个 semver 请求耗时 250064 ms；保存日志后仅停止本次安装进程。有限 fetch 超时重试仍等待，离线模式明确报 d3 元数据缺口。通过正式 `pnpm store add` 缓存确定版本后，`pnpm install --prefer-offline --fetch-timeout=20000 --fetch-retries=1 --reporter=append-only` 实际 exit 0，含完整 postinstall，耗时 1m18.9s。没有手工编造锁文件、修改全局网络设置或 blanket approve-builds。

安装失败/中断、离线缺口及最终日志分别保留。原有 DeepSeek peer 警告和未批准的可选 build scripts 保持单列，不归因到本轮导出修复，也不隐去。

最终环境实测：Node `v24.15.0`、ABI `137`、better-sqlite3 `12.10.0`、内存 SQLite `3.53.1`。guard、typecheck、i18n 均 exit 0。完整输入/恢复/导出回归及真实 standalone 打包与包内版本核对，详见本轮执行记录；没有把原基线 CI 复用为新 head 证明。

## 5. 真实打包发现的 pin 缺口

local.6 在 `assembled-app` 阶段生成的真实 `package.json` 仍明确声明 `sharp: 0.35.3`，而工作区 HyperFrames 已解析到 0.35.5。原因是 `tools/pack/src/mac/prebundle.ts` 有独立运行依赖 pin，单改 pnpm override 不会同步它。

新增真实依赖身份回归：从 HyperFrames 的实际 require resolution 读取 Sharp manifest，与候选组装 pin 对照。修复前为 **expected 0.35.5 / received 0.35.3**，1 failed / 13 passed，exit 1；先前测试 metadata 子路径未被 exports 暴露的取路径失败也单独保留，不充当这个 red。

最小修复仅把 macOS pin 同步到 0.35.5，并更新旧固定值断言。九个打包套件 75 tests passed、tools-pack typecheck/build exit 0；新身份回归进入根 CI。没有顺带修改 Windows pin或新增打包进程框架。

local.6 构建已停止，exit 1（SIGTERM），真实清单与 `local6-build.log` 保留；没有产出或安装 local.6 成功包，也没有运行原生验收。修复后的候选递增为 `0.0.3-local.7`，必须重新核对实际包内 Sharp，不能用单元 green 替代。

## 6. local.7 实际包内核对

source/validation SHA `4cf68e9c7feda8cc5222825ba209f179490cabbf`，本包构建 exit 0 并从源码目录外安装/启动。实际 Resources 中 Sharp **0.35.5**、adm-zip **0.6.1**、Next **16.3.6**；外置 NPM 树 PostCSS **8.5.29**，不同于工作区锁定 8.5.23，解析差异已记录。15,295 文件的实际资源清单和包摘要见 [local.7 原生记录](./2026-10-07-local7-native-verification.md)。该源码 [CI run 37579971288](https://github.com/MainQuestAI/Mokina/actions/runs/37579971288) 实际 `success`，含 owner 身份回归，不借用旧 head 结果。

从实际组装的 `package.json` 与真实 `node_modules/.package-lock.json` 在隔离目录运行 `npm audit --omit=dev --json`，exit 1。203 个外置生产依赖中，**0 critical / 0 high / 5 moderate affected packages**；当前 moderate 报告沿 `hyperframes → onnxruntime-node → global-agent → roarr → sprintf-js`。原报告 `r1-evidence/local7-external-runtime-audit.json` 保留。

NPM 的受影响包计数与 pnpm 的告警数口径不同，不能相减。外置树不覆盖编译进 Web/daemon 的全部依赖，也不覆盖构建工具链；工作区 **7 high / 4 moderate / 1 low** 和上节逐项剩余处置继续开放，未宣称发布安全完成。
