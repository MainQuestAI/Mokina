# V0.0.2 Local Preview · 证据记录（持续更新）

规则：只记录实际执行过的命令与结果；未跑的项明确写 `not_run`，不以文档推测代替。

## T00 基线与实现映射

| 证据 | 结果 |
|---|---|
| 分支/工作树 | `codex/mokina-v0.0.2-local-preview` @ `df4a0b2`；`Mokina-worktrees/v0.0.2-local-preview`；起点 = PR3 head（含 R2 修复） |
| 环境 | macOS 27.0.1 arm64；node v24.12.0；pnpm 10.33.2（corepack shim 见 `baseline.md`）；codex-cli 0.160.0 |
| 依赖 | `corepack pnpm install --frozen-lockfile` exit 0 |
| 产出 | `docs/mokina-v0.0.2/baseline.md`、`implementation-map.md`；提交 `a6cc708` |

## T01 产品身份 profile

| 证据 | 结果 |
|---|---|
| 改动 | `packages/release/src/mokina-product.ts`（新增）+ index 导出；`tools/pack` `resources/mokina-product.json`、`config/product-profile.ts`、`mac/identity.ts`、`mac/paths.ts`、`mac/builder.ts`、`mac/app.ts`；`apps/packaged` `config.ts`、`window-title.ts`、`sidecars.ts`、`index.ts`、`headless.ts` |
| 单测 | release 9/9；tools/pack 44 文件 339 pass/8 skip（含新增 identity/mac render 用例）；packaged 23 文件 334 pass（含 window-title 用例） |
| typecheck | `@open-design/release`、`@open-design/tools-pack`、`@open-design/packaged`、`@open-design/desktop` 均 exit 0 |
| guard | `pnpm guard` exit 0 |
| 未跑 | 真实 `tools-pack mac build` 产物检查（Info.plist/包内 config）→ 归入 T18；AC02/AC03 的 network-inspection 断言归 G1/T18 |
| 提交 | `cbc030d` |

## T03 稳定桌面存储

| 证据 | 结果 |
|---|---|
| 改动 | desktop：`main/mokina-recovery-store.ts`（新增；CAS/单写者/原子写/键白名单/容量上限）、`main/runtime.ts`（4 个 IPC，sender 校验）、`main/preload.cts`（`recoveryStore` 桥）；host：`protocol.ts` 类型 + index 导出；web：`runtime/persistence/mokina-recovery-store.ts`（新增 facade：镜像/CAS 重试/hydration 不覆盖本地较新值）、`composer-draft.ts`、`send-request-state.ts`、`ChatComposer.tsx`、`ChatPane.tsx` 写入点镜像、`App.tsx` 启动 hydration |
| 单测 | desktop store 10/10（含并发 CAS、损坏记录、容量、跨实例持久）；web facade 5/5（无桥 no-op、CAS 更新、删除、hydration 不覆盖、once-per-session） |
| 回归 | desktop 52 文件 498 pass；web 受影响 6 文件 59 pass（send-request-state / composer-draft / draft-persistence / quote-send / next-step / facade） |
| typecheck | web、desktop exit 0 |
| 未跑 | 真机 IPC 联调（打包后验证跨端口恢复）→ 归入 T18/T19；AC09/AC10 故障注入待桌面包可用后执行 |
| 提交 | 见下（本次提交） |

## 待办（诚实清单）

- T02 打包依赖闭包：需真实 `tools-pack mac build`；未开始。
- T04 Codex 连接诊断：待核验既有实现后决定增量。
- T05–T14：未开始。
- T15–T19：未开始；T19 用户签收为 not_run（必须用户本人完成）。

## T05 资料解析器版本 + PDF 包内依赖（服务端）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `ProjectMaterialExtraction.parserVersion?`；daemon `src/pdftotext.ts`（`OD_PDFTOTEXT_PATH` 优先、PATH 回退、`runPdftotext`）；`mokina/materials.ts` 绑定 `MOKINA_MATERIAL_PARSER_VERSION` 并走统一解析入口；`document-preview.ts` 同源解析 |
| 单测 | `mokina-materials` 6/6（新增 parserVersion、路径优先级、PDF 失败不冒充正文） |
| 未跑 | tools-pack 打包 pdftotext + dylib + 许可证、清洁 PATH 验证（AC14 打包侧）→ 归入 T18 |
| typecheck | daemon 0 error |

## T06 不可变上下文快照（服务端）

| 证据 | 结果 |
|---|---|
| 改动 | contracts `api/mokina-context.ts`（快照/选择/回执 DTO + 错误码 + 预算常量），`RunContextSelection.mokinaSnapshotId`（含 daemon 镜像 normalize/merge）；daemon `mokina/context-store.ts`（规范 JSON 指纹、来源重读校验、原子写、内容寻址 blob、幂等/冲突、预算、损坏检测、delivery 回执、prompt 块）；路由 `POST/GET /api/projects/:id/mokina/context-snapshots`；受理注入 `chat-run-context.resolveMokinaSnapshotForRun` → server.ts 启动路径注入 + submitted 回执，OD Next bundle 同源注入（读不到即拒绝启动，不静默丢资料）；CLI `od mokina context prepare|get`（UI+CLI 双轨） |
| 单测 | context-store 11/11；routes 3/3（真实 daemon HTTP：201/200 reused/409 冲突/409 SOURCE_CHANGED/404/413） |
| 未跑 | Web 选择面板（T07）；run 引用在真实模型链路的端到端回执（T19） |
| typecheck | daemon 0 error（contracts 已重建） |

## T08 营销场景与产物结构校验（部分）

| 证据 | 结果 |
|---|---|
| 现状核对 | 两场景包（open-design.json + SKILL.md + report-contract.md）已在 PR3 内落地且内容满足 §5.2 最小标准；prompt 双实现路径已由 SKILL.md assets 注入 |
| 新增 | daemon `mokina/deliverable-structure.ts`（可寻址章节结构检查 + mokina 场景识别）；`run-deliverable-validation.ts` 增加 `structure_invalid` 终态；contracts 两处 union 同步（chat.ts / deliverable-syntax.ts） |
| 测试 | `run-deliverable-validation` 28/28（新增 3 例：缺章节→structure_invalid、合规→valid、上游项目不受影响） |
| 未跑 | 场景 prompt（SKILL.md）本轮未改——现有文本已覆盖目标/KPI/取舍/预算/来源要求；专业评分属 T19 |

## T11 修订发送身份（FileViewer）

| 证据 | 结果 |
|---|---|
| 改动 | `FileViewer.generateChapterCandidate`：POST 前生成稳定 operationId/clientRequestId；`persistPendingSendRequest` 落盘失败即拒绝启动；`markSendRequestDispatched` 通过才 POST；body 携带 clientRequestId；受理成功清理记录；4xx→draft、5xx/网络→unknown；job 复用同一 operationId |
| 测试 | `FileViewer.mokina-revision-recovery` 13/13；`send-request-state` 21/21 |
| 未跑 | 真实 daemon 丢响应注入（AC29 的 real-daemon+fake-agent 端到端）→ 需要真实运行链（T19） |

## 回归状态（诚实记录）

- daemon 全量套件：后台运行中（长时间），完成后补记结果。
- 已确认各包 typecheck：release / contracts / tools-pack / packaged / desktop / web / daemon 均 0 error（截至本记录）。
