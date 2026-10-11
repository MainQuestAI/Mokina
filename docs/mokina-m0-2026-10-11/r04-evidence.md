# R04：稳定 profile 与显式迁移

2026-10-11 源码层完成。支持 macOS 上同一 `namespaceBaseRoot` 内，从 `mokina-local-v004-1` 或 `mokina-local-maturity-4` 显式复制到版本无关的 `mokina-local`。后续版本复用目标；既有目标即使为空也不覆盖、不合并。最终安装候选的原生交接验收由本轮总报告另行记录，本文件不把源码测试视为同包验收。

## 用户路径与边界

- 首次发现支持的旧 profile，原生入口显示可识别的版本选择；取消不创建目标。“全新开始”另行确认；不会先建空目标而堵住迁移。
- 复制项目、会话、消息、版本、固定来源、设置与原生恢复记录。外部导入文件夹保留原路径，不复制用户外部文件。旧 profile 不改动、不删除。
- 运行中来源/目标或无法确认进程状态时拒绝迁移；失败显示实际原因和重开路径。未知请求不自动重发；复制的定时任务暂停，受旧工作目录绑定的 CLI 会话不恢复为活跃会话。
- 不跨根目录搜索，不迁移任意 namespace，不覆盖现用应用，不含更新、公证、自动合并或恢复记录容量扩展。

只读核验现用 `/Users/dingcheng/Applications/Mokina.app`：`CFBundleName=Mokina`，版本 `0.0.4-local.1`；包配置 namespace 为 `mokina-local-v004-1`，未烘焙 `namespaceBaseRoot`。按既有 resolver，普通启动使用 `~/Library/Application Support/Mokina/namespaces`，与 Mokina portable 默认根一致；显式工具/环境根仍会覆盖此默认。不能据此宣称自动发现所有历史 QA 根。

## 持久化与冻结身份

迁移只接受本次核验的 v0.0.4 数据库：`user_version=0`、44 张业务表及实际列结构，随后检查 SQLite integrity 与外键。schema-only 测试夹具来自实际 daemon schema；另对现用 local.1 schema 做过只读表结构比较，44 表无结构差异，未迁移用户数据。

副本先写私有 staging，校验后一次目录 rename 暴露目标。每个来源文件在复制时和发布前验证摘要，发布前再检查写入者；stage 不被 runtime 读取。中断后重建私有副本，保留原数据。SQLite 文件仅作为无业务表的 OS 互斥锁，永不 unlink；真实 SIGKILL 用例证实进程死亡后锁释放。

| 数据 | 处理 |
|---|---|
| 项目版本 HTML、冻结 HTML、snapshot/provenance、digest-bound JSON、原生恢复记录 | 原字节复制，不递归重写 JSON |
| 项目 `metadata.baseDir` 指向旧 profile 内 | 重映射为新 profile；外部路径保留并列入报告 |
| 插件、素材库、诊断转录、技能候选、workspace artifact 的明确可变路径列 | 仅旧 profile 前缀重映射 |
| `candidate-adoption.json.targetFile` | 重映射内部目标，确保重启补写不会改旧 profile |
| `agentCliEnv` 明确路径字段 | 仅内部路径重映射；外部凭据配置不导入其他来源、不打印 |
| 原生恢复记录 | 严格校验实际 schema、key 哈希、非空 recordId 和 tombstone previousRecordId；保留 CAS 身份与删除语义 |
| Chromium session、日志、缓存、更新、run 进程/prompt 临时文件 | 不复制；不继承浏览器自动发送标记 |

完整的支持数据项和可变列白名单见 `apps/desktop/src/main/mokina-profile-migration.ts`。未识别数据项、损坏 JSON、未知 schema、符号链接和特殊文件均拒绝；不静默丢弃后展示成功。提交目标内保留 `profile-migration.json`，含来源摘要、数量、外部引用与排除清单。

## 原生启动顺序修复

实际 Electron 41.3.0 / Node 24.15.0 探针确认：`setPath` 本身不建目录，但 `ready` 即使没有窗口也会建 session 目录；原先异步配置读取结束时已经 ready。因此配置加载改为同步，首次 await 前设置路径。首次迁移使用独立、可清理的 bootstrap session；成功后沿现有 `bootstrapSidecarProcess` 启动正式 profile 的新 Electron 代际，不让 chooser 进程进入 runtime。正常退出清理本次 bootstrap；被强制终止留下的私有临时目录不视为业务 profile，最终 QA 资源清单须精确清理。

真实 Electron 源码探针证据：`output/mokina-m0-2026-10-11/r04/electron-bootstrap.json`。选择前 ready=false；对话框 ready 时目标仍不存在；真实数据库复制成功；下一 Electron 进程在 ready 前使用正式 session。探针的按钮选择由测试 harness 提供；完整工具 launcher 交接及原生点击仍由最终同包验收覆盖。

`tools-pack` 的启动配置和 stable profile 初始日志移到工具拥有的 output/launch，避免工具先创建空目标。packaged 只经允许的 `@open-design/desktop/main` façade 组装；CLI 使用无需 Electron 的声明子入口。

## 验证

以下命令在 `open-design` 下使用 Node 24.15.0 执行：

| 命令 | 结果与有效范围 |
|---|---|
| `pnpm --filter @open-design/desktop test tests/main/mokina-profile-migration.test.ts` | 16/16；保留内容/原目录、取消、全新、并发、源变化、迟到 writer、真实打开 DB、真实 SIGKILL、严格坏记录拒绝 |
| `pnpm --filter @open-design/packaged test tests/mokina-profile-startup.test.ts tests/config.test.ts tests/entry-handoff.test.ts` | 25/25；路径顺序、选择/取消/失败、locale、headless、现有交接 |
| `pnpm --filter @open-design/sidecar test tests/namespace-processes.test.ts` | 2/2；同 namespace 不同 stamp/launcher 仍拦截，枚举错误失败关闭 |
| `pnpm --filter @open-design/e2e test tests/mokina/profile-migration.test.ts` | 1/1；实际 daemon schema、版本采用恢复、指定历史版本读取/冻结内容、固定素材、continuation 摘要、原生草稿跨 profile 保留 |
| `pnpm --filter @open-design/tools-pack test tests/mac.test.ts -t writeLaunchPackagedConfig` | 1 pass；配置/日志准备不预建目标 |
| desktop / packaged / e2e typecheck，desktop / packaged build | PASS；sidecar / tools-pack build 与 typecheck 已通过 |

独立 CLI 在 mkdtemp 合成根执行真实 `profile-migrate`，exit 0，source SHA 不变，临时根已删除；记录 `output/mokina-m0-2026-10-11/r04/cli-migration.json`。Node 的 SQLite 能力也已在本项目实际 Electron 二进制中读取确认。

完整 tools-pack `mac.test.ts` 另有一个既有夹具失败：其临时假 workspace 缺 `tools/pack/resources/pdf/mac-arm64/manifest.json`；当时 21 pass / 1 fail。未借 R04 修改无关资源夹具；对应配置测试单独通过，其他原有打包检查仍由总验证执行。

## 最终同包种子与清理

未运行候选前，父任务可从仓库根运行：

```sh
node output/mokina-m0-2026-10-11/native/seed-legacy-profile.mjs --confirm-synthetic
```

脚本仅允许已登记的 `/Users/dingcheng/Mokina-M0-QA-20261011`，要求旧/新 profile 皆不存在，以实际 daemon 与恢复存储 API 创建 schema、门店项目、消息、两版本、固定文字/素材和正确 key 的未发送章节草稿。无用户数据、凭据或模型调用；生成 `R04-SEED.json` 供 UI/摘要核对。P07 未发送草稿由候选 UI 输入后重启验收。

本代理的 mkdtemp 夹具、探针入口与子进程已清理；未安装应用、未挂载镜像、未触碰现用应用。最终候选/隔离数据与可能的 bootstrap 目录由该 QA 根资源归属清单统一清理。
