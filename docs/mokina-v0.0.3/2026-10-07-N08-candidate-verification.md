# N08｜V0.0.3 候选包连续使用与升级验收

日期：2026-10-06 ～ 2026-10-07
候选包：**0.0.3-local.1**（macOS arm64）
性质：工程验收记录。营销专业评语另行执行，不在本文件下结论。

## 1. 候选包身份（N08-AC04）

| 项 | 值 |
|---|---|
| 源码 SHA | `d68028e33d9e246c640f35ddc7d922d8383e99e6`（main，PR #5–#9 全部合入后） |
| 构建命令 | `pnpm tools-pack mac build --dir .tmp/mokina-v03-pack --namespace mokina-local --portable --to all --app-version 0.0.3-local.1 --json`（前置：`OD_WEB_OUTPUT_MODE=standalone pnpm --filter @open-design/web build`、`pnpm --filter @open-design/tools-pack build`，Node 24.15.0） |
| DMG | `Mokina-mokina-local.dmg`，408,080,854 B，sha256 `4519c17d9acf821712ffefe15e776c8382c6da563a7b19e0bcb197a8449f5ab0` |
| ZIP | `Mokina-mokina-local.zip`，405,123,565 B，sha256 `0ce27ae4b8fa82c01e020d4b610540b36d3f0259ef663955f0865c81eb57c8fc` |
| 包内版本 | Info.plist `CFBundleShortVersionString=0.0.3-local.1`；`open-design-config.json` `appVersion=0.0.3-local.1`、`productName=Mokina`、`bundleIdentifier=ai.mainquest.mokina.preview` |
| 交付副本 | `/Users/dingcheng/Mokina-PR4-QA/releases/0.0.3-local.1/`（dmg + zip + artifact-manifest.json） |

与 local.6 的关系：local.6（0.0.2-local.6，源码 `8950986e`）保持原位归档，原安装 bundle 保留为 `Mokina-0.0.2-local.6.bak.app`；V0.0.2 标签与既有签收记录不变。artifact-manifest.json 无生成器，按 local.6 同格式手工组装，sha256 为 `shasum -a 256` 实测。

## 2. 升级核验（N08-AC02 / AC03）

升级方式：0.0.3-local.1 原位替换 0.0.2-local.6 安装 bundle，数据目录不动（`~/Library/Application Support/Mokina/namespaces/mokina-local/`）。升级前完整备份：`/tmp/mokina-local6-data-pre-v03-backup-202610062126.tar.gz`（6.2MB）。

文件级比对（升级后 vs 备份）：

- 18/18 旧项目目录完整在位；
- 4/4 `MOKINA-CONTINUATION.json` sha256 逐字节一致；
- 2/2 `.mokina-recovery-import.json` 恢复包 sha256 逐字节一致（原恢复包保留 ✓）；
- `app-config.json` 关键字段不变（onboardingCompleted、designSystemId、telemetry 全关）。

UI 级核验：升级后首次启动直进首页（onboarding 状态保留），最近项目列表完整，旧项目可打开、历史版本与「1 个待采用候选」标识可见可开（证据 00–03）。

## 3. 三条代表任务实测（N08-AC01）

全程 GUI 操作（kimi-cu 驱动），真实 Codex CLI 运行。**核心流程临时终端/API 修复次数 = 0**。

### 任务 A：营销方案 + 约束变化 + 单章修订 —— 通过

| 步骤 | 结果 | run 耗时 |
|---|---|---|
| 首页输入目标（精品咖啡豆上市方案，5 万/4 周）+ 运行 | 新建项目，模型反问 3 项澄清卡正常作答 | run1 ≈ 4m20s |
| 方案产出 | v1：50,000 元 / 28 天 / 500 新客 / 1 家主店 | run2 ≈ 29m53s |
| 运行依据（N03） | 「资料与背景（随本次发送提交）」展开可见品牌来源、素材清单、冻结快照区 | — |
| 约束变化（50 万/12 周） | v2：500,000 元 / 84 天 / 7,000 新客 / 1+1 店；量级渠道目标全面随约束变化 | run3 ≈ 23m24s |
| 单章修订 budget | 候选 → 比较（仅 budget 章节变化，其余 830,623 字符字节一致）→ 采用，v3 成为当前稿 | 候选 run ≈ 10–12m |

素材预选一步未完成，原因见「缺陷复核 D1」。

### 任务 B：方案 → 活动页接续 + 导出 —— 通过

| 步骤 | 结果 |
|---|---|
| v3 勾选策略章节 + 咖啡豆主视觉素材（补使用说明）+ 品牌规则，创建接续项目（不发送） | 草稿创建成功 |
| 草稿核对 MOKINA 上下文 | 来源版本 v3、章节、素材（546.3KB 已携带）、品牌全部固定，无需重传 |
| 发送生成 | `coffee-campaign.html`（771KB 自包含，首屏内嵌选定主视觉），另自动追加一次复查 run（未改页面） |
| 导出 | 菜单四项齐全（PDF/图片/zip/独立 HTML），均正确弹出 macOS 原生保存框；保存按钮无法被驱动点击（见驱动限制），导出文件未落盘 |

### 任务 C：开放式数据分析 + 只讨论抽测 —— 通过（补测）

原生打开面板无法被驱动（见驱动限制），CSV 以消息内联方式提交（9 行数据不变）。python 独立预复算对照：

- 各月总额 69,000 / 82,000 / 88,000 ✓；合计 239,000 ✓
- 月度增速 5 月 18.84%、6 月 7.32% ✓
- 天猫 4 月占比 60.87%、6 月 46.59% ✓；环比 5 月 +9.52%、6 月 −10.87% ✓
- 回答区分「数据结论」与「待验证假设」，明确「仅凭 9 条记录无法确认」原因 ✓（推断未冒充事实）
- 只讨论抽测：发送「先不要生成任何文件，讨论最值得警惕的点」→ 纯文字回复，右栏未生成任何文件 ✓（N02-AC02 保持）

### 退出重开

两次完整退出重开：任务 A 期间一次（首页草稿完整保留）、任务 B 后一次（接续项目可见、`coffee-campaign.html` 渲染正确）。

## 4. 缺陷复核（对 subagent 实测报告的再核验）

实测报告初列 4 个缺陷，主 agent 复核后修正如下：

- **D1「首页资料入口路由错误」→ 误报，撤销。** 「资料与背景」按钮跳转「设计体系」页是既有设计行为（`HomeView.tsx:3122-3138`，B1 入口决策，注释明确「只做真实入口」）。「添加 → 引用其它项目」经主 agent 在候选包上重新实测：**正确弹出项目引用弹窗**（证据 29），未跳转。原记录系驱动点击落点漂移误触。任务 A 素材预选受阻的真实原因是原生打开面板不可驱动（驱动限制），不是产品路由缺陷。
- **D2（中，保留）**：接续项目首次打开卡「正在加载工作区…」>5 分钟，重开 app 后秒开（1/1 复现）。建议后续切片定位。
- **D3（轻微，保留）**：成果预览偶发白屏，重开后正常。
- **D4（轻微，保留）**：Web 内容 AX 树间歇坍缩（element_count 掉到 14），影响自动化可测性，不影响真实用户；重开 app 亦未恢复。

UI 文案/交互建议（不阻塞，照录）：zip 文件名含「·」；接续草稿预填指令可能多引入一轮澄清（实际出现一次）；接续项目初始名「未命名」难区分。

## 5. 驱动限制（不计入 app 缺陷，均 0 绕过）

- macOS 原生打开/保存面板：kimi-cu 0.5.11 无法可靠点击或键入（点击不落地、Go To 字段取不到焦点；`osascript` System Events 无辅助访问权限 -25211）。影响三步：任务 A 素材附件、任务 B 导出保存落盘、任务 C CSV 文件上传。任务 C 改用消息内联数据完成；A/B 对应步骤按未完成记录。
- 并发 press_key 竞态丢键（实测两条长文本乱序），只能串行输入。
- type_text 在 AX 树坍缩期间对输入框注入不稳定。

## 6. CI 触发器补齐（N08 开发内容 4）

`.github/workflows/ci.yml` 增加 `push: branches: [main]` 触发器（原仅 pull_request / workflow_dispatch），使 main 合并提交直接留有验证记录；concurrency group 复用 `github.ref`，yaml 与 `git diff --check` 校验通过。

## 7. AC 对照

| AC | 结论 | 依据 |
|---|---|---|
| N08-AC01 三条任务 + 中途退出重开，临时终端/API 修复 0 次 | **通过** | §3，绕过次数 0（驱动限制导致的两步以未完成/替代路径记录，未修路） |
| N08-AC02 旧项目/候选/历史版本/快照/恢复包身份不漂移 | **通过** | §2 文件级 sha256 一致 + UI 级可见可开 |
| N08-AC03 保留原恢复包与包摘要 | **通过** | local.6 包、备份、bak bundle 全部保留；恢复包字节一致 |
| N08-AC04 SHA/摘要/测试/验收对应 | **通过** | §1 全部实测值 |

## 8. 未跑项与边界

- 任务 B 导出文件未实际落盘（原生保存框不可驱动）；导出菜单与对话框弹出行为已验证。
- 任务 C 的文件上传路径未走通（驱动限制），以消息内联同数据替代。
- 未跑全量 e2e 套件（PR #9 已跑受影响两文件 6/6）；桌面全量冒烟矩阵未跑。
- 支持范围仍为实测 macOS arm64；Windows/Linux、签名公证、自动更新均为非目标。
- 遥测保持关闭（非目标 5），未验证任何遥测路径。

## 9. 证据索引

`docs/mokina-v0.0.3/evidence/n08/`：REPORT.md（subagent 全程记录）、00–28 任务截图、29 D1 复核（引用弹窗正常）、30–32 任务 C 补测、sales.csv 用数。升级前数据备份与基线清单在 /tmp（易失），关键比对结果已落 §2。
