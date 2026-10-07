# Mokina V0.0.3：剩余修复执行记录

日期：2026-10-07。依据：[剩余修复与验收方案](./2026-10-07-remaining-repair-and-acceptance-plan.md)。本记录区分代码、工程回归、原生候选、安全处置和人工签收，不覆盖 local.5 的历史结果。

## 1. 身份与保护范围

本轮起点为 `413c15b265a08df6956896f1b76a32234b64d3b6`，分支为 `codex/mokina-v003-repair-a-input`，远端为 `MainQuestAI/Mokina`。现有分支无打开的 PR；本轮不创建 PR、合并或公开发布。

本次 QA 数据和完整日志保留在 `/private/tmp/mokina-v003-qa.zt5jxC`。旧应用、旧 profile、静态备份及 local.5 均保留；不对用户原配置就地升级。公开测试只使用合成数据。

## 2. R0：原基线远端 CI 已通过

命令：`gh workflow run ci.yml --repo MainQuestAI/Mokina --ref codex/mokina-v003-repair-a-input`。

- 实际 head：`413c15b265a08df6956896f1b76a32234b64d3b6`。
- [GitHub Actions run 37574516126](https://github.com/MainQuestAI/Mokina/actions/runs/37574516126)：`success`。
- 开始/结束：2026-10-07 05:04:26 / 05:19:18 UTC。
- 安装、guard、typecheck、i18n、输入/恢复工程集合、真实 daemon 与浏览器链路均完成。
- 完整日志：QA 根目录下 `r0-evidence/baseline-ci-log.json`；捕获命令 exit 0。

这个结果只关闭原基线的远端 CI 缺证，不用于证明本轮依赖和导出变化。修改后的 head 需要另一次 CI。

## 3. R1：兼容安全升级，尚未安全收口

基线生产依赖 audit：exit 1，critical 4 / high 70 / moderate 57 / low 13。报告从上述完整 SHA 的锁文件重新取得，不依赖可变工作区。

已实施：Next、DOMPurify、MCP SDK、multer、PostCSS、undici 的兼容升级；拥有打包链的 electron-builder 在 26.x 内升级。传递依赖沿既有 pnpm overrides 处理明确旧版本和 owner 固定范围，不执行 `audit fix --force`。

Overrides 的移除条件：对应 owner 的锁定依赖自行解析到安全版本后，删除对应 override 并复验。本轮不把 nanoid 4 或 image-size 1 强制改成不兼容主版本。没有补丁的告警保持开放。

最终实际 audit 为 critical 0 / high 7 / moderate 4 / low 1，exit 1。安装及完整 postinstall 已成功，guard、typecheck、i18n 均 exit 0；剩余项未关闭。[升级版本、完整报告摘要与逐项剩余风险](./2026-10-07-security-repair-results.md) 单独记录。安装包中的实际版本与风险条件尚需核对。

## 4. R2：旧接续工程覆盖与原生边界

补充实际恢复模块的回归：匹配的 v2 journal 只查询目标接续稿及目标快照，不读取旧源、不创建项目、不复制素材、不自动绑定或发送；operation/target/snapshot 不匹配以及 403 时，原记录和两侧草稿保留。

这是受控网络的工程验证，不是完整旧 Electron profile 的升级证明。现有静态备份不包含该恢复存储；已向用户请求完整保护副本，未得到时真实历史配置保持待验。

宿主代码核查发现：当前只有一个可信业务主窗口；第二实例聚焦已有窗口。预览、宠物和 splash 不属于业务窗口，恢复 IPC 仍只接受可信主窗口。因此同 profile 双业务窗口原生验收为能力缺口；不放宽 sender 校验、不增造业务窗口。持久化 CAS 工程覆盖与该缺口分别记录。

## 5. R4：已确认的导出缺陷与修复

**根因**：历史 ZIP 的服务端错误被 Web 捕获后，降级为仅包含原始正文的 ZIP；历史 PDF 的错误也可降级为浏览器打印。旧稿缺资源或权限失败时可能得到不完整文件并显示成功。legacy desktop PDF 还缺少历史资源预检，存在读取当前资源的通道。

**修复**：

- contracts 增加 `HISTORICAL_RESOURCES_UNAVAILABLE`，沿现有结构化错误返回所选 file/version、缺失项及显式恢复动作。
- HTML、ZIP、PDF/截图共用历史资源预检，只允许该版本自身保存的内容，不借用今天的资源。自包含旧稿仍可导出。
- Web 对明确版本的 ZIP/PDF 不再静默降级；字符串、结构化和非 JSON 错误均安全解析。无版本普通导出的既有降级不扩大修改。
- 复用已有版本面板的“恢复为新版本”入口；只有明确操作才产生新版本，不回填旧稿、不改原 ID/正文/指纹。

**修复前证据**：Web 导出集合 6 failed / 94 passed；daemon 导出集合 4 failed / 48 passed，均 exit 1。失败包括缺历史资源仍调用 PDF renderer、ZIP 返回普通 400、错误码无恢复语义，以及客户端产生伪成功。

**修复后行为证据**：Web 导出及错误分析 115 tests passed；daemon 导出、PDF、截图交接与版本 95 tests passed。HTTP 显式恢复用例证明新版本可使用当前可用资源导出，旧版本保留且仍拒绝混版。上述行为测试已接入根 CI，未删旧测试或扩大触发器。

类型检查先发现测试未处理 `Response.json()` 的 unknown，随后又发现正式恢复 DTO 的 `version: null` 分支；原失败日志保留。补齐用户结果断言和空值收窄后，全量 typecheck exit 0；最终依赖安装后再次通过。Web 导出及新增旧接续合计 138 tests passed，daemon 四个相关导出集合 95 tests passed。

代码提交：`d95b14fc`（R4 导出与 CI）、`8b318cbd`（R2 旧接续回归）。最终依赖下已逐条执行根 CI 的工程集合：Web 253 + 导出 115，desktop 19，daemon 42 + 136，PDF runtime 1，合计 566 tests passed，六条命令均 exit 0；完整逐命令结果为 `r1-evidence/ci-regression-final.json`。另有打包 owner 的八个现有套件 61 tests passed，已加入同一 CI 工程步骤，合计本地 627 tests passed。尚需最终依赖提交、新 head CI 与新候选原生结果。

### 真实打包补充

兼容依赖已提交为 `b457026df375a215c721f61d9cf51426ceb0eeb0`，文档 head `46c6482f74f1aa53991b1ebf0b7083bec58c121e` 已推送，二者差异仅三份文档。新 head 的 [CI run 37578541368](https://github.com/MainQuestAI/Mokina/actions/runs/37578541368) 已触发；未完成的步骤不记通过。

local.6 实际组装发现 macOS Sharp pin 仍为 0.35.3，停止构建并保留失败，不覆盖或安装该候选。新增真实依赖身份 red→green 后，仅同步该 macOS pin，未改 Windows 或用户配置。打包集合现为 75 tests passed（含身份测试），替代原 61 项计入合计后，本地对应集合 **641 tests passed**；全套 566 项业务回归没有因为仅改打包 pin 被反复重跑。tools-pack typecheck/build 通过，既有 CLI 已重建。详见安全记录第 5 节。

后续递增到 `0.0.3-local.7`，使用新 product source/validation SHA 和新的 CI，不复用 local.6 的失败记录。

## 6. 原生及人工验收仍未被工程结果代替

| 项目 | 本轮状态 |
|---|---|
| 新 local.7 构建与包内依赖 | local.6 组装发现 pin 缺口已停止；修复后递增，不使用 local.5 代替 |
| 十个原生中断/响应丢失断点 | 未跑；已有工程覆盖不自动转为原生通过 |
| 真实旧 Electron pending/journal | 待完整保护副本；合成覆盖只能证明代表性兼容 |
| 同 profile 双原生业务窗口 | 宿主能力缺口；不扩大 IPC 信任范围 |
| 历史导出失败及显式恢复原生入口 | 待新候选复验 |
| 新候选九份实际导出/正式恢复 ZIP | 待同包重跑受影响交付链 |
| HTML/解压 ZIP 的应用外浏览器打开 | 用户手动待验；工具明确限制，不绕过 |
| 真实业务品牌 A/B | 待授权输入；公开合成/参考品牌不能关闭 T33 |
| 原生中文输入及两尺寸入口 | 待新候选及人工输入核验 |
| 专业结果与用户签收 | 待评/待签；不替用户批准 |
| 卡加载/白屏 D1 | 按用户明确决定：未复现，暂时跳过 |

后续若本轮源码、资源或依赖再次变化，保留新的 source/validation SHA、包摘要、CI 与受影响复验；不拼接不同包的结果宣称同候选完成。
