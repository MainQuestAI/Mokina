# Mokina V0.0.1 原生宿主运行与验收记录

更新：2026-09-24。此记录区分源码检查、原生 daemon 运行和浏览器/桌面验收；未完成项不算通过。

## 固定底座与运行

- 完整 OpenDesign 源码固定在 upstream commit `ac6115406f3f780ef5c624a9aad1a87cbbad882a`，以 Git subtree 导入 `open-design/`；保留其 Apache-2.0 许可证、锁文件、分层 `AGENTS.md` 与原有能力。
- macOS 本地使用 Node.js `24.15.0`、Corepack pnpm `10.33.2`。在 `open-design/` 执行 `corepack pnpm install --frozen-lockfile`。需要以独立数据目录运行时执行 `OD_DATA_DIR=/absolute/path/to/empty-data corepack pnpm tools-dev run web --namespace mokina-v001 --daemon-port 18583 --web-port 18584 --no-env-file`。端口可按需改动，数据根不能指向现有用户数据。
- 当前实现有两个官方营销场景包：`mokina-market-analysis` 和 `mokina-marketing-plan`。首页显式选择后，原生项目记录 `scenarioBinding`，继续运行使用该快照。保留“更多”中的上游入口。
- 原生 `od` CLI 与新增 API 对应：`od files material <projectId> <relpath> --json` 读取资料；`od files candidate-create ... --base-version-id ... --section-id ... --replacement-file ... --operation-id ...` 创建候选，`od files candidate-adopt ... --expected-current-version-id ... --operation-id ...` 采用；`od export <file> --project <id> --format html|pdf --version-id <id>` 导出固定版本。长修改要求可用 `--prompt-file <path|->`，候选替换可用 `--replacement-file <path|->`。

## 前轮已验证（历史快照）

| 层级 | 结果 | 证据 |
| --- | --- | --- |
| 源码 | 最新改动后 `pnpm guard`、整仓 `pnpm typecheck`、Web 生产构建通过；相关 daemon 测试 218/218、Web 定向测试两组 25/25 和 16/16 | 本工作树命令结果；为兼容原上游 UI 测试，Vitest 显式设置原版界面模式，Mokina 默认模式由真实浏览器与桌面检查 |
| 原生 daemon | 独立数据根可启动；Codex CLI `0.156.1` 可用；真实运行 `3dd515b8-e30a-4948-8f20-371a1dd33aec` 成功写出并读回 `smoke.html` | `.tmp/mokina-v001-data/runs/` 与项目文件（本地测试数据，不交付） |
| 显式场景 | 项目 `1c33bb2a-f51b-490d-adc2-bb3497d43625` 绑定分析场景；真实 Codex 运行 `2a8f426f-2644-4c56-8831-3a40548beea5` 只讨论、未创建成果文件 | 项目 `scenarioBinding`、run 状态与文件列表 |
| 版本 API | 自包含 HTML 的候选不会推进 current；采纳与重复采纳、旧版 HTML 下载读回通过；进程中断后残留采用日志的恢复测试通过 | daemon 版本库测试和本地 API 检查 |
| 桌面入口 | Electron 在独立数据根启动，窗口与页面标题为 Mokina；首次进入本地 Agent 选择，Codex CLI 可选；首页默认市场分析，自动更新 disabled | `tools-dev inspect desktop status/eval/screenshot` |
| 选择性接续 UI | 桌面版本面板从 `chapter.html` v2 只选 budget/channel 两章，创建项目 `8b07a38a-00e4-4546-9b8a-5c615d72f2ce`；仅保存两条固定摘录，未发送模型；页面刷新后草稿仍在 | 新项目 `MOKINA-CONTINUATION.json`、run 目录和桌面渲染器检查 |
| 资料提取 | TXT 真实 API 读取保留行号；XLSX/PPTX 小样测试保留单元格/幻灯片位置，未缓存公式标为 partial；文档预览显示提取结果与限制 | `/material` 响应与 `mokina-materials.test.ts` |
| 多格式实物样本 | 在独立测试项目生成并经 `/material` 实际读取 CSV、DOCX、XLSX、PPTX、文本 PDF：分别读到行号、段落/表格、单元格、幻灯片文本块、页码；XLSX 未缓存公式明确标为 partial，没有虚构结果 | 五个合成原件及 API 响应留在独立 `.tmp/mokina-v001-data`，不含客户资料 |
| 联网研究 | 独立 daemon 的 Tavily 配置状态为 `configured=true`；`POST /api/research/search` 真实返回 3 条 WHO 来源及 `fetchedAt=1790183322607`。首条 [WHO 2024-06-26 新闻](https://www.who.int/news/item/26-06-2024-nearly-1.8-billion-adults-at-risk-of-disease-from-not-doing-enough-physical-activity) 的返回摘要含成人每周 150 分钟中等强度或 75 分钟高强度建议 | 原生 API 调用；仅取得搜索摘要，未取来源全文，也未把该公开健康问题当作营销报告依据；未记录 key |
| 真实方案生成 | 分析场景的“只讨论”不写文件；另一个方案场景的 Codex 运行 `35d4de24-6c7d-437c-adc6-4a0f9296b8c4` 成功写出 `plan.html`，18,820 字节、7 个稳定章节、无外部资源，预算/周期/渠道限制与假设均在正文 | run 状态、项目文件、HTML 结构检查；尚非专业质量验收 |
| 真实分析生成 | 第二组事实的 Codex 运行 `e53a608a-359a-46b2-804f-a5cfcd7c754d` 写出 `analysis-b.html`，包含 7 个稳定章节，无外部脚本/图片依赖；89 元、30 万/4 周、大学生、短视频可用、线下快闪受限进入判断。样例已复制到 `docs/fixtures/mokina-v0.0.1/market-analysis-synthetic.html` | run 状态、HTML 结构与事实检查；与方案场景是不同任务，不能单靠结构差异证明对输入敏感 |
| 选择性接续真实讨论 | 运行 `3c7bc948-e865-425e-a752-15eabf96e435` 成功返回讨论、无新文件；固定摘录中的预算 100/线下体验进入用户请求，未选事实“三个月”未进入运行状态 | 独立项目运行状态与请求检查；没有文件读取工具调用，不能推广成任意模型配置下的强制隔离 |
| 接续摘录不漂移 | 接续项目的 `MOKINA-CONTINUATION.json` 固定 `chapter.html` v2 的渠道“线下体验”；源项目当前稿后来采用 v4，渠道已变为“门店试香和社群复购”，接续文件读回仍是旧摘录与原版本 ID | 两个原生项目文件读回；源文件删除情形尚未实测 |
| 资料选择与排除 | 桌面端在源项目勾选 `facts.txt`，未勾选含独有标记的 `excluded.md`，创建独立项目 `ce2d8e03-a76b-49ee-98b0-bf229819a767`。新项目只含固定摘录文件，未发送前没有运行；用户发送后，Codex 运行 `e5052f72-74ae-444a-88c6-4f0a0d5963b8` 的请求与回复使用 100 万预算、禁投短视频及行号，未出现排除文件标记与 999 万预算 | 桌面 UI、项目文件、run 状态与对话 API；当前实现为新项目独立工作路径，不是同项目任意会话的文件权限隔离 |
| AI 单章修订与采用 | 浏览器在 `chapter.html` v2 选 `channel`，真实 Codex 运行 `2a24a6db-0610-4f19-aeb7-aff1304c47c3` 于独立项目写出 `MOKINA-REPLACEMENT.html`。v4 候选保存后当前文件哈希仍为 `100cd3a…`；点击采用后 v4 成为 current，`budget=预算100`、`period=三个月` 字节对应正文保持，只有渠道改为门店试香/社群复购/禁投短视频 | 浏览器版本面板操作、run 输入与产物、候选/当前版本 API 和文件读回；候选冲突/中断由版本库单测覆盖，更多运行取消情形未验收 |
| 原生运行取消 | 对独立合成项目启动 Codex 运行 `2dc3a95c-c3a4-40a4-b9a6-2a42954e4741`，立即通过原生取消接口返回 `ok=true`、状态 `canceled`；稍后重读仍为 canceled、`cancelRequested=true`，源项目目录没有新近写入的文件 | 原生 run API 与项目文件检查 |
| 项目切换时的草稿 | A 项目 Codex 运行 `fd7453fa-217e-4758-a4e2-90d3fd1213a7` 为 running 时，浏览器在 B 项目填写未发送草稿；A 经原生接口取消后 B 页面重载仍保留原草稿，A 状态仍为 canceled。测试后已清空 B 草稿 | 原生 run API 与 Playwright 编辑器读回；验证切换和取消，不等于已证明 A 完成时的异步响应行为 |
| Web 浏览器 | Playwright CLI 在 `1440×900`、`1280×800` 打开 Mokina 首页与原生项目，对话、成果列表和资料选择入口可见且无横向溢出；通过原生 HTML 出口在浏览器打开 `analysis-b.html`，检查首屏排版与来源标记。修复默认 Vela/AMR 与项目 Workspace 账单后台请求后，重载首页及项目页无该组 503/500 控制台错误 | `output/playwright/mokina-v001-browser/` 截图、页面快照及浏览器控制台；只覆盖上述页面和尺寸 |
| 历史版本浏览器复核 | Web 重启后在原生项目打开 `freeze-demo.html`，主成果仍显示当前 v2 的 `blue`；版本面板选 v1 后 iframe 显示 `red`，当前版本标识仍在 v2。另发现本地版旧 Workspace 事件 SSE 对测试身份返回 403；停用该本地版无关订阅后重载，资源时序里该接口请求数为 0 | Playwright 页面快照与 resource timing；图片颜色的字节和 PDF 栅格验证见历史资源行 |
| 本地版遥测边界 | daemon 重启后，对保留旧显式开启记录的独立数据根读取 `/api/app-config` 得到 metrics/content/artifactManifest 均为 false，`/api/analytics/config` 为 disabled 且不返回 key/host；启动日志中的 run sink 为 none、task observation effectiveMode 为 off。浏览器默认首页资源列表不含 Vela 状态/消息、Workspace 账单/目录、AIHubMix 目录 | 运行 API/日志、Playwright resource timing；本机模型服务授权请求仍是用户主动运行所需，不属于产品遥测 |
| 干净目录安装与启动 | 从提交 `28646da` 的 `open-design/` 导出新目录，使用全新 `/tmp/mokina-v001-clean-store` 从网络下载 1131 个锁定依赖包，`pnpm install --frozen-lockfile` 完成；全新数据根启动 Web/daemon，首页 HTTP 200 且标题 Mokina，插件列表含两个营销场景，遥测接口 `enabled=false` | 临时 `/tmp/mokina-v001-clean-check` 运行检查；仅覆盖安装和启动，未在该临时目录再次运行 Codex 主链 |
| 历史 PDF 边界 | 指定 v1/v2 的 PDF API 各返回真实 PDF；渲染图分别显示“线上”/“线下体验”。未冻结的本地图片依赖在历史 HTML 和 PDF 导出均报 422，未混用当前图片 | PDF 下载字节与逐页图像目视检查、错误响应 |
| 历史本地图片冻结 | 新保存的 `freeze-demo.html` v1/v2 分别内嵌当时的红色/蓝色 PNG；更新原图片后，指定版本 HTML 出口的解码像素仍是红/蓝。`/export/pdf-image` 两次返回真实 PDF，逐页栅格检查 v1 只有红色像素、v2 只有蓝色像素；历史预览优先使用冻结 HTML | 版本库测试、原生 HTML/PDF API 和栅格像素检查。桌面 `/export/pdf` 会打开系统保存对话框，需要用户选择路径，不作为无人值守 API 判据 |
| CLI 与 API 对应 | `od files material` 实读 CSV 的行号；`od export --version-id` 导出旧版红色图片；`od files candidate-create` 在当前稿保留“原渠道”的同时保存非 current 候选，`candidate-adopt` 后当前稿变成“CLI 新渠道” | 原生 `od` 命令与源文件读回；候选 `42724fed-6580-4539-bc9d-883f4cf3adfa` |

## 本轮修复与复测（2026-09-24）

**结论：在 macOS 本地、Codex 主通道和下列边界内，V0.0.1 达到工程可试用。** A01–A11 的本轮主通道失败项已关闭。该结论不等于营销专业质量签收或生产交付。

| 编号 | 判定 | 本轮证据及限制 |
| --- | --- | --- |
| A01 | 通过 | 隔离且全新的数据根启动 Web/daemon/桌面；Codex 运行 `c784a4f4-ae07-49fe-862f-6050691e6219` 成功写出 `analysis.html`，浏览器重开后仍可读。默认首页网络观察只出现本地服务与 data URI；配置 API 返回遥测关闭。 |
| A02 | 通过 | 相同市场分析场景与任务在独立 A/B 项目运行：A `185a6c03-1017-4180-be0b-df149fa4f4b4`、B `5ae6c13c-f467-45ad-985f-23d5afbd1289` 均成功。A 使用 399 元/100 万元/8 周/禁投短视频，B 使用 89 元/30 万元/4 周/大学生/可投短视频/禁线下快闪；两份报告的判断与渠道建议随事实变化。`/material` 现按标题、页、幻灯片、工作表行段等提供分组与位置，超长单元分片；浏览器预览后仅勾选“新资料”，新项目 `a6b01f22-7a96-4920-84c8-d4f5eb63e969` 只保存 25 万元与禁投短视频，没有旧资料 999 万元。原件在预览后变化时，创建被拒并要求重新选择；界面显示 32,000 字上限和解析限制。 |
| A03 | 通过 | 同场景 A/B 分析报告分别包含问题、比较、事实与推断、证据缺口和决策条件；方案场景运行 `35d4de24-6c7d-437c-adc6-4a0f9296b8c4` 生成有行动、预算与 KPI 假设的 `plan.html`。此处检查工程结构与事实一致性，专业营销质量仍待实际试用签收。 |
| A04 | 通过 | 分析场景只讨论运行 `2a8f426f-2644-4c56-8831-3a40548beea5` 未生成文件；用户明确要求后，A/B 分析和方案分别产生 HTML。 |
| A05 | 通过，摘要级来源 | 真实搜索运行 `492bb390-4b68-4f20-956d-1e7750033f5a` 写出 `research-analysis.html` 与 `research/who-2024-adult-physical-activity.md`。报告保存来源 URL、访问时间、支持结论的摘录及“搜索摘要”标识，并声明未读网页正文。缺少 Tavily key 或搜索失败时返回错误；提示词要求将调研标为未完成，不伪装成原文或完成调研。未增加通用网页全文抓取。 |
| A06 | 通过 | 干净目录的章节修订运行 `578702bc-e9fb-41a2-a30a-3816e85dda84` 生成替换内容，候选 v2 `cc934df5-9ba2-43c0-ad37-72eb99546356` 保存后 current 仍为 v1 `71679613-96c0-4abf-bd46-24da220d6160`；浏览器采用后 current 才成为 v2，导出的两个 HTML 仅标题和指定句子不同。手工编辑与范围外保留见前轮证据。 |
| A07 | 通过 | 版本测试覆盖手工并发修改返回 `VERSION_EXTERNAL_CHANGE`、重复采用幂等；运行取消后仍为 canceled，修订对话框重开读取真实 run 状态，运行中可取消，失败/取消清除过期恢复入口，只有成功运行可保存候选。daemon 重启中断运行 `97cdb979-0d0d-46e4-93ff-2bdb66ae66ed` 显示“意外中断”并可重试，没有显示为成功。 |
| A08 | 通过，存量资源有限制 | 指定 v1/v2 导出的 HTML 分别为 19,815/19,863 字节；PDF 均为真实三页文件（870,779/881,253 字节），逐页栅格检查标题和长正文可读，版本差异对应正文。A 组长报告另检查五页 PDF。新保存版本使用同版正文与资源；前轮已实测存量未冻结图片的 HTML/PDF 均报 422，不混用当前图片。证据在 `output/playwright/mokina-v001-final/`。 |
| A09 | 通过，隔离范围有限制 | 接续项目 `8b07a38a-00e4-4546-9b8a-5c615d72f2ce` 的固定摘录，在源 `chapter.html` 从 v2 改到 v4 并删除后仍保持原版本与“线下体验”。接续运行 `3c7bc948-e865-425e-a752-15eabf96e435` 的请求只含所选预算/渠道摘录；资料选入运行 `e5052f72-74ae-444a-88c6-4f0a0d5963b8` 的请求与工具记录没有未选资料标记或源项目目录。草稿未发送前无运行。没有对所有 Agent 或操作系统级目录隔离作认证。 |
| A10 | 通过 | A 研究运行正常完成时，B 项目浏览器页面和未发送草稿保持原样；重开后成果、版本与修订状态从原生存储恢复。daemon 重启未完成运行的中断与重试见 A07。 |
| A11 | 通过 | 独立源码目录在全新依赖缓存中下载 1,131 个锁定包，使用全新数据根完成“安装→Codex 生成→浏览器重开→章节修订→采用→指定 v1/v2 HTML/PDF 导出”主链，未借用既有项目数据。默认入口观察未发现上游商业、遥测或更新请求；这不是对所有可选上游入口的网络审计。 |

本轮相关 daemon 测试 27/27、Web 定向测试 183 通过/3 跳过，`pnpm guard`、整仓 `pnpm typecheck` 和 Web 生产构建通过。早先同场景 A 运行 `b26b1b15-7c62-4510-b226-02ca6d3e5d6e` 已读到资料，但随后无新模型事件，用户取消后终态为 canceled；未发现宿主丢失运行状态，不能把它计作成功。后续 A/B 重试均取得完整报告，保留上述 run ID、状态、事件、工具记录及成果文件。干净目录与原生测试数据均保存在各自的隔离数据根中，不含客户资料；运行 ID 可用于定位状态、事件和工具记录。

**仍待签收与明确限制：** 营销专业人员对首稿质量的实际试用与签收保持“待验收”，不计入工程可试用结论。资料读取和新工作选入有 150,000 字提取上限、32,000 字选入上限、无 OCR 等提示；模型进程未实行系统级目录沙箱。联网研究目前只证明搜索摘要来源，没有通用网页全文读取。存量未冻结资源继续明确报错，远程资源无法冻结。默认路径的网络观察不覆盖保留的所有可选上游入口。

## PR #1 复审缺陷回归（2026-09-24）

以 PR 原提交 `51c0c9b` 复审发现的四项缺陷为范围，修复提交为 `51b12d5`。A02、A07、A08 重新打开后，本表所列主通道回归通过；上文其他 A 项沿用已有运行证据。**macOS 本地、中文版、Codex 主通道的“工程可试用”结论在本轮范围内继续成立**，营销专业质量仍待签收。

| 项目 | 判定与修复 | 回归证据 |
| --- | --- | --- |
| A02：未选资料泄漏 | **通过。** `/material` 的文件级 `limitations` 只保留通用限制，单元格与空白 PDF 页诊断按 `groupId` 保存；选入快照只带所选分组的正文、位置与诊断。文件和待发送请求共用快照。 | 真实 `mokina-pr1-budget.xlsx` 预览显示 `预算!A1` 与 `预算!B41` 诊断；[仅勾选 A1 的浏览器截图](evidence/pr1-fix/xlsx-selected-a1.png)。新项目 `6e19f451-5a9c-4985-a137-2f6e5ec93eb0` 的 `MOKINA-MATERIALS.md` 只有 A1；Codex 运行 `7651de3f-4624-4295-9aea-2abda430ef2c` 成功，其请求、事件和工具记录均无 `B41`、`987654321` 或源项目 ID。反向只选 B41 的项目 `2fd0a58c-c1aa-4d6b-b739-2f0e3d9d2c5e` 保留该位置、缓存值及“未重新计算”说明。daemon 提取与 Web 快照测试通过。 |
| A07：候选绕过与修订恢复 | **通过。** 通用恢复接口对未采用候选返回 HTTP 409、`VERSION_CANDIDATE_REQUIRES_ADOPTION`；正式旧版和已采用版本仍可恢复。修订面板在读取恢复记录前禁用新生成，按 run ID 与 operation ID 归属清理；关闭面板停止本地轮询，失败保存保留原 operation ID。 | 接口测试覆盖 v1→候选 v2→人工修改 v3 后 adopt 和 restore 都不覆盖 v3，拒绝前后工作文件、current、版本数量不变；CLI 错误透传测试通过。浏览器修订运行 `7d218cbd-f218-4422-ad0f-7a76c11bc22e`（operation `3f8a1075-2bde-45d5-babf-208ebd74ed89`）运行中重开仍可恢复，B 请求被禁用；成功后再次重开，保存候选 `91392fd5-47b2-4e3f-8859-f2041ac9ff8c`，当前版本仍为 `cf324f76-5cb8-4d75-9c40-b2d44e232474`。[重开后候选截图](evidence/pr1-fix/revision-candidate-after-reopen.png)。UI 定向测试覆盖取消失败、保存失败后重试同一 operation ID；归属测试覆盖旧任务不能清理新记录。 |
| A08：历史阅读不一致 | **通过，存量资源限制仍在。** 版本面板与新窗口共用指定版本 HTML 导出得到的可呈现正文，并按版本 ID 缓存；原始 HTML 继续用于比较和章节修订。未冻结的历史本地资源显示错误，禁止从当前项目补图；自包含旧版可打开。 | 浏览器选 `report.html` v1 后，面板与[新窗口截图](evidence/pr1-fix/history-v1-new-window.png)均显示“历史版本红色”，current 仍为 v2。原有 `freeze-demo.html` v1/v2 的指定版本 [HTML v1](evidence/pr1-fix/freeze-v1.html)、[HTML v2](evidence/pr1-fix/freeze-v2.html) 内嵌 8×8 PNG 像素分别为 RGB `(255,0,0)`、`(0,0,255)`；[PDF v1](evidence/pr1-fix/freeze-v1.pdf)、[PDF v2](evidence/pr1-fix/freeze-v2.pdf) 均返回 200，栅格[红](evidence/pr1-fix/freeze-v1-page.png)/[蓝](evidence/pr1-fix/freeze-v2-page.png)一致。Web 测试模拟未冻结旧版 422，确认面板报错且新窗口按钮禁用。 |
| 方案 Skill | **已调整。** 按问题需要给出一个或多个方向，仅在存在实质替代路径时比较。 | 同场景 reference 已核对，无相同固定“两方向”硬性要求；本轮不重新声称专业质量签收。 |

上述复审轮次的定向执行为：daemon 相关测试 26/26，恢复路由关键测试 2/2；营销模式开启的 Web 四组测试 218 通过、3 跳过，原版模式的版本与导出测试 107/107。`pnpm guard`、整仓 `pnpm typecheck`、营销模式 Web 生产构建及 `git diff --check` 均通过。当时额外全量 Web 测试为 12,650 通过、9 失败、1 预期失败、11 跳过；全量 daemon 版本路由文件另有两例写入失败模拟不符。这些是该轮历史结果，最新复审收口见下节。

边界维持：中文版、macOS、本地 Codex；未认证其他 Agent，未添加通用网页全文抓取、旧图片迁移或系统级目录沙箱。GitHub 自动审查提出的全语言文案问题记录为已知限制，不在此次定向修复内。证据项目和运行记录保存在独立 `.tmp/mokina-v001-data` 中；提交中只保留合成资料的 HTML/PDF 与浏览器截图。

## PR #1 最新复审收口（2026-09-24）

最新复审在 `d8812ce` 指出 A07 的异常退出缺口：运行成功但替换文件缺失或候选校验持续返回 400 时，待处理记录会挡住下一轮修订。本轮为成功且未保存候选的任务增加“放弃本次结果”及二次确认；确认时重新读取真实 run 状态，并按 `runId + operationId` 清理自己的记录。运行中、未知状态或保存请求进行中不能放弃；500 暂时保存失败仍可用原 operation ID 重试。放弃不调用取消接口，也不修改运行记录、临时文件、版本或当前稿。

**A07 复核：通过。** Web 定向测试覆盖缺失替换文件、持续 400、取消确认、放弃后新建任务、旧任务异步回调遇到新记录，以及 500 后按原 operation ID 重试；修订恢复测试 7/7。真实浏览器在独立合成项目中关闭再打开面板，分别检查缺文件与原生候选 API 的 400；放弃后原文件 SHA-256 仍为 `d7429bc4e6fbe198269c417ffb0fda6cc9688dba7427cec00a141dc0e001531a`，current 仍为 v1 且只有一个版本。新的修订记录可以启动。异常 run 状态与新 run ID 由浏览器受控路由模拟，不将其记为新的真实 Codex 运行；[页面快照与 API 读回说明](evidence/pr1-closeout/revision-abandon-browser.md)。浏览器同时发现两个修订按钮继承 `sticky` 样式后重叠，已只对该区域改为普通布局并复核点击。

全量 daemon 版本路由先前两例失败的原因已定位：版本目录被测试设为普通文件时，锁内预读采用日志遇到 `ENOTDIR`，在内容写入前退出。本轮仅将该情形视作无日志，使内容写入继续，再由版本捕获逻辑返回 `PROJECT_FILE_VERSION_CAPTURE_FAILED`。JSON 与 multipart 写入均返回 200、原文可读且带类型化警告；真正的内容写入失败仍返回 500，已有目录中的损坏采用日志继续阻止写入。完整版本路由及版本库测试 33/33。

全量 Web 再次运行得到 **12,655 通过、8 失败、11 跳过**，因此不称为全量通过。8 项逐类核对如下；本轮改动范围内的 Web 五组定向测试为 **134 通过、3 跳过**：

| 失败数 | 项目与原因 | 处理口径 |
| --- | --- | --- |
| 2 | DeepSeek V4 Flash 入口的源码形状断言要求无条件呈现；本地 Mokina 模式按已定边界收起该上游入口，原版模式仍保留条件分支。 | 旧源码断言与版别条件不一致；不扩大本轮商业入口范围。 |
| 1 | `zh-CN.homeHero.title` 使用 Mokina 的静态中文标题，原版 i18n 合同测试仍要求英文标题的 `{word}` 动态占位符。 | 字典合同待按版别拆分；当前中文版首页标题与选择入口已在浏览器核对，不宣称全语言一致。 |
| 1 | 上游配置测试要求默认遥测开启，本地 Mokina 默认关闭。 | 既定本地隐私默认值；保留关闭状态。 |
| 2 | 首页 rail 与十项场景卡断言固定的上游顺序，Mokina 两个营销入口被放在前面。 | 既定首页入口差异。 |
| 2 | 上游 automatic-default 芯片测试假设所有首层芯片都由 daemon 自动推导；Mokina 两个营销芯片使用显式场景绑定。 | 测试前提未区分显式营销入口；真实项目 `scenarioBinding` 已另行验收。 |

首次全量运行另有 3 个 HomeView 模板菜单用例在并发下未找到入口；三文件独立复跑 44/44，通过，第二次全量运行也通过。原有一处 Mokina 资料选择器字重 `650` 不符合仓库字重规则，已改为 `600`，定向与第二次全量对应测试通过。`pnpm guard`、整仓 `pnpm typecheck`、营销模式 Web 生产构建和 `git diff --check` 均通过。上述全量失败不涉及 A07 的修订退出路径，但保留为明确的原版测试/版别合同差异，不写成 CI 已通过。

此前 A01–A11 的真实 Codex 主链、A/B 差异及指定版本导出证据沿用；本节只重新打开并关闭 A07 的缺口。**macOS 本地、中文版、Codex 主通道的“工程可试用”结论在该范围内继续成立**。营销专业质量签收仍待验收；PR #1 保持待合并。
