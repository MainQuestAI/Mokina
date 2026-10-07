# V0.0.3 修复实施与候选验证

日期：2026-10-07。用户明确授权实施 Repair-A → B → C → D1 → D2。

## 结论与身份

已实施输入准备、精确选区、会话作用范围、品牌竞态、依据读回和完整意图接续恢复，并把新增及相关回归纳入根 CI。以下结果不构成 V0.0.3 整体验收完成：真实品牌、专业结果与完整原生矩阵仍按实际验证状态单列。原卡加载/白屏经相关代码检查与定向回归仍未复现，按用户 2026-10-07 明确回复暂时跳过，不标为已修复。

| 身份 | 值 |
|---|---|
| base | `93531732e2e01e6bfdf5153f3685af4bf132f850` |
| 当前分支 | `codex/mokina-v003-repair-a-input`（A/B/C 顺序集成，未交叉覆盖） |
| 产品源码 | `0ed77171b07afcb4225252c4569ab4eb28196ceb` |
| 验证代码 SHA | `0ed77171b07afcb4225252c4569ab4eb28196ceb`（与候选产品源码相同） |
| 证据整理提交 | 本记录所在提交；仅 README、验证文档、合成输入与截图，不改运行代码或打包资源 |
| 核心修复提交 | `f5d484a40d400490720cf640ecd47def3e3843e5` |
| 品牌正文预算修复 | `97c157aaf38b211ab22f308f48d1f05c67361ae1` |
| CLI 协议验证及修复 | `4d3bfa59d03b246cf242db5622f72c745dee3de3` |
| 接续读回、来源呈现与条件清理 | `0ed77171b07afcb4225252c4569ab4eb28196ceb` |
| 候选 | `0.0.3-local.5`；local.2/local.3/local.4 仅为过程候选，不复用其原生验收 |
| CI | 根 `.github/workflows/ci.yml` 已更新；本轮未推送，远端 CI run 为未运行 |
| 支持边界 | 本机 macOS arm64；未签名、公证、公开发布、合并或创建 PR |

旧签收 `0.0.2-local.6` 的包源码 `8950986e41e5047c56aab4d3ba9fda900902aa9a` 与 V0.0.2 main/tag `e3e8848e` 保持原记录，不改写为新包证据。所有原有未跟踪资料、旧 worktree、旧应用和原数据保留。本轮没有删除旧分支或用户数据。

## 修复落点与用户变化

| 切片 / 发现 | 实施内容 | 验证出口 |
|---|---|---|
| A / F01 | 准备结果明确为 ready / needs-input；冻结、持久化绑定完成才放行。失败保留原请求和选择；选段文件不再隐式随普通附件整份发送；离开页面不自动抢导航 | 首页准备模块、ProjectView 门禁、真实 daemon 首页交接 E2E |
| A / F02 | File 添加时生成稳定 inputId；按上传次序匹配真实回执 path；撤销传播至计划与迟到回执；浏览器重开仅恢复元数据并要求重新选择字节 | 重名、路径、撤销、草稿持久化测试 |
| A / F03 | parserVersion 2 每段唯一 fragmentId；新客户端使用 fragments；服务端全量校验、去重按原文顺序拼接。预算共用 contracts，计入双换行和原始品牌正文；旧 groups 语义保留 | 精确输入真实 parser/store/HTTP 与边界回归 |
| B / F04 | pending v2 按 workspace/project/conversation/generation；桌面 CAS 为权威，缓存发布在同键队列内；非桌面路径必须有 Web Locks；受理后只消费调用方捕获身份 | 双会话、迟到 A/B、同 snapshot 新 generation、持久化冲突测试 |
| B / F06 | 目录、品牌详情和冻结绑定身份及请求序列；切换立即使旧正文失效；读取失败可重试；源码变化需重读确认 | 品牌组件竞态、目录错误、实际 24,000 字正文冻结测试 |
| B / F07 | run 与 snapshot 都带 workspace context，切换身份清状态，迟到回执不回写；依据展开显示实际正文、位置、用途和摘要；传输事实不称模型采纳 | 依据授权/错误/切换回归及 local.5 原生 CSV/预算展开 |
| C / F05 | journal v3 保存完整意图、原 ID、目标和逐项复制回执；目标优先恢复；固定快照复用；目标列表失败不视为空目录；源缺失/编辑冲突停止覆盖；变化确认新副本；草稿读回后条件清理，不自动运行 | 工程断点回归 + 原生接续退出重开 + 修改品牌显式副本与两侧记录核对 |
| D1 / G01 | 首页延迟、失败、取消/离开、重开时间线；加载相关代码检查及导航/工作区两尺寸回归 | 未复现，按用户要求暂时跳过；不标根因关闭 |
| D2 | local.5 独立安装、真实 CSV/两预算任务、旧数据副本升级、九导出、取消、接续/新副本、正式恢复 ZIP | 已运行证据见原生台账；业务品牌、网页外部打开及缺失旧恢复存储仍单列 |

主要新增模块：`staged-input-draft.ts`、`continuation-recovery.ts`、`MokinaHomePreparationNotice.tsx`、`MokinaContinuationRecoveryNotice.tsx`。共享 DTO/预算在 contracts；Web 没有导入 daemon 私有实现。现有 `od mokina context prepare/get` 原样传输 fragments，并修复其内联 JSON 与帮助文档不一致的问题。

### 接续收尾与兼容边界

- 接续章节正文在首次意图确认时固定，目标快照以 `user-note` 保存固定摘录并新增可选 `continuationOrigin`，记录源项目、文件、版本状态、版本 ID、摘要与 sectionId。依据卡呈现源身份，并明确这是用户确认时固定的摘录，不等于重新读取或批准源版本。旧 schema 1 快照没有该字段仍原样读取、不重算指纹。
- 目标草稿写入后再次读取并核对身份，绑定持久化读回成功后才进入 `draft-ready`；随后先保存完成记录，再按 operation、intentDigest、revision 条件清理活动 journal。完成记录保留原目标；清理失败仅同步原记录，不重新创建项目、不抢导航。新增回归覆盖草稿读回失败、完成记录保存失败与迟到条件清理冲突。

## 自动化结果与命令

环境：Node `24.15.0`，pnpm `10.33.2`；SQLite 实际 daemon/HTTP 已运行。shell 不使用默认 Node 22。

| 命令 / 集合 | 结果 | 证据层 |
|---|---|---|
| `pnpm guard` | exit 0 | 边界/结构检查；沙箱初次 tsx IPC EPERM exit 1，允许本地 IPC 后实跑通过 |
| `pnpm typecheck` | exit 0 | 完整 workspace；CLI 后续构建再检查 daemon |
| `pnpm i18n:check` | exit 0 | 新文案键检查；非中文语言部分沿用英文回退，非人工翻译签收 |
| 根 CI Web 20 文件、`--maxWorkers=2` | 246 passed | 实际模块/组件与受控 promise |
| 根 CI daemon 12 文件 | 130 passed | parser、冻结、授权、幂等、HTTP、CLI 真实进程 |
| 桌面 `tests/main/mokina-recovery-store.test.ts` | 19 passed | 实际持久化/CAS；不是两个原生窗口验收 |
| tools-pack `tests/resources/pdf-runtime.test.ts` | 1 passed | 包内 PDF 工具资源 |
| Playwright 输入/导航/工作区与 real-daemon `--grep Mokina` | 25 passed / 0 skipped / 0 flaky | 浏览器 + 真实 daemon/SQLite，部分 run 使用 fake CLI；不是专业模型成果 |
| FileViewer 加载/预览 `vitest -t` 定向集合 | 5 passed；311 项不匹配本次过滤 | 只证明所选激活、版本和预热行为；不称全部 FileViewer 用例已运行 |
| `tools-pack mac build ... --portable --to all` | local.5 exit 0，产品 SHA `0ed77171` | 构建/资源与原生验证分开 |
| `git diff --check` | exit 0 | 文本差异检查 |

完整文件集合和可复跑命令由根 `.github/workflows/ci.yml` 管理。浏览器原始报告位于 `open-design/e2e/ui/reports/results.json`，最终运行统计为 expected 25 / unexpected 0 / skipped 0 / flaky 0。附件中的 request-state-timeline 保存请求开始、结束、失败与最终 UI 状态；新证据只用合成数据。

### T31 时间线摘录

| 场景 | 冻结请求/响应 | 最终结果 |
|---|---|---|
| ready | 5,896ms POST → 6,923ms 201 | 7,104ms；run 1 |
| failed | 3,217ms POST → 4,530ms 403 | 5,393ms；run 0；可恢复错误保留 |
| leave | 3,636ms POST → 4,668ms 201 | 8,303ms；run 0；返回后手动恢复 |
| reload | 3,371ms POST → 4,243ms aborted；9,119ms 原身份重试 → 9,128ms 201 | 9,987ms；run 0；不自动重新发送 |

截图位于 `output/playwright/mokina-v003-repair-2026-10-07/`：`input-ready.png`、`input-failed.png`、`input-reload.png`、`continuation-draft.png`。保留原始报告，不把截图或一次成功作为旧白屏根因证据。

### 失败与处理

1. 新精确片段真实模块用例在旧实现失败；修改协议/解析后通过。旧的 group 扩展断言更新为精确正文断言，不保留有损行为来凑绿色。
2. ProjectView 恢复测试出现 OOM：测试中变动的翻译函数进入恢复 effect 依赖导致循环；改为引用读取，再跑受影响及完整 Web 集合通过。不是直接登记环境问题。
3. 品牌目录错误测试先使用错误标题断言，校正后发现 UI 早退隐藏错误，修复早退条件并通过。
4. FileViewer journal 测试还监控旧持久化入口；改为实际 CAS 入口并断言完整意图，不仅修改 mock 名称。
5. 首页 E2E 全页面离开终止准备请求，校正预期为原身份手动恢复；截图后读取已清理状态的等待产生假超时，改为即时查询，并重跑 25 项通过；未延长 timeout。
6. 品牌预算发现客户端按解析片段分隔符扩展计数，服务端实际冻结原正文；改为原正文长度，并新增实际 POST 和绑定 24,000 字断言。该边界不声称已取得修复前红测试。
7. CLI 新增两项用例 exit 2，原因是内联 JSON 被当作路径；修正后 6/6 通过，最终完整 daemon 130/130 通过。
8. 打包依赖安装报告 6 项漏洞（5 moderate / 1 high）；组装目录无 lockfile，`npm audit --omit=dev --json` 返回 ENOLOCK。随后工作区 `pnpm audit --prod --json`（pipefail 保留退出码）exit 1：4 critical / 70 high / 57 moderate / 13 low。包内确认 Next.js 16.2.6；本轮 package.json/lockfile 对 base 没有差异。工作区告警不等于包内可利用性，单列 [依赖审计记录](./2026-10-07-dependency-audit.md)；未完成安全处置，不运行 `audit fix --force`。
9. 原生 CUA 首次读取曾超时/长时间阻塞；随后控件操作可用。原生文本区 setValue/paste 未写入，中文键盘输入失真，改用英文可见输入后提交；这是工具交互过程失败，不伪装为用户已完成原生输入测试。
10. 接续新契约字段首次 typecheck 因 contracts 已生成的声明仍是旧版本而失败；执行既有 contracts build 后重跑完整 typecheck exit 0。全新 CI 的既有 postinstall 会构建 contracts，未跳过类型检查。

### D1 相关代码检查（暂时跳过，不冒领根因）

只读检查了 App bootstrap 与 workspace 门禁、ProjectView 会话列表有限重试、`useProjectRouteWorkspaceContext` 的请求 epoch/身份复位、FileViewer 版本读取/内容缓存/iframe generation 和 onLoad 生命周期。失败、取消、身份改变均有对应终态或退役校验；现有版本 fallback 和单次 iframe 恢复属于基线代码，本轮未增加 reload、无限重试或延长 timeout。可能的 workspace 未结算、版本晚到、隐藏 iframe 激活等路径尚无证据能解释原故障，因此不实施猜测修复。

investigate 的先确认原因再修复要求用于此项诊断；5 项定向回归与两个尺寸浏览器入口检查通过，只证明对应场景。用户明确要求无法复现可先跳过，故状态为「未复现，暂时跳过」，不是「根因关闭」。

## F/T/AC 结果口径

T01–T30 的原编号不变。A 的 T01–T09、B 的 T10–T13/T18–T21、C 的 T14–T17 有对应工程回归，但本记录不把测试数量换算成外部编号全部通过。T31 有浏览器跨层证据，T32 有授权与晚到回执组件证据，T34 有错误封装/接续恢复证据。T22–T30 原生已运行项见 [local.5 原生台账](./2026-10-07-local5-native-verification.md)，T33 业务品牌待授权资料。实际公开风格参考 A/B 不冒称业务真实品牌签收。

31 条原 AC 的最终验收仍逐项列出；“工程覆盖”表示本轮有代码/自动化证据，不等于整条 AC 签收。

| 原 AC | 本轮状态与尚缺证据 |
|---|---|
| N00-AC01 | HEAD/分支/worktree/未跟踪现场已核对，原改动保留；本轮提交仅含自有修改 |
| N00-AC02 | 从 93531732 主干基线修复，候选递增 local.2 → local.3 → local.4 → local.5 |
| N00-AC03 | local.6/main/tag 身份分开；旧包与标签未修改 |
| N01-AC01 | README 保留桌面产品、外部 Codex、源码与历史原型边界并更新本轮状态 |
| N01-AC02 | local.5 原生首次连接、CSV、两预算、品牌参考、接续和导出实际运行；过程候选结果不沿用 |
| N01-AC03 | 源码/候选/平台/包摘要按新候选台账核对；公开发布未做 |
| N02-AC01 | 首页固定资料/一次运行有真实 daemon E2E；local.5 原生结果另列候选台账 |
| N02-AC02 | local.5 CSV、两预算和风格参考讨论未强制生成 HTML，实际 artifactCount 0 |
| N02-AC03 | 草稿、重开、取消、幂等工程覆盖；local.5 原生任务/接续重开完成，强制断点矩阵未冒领 |
| N03-AC01 | scoped binding/双会话工程覆盖；双原生窗口待验证 |
| N03-AC02 | draft/unknown/submitted 及原 requestId 工程覆盖；原生响应丢失矩阵待验证 |
| N03-AC03 | 实际固定正文与“传输不等于采纳”已实现；local.5 原生展开结果另列台账 |
| N03-AC04 | 迟到清理与新 generation 工程回归通过 |
| N04-AC01 | A/B 竞态和不可变快照工程覆盖，local.5 Stripe/Vercel 实际参考接入与旧快照不漂移；业务品牌待资料 |
| N04-AC02 | 未改既有冲突规则；本轮不新增专业冲突判断签收 |
| N04-AC03 | 素材固定字节/角色工程覆盖，原生 LOGO 进入接续及九导出；本轮源 LOGO 删除原生验收未跑 |
| N05-AC01 | local.5 目标固定 strategy、品牌参考与单一素材及新副本草稿核对完成 |
| N05-AC02 | 已固定目标不再读源工程通过；实际下游页面待验证 |
| N05-AC03 | 源身份在 journal/接续文件/新快照和依据卡呈现，明确用户确认固定而非批准；工程回归通过 |
| N05-AC04 | 工程断点/响应丢失回归通过；原生退出重开保持原身份，新副本保留原目标/完成记录，均不自动发送 |
| N06-AC01 | 1280×720 / 1440×900 浏览器入口回归通过，不冒称所有原生窗口尺寸已验收 |
| N06-AC02 | local.5 九份 actual 文件内容/资源/版本与 PDF 12 页核对；取消不成功、不改指针。应用外 HTML/ZIP 网页打开被工具策略阻止，待手动 |
| N06-AC03 | 恢复通知/项目导航工程覆盖；旧加载故障未复现，按用户要求暂时跳过 |
| N07-AC01 | 合成资料两组真实模型预算任务完整成果已保存，独立逐行金额/比例与禁投复算通过；专业评语待评 |
| N07-AC02 | local.5 CSV 数值、预算执行约束、品牌参考结果分别核对；不冒领业务页面/专业验收 |
| N07-AC03 | 新增及受影响集合通过，失败原因与处理如上；远端 CI 未运行 |
| N07-AC04 | 自动化、原生结果、专业评语、用户签收分别记录，无专业签收冒领 |
| N08-AC01 | 同一 local.5 三代表任务、退出重开与核心流程完整验收按候选台账结算 |
| N08-AC02 | 旧副本升级后六类数据库计数与 347 文件摘要一致；缺旧 Electron 恢复存储，旧 pending/journal 原生升级未跑 |
| N08-AC03 | 原生正式恢复 ZIP 42 成员摘要通过，正式导入新项目，21 原始文件和 10 版本/9 frozen 内容核对一致；原包/数据保留 |
| N08-AC04 | 包与产品 SHA 独立记录；本轮后续文档提交不改运行代码/资源，用户签收为空 |

## 旧数据、公开资料与剩余动作

旧静态备份 SHA256 为 `4bf866ebed014849574ca459f0c310b0b539af9f9a0acf785531b1a3f8466fc9`。本轮解压到独立受保护目录作升级输入，原备份不修改。不能承诺旧程序读取 v3 恢复记录；回退使用旧包与升级前副本，不拷回已迁移数据。

资料发布盘点分开处理：六篇 `docs/Mokina-v0.3-*.md` 含公开来源链接但公开授权仍需确认；`docs/designs/mokina-v0.3-*.md` 至少包含本机绝对路径，归为需脱敏；既有客户/业务材料默认授权待确认，未用作新夹具或公开证据。新 CSV、请求与截图全部为本轮合成输入。未删除、改写历史或推送公开资料。

后续门槛：手动确认应用外 HTML/ZIP 网页打开；补齐包含旧 Electron pending/journal 的受保护升级输入，双原生窗口与强制断点实跑；业务真实品牌资料授权、专业评语和用户签收；单独核查并处置依赖安全告警。已有工程代码/本地验证已交付，远端 CI 未运行、不宣称整体验收完成。旧加载问题按用户要求暂时跳过，取得具体复现再继续定位。未完成项不记通过。
