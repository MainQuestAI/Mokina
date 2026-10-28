# PR21 后续修复验证

本轮修复 PR21 审查发现的 4 项 P2、3 项 P3，保证网页资料中的数值、捕获回执、文件发布和失败恢复保持一致。以下记录来自 **2026-10-28 的本地验证**，基线为 `9cfb95bc7561185ffddf43ffbf93199b997d403d`，使用 Node **24.15.0**、pnpm **10.33.2**。新 PR 的提交身份与远程 CI 以 PR 检查为准；本记录不将原 PR21 的 CI 或本地检查作为新提交 CI。

## 修复与行为回归

| 问题 | 实际改善 | 对应回归 |
| --- | --- | --- |
| R1 · 表格数值粘连 | 相邻 `td/th` 保留文本边界，`2025` 与 `100` 不再变成 `2025100`；单元格内联文本保持连续。解析器标识为 `mokina-web/2`，不改历史来源。 | [公开页解析测试](../../open-design/apps/daemon/tests/public-web-page.test.ts)：压缩 HTML 的表头、数值、内联文本。 |
| R2 · CLI 损坏响应误报成功 | 损坏的 2xx 响应、缺字段和身份／摘要不符均以非零状态退出，提供同一操作的只读查询；合法空查询仍成功。CLI 与 Web 共用响应身份解析，各自校验实际字节摘要。 | [CLI 测试](../../open-design/apps/daemon/tests/mokina-web-cli.test.ts)：损坏响应、错身份、合法 `{result:null}`，且不自动重发 POST。 |
| R3 · 半成品写入无法恢复 | 原子独占发布失败时仅清理本次临时文件；保存好的来源版本仍可查询，恢复后补写同一版本，不重新抓取、不覆盖并发创建者。 | [捕获测试](../../open-design/apps/daemon/tests/mokina-web-evidence.test.ts)：EPERM／ENOTSUP、ENOSPC 故障注入、EEXIST 竞争和同操作恢复。 |
| R4 · 元数据损坏挡住普通资料 | 工作文件完好但清单 JSON／回执结构损坏时，仍可读取普通资料；不授予可信来源身份，版本完整性错误与真实 EIO 继续失败。 | [API 测试](../../open-design/apps/daemon/tests/mokina-web-api.test.ts)：两类清单损坏、普通资料降级、版本读取及 I/O 错误。 |
| R5 · 发送后误称未发送 | 已校验的文件、版本、摘要和操作身份保持可见；本地恢复标记失败显示真实状态，阻止新 POST，允许恢复后查询同一次操作。19 种语言补齐反馈。 | [组件测试](../../open-design/apps/web/tests/components/MokinaWebEvidence.test.tsx)、[浏览器测试](../../open-design/e2e/ui/mokina-web-evidence.test.ts)：失败反馈、一次 POST 加一次 GET、恢复记录 `unknown → saved`、身份不变。 |
| R6 · 地址校验误报过大 | 仅实际序列化 UTF-8 字节超限返回 413；小正文但最终 URL 非法返回读取失败，不放宽大小或地址限制。 | [公开页测试](../../open-design/apps/daemon/tests/public-web-page.test.ts)：超过 4096 字符的最终 URL 与小正文。 |
| R7 · 普通资料预设存在回执 | 普通网页格式资料使用中性描述；可信回执仍由来源版本记录决定，不能仅凭文档格式获得来源身份。 | [资料测试](../../open-design/apps/daemon/tests/mokina-materials.test.ts)：手工资料描述与来源身份。 |

R3 的边界：不支持硬链接原子独占创建的文件系统或权限环境会明确拒绝发布，返回 `ATOMIC_EXCLUSIVE_UNSUPPORTED`，不退回可能留下半个文件的直接写入。捕获接口返回 `500 WEB_CAPTURE_UNAVAILABLE`，已保存的版本仍可查询；环境恢复后可补写同一版本。本轮不声称所有 exFAT、SMB、FUSE 环境均可物化，也不会覆盖用户已修改的文件。

## 验证结果

先以新增回归确认旧实现失败，再检查修复。解析／文案组旧实现 3 项失败，修复后 25 项通过；CLI／资料边界组旧实现 11 项失败，修复后 20 项通过；原子发布专项旧实现 2 项失败，修复后 11 项通过；恢复反馈组件旧实现 3 项失败，修复后 14 项通过。这些专项属于以下汇总范围，不另行累加。

| 检查 | 本地结果 |
| --- | --- |
| `pnpm guard`、全仓 `pnpm typecheck`、`pnpm i18n:check` | PASS |
| contracts／packages、daemon、Web production 构建 | PASS |
| desktop 支持代码、tools-dev 构建 | PASS，用于恢复库与隔离运行环境 |
| 后端 10 个受影响测试文件 | **120/120 PASS**：公开页、捕获／API／CLI、资料、业务文件、版本证据、恢复包和完整性 |
| 前端与恢复库 3 个测试文件 | **42/42 PASS**：响应恢复、CAS、损坏草稿、取消、切换与持久化 |
| 原子发布／独占创建专项 | **11/11 PASS**，与后端 120 项重叠 |
| 新增浏览器回归运行于基线 | **2/2 按预期失败**：POST 已成功，旧反馈却称未发送 |
| 修复后受影响浏览器文件 | **4/4 PASS**：两种视口的 URL 草稿保护与响应后恢复 |
| `git diff --check` | PASS |

浏览器使用实际运行的 renderer、项目／会话 API 和隔离目录中的真实恢复库。网页捕获 POST／GET 使用同一固定响应，仅对响应后第一次 `saved` 镜像写入注入失败；断言操作 ID、文件、版本与摘要不变。证据覆盖界面和恢复库边界，**不覆盖原生 Electron IPC、重新访问真实外网或新安装包验收**；本轮未重跑模型任务。原生首次连接与专业人工签收继续单列。

## 同数据、同视口截图

PNG 的实际尺寸与下表一致，修复前后使用相同测试资料与故障条件。

| 实际视口 | 修复前故障态 | 修复后故障态 |
| --- | --- | --- |
| **1440×900** | [修复前](evidence/web-recovery-mirror-failure-1440-before.png) | [修复后](evidence/web-recovery-mirror-failure-1440-after.png) |
| **900×600** | [修复前](evidence/web-recovery-mirror-failure-900-before.png) | [修复后](evidence/web-recovery-mirror-failure-900-after.png) |

[900×600：同一次操作查询并恢复后的界面](evidence/web-recovery-reconciled-900-after.png)。小窗口中，已有固定底栏遮挡截图中的部分长内容；实际查询按钮操作与状态恢复测试通过。本轮未修改该布局，不将截图视为无遮挡布局验收。

本轮测试进程与隔离运行数据已清理，保留必要证据。未创建临时原生应用、挂载或 LaunchServices 注册；现用应用、用户数据与模型配置未改动。
