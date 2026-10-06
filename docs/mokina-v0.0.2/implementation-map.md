# V0.0.2 Local Preview · Implementation Map（T00/T01 有界落点核对）

日期：2026-10-04　｜　基线：`df4a0b2`（分支 `codex/mokina-v0.0.2-local-preview`）
口径：以下"复用点"均为已读代码确认；"最小差异"是本轮计划的改动面；"验证用例"是承载证据的测试/命令。

## 1. Packaged 产品身份解析点

| 环节 | 复用文件/函数 | 最小差异 | 验证用例 |
|---|---|---|---|
| mac 安装身份 | `tools/pack/src/mac/identity.ts:24 resolveMacInstallIdentity`、`tools/pack/src/mac/constants.ts PRODUCT_NAME` | 增加 Mokina profile 判定：`namespace === mokina-local*` 时 appId/productName 取 `ai.mainquest.mokina.preview` / `Mokina`；无则保持原逻辑 | `tools/pack` 单测：identity 解析（mokina namespace vs 默认） |
| electron-builder 配置 | `tools/pack/src/mac/builder.ts:99-165`（appId/productName/protocols/artifactName） | Mokina profile 下跳过 `opendesign` 协议注册（registersOdScheme=false）、artifactName 用 Mokina | 构建产物 Info.plist 检查（T18 证据） |
| 打包配置烘焙 | `tools/pack/src/mac/app-config.ts:42 writeLaunchPackagedConfig`；`.app/Contents/Resources/open-design-config.json` 写入点（tools/pack 构建链） | 身份对象（productId/productName/productVersion/releaseKind/策略开关）编译进 open-design-config.json | 单测 + `tools-pack mac build --to dir` 后读回配置 |
| packaged 读取 | `apps/packaged/src/config.ts:186 readPackagedConfig`、`RawPackagedConfig` | 增加可选 `product` 字段（向后兼容，缺省即非 Mokina） | `apps/packaged` 单测：解析缺省/存在两种配置 |
| 窗口标题 | `apps/packaged/src/window-title.ts:7 resolvePackagedWindowTitle` | 优先 `product.productName`，其次 channel identity，最后 `"Open Design"` | packaged 单测 |
| desktop 默认标题 | `apps/desktop/src/main/runtime.ts:2247`（已默认 `"Mokina"`） | 不改 | 现有测试 |
| updater 关闭 | `apps/desktop/src/main/updater/config.ts:165-168`（默认 `enabled=false`，注释已写明 Mokina local edition）、`apps/packaged/src/index.ts:95-99 applyPackagedUpdaterEnv` | Mokina profile 下不烘焙 `updateMetadataUrl`；不设 `OD_UPDATE_ENABLED` | `tools/pack`/desktop 单测 + AC03 network-inspection（T18） |
| daemon/web 版本身份 | `apps/daemon` `isMokinaLocalEdition`、web `MOKINA_LOCAL_EDITION` | daemon spawn env 增加只读 `MOKINA_PRODUCT_*`（来自 packaged config） | daemon 侧读取单测 |

## 2. 现有 host 持久存储接口（T03 前置核对结论）

- **不存在产品级持久 KV IPC**。desktop `ipcMain.handle` 现有：`shell:open-external`、`dialog:pick-working-dir`、`browser:clear-data`、`od:update:*`、`od:print-pdf`、`od:capture-page`（`apps/desktop/src/main/runtime.ts:2038-2655`）。
- 现状：Composer 草稿 `apps/web/src/runtime/chat/composer-draft.ts`、发送状态 `runtime/chat/send-request-state.ts` 均用 localStorage（随 origin/端口变化丢失 → Spec 风险表已识别）。
- **最小差异**：desktop main 新增窄 IPC `mokina:recovery-store:get|put|delete`（固定命名空间、有界 JSON、单写者串行、expectedRecordId 比较交换），落盘在既有 desktop profile 数据所有者下（`electronApp.getPath("userData")` 派生目录）；web 侧新增异步 facade，浏览器/dev 保持 localStorage 实现与 PR3 故障语义。
- 验证用例：`apps/desktop` 单测（store 语义：CAS/冲突/有界）；web facade 单测；T03 的 AC09/AC10 跨端口/落盘失败注入。

## 3. 场景接入注册点

| 环节 | 复用文件/函数 | 最小差异 | 验证用例 |
|---|---|---|---|
| 场景清单 | `plugins/_official/scenarios/<name>/open-design.json`（`mokina-market-analysis`、`mokina-marketing-plan` 已存在） | 新增 `mokina-landing-page`（薄场景：组合既有品牌/素材/HTML 工具 + 输出契约） | daemon bundled 注册测试 + 真实任务（T10/AC34） |
| 发现注册 | `apps/daemon/src/plugins/bundled.ts:64 registerBundledPlugins`（自动 walker，无需改 daemon 代码）；`server.ts:3613` | 无 | 现有注册测试扩展 |
| 项目绑定 | `apps/daemon/src/plugins/scenario-binding.ts`（`writeProjectScenarioBinding`/`readVerifiedProjectScenarioBinding`）、`resolve-snapshot.ts:442-460` | 无（复用） | 现有测试 |
| 首页入口 | `apps/web/src/components/home-hero/chips.ts:108-131`、`chip-labels.ts` | 增加落地页 chip（仅 T10 通过后） | e2e/UI（T10） |
| prompt 双路径 | `apps/daemon/src/prompts/`（legacy）＋ `packages/contracts/src/prompts/`（API/BYOK 镜像）；OD Next 侧 `plugins/_official/scenarios/od-next-strategy/assets/**`；开工前必读 `open-design/docs/prompt-composition.md` | 场景提示/契约文本修改须两侧核对 | T08 双路径核对记录 |

## 4. 受保护项目元数据目录所有者

- 项目内容：`PROJECTS_DIR = <RUNTIME_DATA_DIR>/projects`（`apps/daemon/src/server.ts:1413`）；内部目录先例：`.file-versions`、`.live-artifacts`（`apps/daemon/src/projects.ts:49-52`）。
- 项目元数据：SQLite `projects.metadata_json`（`apps/daemon/src/db.ts:99-108`），daemon-owned 键先例：`scenario-binding.ts:118 writeProjectScenarioBinding` + PATCH 守卫（`routes/project/index.ts:5186-5245`）。
- **最小差异**：新增 `apps/daemon/src/mokina/context-store.ts`，快照 JSON 存 `projects/<id>/.mokina/contexts/<snapshotId>.json`、冻结资产存 `projects/<id>/.mokina/blobs/<sha256>`（镜像 `.file-versions` 原子写入+校验模式）；不用 SQLite 存大正文；快照在 PATCH/文件列表侧不暴露为普通成果。
- 验证用例：daemon 单测（原子写、损坏检测、跨项目权限、不漂移）。

## 5. 项目导入入口（恢复包前置）

- 现状：有 `POST /api/import/folder`（外部目录）、`POST /api/import/claude-design`（zip 一次性消费）、`POST /api/project-locations/scan`；**没有**通用归档 restore 路由；**无 `uploadId` 概念**——上传暂存是 multer diskStorage（`server.ts:2829-2858`，`UPLOAD_DIR`），用完即删。
- **最小差异**：新增 `POST /api/mokina/recovery-import`（multer `importUpload` 上传 zip → 服务端持有暂存文件 → 按 `operationId` 幂等创建新项目）；Spec 中 `uploadId` 语义落在服务端暂存路径持有者即可，不新增客户端可伪造句柄。导出侧复用 `apps/daemon/src/projects.ts buildProjectArchive` + 新增 `mokina-recovery.json` 清单（`schema=mokina.project-recovery.v1`）。
- 验证用例：daemon 单测（路径穿越/symlink/摘要不符/重复 operationId/半份失败回滚）；T14 AC41-43。

## 6. PDF 原生依赖（pdftotext）

- 现状：`apps/daemon/src/mokina/materials.ts:51` 与 `apps/daemon/src/document-preview.ts:77` 直接 `execFile('pdftotext', ...)` 依赖 PATH；错误提示为 `unreadable`（不当正文，符合 Spec §4.2）。
- **最小差异**：解析前先读 `OD_PDFTOTEXT_PATH`（或 packaged 传入的资源路径）再回退 PATH；`tools/pack` 侧把目标平台 `pdftotext` 及所需 dylib/许可证作为受控资源打进包并注入该 env。无 Homebrew PATH 下必须可用（AC14）。
- 验证用例：daemon 单测（env 优先、缺失回退、失败提示）；T05/T18 打包读回。

## 7. 导出与版本存量的既有接缝（供 T12/T13 复用）

- 版本存储：`apps/daemon/src/project-file-versions.ts`（`.file-versions/<sha256(fileName).slice(0,24)>/manifest.json` + frozen HTML）；路由 `routes/project/index.ts`：versions L7253、candidates L7329、adopt L7367（`expectedCurrentVersionId` CAS 已存在）、单版本 L7577。
- 导出器：`artifacts/standalone-html.ts:102 bundleStandaloneHtml`、`import-export-routes.ts`（`/export/html` L1519、`readExportVersionSource` L744 已支持 versionId）、desktop PDF `apps/desktop/src/main/pdf-export.ts`、归档 `projects.ts:332 buildProjectArchive`。
- 前端：`apps/web/src/components/FileViewer.tsx`（修订 `generateChapterCandidate` L4406 缺 clientRequestId——本轮 T11 首要修复；接续创建 L4160-4305；版本导出菜单 L4670-4910 仅 current 可见——T13）。

## 8. 本轮不做事项（防止误解为缺口）

- 不新增第二 Electron 壳、第二 launcher、第二数据库；不改 `@open-design/*` 包名；不建 RAG/知识库/工作流平台；不做 OCR；不新增根级 dev/test 别名。
- UI 新能力按仓库 AGENTS 需同时提供 `od` CLI 形态（context-snapshot、recovery 两处）；本 Map 将 CLI 注册点记为 `apps/daemon/src/cli.ts SUBCOMMAND_MAP`。
