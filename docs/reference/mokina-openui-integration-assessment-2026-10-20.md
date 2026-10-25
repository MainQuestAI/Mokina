# Mokina × wandb/openui 结合可行性评估

- 日期：2026-10-20
- 评估对象：https://github.com/wandb/openui
- 核查方式：Mokina/OpenDesign 源码只读核对 + OpenUI 仓库浅克隆与 GitHub API/README 原文抓取；外部证据访问时间 2026-10-20 18:20–18:55（+08:00）
- 证据标注：【事实】= 有本地代码或原文抓取支持；【推断】= 基于事实的判断；【建议】= 行动建议

## 结论摘要（TL;DR）

【建议】**不建议把 wandb/openui 作为 Mokina 的产品依赖或生成引擎集成；它值得借鉴的部分很小，不需要引入或 fork。**

理由分三层：

1. 【事实】wandb/openui 不是一个"生成式 UI 框架"，而是一个 2024 年 3 月创建、用 LLM 生成单文件 HTML 的独立 Playground（前端 React 18 + Vite + Tailwind 3，后端 FastAPI + SQLite）。产品代码最后实质改动在 2025-05，2025-09 之后只有 devcontainer、依赖与安全类提交；仓库 0 tag、0 release，前端 `private: true`，从未发布可安装包；本地 demo 长期不可用。
2. 【事实】Mokina 侧与它重叠的能力已经很多，且更深：9 类 artifact（含 react-component / mini-app）、iframe 预览 + comment/inspect/edit/tweaks/draw/deck 多桥、结构化批注（selector、position、computedStyle、截图、框选/圈选/多元素组）、163 个 skill 目录（含 image-to-code）、114 个 design-template 目录、版本/证据/导出/恢复体系。OpenUI 的"点选批注 → 局部重写"在 Mokina 里已有更强实现。
3. 【事实】两者在运行形态上冲突明显：引入它需要给 macOS 包增加 Python 运行时与第二条服务链路；其预览依赖外部 CDN（Tailwind Play CDN、unpkg、placehold.co）；iframe 采用同源 `allow-same-origin allow-scripts`，生成内容里的任意 JS 可执行；历史与版本存在 localStorage 的单个 markdown 字符串里。这些都与 Mokina 的本地离线、自包含 HTML、项目/版本/证据模型相冲突。

【建议】真正可取的只有两件事，且都可用 0.5–1 人日的 spike 完成，不引入任何 OpenUI 代码：
- 把 OpenUI 那段约 45 行的 HTML 生成提示词当作 A/B 基线，对照现有 image-to-code / 设计模板技能的产出质量；
- 把它"生成 → 点选 → 局部重写"的信息架构当交互参考，检验 Mokina 现有批注批量发送链路的时延与 token 成本是否需要优化。

【建议】如果真实目标是"产品内生成式 UI"，应评估同名的 **thesysdev/openui**（MIT、2026-10 仍活跃、以 OpenUI Lang 为中心的 full-stack 生成式 UI 框架、npm 包 `@openuidev/*`），而不是 wandb/openui。但在当前产品节奏下，这仍应排在 M2（专业方法与证据）和 M3（成果可持续操作）之后，用场景需求驱动，而不是先引技术。

---

## 0. 先澄清：两个同名的 OpenUI

| 项目 | 定位 | 活跃度（截至 2026-10-20） | 与本次问题关系 |
|---|---|---|---|
| **wandb/openui**（本文对象） | "Describe UI, see it rendered live"：prompt/图片 → 单文件 HTML 预览 → 点选标注后重生成 → 导出 JSX，可分享 | 22,631 stars / 2,058 forks / 89 open issues；main 最后提交 2026-06-30（renovate），最后产品代码改动 2025-05；无 release | 用户所贴链接；能力偏"个人 UI 草稿工具" |
| **thesysdev/openui** | 自述 "The Open Standard for Generative UI"：以 OpenUI Lang 为中心的 full-stack 生成式 UI 框架；框架无关内核 + React/Vue/Svelte/Angular 运行时，npm 包 `@openuidev/*`，含组件库、从组件库生成提示词、流式渲染器、browser bundle | 12,369 stars / 836 forks / 169 open issues；pushed 2026-10-19；MIT；TypeScript | 若目标是"产品内生成式 UI"，这才是对标物；本文第 6 节给初步判断 |

【事实】两者互不隶属，代码与产品形态完全不同。把 wandb/openui 当作"生成式 UI 框架"来评估会得出错误结论。

---

## 1. 【事实】wandb/openui 是什么

### 1.1 产品闭环

Prompt（可带参考图）→ 流式生成 → 前端把增量 markdown 里的 HTML 块实时塞进 iframe → 结束后成为历史中的一个"版本章节" → 点选元素写批注 → 再次 refine → 导出 JSX / 分享只读链接（读取 JSON 后按同一渲染管线重放）。核心 UI 表面：Chat、History 侧栏、Versions 缩略图、HtmlAnnotator（主预览 + 主题/暗色/设备宽度）、Monaco 代码面板、Settings（模型/温度/系统提示词）、ShareDialog。

### 1.2 技术栈与规模

| 维度 | 事实 | 证据 |
|---|---|---|
| 前端 | React 18.3.1、Vite 5.4.18、Tailwind 3.4.17（CDN 注入）、jotai 2.12、Radix UI、Monaco；约 10,024 行 TS/TSX | `frontend/package.json` |
| 后端 | FastAPI 单文件应用 `server.py` 634 行；核心代理/存储约 1.3k 行 Python；Peewee + SQLite（WAL） | `backend/openui/server.py`、`backend/openui/db/models.py` |
| 模型接入 | 按模型名前缀分派 OpenAI / Groq / LiteLLM / Ollama / dummy；SSE 输出 OpenAI ChatCompletionChunk | `server.py:134-208`、`backend/openui/openai.py:18-26` |
| 系统提示词 | 不在后端，在前端常量 `api/openai.ts:32-77`，Settings 可改并持久化到 localStorage | `frontend/src/api/openai.ts:32`、`state/atoms/prompts.ts:7` |
| 输出约束 | Tailwind 工具类、body-only、`placehold.co` 占位图、禁内联 SVG、明暗双模、shadcn CSS 变量；无 Tailwind 版本号约束 | `api/openai.ts:32-85` |
| 渲染方式 | 同源固定 URL iframe（`/openui/index.html`）+ postMessage 注入 innerHTML，不是 srcDoc | `HtmlAnnotator.tsx:96-98,360`、`VersionPreview.tsx:133-145` |
| 状态/版本 | 单个 markdown 字符串按 `---` 分章；localStorage + IndexedDB，超 4MB 丢历史 | `lib/markdown.ts:12-14`、`state/atoms/history.ts:338-359` |
| 后端端点 | `/v1/chat/completions`（+别名）、`/v1/login`、`/v1/callback`、`/v1/share/{id}`(GET/POST)、`/v1/vote`、`/v1/models`、`/v1/session`(GET/DELETE)、SPA 兜底；**没有** `/v1/edit`、`/v1/screenshot`（编辑与截图都在前端完成） | `server.py:107-208,301-391,430-573` |
| 数据表 | User / Credential / Session / Component / Vote / Usage / SchemaMigration | `backend/openui/db/models.py:40-86` |
| 分享存储 | S3（boto3 + gzip JSON），无本地回退 | `backend/openui/util/storage.py:6-23` |
| 部署 | `pip install .` + `python -m openui`；Docker；本地环境自动建 session，无需 OAuth | `backend/README.md`、`server.py:455-491` |
| 许可 | Apache-2.0（根/前端/后端目录一致；`frontend/package.json` 写 MIT 但 LICENSE 文件为 Apache-2.0） | `LICENSE`、`frontend/LICENSE`、`backend/LICENSE` |
| 测试 | 前端 2 个 vitest 文件 + 1 个 Playwright spec（依赖假模型/ docker webServer）；后端测试为脚手架残留 | `frontend/integration_tests/basic.spec.ts`、`backend/tests/test_openui.py` |
| 发布 | 0 tag、0 release；PyPI 包 `wandb-openui` 的发布 workflow 需 release 触发，从未发布；npm 无官方包（`frontend` 为 `private: true`） | `api.github.com/repos/wandb/openui/releases`（2026-10-20）、`frontend/package.json:4` |

### 1.3 它真正独特的地方

【事实】不是"生成 HTML"，而是"生成 → 点选 → 局部重写"的锚点协议：iframe 内用 `theroomjs` 拾取元素，提交时把评论文本写成 HTML 注释节点插到目标元素前（`document.createComment("FIX (n): text")`），将整个 innerHTML 回传父窗口；下一轮 refine 时用正则探测 `<!--FIX (n): ...-->`，命中就把用户输入替换为 "Address the FIX comments."，整文件回灌给模型（`public/annotator/index.html:470-483`、`api/openai.ts:146-152`）。

【事实】该协议很弱：批注是自然语言注释而非选择器/AST，改哪里、改多少不可控；`fixHTML` 还会用正则删除全部注释，FIX 只存活一轮，不可审计、不可重放。

### 1.4 成熟度与可用性风险

- 【事实】产品代码停在 2025-05；2025-09 的两次提交只改 `.devcontainer`；2026-06 四次提交全是 renovate/security。无 tag/release，`pyproject` 仍写 0.5.0。
- 【事实】demo `openui.fly.dev` 自 2025-11-05 起有 issue #250 报告不可用，至今仍 open（5 个 eyes 表情）。
- 【事实】`peewee>=3.0.0` 未锁版本；当解析到 peewee 4 时 `python -m openui` 启动即 ImportError（`SqliteExtDatabase` 已移除）；社区修复 PR #268（2026-10-09）仍 open、未合并。
- 【推断】它的定位只能是"设计参考 + 可拷贝的单文件标注器"，不能作为依赖。

---

## 2. 【事实】Mokina 侧的相邻能力（为什么重叠）

| 能力 | Mokina 现状 | 证据 |
|---|---|---|
| 成果类型 | `ArtifactKind` 9 类：html / deck / react-component / markdown-document / svg / diagram / code-snippet / mini-app / design-system；导出 html/pdf/zip/jsx/md/svg/txt。kind 是 contracts、web types、web manifest、daemon manifest 四处硬编码白名单，新增一种必须一次改齐 | `open-design/packages/contracts/src/api/artifacts.ts:3-22`、`apps/daemon/src/artifacts/manifest.ts:22` |
| 成果落盘与版本 | agent 调 MCP `create_artifact` 写入口文件 + 同名 `.artifact.json` sidecar；版本在项目 `.file-versions/manifest.json`，带 `source=ai|manual|restore` 与 contentDigest；`ARTIFACTS_DIR` 不是成果库 | `apps/daemon/src/mcp.ts:572`、`apps/daemon/src/run-artifact-fs.ts:43`、`apps/daemon/src/project-file-versions.ts:22` |
| 预览与编辑桥 | FileViewer 默认 url-load iframe（`/api/projects/:id/raw/*`），需注入桥时退 srcDoc；桥包括 deck、comment、inspect、edit、tweaks、palette、draw、snapshot；另有 `/powered/*` 跨源隔离预览。比 OpenUI 单一标注器更完整 | `apps/web/src/components/file-viewer-render-mode.ts:4-60`、`apps/web/src/runtime/srcdoc.ts:3169`、`apps/daemon/src/routes/project/index.ts:7014` |
| GenUI 协议层（半成品） | 插件 manifest 可预声明 `od.genui.surfaces[]`（form/choice/confirmation/oauth-prompt 四种 + JSON Schema），带 run/conversation/project 级持久化、daemon 路由、`od ui` 命令与 AG-UI 投影；但 `GenUISurfaceRenderer` / `GenUIInbox` 目前只被测试引用，**未挂载到运行中的 Web UI** | `packages/contracts/src/plugins/manifest.ts:89-129`、`apps/daemon/src/routes/genui.ts:47`、`apps/web/src/components/GenUISurfaceRenderer.tsx:73` |
| 直连 LLM 流式 artifact | 已有 BYOK/API fallback 的流式 `<artifact>` 通道：边收边解析边渲染，是最接近 OpenUI 的现有实现 | `apps/web/src/artifacts/parser.ts:1-10`、`apps/web/src/components/ProjectView.tsx:22` |
| 结构化批注 | 批注快照含 selector、position、currentText、computedStyle、screenshotPath、框选/圈选/多元素组（pod）、图片附件；批量发送到 agent 会话，由 agent 结合项目上下文修订 | `apps/web/src/comments.ts:630-710`、`components/comment-send-result.ts`、`FileViewer.tsx:5924` |
| 手动编辑 | ManualEditPanel + edit-mode bridge：源码路径映射、元素选择遮罩、对齐辅助线、文本/链接/图片/容器/token 编辑 | `apps/web/src/edit-mode/bridge.ts`、`components/ManualEditPanel.tsx` |
| 生成技能 | 163 个 skill 目录，含完整 image-to-code（参考图 → 前端实现）技能；114 个 design-template 目录（dashboard、docs-page、blog-post 等单文件 HTML 模板） | `open-design/skills/image-to-code-skill/SKILL.md:1-30`、`skills/`、`design-templates/` |
| 模型接入 | 17 个 provider 适配文件（openai-compatible、anthropic-compatible、ollama、azure、google、api-proxy 等）与 agent runtime 体系 | `apps/web/src/providers/` |
| 版本/证据 | 项目、artifact 版本、候选/采用、导出、恢复包、来源冻结（M5 网页证据回执） | `docs/mokina-m5-2026-10-14/verification.md` |
| 技术栈 | Next 16.3.6、React 18.3.1、Tailwind 4.3（postcss）、Node ~24、pnpm 10.33.2；daemon 为 Express 5 + better-sqlite3 | `open-design/apps/web/package.json`、根 `package.json` |

【推断】OpenUI 与 Mokina 的重叠是"生成单文件 HTML + 预览 + 改一改"。差异只在于 OpenUI 是独立小工具、Mokina 是带方法论/证据/版本的成果工作台；前者是后者的一个子集，且实现更浅。

---

## 3. 四种"结合"方式与判定

| 方式 | 做法 | 增量价值 | 成本/风险（推断） | 判定 |
|---|---|---|---|---|
| **A. 作为运行时依赖内嵌** | 在 Electron 包里带 Python + 启动 OpenUI 服务，Mokina 调其 API | 几乎没有：生成能力已被 agent + skills 覆盖 | 5–10 人日；新增 Python 运行时、第二条服务、鉴权/存储/端口、签名与更新复杂度；上游已停更 | 【建议】不做 |
| **B. 复用前端组件/代码** | 拷 annotator iframe、提示词、markdown 解析进 apps/web | 标注器与提示词；但样式体系（Tailwind 3 CDN）与 CSS Modules/Tailwind 4 冲突 | 3–5 人日；需重写状态层、iframe 地址逻辑、SSR/worker 适配；安全模型不同 | 【建议】不做；只抄提示词 |
| **C. 吸收交互/提示词做 spike** | 用其提示词做 A/B；用其 FIX 聚合思路对照现有批注批量发送 | 可能改善单次 HTML 质量与批注时延 | 0.5–1 人日；无生产风险 | 【建议】可做，见第 5 节 |
| **D. 内部设计/研发工具** | 本地跑 OpenUI，用于探索版式，导出 HTML 再改造成 design-template | 快速试错，但不比直接用 Mokina 自己的生成/预览/编辑链路更强 | 0.5 人日；不进入产品依赖 | 【建议】可选，价值有限 |

---

## 4. 【推断】为什么整体判定为"低结合价值"

1. **能力是子集**：Mokina 已有同类的生成、预览、批注、手动编辑、导出，甚至已有半成品的 GenUI 协议层（插件预声明 surface、daemon 路由与持久化，Web 渲染组件未挂载）和 BYOK 流式 artifact 通道；OpenUI 没有版本/证据/项目/方法论，而这些正是 Mokina 的差异点。
2. **架构冲突**：Python 运行时不在当前包内；OpenUI 的会话/版本是"一个 markdown 字符串 + localStorage"，Mokina 是项目制 artifact + 版本 + 证据链，直接集成等于重写 OpenUI 的状态层，只剩提示词可留。
3. **交付形态冲突**：OpenUI 输出强依赖 Tailwind Play CDN、unpkg、placehold.co；Mokina 的成果要求离线可开、自包含、品牌/设计系统约束，二者默认产物不兼容。
4. **安全模型冲突**：OpenUI 预览 iframe 为同源 `allow-same-origin allow-scripts`，模型生成的任意 JS 可执行且可触达外部 CDN；Mokina 的预览沙箱与注入守卫是刻意收紧的，倒向 OpenUI 是退步。
5. **维护风险**：0 release、产品代码最后实质改动停在 2025-05（超过一年）、测试失效、安装漂移；作为依赖意味着替上游维护 Python 后端。
6. **产品纪律**：当前路线图明确"不新建 Agent 引擎""不扩成任意 HTML 编辑器"，近期重点是 M2 专业方法与证据、M3 成果可持续操作；此时引入新生成引擎不符合既有范围。

---

## 5. 【建议】真正可做的小事（不引入 OpenUI 代码）

### 5.1 提示词 A/B（约 1 人日）

把 OpenUI 的系统提示词骨架（body-only、禁内联 SVG、占位图约定、明暗双模、shadcn token 命名）与现有 `image-to-code` / 设计模板技能的提示词做同任务对照：同一份参考图与 brief，比较首版 HTML 的可读性、品牌一致性、修订轮数。若 OpenUI 骨架在某类任务（如单屏 dashboard/landing 草稿）更稳，吸收进技能文本，不引入实现。

### 5.2 批注链路对照（约 0.5–1 人日）

用同一张 HTML 成果，对比两种路径的时延、token 与 diff 局部性：
- 现状：结构化批注批量发送 → agent 结合项目上下文修订（Mokina）；
- OpenUI 式：整文件回灌 + "Address the FIX comments" 单轮重写。
预期结论：现状在可审计性/上下文上更好；若发现小改动的时延明显偏高，再考虑给"纯样式微调"加一条更轻的快速路径（仍在现有 agent/runtime 内，不引入 OpenUI）。

### 5.3 如果真要做生成式 UI：先走已有通道

【建议】品牌/产品的"生成式 UI"需求若成立，优先顺序应是：

1. **先挂载已有 GenUI surface 通道**：`GenUISurfaceRenderer` / `GenUIInbox` 与现成 daemon 路由、持久化事件已经存在，只差 Web 挂载与验收；成本低于引入任何外部框架。
2. **再考虑只引 `@openuidev/lang-core`**（零 React 依赖）做"受控 UI DSL"的封闭试验，验证模型按白名单组件输出是否比自由 HTML 更稳；不进入产品。
3. **最后才评估 `browser-bundle` + iframe**：可沿用现有沙箱，但要接受约 900 KB gzip、自定义组件库重打与无静态 HTML 导出。

【推断】若要新增"生成式 UI 产物"为正式 artifact kind，接入成本不在模型侧，而在 Mokina 既有约束：artifact kind 是 contracts/web types/web manifest/daemon manifest 四处白名单 + FileViewer 分派；任何 UI 能力还要有 `od` CLI 等价物；prompt 有 daemon 与 contracts/BYOK 两套实现且 OD Next 在函数首行分流，DSL 指令必须双写并覆盖两条路径。

### 5.4 明确不做的清单

- 不把 Python/OpenUI 服务打包进 macOS 应用；
- 不 fork OpenUI 前后端；
- 不引入依赖 CDN 的预览/交付路径；
- 不用 OpenUI 的会话/版本模型替换项目制 artifact 与证据体系；
- 不为"追新"新增生成引擎——若要做生成式 UI，先给场景与验收标准。

---

## 6. 如果目标其实是"产品内生成式 UI"

### 6.1 thesysdev/openui 是什么（原文核查）

【事实】它与 wandb/openui 是两套完全不同的项目：

- 自述 "a full-stack, framework-agnostic Generative UI framework built around a compact, streaming-first language"；核心是 **OpenUI Lang**：一行一条 `name = Component(args)`，参数按组件 Zod schema 的位置顺序，可前向引用，支持表达式、`$` 响应式状态与 `Query/Mutation`。
- 与"模型直接吐 HTML/JSX"的本质差别：模型只能在宿主注册的组件白名单里组合，不执行任意代码；解析器逐 chunk 重算，半截输出也能渲染；坏语句按最小粒度丢弃并回传结构化错误；点击、表单、查询在浏览器执行，不回模型。
- 包形态（npm，运行时而非独立服务）：`@openuidev/lang-core`（框架无关解析 + prompt 生成）、`@openuidev/react-lang`（React 渲染核心）、`react-ui`（聊天壳 + 组件库）、`react-headless`、`browser-bundle`（iframe/CDN 嵌入）等；另有 Vue/Svelte/Angular 运行时与 `assistant-ui`/A2UI 适配。
- 能力面：`openuiLibrary` 约 82 个注册项，覆盖布局（Stack/Tabs/Accordion/Modal）、内容（Card/Markdown/ImageGallery/CodeBlock）、表格（Table/EditableTable）、图表（Bar/Line/Area/Pie/Radar/Scatter）、表单族（Input/Select/DatePicker/Slider/Checkbox/Radio/Switch/Chips/OptionCards + 校验）；主题经 `--openui-*` CSS 变量注入，可用 `defineComponent` + `library.extend()` 扩展。
- 许可与节奏：MIT；2026-10-12 发 1.0、10-15 发 1.0.1，2026-10-19 仍在 push；160 个测试文件、54 组 1.0 一致性用例；官方有 Agent Skill 与 playground。

### 6.2 集成约束（对 Mokina 这种宿主）

| 维度 | 事实 | 对 Mokina 的含义（推断） |
|---|---|---|
| React 版本 | peer `^18.3.1 || ^19.0.0`；官方 Next 模板与示例均为 Next 16 + React 19.2.3，CI 解析到 19 | 声明上兼容 Mokina 的 React 18.3.1，但 18 组合无官方覆盖，需自测 |
| Next App Router | 官方用法是在自有 `"use client"` 组件内放 `<Renderer>`，无 Server Component 用法 | SSR 需自测；对 Mokina 的 CSR 工作台风险可控 |
| 体积/依赖 | `react-ui` 解包约 16.1 MB、34 个运行时依赖（Radix、d3、react-markdown、syntax-highlighter、tanstack-table），CSS 约 896 KB；peer 另需 `zod ^3.25||^4`、`zustand ^4.5.5` | 宿主当前无 zod/zustand 直接依赖；引入会增大 web bundle 与依赖面 |
| 样式 | 预编译 CSS、`.openui-*` 类名与 `--openui-*` 变量，无全局 reset、无外链字体、不依赖 Tailwind | 与 Mokina CSS Modules + Tailwind 4 可共存，但要吃掉一套 token/视觉 |
| 数据/交互 | `onAction(ActionEvent)`、`onStateUpdate`、`initialState`、`toolProvider`（函数表或 MCP client）；Thesys Gateway/Autofix 为可选商业云 | 可接 Mokina 的 daemon API/MCP；云能力非必需 |
| 导出 | 没有官方"OpenUI → 静态 HTML"导出；成文路径只有 React Email + `@react-email/render`，或把 HTML 塞进自定义组件走沙箱 iframe | 不能直接产出 Mokina 现有的单文件 HTML 交付物 |
| 风险 | 安装期遥测默认开；内部包 peer 窗口窄（react-ui 0.18 ↔ react-lang 1.0 ↔ headless 0.14–0.19）需锁步升级；169 个 open issue | 需固定版本、关遥测、规划升级 |

### 6.3 对 Mokina 的适用性判断

【推断】它的适用面是"生成后仍要持续交互/拉数/保状态的嵌入式 UI"（卡片、表单、轻量仪表盘、CRUD），不是"一次性、可归档、可离线打开的营销 HTML 交付物"。

- **可直接尝试（最低成本）**：只引 `@openuidev/lang-core`（零 React 依赖）验证"受控 UI DSL + 从组件库生成提示词"是否比现有自由 HTML 更稳；不进入产品。
- **需改造才能用**：在 iframe 里用 `browser-bundle` 可沿用现有沙箱（约 900 KB gzip），事件走 postMessage 桥；但只带 chat 库、自定义组件库需自行重打，且导出 HTML 无官方能力。
- **不建议**：替换"agent 写 HTML → 版本化 → iframe 预览"主链路。产物形态不同（交付物 vs 应用内 UI），React 18 组合无官方背书，还会新增 zod/zustand 与近 900 KB CSS；对当前 M2/M3 目标没有直接帮助。
- **更近的替代**：Mokina 已有半成品 GenUI surface 协议（插件 manifest + daemon 路由 + 持久化，Web 渲染组件仅测试引用）与 BYOK 流式 `<artifact>` 通道；若目标只是"聊天内可控交互 UI"，先把已有通道挂载验收，比引入 OpenUI Lang 更省。

【建议】若确有兴趣，先开一个"生成式 UI 场景定义"小任务：限定 1–2 个具体界面（例如成果质量面板的交互卡、活动页配置表单），明确输入/交互/数据绑定/验收标准，再比较"自研 React 组件"与"`react-lang`/`browser-bundle`"的成本与锁定风险。

---

## 7. 若仍要集成：风险清单

| 风险 | 说明 | 缓解 |
|---|---|---|
| 维护/供应链 | 上游停更、无 release、测试失效、依赖漂移 | 只抄代码不引依赖；固定 commit |
| 运行时 | 增加 Python 3.9+ 与第二条服务 | 放弃（本评估建议）；或改为重新实现 200 行 Node 代理 |
| 网络依赖 | Tailwind Play CDN、unpkg、placehold.co | 必须离线化，等于重写渲染壳 |
| 安全 | 同源 iframe + `allow-scripts`，生成 JS 可执行 | 改用 Mokina 现有沙箱与注入守卫 |
| 数据/版本 | localStorage 单字符串、4MB 上限 | 映射到项目 artifact/版本体系需重写 |
| 品牌一致性 | 默认 shadcn/Tailwind 视觉，无设计系统约束 | 用 Mokina design-system/DESIGN.md 约束提示词 |
| 接入成本 | 新 artifact kind 要改四处白名单 + renderer 分派；新能力要补 `od` CLI 与 19 语言文案；prompt 有 daemon 与 BYOK 两套实现 | 先按现有 artifact/GenUI 通道承载，不新增 kind |
| 许可 | Apache-2.0（兼容），但 `package.json` 标 MIT 不一致 | 按 Apache-2.0 处理，保留 NOTICE/版权 |

---

## 8. 需要确认的三个问题

1. 你说的"结合"是**产品能力**（Mokina 内可用），还是**研发/设计工作流**（团队拿它当工具）？
2. 目标是"**生成 UI 本身**"（组件/界面草稿），还是"**让营销成果的呈现更好**"（落地页、报告、活动页）？
3. 是否接受为它引入第二条服务链路与 Python 运行时？（若不接受，本文结论已可直接采用）

---

## 附录 A：证据与访问时间

### 本地代码（原文，2026-10-20 读取）

- `open-design/packages/contracts/src/api/artifacts.ts:3-22`（artifact 类型/导出类型）
- `open-design/apps/web/src/components/file-viewer-render-mode.ts:4-60`（预览桥列表）
- `open-design/apps/web/src/comments.ts:630-710`（结构化批注内容）
- `open-design/apps/web/src/components/comment-send-result.ts`（批量发送结果）
- `open-design/apps/web/src/edit-mode/bridge.ts`、`components/ManualEditPanel.tsx`（手动编辑）
- `open-design/apps/web/src/artifacts/renderer-registry.ts:33-40`（HtmlRenderer `supportsStreaming: false`）
- `open-design/skills/image-to-code-skill/SKILL.md:1-30`（image-to-code 技能）
- `open-design/apps/daemon/src/mcp.ts:572`、`run-artifact-fs.ts:43`、`project-file-versions.ts:22`（create_artifact / sidecar / 版本清单）
- `open-design/packages/contracts/src/plugins/manifest.ts:89-129`、`apps/daemon/src/routes/genui.ts:47`、`apps/web/src/components/GenUISurfaceRenderer.tsx:73`（GenUI surface 协议层与未挂载的 Web 组件）
- `open-design/apps/web/src/artifacts/parser.ts:1-10`、`apps/web/src/components/ProjectView.tsx:22`（BYOK 流式 artifact 通道）
- `open-design/apps/web/package.json`、根 `package.json`（Next 16.3.6 / React 18.3.1 / Tailwind 4.3.0 / Node ~24）
- `open-design/LICENSE`（Apache-2.0）
- `docs/plans/mokina-terminal-roadmap-2026-10-11.md`（M2/M3 范围；"不新建 Agent 引擎"）
- `docs/mokina-m5-2026-10-14/verification.md`（当前成果/证据状态）

### OpenUI 仓库（原文，2026-10-20 18:20–18:55 +08:00）

- README：https://raw.githubusercontent.com/wandb/openui/main/README.md
- 仓库元数据：https://api.github.com/repos/wandb/openui（stars/forks/license/pushed_at）
- 提交历史：https://api.github.com/repos/wandb/openui/commits?per_page=15
- Releases：https://api.github.com/repos/wandb/openui/releases（返回 `[]`）
- Demo 不可用 issue：https://api.github.com/repos/wandb/openui/issues/250（2025-11-05 创建，2026-10-20 仍 open）
- peewee 4 启动失败的修复 PR：https://api.github.com/repos/wandb/openui/pulls/268（2026-10-09，open，未合并）
- 本地克隆：`/tmp/openui-inspect`，HEAD `42d7ab4`（2026-06-30）；关键文件：`backend/openui/server.py`、`frontend/src/api/openai.ts`、`frontend/public/annotator/index.html`、`frontend/src/components/HtmlAnnotator.tsx`、`frontend/src/components/VersionPreview.tsx`
- 同名项目：https://api.github.com/repos/thesysdev/openui（MIT / 12,369 stars / pushed 2026-10-19）；README：https://raw.githubusercontent.com/thesysdev/openui/main/README.md（2026-10-20 18:52 +08:00 原文抓取）

### 关键原文摘录（原文，含访问时间）

- README（2026-10-20 18:21 +08:00）：「OpenUI let's you describe UI using your imagination, then see it rendered live... It's like v0 but open source and not as polished」；支持 OpenAI / Groq / Gemini / Anthropic / Cohere / Mistral / Ollama / LiteLLM。
- 系统提示词（`frontend/src/api/openai.ts:32-77`，本地原文）：「Your mission is to transform detailed descriptions or compelling images into stunning HTML using the versatility of TailwindCSS」「Only implement elements within the `<body>` tag」「Utilize placehold.co for placeholder images」「Avoid using SVGs directly」。
- 批注协议（`frontend/public/annotator/index.html:470-483`，本地原文）：把评论文本写成 `FIX (n): text` 注释节点插到目标元素前，再回传整个 `wrapper.innerHTML`。
- GitHub issue #250（2026-10-20 18:47 +08:00 抓取原文）：「https://openui.fly.dev/ is down - is that expected?」，2025-11-05 创建，state=open。
- GitHub PR #268（2026-10-20 18:48 +08:00 抓取原文）：「python -m openui fails at startup with ImportError: cannot import name 'SqliteExtDatabase'... when the install resolves peewee 4.0.1 or newer」，2026-10-09 创建，open，未合并。

### thesysdev/openui（原文，2026-10-20 18:40–18:55 +08:00 抓取）

- README：https://raw.githubusercontent.com/thesysdev/openui/main/README.md
- OpenUI Lang 规范：https://github.com/thesysdev/openui/blob/main/spec/overview.md
- 接入文档：https://github.com/thesysdev/openui/blob/main/docs/content/docs/getting-started.mdx
- Renderer/交互/遥测：`docs/content/docs/openui-lang/renderer.mdx`、`interactivity.mdx`、`telemetry.mdx`（同仓库）
- 组件库：`packages/react-ui/src/genui-lib/openuiLibrary.tsx`
- iframe 嵌入：`packages/browser-bundle/README.md`
- 仓库元数据：https://api.github.com/repos/thesysdev/openui（MIT / 12,369 stars / pushed 2026-10-19）

### 检索摘要（非原文，仅用于定位）

- 中文技术文章《UI 新革命？GenUI、WanDB-OpenUI、thesysdev-OpenUI、A2UI、AG-UI、MCP-UI》用于确认两个 OpenUI 同名项目并存，未采用其结论作为证据。

## 附录 B：方法与局限

- 结论基于代码与公开数据的只读核查，未在 Mokina 内实际接入 OpenUI 做端到端试验；涉及工作量与人日的判断为推断。
- Mokina 当前工作树存在本轮之前的历史未提交改动（README/AGENTS/.gitignore 与 output），本评估未修改这些文件，只新增本文档。
- OpenUI 上游已停更，本文不判断其历史设计价值，只判断"作为 Mokina 依赖/引擎"的适用性。
