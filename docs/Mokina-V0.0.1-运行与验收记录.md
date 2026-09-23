# Mokina V0.0.1 原生宿主运行与验收记录

更新：2026-09-24。此记录区分源码检查、原生 daemon 运行和浏览器/桌面验收；未完成项不算通过。

## 固定底座与运行

- 完整 OpenDesign 源码固定在 upstream commit `ac6115406f3f780ef5c624a9aad1a87cbbad882a`，以 Git subtree 导入 `open-design/`；保留其 Apache-2.0 许可证、锁文件、分层 `AGENTS.md` 与原有能力。
- macOS 本地使用 Node.js `24.15.0`、Corepack pnpm `10.33.2`。在 `open-design/` 执行 `corepack pnpm install --frozen-lockfile`。需要以独立数据目录运行时执行 `OD_DATA_DIR=/absolute/path/to/empty-data corepack pnpm tools-dev run web --namespace mokina-v001 --daemon-port 18583 --web-port 18584 --no-env-file`。端口可按需改动，数据根不能指向现有用户数据。
- 当前实现有两个官方营销场景包：`mokina-market-analysis` 和 `mokina-marketing-plan`。首页显式选择后，原生项目记录 `scenarioBinding`，继续运行使用该快照。保留“更多”中的上游入口。
- 原生 `od` CLI 与新增 API 对应：`od files material <projectId> <relpath> --json` 读取资料；`od files candidate-create ... --base-version-id ... --section-id ... --replacement-file ... --operation-id ...` 创建候选，`od files candidate-adopt ... --expected-current-version-id ... --operation-id ...` 采用；`od export <file> --project <id> --format html|pdf --version-id <id>` 导出固定版本。长修改要求可用 `--prompt-file <path|->`，候选替换可用 `--replacement-file <path|->`。

## 本次已验证

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
| 原生运行取消 | 对独立合成项目启动 Codex 运行 `2dc3a95c-c3a4-40a4-b9a6-2a42954e4741`，立即通过原生取消接口返回 `ok=true`、状态 `canceled`；稍后重读仍为 canceled、`cancelRequested=true`，源项目目录没有新近写入的文件 | 原生 run API 与项目文件检查；尚未通过浏览器执行“运行 A 时编辑 B”情形 |
| Web 浏览器 | Playwright CLI 在 `1440×900`、`1280×800` 打开 Mokina 首页与原生项目，对话、成果列表和资料选择入口可见且无横向溢出；通过原生 HTML 出口在浏览器打开 `analysis-b.html`，检查首屏排版与来源标记。修复默认 Vela/AMR 与项目 Workspace 账单后台请求后，重载首页及项目页无该组 503/500 控制台错误 | `output/playwright/mokina-v001-browser/` 截图、页面快照及浏览器控制台；只覆盖上述页面和尺寸 |
| 历史版本浏览器复核 | Web 重启后在原生项目打开 `freeze-demo.html`，主成果仍显示当前 v2 的 `blue`；版本面板选 v1 后 iframe 显示 `red`，当前版本标识仍在 v2。另发现本地版旧 Workspace 事件 SSE 对测试身份返回 403；停用该本地版无关订阅后重载，资源时序里该接口请求数为 0 | Playwright 页面快照与 resource timing；图片颜色的字节和 PDF 栅格验证见历史资源行 |
| 本地版遥测边界 | daemon 重启后，对保留旧显式开启记录的独立数据根读取 `/api/app-config` 得到 metrics/content/artifactManifest 均为 false，`/api/analytics/config` 为 disabled 且不返回 key/host；启动日志中的 run sink 为 none、task observation effectiveMode 为 off。浏览器默认首页资源列表不含 Vela 状态/消息、Workspace 账单/目录、AIHubMix 目录 | 运行 API/日志、Playwright resource timing；本机模型服务授权请求仍是用户主动运行所需，不属于产品遥测 |
| 干净目录安装与启动 | 从提交 `28646da` 的 `open-design/` 导出新目录，使用全新 `/tmp/mokina-v001-clean-store` 从网络下载 1131 个锁定依赖包，`pnpm install --frozen-lockfile` 完成；全新数据根启动 Web/daemon，首页 HTTP 200 且标题 Mokina，插件列表含两个营销场景，遥测接口 `enabled=false` | 临时 `/tmp/mokina-v001-clean-check` 运行检查；仅覆盖安装和启动，未在该临时目录再次运行 Codex 主链 |
| 历史 PDF 边界 | 指定 v1/v2 的 PDF API 各返回真实 PDF；渲染图分别显示“线上”/“线下体验”。未冻结的本地图片依赖在历史 HTML 和 PDF 导出均报 422，未混用当前图片 | PDF 下载字节与逐页图像目视检查、错误响应 |
| 历史本地图片冻结 | 新保存的 `freeze-demo.html` v1/v2 分别内嵌当时的红色/蓝色 PNG；更新原图片后，指定版本 HTML 出口的解码像素仍是红/蓝。`/export/pdf-image` 两次返回真实 PDF，逐页栅格检查 v1 只有红色像素、v2 只有蓝色像素；历史预览优先使用冻结 HTML | 版本库测试、原生 HTML/PDF API 和栅格像素检查。桌面 `/export/pdf` 会打开系统保存对话框，需要用户选择路径，不作为无人值守 API 判据 |
| CLI 与 API 对应 | `od files material` 实读 CSV 的行号；`od export --version-id` 导出旧版红色图片；`od files candidate-create` 在当前稿保留“原渠道”的同时保存非 current 候选，`candidate-adopt` 后当前稿变成“CLI 新渠道” | 原生 `od` 命令与源文件读回；候选 `42724fed-6580-4539-bc9d-883f4cf3adfa` |

## 尚未通过的完成条件

- 长资料的章节级选择、模型工具读取记录。当前选入路径把固定摘录写入请求，但模型进程所在机器仍可能通过额外工具访问其他可读目录，尚无系统级目录沙箱。联网研究的搜索摘要链路已实测；来源全文读取与在实际营销报告中的引用尚未验收。
- 同类分析或方案在 A/B 两组输入下的实质差异与专业质量检查；AI 章节修订的真实候选/采用已通过，运行中浏览器退出、迟到输出和失败恢复仍需验收。
- 同场景 A/B 复核曾启动分析场景运行 `b26b1b15-7c62-4510-b226-02ca6d3e5d6e`，工具实际读取了 `brand-a.md` 的 399 元、100 万元、8 周及禁投短视频；随后数分钟没有新模型事件或 `analysis-a.html`，已主动取消，终态 `canceled`。因此不能把已有的 B 组分析与另一任务的 A 组方案当作同场景输入敏感性验收。
- 选择性接续在原项目修改/删除后的对照，以及对所有可用 Agent 的目录隔离验收。
- 旧版存量成果的图片资源此前未冻结，仍按 422 拒绝；远程资源无法冻结。长成果的浏览器交互与 PDF 排版、桌面取消/切换/进程重启恢复尚未完整验收。干净目录的安装和启动已通过，完整主链仍由原独立数据根验证。
- 本地版默认界面与运行时已关闭上游促销、账单、更新和遥测；仍未对每一条设置页、媒体提供商及所有可选上游入口做完整网络审计。用户主动进入保留的上游能力仍可能发起对应请求，不将默认路径证据扩大为全产品承诺。

最初浏览器控制接口多次超时，随后使用 Playwright CLI 完成上表限定的浏览器检查；桌面操作仍由目标仓库 `tools-dev inspect desktop` 完成，两个层级分别记录。测试目录 `.tmp/mokina-v001-data` 和旧原型输出均不属于交付样例。启动桌面时工具重启 daemon，运行 `b9499e7d-706f-4691-bbc1-7b232faefe9b` 因此被取消，未留下报告；这是运行中切换启动形态的已知限制，不能把该运行当生成成功。
