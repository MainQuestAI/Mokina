# V0.0.3 local.10：本轮修复与剩余验收

本轮已修复 PDF 捕获、长路径布局和原生复验发现的发送回执身份遗漏；未重做 Repair-A/B/C。最终候选递增为 **0.0.3-local.10**，同包十个核心原生中断点及三个负向用例通过，九份交付文件和十二页 PDF 已实际检查。安全审计仍有 **2 high / 3 moderate / 1 low**；真实旧数据升级、授权业务品牌、部分原生错误格式和人工签收未齐，**不标记完整工程收口，不自动合并或发布**。

本文件是 local.10 的独立台账，不覆盖 [local.8 失败记录](./2026-10-07-closeout-local8.md) 和 [local.9 台账](./2026-10-07-local9-closeout-verification.md)。[local.10 证据 JSON](../../output/playwright/mokina-v003-repair-2026-10-07/local10-closeout-evidence.json) 保存同包运行身份、完整合成模型回复、独立复算、断点报告摘要、九文件与恢复成员摘要。安全缓解、工程通过、专业评审、用户签收分别记录。客户内容和 CLI 原始日志保留在隔离本地，不入库。

## 1. 固定身份与保护范围

| 项目 | 实际身份 |
|---|---|
| 复审基线 / 本轮起点 | `93531732e2e01e6bfdf5153f3685af4bf132f850` / `5959a3e4ad88f4da77524a279f335eff2f972e08` |
| 分支 | `codex/mokina-v003-repair-a-input` |
| 产品源码 | `7ced0cf93b14387b9dd3740a218aac5b4e8bdbce` |
| 构建期间验证/文档 HEAD | `1527f6aad9f8f468a37cf1eab3ce976789185bd1`；与产品 SHA 之间仅历史证据/文档，无运行代码或资源差异 |
| 安装版本 / namespace | `0.0.3-local.10` / `mokina-local-repair-v003-10` |
| 完整源码 CI | [37603369750](https://github.com/MainQuestAI/Mokina/actions/runs/37603369750)，completed / success，head 为上述产品 SHA |
| DMG SHA-256 | `c84d1a12071e5fa2ae818457eebf40f6d85ff7ddf828ea7c60d4a43273e8858b` |
| ZIP SHA-256 | `c86ddf3c7cc5cf2ca9c046fe1a9e70a9496972dcd05ed3faf21aa850c3190de0` |
| 更新 payload SHA-256 | `7acf6e7194401514d1d1c071821001d61acffe2fe76e64fd7aa1dca2a740b7e2` |
| 安装资源清单 | 15,295 文件 / 746,041,304 字节 / 11 symlink；清单摘要 `ab5894c09cb6daf81b34f05b09da75b307067496c08c2563391ccefb3937fbfc` |

QA 根为 `/private/tmp/mokina-v003-closeout.WwddbA`。包与源码目录分离，位于 `out/mac/namespaces/mokina-local-repair-v003-10/`，数据位于 `runtime/mac/namespaces/mokina-local-repair-v003-10/`。local.7 根 `/private/tmp/mokina-v003-qa.zt5jxC` 及 local.8/9 的包、数据、失败日志全部保留。公开 HTTP/CLI、snapshot、journal schema 未变，未加产品故障接口或放宽 IPC。

## 2. 实际失败、最小修复与复验

PDF：同一 1800px 非 deck 长页面的真实 Electron 捕获，修复前 109,184 个滚动条特征像素，修复后 0。仅一次性离屏页隐藏 scrollbar paint；宽度 786px、高度 1800px、三页保持，可滚动，包含图片、懒加载、滚动触发、fixed/sticky。历史资源隔离和缺资源报错不变。local.10 原生导出再逐页渲染十二页：无滚动条、缺字截断、重复或漏页，中文和冻结 LOGO 正确；分页线跨装饰边框但未切断文字。

长路径：先修 fieldset min-content、flex/控件收缩约束。local.9 局部区域通过，但截图发现外层 body 345/355 的横溢，不能当成功。根因是新滚动 wrapper 内的版本列表仍带原直接布局的 `margin-right:-10px` 补偿。只取消此 wrapper 内的旧补偿，不改全局列表。新增两尺寸外层断言先 red，修复后浏览器六项通过；local.10 实际 resize 至 1280×720、1440×900，外层 345/345、接续区 328/328、fieldset 304/304。中文、空格、多层路径、重名和三个素材选择保持，完整名称可访问，按钮聚焦可见可用，无新增内部滚动层。

原生键盘创建得到目标 `7a43cd6f-d726-42d4-9f3f-06cc64e54dcb`，operation `8671a41a-485d-4be4-8e49-b4667af4c465`，snapshot `5aeac727-a89b-45bb-a4bc-e2482dc02862`，指纹 `54e84c14fb2e241675c915abb4e5ccbefa5976c49dcc2f022daadb76a5a21fc0`。仅 strategy 和三个素材，目标路径 asset-1/2/3.svg；退出重开后三项实际字节摘要匹配，原会话和绑定 generation `31f91c49-25ea-4d7e-a63c-40fafc59e344` 保持，run 0，不自动发送。见 [原生长路径截图](../../output/playwright/mokina-v003-repair-2026-10-07/native-longpath-local10.png)。

local.8 的原生 9/10 失败另发现：已受理运行的回执缺 `mokinaSnapshotGeneration`，重开不能证明待消费身份。补齐既有字段，63 项组件/绑定/发送测试和 local.10 原生 9/10 通过；旧无身份回执仍不能认领新绑定。运行改动后分别递增 local.9/local.10，没有拼接包的通过记录。

## 3. 同包原生中断矩阵

既有 tools-pack 安装、启动、inspect、停止；E2E 控制实际成功回执的暂停/丢弃或隔离目录存储失败。先证实真实服务端副作用再丢回执，不靠 sleep、不伪造 journal。仅故障矩阵用合成 CLI 确定性运行，真实业务另用正常 Codex CLI。

| 断点 | local.10 结果 |
|---|---|
| 1 prepared → 创建前 | 原 operation/target，恢复只一个目标 |
| 2 项目完成 → 回执丢失 | 查询复用目标，不重复创建 |
| 3 素材路径分配 → 复制前 | inputId/目标真实路径不变，只补缺步 |
| 4 复制完成 → 回执丢失 | 删除合成源后仍按目标摘要恢复，不重传 |
| 5 快照固定 → 检查点未更 | 删除源后复用原正文/指纹/snapshotId |
| 6 草稿写入 → 读回失败 | 重读原文件，不重复创建 |
| 7 绑定持久化 → 缓存未发布 | 同会话/generation 恢复，不自动发送 |
| 8 完成保存 → journal 清理失败 | 只补清理，不重建、不抢导航 |
| 9 run 受理 → 响应未知 | 原 requestId 查询，一个逻辑运行，重开无第二次 POST |
| 10 run 受理 → pending 消费失败 | 已提交待同步；只重试清理，不重发 |
| 负向：3 源丢失 | 具体缺口；journal/目标保留，不假成功 |
| 负向：6 用户已编辑目标 | 冲突停止覆盖，保留用户正文 |
| 负向：目标列表读取失败 | snapshot-saved 后实际隔离目录权限错误；不当空列表，恢复权限/重开复用目标与快照 |

`native-local10-matrix.log`：13 passed / 16 非选定用例 filtered/skipped / 29，306.11s。报告 `native10-report/mokina/*-hit/recovered/blocked.json`；真实 FS 故障另存 storage/directory-failure 文件。mac opt-in 用例进入既有入口，不宣称 Linux CI 跑了原生矩阵。

同包补充实际交互（不冒称额外自动化用例）：

- 全部资料不可用：真实 CSV 上传后暂停实际冻结，只将该 QA 项目的上传副本移出项目并保留；原 CSV 与业务 CSV 不动。放行真实请求 → 409 `MOKINA_CONTEXT_NOT_SUPPORTED / 文件不存在：native9-sales.csv`。草稿完整保留，再点发送仍零 POST/零 run。见 [原生准备失败](../../output/playwright/mokina-v003-repair-2026-10-07/native-all-input-missing-local10.png)。
- 明确排除：实际缺源任务选 strategy、不带缺失素材；原生确认“新建副本并保留原稿/恢复记录”。新 operation `7085b627-a6b9-436c-a038-ead9e8b32736`、目标 `a9214bcc-6b44-4177-b225-22d4e41b39bd`、snapshot `f6cc6a57-8282-4dc3-bcd6-6be34d6df536`；素材 0、run 0。原 operation `0dc1b9eb-969f-4aa6-a7d4-7e238a814f43`、目标、snapshot、intentDigest 与断点原记录一致，旧 journal 和目标 API 均存在。复制前的空项目不一定已有磁盘目录，不能用目录存在代替项目身份。

403、字符串、非 JSON 的组件解析覆盖不代替真实原生命中；结构化 409 和真实列表失败本包已验，T34 原生全格式仍未验。

## 4. 安全处置与安装依赖边界

本轮原始审计 `0 critical / 7 high / 4 moderate / 1 low`，刷新 local.10 为 `0 / 2 / 3 / 1`，命令仍 exit 1。

| 链 / 公告 | 处置与证据 | 当前状态 |
|---|---|---|
| converter → nanoid；GHSA-28wg-ghj8-5hjv、2v37-7h3g-55p8、xwg4-73v4-xw9w、mwcw-c2x4-8c55 | 来源限定覆盖 `@excalidraw/mermaid-to-excalidraw>nanoid:5.1.16`；实际转换/引用 owner 测试，候选 UI 重复保存/重开单列 | 3 high/1 moderate 不再出现 |
| PptxGenJS → image-size；GHSA-5p2g-fcmc-qvqq、w3rx-r6r6-pgpr | 定向 `pptxgenjs>image-size:2.0.3`；正常图片/PPTX、隔离有限时 ICNS/JXL/HEIF。旧 ICNS/JXL 超时为 red，旧 HEIF 已拒绝不伪造 red | 2 high 不再出现 |
| braces；GHSA-vfj7-8cjw-p6xm | watcher 真实目录禁 glob、禁 follow symlink；真实花括号/深目录/增改删改名/轮询/symlink 通过 | **high 开放**，仅产品路径缓解；其他构建模式不豁免。[公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| http-cache-semantics；GHSA-ch52-4w7c-c8xp | @electron/get 默认 HTTP 响应 cache 未启用；同 URL 不同授权 A/B/B 三次实际请求不串正文，制品缓存/独立校验保留 | **high 开放**；不是依赖已修复，自定义 cache 需另验。[公告](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) |
| OTel GHSA-8988-4f7v-96qf / sprintf-js GHSA-hp3w-g68c-fv3c / KaTeX GHSA-238p-pmpm-9mq7 | 未扩大耦合/跨主版本修复 | moderate/low 开放 |

不使用 `audit fix --force`，不全局强换，不接受未授权风险。owner 自然带入安全版后才能移除 override，并重跑实际行为与审计。

工作区、编译产物、独立打包 pin 和安装包均核对。外置 adm-zip 0.6.1、nanoid 3.3.20（另一 owner）、postcss 8.5.29、sharp 0.35.5、Next 16.3.6。实际 PptxGenJS 4.0.1 dist CJS/ES 无 image-size 调用，未外置该解析器；工作区声明链解析 2.0.3，不虚报安装包物理存在 2.0.3。client converter 的 nanoid 5 编入客户端而非外置，不能按另一个 nanoid 3 目录推断 converter 版本。local.9/10 依赖版本相同；资源清单文件数差异包含构建缓存合成项目路由数量和新的 chunk/buildId，非真实客户内容。

## 5. 同包交付、恢复与真实业务

local.10 从原生 Save As 完成 current v5 / historical v2 / candidate v3 × HTML/ZIP/PDF 九份文件，位于 QA 根 `local10-exports/`，每份字节数/摘要见证据 JSON。候选取消导出未落盘、未采用，v5 仍当前、v3 仍候选。

本次三个 ZIP 均为自包含版本交付（index.html / handoff / manifest），不是 local.9 current 的目录导出形状。核对 manifest 的所选版本和完整正文独立摘要、内联冻结 SVG 摘要、预算与候选标记。预览传输脚本使 ZIP HTML 不能冒称与原文件字节完全相同；正文 oracle 排除脚本/样式后完整等同，原文件/冻结版本摘要未变。旧检查器按目录形状取错了预期入口，按实际 manifest 分支修正检查器，没有放宽正文或资源要求，也没有修改产品导出。十二页 PDF 全部渲染检视，应用外 HTML/ZIP 人工打开另待验。

正式原生恢复入口选择旧合成 ZIP：摘要 `ba56fdf1790f899f4dd47d1ce6a8f28a9e278f6f7da54066a7e34304cb920928`；实际 manifest/44 成员 byte/hash 检查，导入 21 原文件、11 版本正文摘要全部一致。目标 `eb63eb99-7b96-40bf-b7dc-14ac55c7d8cc`；不是导入标记文件，也不代替完整真实旧 profile 升级。

同包真实 CSV：原生文件选择、用途“资料”、精确十片段协议、冻结、一次首页交接、Codex CLI 实际运行；源摘要 `a009436b7f2f9995fbd0ed5f513a7ecbbc9d2d03cac17d197dfdd6aff567524a`。snapshot `fa2ce171-2d7f-44fa-82b8-4ee3b7e504eb`，run `a06b0720-4004-4622-ad6c-eb6b276de172` succeeded。按原始 CSV 独立复算月合计 69,000 / 82,000 / 88,000，总额 239,000；5/6 月增长 18.84% / 7.32%，4/6 月 Tmall 占比 60.87% / 46.59%，回复一致，未猜测单位。

同一合成 brief 的两预算：源摘要均 `18d9462995e6860705c30343458f00572edc23245e17b3dda0de8f70320a45dd`，原生 picker 各自上传/固定，真实 Codex CLI 独立 succeeded，A run `2db14bad-5edd-426a-b20e-94d3beb88744`、B run `7df5870c-2abe-4595-9e10-7645ad1b0003`。

| 任务 | 实际六项金额 / 独立检查 |
|---|---|
| A 300,000 | 90,000 + 60,000 + 48,000 + 36,000 + 24,000 + 42,000 = 300,000；比例合计 100%，四项禁投各 0 |
| B 180,000 + 禁门店活动 | 0 + 54,000 + 45,000 + 36,000 + 27,000 + 18,000 = 180,000；比例合计 100%，门店/四项禁投各 0 |

B 完整回复明确原品鉴目标不可执行，不发布邀请、不开放品鉴预约、不组织活动，改为教育内容/社群讨论/同意与退订管理；未将禁投重命名转入其他科目。独立检查金额与比例用整数交叉乘积，避免 `14.000000000000002` 的浮点假失败。三个真实任务均仅一个 run、artifactCount 0、各项目仅输入文件，退出重开后身份/正文/快照仍一致、无新增运行。不是专业策略签收或真实品牌 A/B 验收。

Mermaid：真实编辑器同一序列图两次转换，首次 14 元素/20 引用，第二次 28 元素/40 引用；ID 全唯一、原 ID 保留、所有引用有目标。真实保存后退出重开文件，摘要仍为 `490649ea44fd9202ccc1d9714f57b4bfbd53e6027905dbc8f58e6156849e733c`。见 [Mermaid 重开截图](../../output/playwright/mokina-v003-repair-2026-10-07/native-mermaid-local10.png)。重复插入默认位置重叠，ID/引用兼容性通过不等于布局质量验收。专业评语、业务品牌与用户签收继续独立。

## 6. 检查与 CI

Node 24.15.0、pnpm 10.33.2，原生 SQLite ABI 按既有入口核对。质量切片 Web 107、daemon 27、watcher 14 + 3、pack 28、浏览器 6、真实 Electron PDF 1；generation 修复 63；外层修复浏览器 6 与 guard/full typecheck 均通过。新增回归进入根 CI；未变 UI 文案，既有 CI i18n 通过。

本次仅证据/文档提交再跑 guard，exit 0，日志 `guard-local10-evidence.log`；首个 sandbox 调用因 tsx 本地管道 `listen EPERM` 未能执行检查，取得既有主机执行权限后重跑，未改产品规避错误。证据 JSON 解析、13 原生用例索引、九文件记录、31 AC 行、文档本地链接及 git diff check 全通过。文档提交不重建或冒称新增运行代码验证。

保留验证提交 `9eed93fa` 的 CI 37600100543 失败：恢复草稿少尾字符/retry workspace 未就绪。与产品源码无运行差异，不无证据归因环境。补齐输入/清空就绪及真实 request.currentPrompt 全文 oracle 后本地三次无重试通过；53f94580 的独立 CI 被新提交 concurrency 取消，不记通过。最终产品 `7ced0cf9` 完整 CI 37603369750 success，包含修正后的 daemon 恢复/导航和新增外层断言。没有加 sleep、删断言或 blanket skip。

## 7. 原 31 条 AC 与剩余门槛

以下为逐项当前状态；“工程覆盖保留”不表示本轮重跑全部旧功能。

| 原 AC | local.10 结果 / 未齐门槛 |
|---|---|
| N00-AC01 | base/head/分支与自有改动核对，不提交用户无关文件 |
| N00-AC02 | 原起点延续；真实失败后递增候选，不拼包 |
| N00-AC03 | local.7/8/9/10、旧数据与失败证据保留 |
| N01-AC01 | 桌面/CLI/源码/原型边界保持，无新工作台/引擎 |
| N01-AC02 | 同包原生安装/CSV/两预算/接续/重开/导出/ZIP 恢复完成；人工门槛未齐 |
| N01-AC03 | 版本/源码/资源/包摘要登记，不公开发布 |
| N02-AC01 | 本包原生 CSV 固定十行/发送/依据可读；全输入丢失真实 409 后零 POST/零 run |
| N02-AC02 | CSV/两预算只讨论，各一个成功运行、零成果文件，原输入保持 |
| N02-AC03 | 十断点原身份恢复通过；真实旧 profile 待验 |
| N03-AC01 | CAS/双会话工程覆盖保留；双原生业务窗口宿主缺口 |
| N03-AC02 | 原生 9/10 原 requestId、未知响应、仅清理通过 |
| N03-AC03 | CSV 原文/位置/摘要，提交事实不等于采纳 |
| N03-AC04 | generation red/63 green/同包 9/10 通过 |
| N04-AC01 | 品牌竞态工程覆盖保留；真实授权 A/B 待验 |
| N04-AC02 | 合成 LOGO 隔离正确不等于品牌专业签收 |
| N04-AC03 | 源删除目标摘要恢复；三素材路径固定 |
| N05-AC01 | 同包改变选择/明确排除均确认新副本，旧意图/journal/目标保留 |
| N05-AC02 | 目标优先/源删除/快照复用通过；业务接续专业待评 |
| N05-AC03 | 原稿版本/strategy/快照身份保持，不冒称批准 |
| N05-AC04 | 十核心 + 缺源/编辑冲突/实际列表失败通过，不自动发送 |
| N06-AC01 | 两实际原生尺寸/外层无横溢/完整名称/聚焦/键盘创建通过；人工中文 IME 待验 |
| N06-AC02 | 九文件/十二 PDF 页/取消/冻结资源通过；应用外 HTML/ZIP 待验 |
| N06-AC03 | 无导航抢占；原白屏无法复现，按用户要求跳过且未关闭 |
| N07-AC01 | 两预算真实模型/全文/独立复算通过，专业策略评审待评 |
| N07-AC02 | CSV 复算通过，业务品牌/专业结论未签 |
| N07-AC03 | 最终产品完整 CI success；2 high/其余告警开放 |
| N07-AC04 | 工程/安全/专业/用户分列，未代签 |
| N08-AC01 | 同包主要原生链路完成；未齐门槛阻止完整工程收口 |
| N08-AC02 | 完整旧 profile 已找到但仍运行，一致性备份/升级未验 |
| N08-AC03 | 正式 ZIP 成员/原文件/版本摘要一致，旧包数据未删 |
| N08-AC04 | 产品/验证 SHA 与实际候选对应，后续文档不改本包代码 |

T14–T17：本候选十三原生用例与明确排除通过。T26–T27：九文件/PDF/资源/取消通过，外部打开待人工。T33：授权真实品牌待验。T34：结构化 409/真实列表失败原生通过，其他原生格式未齐。T28：原白屏未关闭不阻塞其他工作。T31：本包正常交接一次运行，准备失败零 POST/零 run；延迟冻结被真实门槛阻止。T10–T13/T32 的 CAS/会话/workspace 权限工程覆盖不升级为双窗口或全部原生授权验收。

## 8. 后续执行与恢复说明

1. 真实升级：原实例正常退出后，对完整 profile 制作保护副本与工作副本；核对旧项目/历史/候选/快照/pending/journal，禁止自动发送旧草稿。目前原实例仍运行，没有对写入中的 LevelDB 硬复制。
2. 授权品牌：取得真实 A/B 规则、标志、素材及允许模型目的地后，同包切换/接续，旧 A 固定快照不漂移。
3. 原生负向补齐：全部输入丢失与明确排除本包已补；后续稳定命中真实 403/字符串/非 JSON 再记结果，不能伪造响应。
4. 人工操作：应用外 HTML/ZIP 正确入口/资源；1280×720、1440×900 下中文 IME、用途/品牌/背景/副本/返回恢复。
5. 专业与用户：原始输入、完整结果、独立复算、接续成果分别记录预算/禁投/品牌/策略评审人及问题；用户独立签收。
6. 安全：两 high 未解除不宣布公开发布；其余告警同表跟踪，不静默接受。双业务窗口是另行宿主议题，不放宽权限；白屏有新复现证据再定位。

原意图重试保留 operation/target/snapshot；响应未知查原 requestId；已提交待同步只补清理。改变选区/品牌/素材/要求明确创建新副本，保留原恢复记录。源缺口或目标用户编辑停止覆盖；不要手工删除 journal。回退使用旧包与验证前数据副本，不承诺旧程序可读新恢复记录。本轮不新增垃圾回收、不自动合并、不公开发布。
