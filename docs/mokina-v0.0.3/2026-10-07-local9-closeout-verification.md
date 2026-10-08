# V0.0.3 local.9：剩余问题修复与验收台账

日期：2026-10-07。PDF、接续区内部长路径和发送恢复缺陷已修复；十个核心原生断点及三个负向用例通过。截图复核发现版本面板外层仍有 10px 横向溢出，local.9 不作为最终候选。安全审计从 7 项 high 降为 2 项，仍有开放告警和人工/旧数据门槛，**不标记完整工程收口，不自动合并或公开发布**。

本文替代“local.8 将成为最终候选”的预期，不覆盖其失败记录，也不沿用 local.7 的通过结论。公开合成数据、完整模型回复及文件摘要见 [local.9 证据 JSON](../../output/playwright/mokina-v003-repair-2026-10-07/local9-closeout-evidence.json)。客户资料、旧 profile 内容和原始 CLI 日志不进入公开证据。

## 1. 源码、候选与数据保护

| 身份 | 实际值 |
|---|---|
| 基线 | `93531732e2e01e6bfdf5153f3685af4bf132f850` |
| 本轮起点 | `5959a3e4ad88f4da77524a279f335eff2f972e08` |
| 分支 | `codex/mokina-v003-repair-a-input` |
| 质量/依赖修复 | `cc0b0ba8f65c54ab7fcbc698160a6bbb4f695087` |
| local.9 产品源码 | `7724f8ad603ad125832f390c2b45916d0111a7b3` |
| 原生列表失败验证提交 | `9eed93fa51bde6d44f7a44b6977aad6c1d849120`；仅三个 E2E 文件变化，无运行代码/资源变化 |
| CI 输入就绪验证提交 | `53f945804424d7bcb34bae5295e08aa664dc0d83`；仅一个 E2E 文件变化，无运行代码/资源变化 |
| 安装版本/namespace | `0.0.3-local.9` / `mokina-local-repair-v003-9` |
| QA 根 | `/private/tmp/mokina-v003-closeout.WwddbA`，源码目录外安装 |
| DMG SHA-256 | `c3b18111ae303faec086b6e3e0915e2fcf29ffe6516270bd7a502a326b6db8dd` |
| ZIP SHA-256 | `50c63f083ff878e648d736eafc1da59d74f345bbee7feff776c7f3ad075edf45` |
| 更新 payload SHA-256 | `551b2953dc99ff6876841d568e86c899ce27eef4da64788df0ef7cd2579e67d5` |
| 安装资源清单 | 15,301 文件 / 746,078,531 字节 / 11 symlink；摘要 `950f3fd6a0af0ded17807253f61b7b755bdd69d712ab608a3414f22f25d0511a` |

包位于 QA 根的 `out/mac/namespaces/mokina-local-repair-v003-9/`，运行数据位于 `runtime/mac/namespaces/mokina-local-repair-v003-9/`。包、清单、原始审计、断点命中记录和失败日志继续保留。local.7 位于独立旧 QA 根 `/private/tmp/mokina-v003-qa.zt5jxC`；未覆盖、未清理原 journal。

实际旧完整 Electron profile 已找到：`/Users/dingcheng/Library/Application Support/Mokina/namespaces/mokina-local`，包含 LevelDB 与恢复存储，不再登记为“资料未找到”。原 Mokina 仍运行，尚未制作一致性保护副本；不能把静态 QA 数据升级当成该 profile 验收。只读盘点键/版本，没有公开客户记录正文。用户正常退出原实例后，先做保护副本，再对独立工作副本验收，禁止自动发送旧草稿。

公开 HTTP/CLI、snapshot 和 journal schema 没有变更。后续测试与文档提交和产品 SHA 分开登记；如再次修改运行代码或资源，须递增候选，不拼接 local.9 的结果。

## 2. 修复前失败与修复后结果

### PDF 与长路径

非 deck 捕获只在一次性离屏页面隐藏 scrollbar paint，保留原宽度/gutter 和可滚动性。真实 Electron 捕获回归使用同一 1800px 页面（正文、图片、懒加载、滚动触发、fixed/sticky）：修复前 109,184 个滚动条特征像素，修复后 0；正文宽 786px、高 1800px、三页不变。不是仅验证 CSS 字符串。

local.9 又从真实原生下载入口生成 current/historical/candidate × HTML/ZIP/PDF 九份文件。通过 PDF 逐页渲染检视十二页：没有滚动条、缺字截断、重复或漏页；中文和冻结 LOGO 正确；候选标记只出现在候选。分页线穿过装饰框，但未截断文字。既有缺资源拒绝与历史资源隔离不变。

长路径根因是 fieldset 的默认 min-content 和 flex/控件收缩约束不足；最小布局改动保持现有分区和完整 title/可访问名称，不另增滚动层。浏览器修复前 358px 区域被撑到 976px，修复后原六项回归通过。**同一 local.9 实际原生 resize** 到 1280×720、1440×900，接续区域 clientWidth/scrollWidth 均为 328/328，两 fieldset 均 304/304；三个中文/空格/多层路径素材（含重名）与 strategy 选择保持，按钮聚焦、可见且可用。这些局部断言漏掉了版本面板外层，不能证明整体无横溢。

截图复核后发现外层 body clientWidth 345 / scrollWidth 355。实际版本列表仍沿用直接置于面板时的 `margin-right:-10px` 滚动条补偿，被新外层滚动 body 包裹后反而撑出 10px。正在给该 wrapper 内的列表取消旧补偿，并在两尺寸浏览器用例增加外层 body 断言；修复运行样式后候选须递增 local.10，local.9 结果只能作为历史分层证据。

随后实际键盘 Return →“选择已改变，新建副本”确认 → 目标草稿保存。目标 `e6e6e335-0ad5-44c8-8ae7-e2d611aaf6fd` 的快照包含 strategy 和三个素材，真实路径分别 `asset-1.svg`、`asset-2.svg`、`asset-3.svg`，run 数为零。返回源项目后 v5 当前/v3 候选保持，见 [长路径原生入口](../../output/playwright/mokina-v003-repair-2026-10-07/native-longpath-local9.png)。未将 CUA 索引错用造成的额外合成副本记为通过证据；它未运行模型、未覆盖原稿。人工中文 IME 验收仍单列。

### local.8 原生发现的发送恢复缺陷

local.8 十点均命中，1–8 通过，9/10 失败：服务端只有一个 run，重开却保留已提交的 pending。根因是 ProjectView 保存发送回执时漏存既有 `mokinaSnapshotGeneration`；重挂查询虽找到 run，条件消费无法证明绑定身份。

新增组件重挂测试在缺字段处失败；补齐字段后组件/绑定/发送状态 63 项通过。旧无 generation 回执仍不得认领新的绑定。由于运行代码变化，重建 local.9，而非让 local.8 借用修复后结果。旧包、profile 和失败日志完整保留，详见 [local.8 执行记录](./2026-10-07-closeout-local8.md)。

## 3. 原生中断矩阵：13 个自动化用例

使用既有 tools-pack 的安装/启动/inspect/停止机制，在 E2E 侧暂停、丢弃成功回执或制造隔离目录存储错误；真实 daemon、项目文件与桌面恢复存储未替换。回执丢失用例先读取实际成功响应并核对副作用，不靠延迟猜测。故障运行用合成假 CLI 确定运行结果，不将它冒称真实模型业务验收。

| 原生断点 | 同一 local.9 的实际结论 |
|---|---|
| 1 prepared 保存后、创建前 | 原 operation/target 保持，恢复只有一个项目 |
| 2 创建成功、回执丢失 | 已完成响应先证实；恢复查询复用目标，无重复创建 |
| 3 路径分配后、复制前 | inputId/目标真实路径保持；只补未完成步骤 |
| 4 复制成功、回执丢失 | 删除合成源后仍凭目标摘要恢复，不再上传 |
| 5 快照固定、检查点未更新 | 删除源后仍复用原 snapshotId/正文/指纹，不重新冻结 |
| 6 文件写入、读回失败 | 重读原草稿并继续，不重复创建 |
| 7 绑定持久化、缓存发布前失败 | 实际持久记录恢复同会话/generation，不自动发送 |
| 8 完成记录保存、journal 清理失败 | 只补清理，不创建项目、不抢导航 |
| 9 run 受理、响应未知 | 原 requestId 查询，同 scope 一个 run，重开不再 POST |
| 10 run 受理、pending 消费失败 | 显示已提交待同步；重开只补清理，不再 POST |
| 负向：断点 3 源已丢失 | 明确缺口，原 journal/目标保留，不假成功、不运行 |
| 负向：断点 6 目标被用户编辑 | 明确冲突，保留用户编辑，不覆盖两侧数据 |
| 负向：实际目标文件列表读取失败 | 快照已保存后，临时移除隔离项目目录读取权限，真实 HTTP 失败；不当空列表。权限恢复并重开后复用原 snapshot/目标 |

`native-local9-matrix.log`：12 passed、16 个非选定用例 filtered/skipped，179.88s；`native-local9-target-list-fixed.log`：1 passed、28 filtered/skipped，33s。这些过滤不是 blanket skip。首次目录故障控制器在目录尚未创建时失败，改为真实 snapshot-saved 后注入；保留该 fixture 设置失败日志，不把它算产品红证据。

核心报告：QA 根 `native9-report/mokina/*-hit/recovered/blocked.json`，列表失败报告 `native9-list-report/mokina/`。测试开关沿用 `OD_PACKAGED_E2E_MOKINA_RECOVERY=1`、`OD_PACKAGED_E2E_TOOLS_PACK_DIR=<隔离绝对目录>` 与既有 mac namespace 参数；产品没有故障接口或 IPC 放宽。mac 用例进入现有 opt-in 验证入口，不宣称 Linux CI 执行了它们。

### 同包补充原生负向链路

全部资料不可用：原生选择真实 CSV、真实上传回执 200 后，只移除隔离项目中的上传副本（原 CSV 保留），再放行真实冻结请求，返回结构化 409 `MOKINA_CONTEXT_NOT_SUPPORTED / 文件不存在：native9-sales.csv`。UI 保留原要求、重试/调整入口；手动再次点击发送仍为零 `/api/runs` POST、零 run。截图见 [准备失败](../../output/playwright/mokina-v003-repair-2026-10-07/native-all-input-missing-local9.png)。该交互补测不冒称第十四个自动化用例。

明确排除：在缺源恢复任务中排除素材，UI 明确确认新意图副本，原 operation `b5cd030f-32f1-47ac-a071-000ee50d6c31`、原目标和旧 journal 保留；新 operation `f42a48d0-3c99-4071-9fdb-b9a3d4d2e2ba` 固定 strategy、素材 0，草稿完成且 run 0。不是偷偷修改原恢复记录。

403、字符串错误及非 JSON 错误已有组件/接口解析覆盖，但尚未稳定命中本候选的原生真实响应；结构化错误本次实测通过。不能将前者登记为原生 T34 全通过。同 profile 两个原生业务窗口仍是宿主能力缺口，保留 CAS/双会话测试，不扩大 IPC 权限。

## 4. 安全依赖：逐公告与打包边界

实际 `pnpm audit --prod --json` 前后均 exit 1；critical/high/moderate/low 从 `0/7/4/1` 变为 `0/2/3/1`。原始报告在 QA 根，不能把仍存在的告警写为已修复。

| 公告/依赖链 | 处置与验证 | 当前状态 |
|---|---|---|
| nanoid：GHSA-28wg-ghj8-5hjv、GHSA-2v37-7h3g-55p8、GHSA-xwg4-73v4-xw9w，另 GHSA-mwcw-c2x4-8c55 | converter 最新上游仍 pin 4；只覆盖 `@excalidraw/mermaid-to-excalidraw>nanoid:5.1.16`。owner 转换测试，以及 local.9 实际 Mermaid→Excalidraw 重复插入、保存、退出重开 | 3 high/1 moderate 不再出现。实际 28 个 ID 全唯一、40 引用全有目标，重开文件摘要不变 |
| image-size：GHSA-5p2g-fcmc-qvqq、GHSA-w3rx-r6r6-pgpr | 只覆盖 `pptxgenjs>image-size:2.0.3`；真实正常 PNG/PPTX、畸形 ICNS/HEIF/JXL 隔离子进程有限时测试 | 2 high 不再出现。旧 ICNS/JXL 超时为失败证据；旧 HEIF 样例本已拒绝，不虚构 red |
| braces：GHSA-vfj7-8cjw-p6xm | 产品 watcher 只接真实目录，disableGlobbing + 不跟随 symlink；真实花括号目录事件、增改删改名、深目录、轮询与 symlink 边界通过 | **high 仍开放、无公告补丁**；仅产品真实目录路径缓解，其他构建 glob 不豁免 |
| http-cache-semantics：GHSA-ch52-4w7c-c8xp | 实际 @electron/get 默认 HTTP 响应 cache 未启用；同 URL 授权 A/B/B 三次真实服务端请求，正文不串用，磁盘制品缓存与独立 checksum 保留 | **high 仍开放、无公告补丁**；默认路径验证不等于依赖修复，自定义 HTTP cache 必须重新评估 |
| OpenTelemetry GHSA-8988-4f7v-96qf、sprintf-js GHSA-hp3w-g68c-fv3c、KaTeX GHSA-238p-pmpm-9mq7 | 本轮未扩大耦合版本/跨主版本改造 | moderate/low 继续开放 |

没有全局 nanoid/image-size 替换、没有 audit fix --force、没有自动接受风险。移除 override 的条件是 owner 正常解析至安全版本，删除覆盖后重新验证实际功能与审计。

安装包清单核对：外置 adm-zip 0.6.1、nanoid 3.3.20（另一 owner）、postcss 8.5.29、sharp 0.35.5、Next 16.3.6；daemon 元数据含 braces 3.0.3/nanoid 3.3.20/non-secure/PptxGenJS 4.0.1。PptxGenJS 已使用的 dist CJS/ES 没有 image-size 调用，该解析器未编入包；工作区声明链解析 2.0.3，**不虚报包内物理存在 image-size 2.0.3**。client converter 的 standalone nanoid 5 包不外置，实际 UI 行为已验证，物理目录缺包不等于它仍用旧外置 nanoid 3。

实际 Mermaid 场景保存文件摘要 `95233b9c47c60c0a0a48f3ddce2a7a5e1c3e1abc33bc323fe350d6c01abbfd1f`，重开一致；重复插入默认位置重叠，不把 ID/引用完整性测试当作布局质量验收。截图见 [Mermaid 重开](../../output/playwright/mokina-v003-repair-2026-10-07/native-mermaid-local9.png)。

## 5. 同一候选交付文件与真实业务

九文件来自 local.9 原生 Save As，字节数和 SHA-256 全列于证据 JSON，位于 QA 根 `local9-exports/`。current v5、historical v2、candidate v3 的版本指针和候选状态分别核对；候选下载取消未产生文件、成功提示或版本采用。历史/candidate ZIP 是 self-contained 交付；current ZIP 是既有目录导出，入口按 manifest 指定多层中文/空格 HTML 和相对资源。

current ZIP 主 HTML 比冻结 v5 正文仅多一个末尾换行，已逐字符串验证并分别保存两个摘要，未伪报字节指纹相同。冻结 LOGO 摘要 `49a9c2b51589ba476a6b7ec0fda1dd6d19158beabb2e33db214ca01b19235896` 匹配。目录包的其他历史页没有全部应用外打开；HTML/ZIP 外部打开仍待人工验证，不能以成员存在代替该结论。

正式恢复入口选择合成旧 ZIP：原包 SHA `ba56fdf1790f899f4dd47d1ce6a8f28a9e278f6f7da54066a7e34304cb920928`；实际读取 manifest、44 成员 byte/hash，导入后 21 原文件和 11 版本正文摘要匹配，current/candidate 保持。不是导入标记文件证明。

真实业务任务时恢复隔离 app 的 `agentCliEnv={}`，使用实际 Codex CLI，而不是矩阵假 agent。只使用合成、无客户授权争议的选入资料。

| 任务 | 实际结果与独立复算 |
|---|---|
| 原生 CSV | 196 字节真实 picker 上传；10 个精确片段、204 UTF-16 正文固定。月合计 69,000 / 82,000 / 88,000，总额 239,000；增长 18.84% / 7.32%，Tmall 占比 60.87% / 46.59%，独立 Node 复算一致 |
| 同资料预算 A | 300,000；90,000 + 66,000 + 48,000 + 36,000 + 24,000 + 36,000，比例合计 100%；四项禁投支出均 0 |
| 同资料预算 B | 180,000，禁止实体门店活动；0 + 63,000 + 54,000 + 27,000 + 18,000 + 18,000，比例合计 100%；禁投四项与门店支出均 0，完整执行描述未安排门店活动 |

两预算输入源摘要相同 `18d9462995e6860705c30343458f00572edc23245e17b3dda0de8f70320a45dd`，每任务一个 succeeded run，实际 artifactCount 0，未要求文件就没有强制成果。原始要求、完整回复、逐行复算保存在公开合成证据；数字通过不等于专业策略签收。真实业务品牌 A/B 的授权规则、标志、素材及允许的模型目的地仍待提供。

## 6. 检查与 CI

Node 24.15.0 / pnpm 10.33.2。每切片运行 guard/typecheck/受影响测试；本轮没有新增界面文案，既有 i18n 检查通过。命令从 `open-design` 执行：

```sh
pnpm guard
pnpm typecheck
pnpm i18n:check
pnpm --filter @open-design/web exec vitest run tests/components/ProjectView.pendingPrompt.test.tsx tests/runtime/mokina-pending-context-snapshot.test.ts tests/runtime/send-request-state.test.ts
pnpm --filter @open-design/desktop exec vitest run tests/main/page-pdf-capture.test.ts
pnpm --filter @open-design/e2e exec playwright test -c playwright.config.ts ui/real-daemon-run.test.ts --grep 'Mokina' --workers=1
pnpm --filter @open-design/e2e exec vitest run specs/mac.spec.ts -t 'Mokina recovery native interruption'
```

最后命令必须显式设置隔离 mac 开关/目录/namespace，不能对用户 profile 运行。native sidecar 权限/端口与 Electron 运行需要主机授权；首次 sandbox IPC EPERM 单列，不冒称产品回归。

质量切片 Web 107、daemon 27、watcher 14 + polling/symlink 3、pack 28、浏览器 6、真实 Electron PDF 1；generation 修复组件/绑定/发送 63 通过。新增 owner、捕获及既有首页/品牌/依据/恢复/导航集合进入根 CI。

[质量源码 CI 37591494788](https://github.com/MainQuestAI/Mokina/actions/runs/37591494788) 与 [local.9 产品源码 CI 37594636935](https://github.com/MainQuestAI/Mokina/actions/runs/37594636935) 全部成功。后续仅 native 验证提交 `9eed93fa` 的 [CI 37600100543](https://github.com/MainQuestAI/Mokina/actions/runs/37600100543) **失败**：daemon 恢复组 13 passed / 1 failed，拒绝后恢复草稿少末尾字符，retry 项目界面未就绪；后续导航组未执行。相同产品源码与该提交之间没有运行代码差异，不据此断言“环境导致”。本地原样定向用例通过；补齐输入/清空就绪断言及实际 request.currentPrompt 完整断言后，无重试连续三次通过（1.5m）。guard/E2E typecheck 通过；[53f94580 的复验 CI 37602793383](https://github.com/MainQuestAI/Mokina/actions/runs/37602793383) 已派发，最终状态另行更新。没有删断言、加 sleep 或修改产品掩盖该失败；原失败日志 `ci-37600100543-failed.log` 保留。

## 7. T 与原 31 条 AC 回填

T14–T17：十核心断点/缺源/编辑冲突的本候选原生范围通过；T31：实际准备失败零 run 补测通过，但不重报此前全部准备行为；T26–T27：九实际文件/资源/取消/PDF 通过，外部 HTML/ZIP 待验；T34：结构化错误和真实列表失败原生通过，其他格式原生未验；T33：真实授权品牌待验；T28：原白屏未复现，按用户要求跳过并未关闭。T10–T13/T32 的 CAS、会话和 workspace 权限已有工程覆盖，不冒称双原生业务窗口或所有授权原生场景。其他 T 保留原记录，不把未跑项记通过。

| 原 AC | local.9 本轮结果与剩余门槛 |
|---|---|
| N00-AC01 | 分支/base/head/自有改动核对；其他未跟踪用户文件未加入提交 |
| N00-AC02 | 从已登记起点修复；local.8 实际失败后递增 local.9，不拼包 |
| N00-AC03 | local.7/local.8/local.9 包、数据和失败证据分别保留，旧签收事实不覆盖 |
| N01-AC01 | 桌面/外部 CLI/源码与历史原型边界保留；未新增引擎或工作台 |
| N01-AC02 | 本包安装/真实 CSV/预算/接续/重开/导出/正式恢复完成；人工中文和其余必需门槛未齐 |
| N01-AC03 | 版本/源码/清单/包摘要已登记，未公开发布 |
| N02-AC01 | 原生 picker 精确 CSV 固定/发送/依据读回，资料失效后零 run |
| N02-AC02 | CSV 与两预算仅讨论，实际 artifactCount 0；不强制生成 |
| N02-AC03 | 本包中断、原身份恢复与响应丢失完成；旧完整 profile 待验 |
| N03-AC01 | 双会话/CAS 工程覆盖保留；同 profile 双业务窗口不通过 |
| N03-AC02 | 本包原 requestId 恢复/未知响应/提交待同步实际通过 |
| N03-AC03 | CSV 固定十行/位置/摘要可读，“传输不等于采纳”保持 |
| N03-AC04 | generation 修复组件 63 和原生 9/10 通过，旧无身份回执不认领新绑定 |
| N04-AC01 | 工程 A/B 竞态与固定快照覆盖保留；本包真实业务品牌待验 |
| N04-AC02 | 既有冲突规则未变；合成 LOGO 不冒称专业品牌一致签收 |
| N04-AC03 | 原生复制后删除源仍恢复，三个真实目标路径和摘要固定 |
| N05-AC01 | 实际改变选择/明确排除，确认新副本；原稿和旧恢复记录保留 |
| N05-AC02 | 原生目标优先、快照固定后源丢失仍恢复；真实业务接续成果专业待评 |
| N05-AC03 | journal/草稿/快照源版本与选定 strategy 一致；确认不冒称批准 |
| N05-AC04 | 十个核心原生中断及缺源/冲突/目录错误完成；不自动运行 |
| N06-AC01 | 两实际原生尺寸/完整名称/按钮焦点/键盘创建已跑；外层 10px 溢出未关闭，人工中文待验 |
| N06-AC02 | 同包九文件与十二 PDF 页、取消/资源隔离通过；外部 HTML/ZIP 打开待验 |
| N06-AC03 | 恢复导航未抢占；原加载故障未复现，暂跳且未关闭 |
| N07-AC01 | 实际两预算完整回复和独立复算通过，策略取舍专业待评 |
| N07-AC02 | CSV/禁投独立复算通过；业务品牌和专业结论未签 |
| N07-AC03 | 产品源码 CI 成功；后续验证 CI 失败需复验；2 high 与 moderate/low 仍开放 |
| N07-AC04 | 工程、安全、专业与用户签收分列，未代签 |
| N08-AC01 | 同包多条真实链路通过；未齐项仍列出，不标完整工程收口 |
| N08-AC02 | 完整旧 profile 已找到但仍运行；一致性保护副本与 pending/journal 升级未验 |
| N08-AC03 | 正式 ZIP 44 成员/21 文件/11 版本复验一致，旧包数据未删 |
| N08-AC04 | 产品/验证 SHA、源码 CI、候选和资源摘要对应；后续仅测试/文档不改本包运行内容 |

## 8. 剩余事项与恢复说明

| 项目 | 当前状态 | 下一步/通过门槛 |
|---|---|---|
| 2 high、moderate/low | 开放；局部路径缓解不等于依赖修复 | 按公告跟踪 owner/补丁，未解决不宣布公开发布 |
| 验证提交 CI | 一个草稿恢复用例失败 | 保留失败，验证输入准备/实际请求/恢复全文，再跑 CI；不能 blanket skip |
| 版本面板外层横溢 | local.9 345/355，原局部断言遗漏 | 修复列表负 margin 与 wrapper 关系；local.10 同包复验，不借用 local.9 结果 |
| 完整真实旧 profile | 找到但原应用仍写入 | 用户正常退出后保护副本；对工作副本验旧项目/版本/候选/快照/pending/journal，不自动发送 |
| 真实品牌 A/B | 缺授权材料/允许模型目的地 | 提供规则/标志/素材后同包切换和接续，证明旧 A 快照不漂移 |
| 原生错误格式 | 结构化已验，其余三类未验 | 通过真实授权/实际故障响应稳定命中 403/字符串/非 JSON，不伪造响应冒称原生 |
| 外部 HTML/ZIP、真实中文 | 人工待验 | 解压后按 manifest 打开入口，检查资源；中文 IME 输入、发送和重开不丢字 |
| 专业评审 | 待评 | 原始输入+完整成果+独立复算；记录评审人及预算/禁投/品牌/策略结论 |
| 用户签收 | 待签 | 用户独立确认，不以测试或模型自评代签 |
| 双原生窗口 | 当前宿主缺口 | 不放宽 IPC；另行确定可信窗口能力，工程 CAS 不替代 |
| 原白屏 | 未复现/未关闭 | 按已确认范围先跳过，后续有步骤与时间线再定位 |

恢复使用：原意图重试保留 operation/target/snapshot；提交响应未知查询原 requestId；已提交待同步只重试清理；修改章节/品牌/素材/要求明确创建新副本，旧操作继续可恢复；目标用户编辑或源缺口停止覆盖。不要手动删除 journal 来“恢复”。回退使用旧包与验证前保护副本，不承诺旧程序可读取新恢复记录。

人工验收清单：旧 profile 正常退出并备份；授权品牌 A/B 与允许模型目的地确认；两个尺寸下中文输入/调整用途/品牌/背景/副本/返回恢复；九交付文件应用外打开；专业评语和用户签收。没有记录的项保持待验。
