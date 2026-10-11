# R04 独立审查

审查日期：2026-10-11。审查者：`workflow_audit`。只读检查本轮 desktop 迁移、packaged 首次启动、tools-pack 生命周期和 sidecar 进程定位实现及定向用例；没有新建迁移数据、启动应用或重复执行测试。本记录不能代替最终候选原生验收。

## 修复后结论

对冻结后的源码复核，两项发现均已修复，未发现新增的代码审查阻断。同步配置读取使稳定 profile 的 session 路径在首次 `await` 前设定；临时选择进程只负责准备，正式运行必须经过现有 sidecar bootstrap 进入新 Electron 代际。真实 Electron 的顺序证据已读取，最终同包 GUI 交接和重启仍由主验收完成。

## 发现与闭环

| 优先级 | 发现与用户影响 | 修复与证据 |
|---|---|---|
| P1 | 有旧 profile 时，原生选择对话框先等待 `app.whenReady()`，随后才设置 `userData/sessionData`。这违反当前 Electron 的启动契约，首次迁移可能先初始化默认 Chromium 数据位置，失去固定 profile 隔离。已有目标、无对话框的路径不会暴露它。 | 已修复。`config.ts:180` 同步读取配置；`index.ts:166` 在首次 await 前设置路径。目标不存在时使用独立临时 bootstrap session，不创建目标；迁移完成经 `index.ts:225–234` 的既有 bootstrap 交接，若未交接则拒绝进入正式 runtime。`r04/electron-bootstrap.json` 证明 Electron 41.3.0 在 ready=false 时设定临时 session、选择时目标不存在，以及下一进程在 ready=false 时使用正式 session。证据明确未替代完整安装包交接验收。 |
| P2 | 迁移恢复记录校验比实际 store 读取宽松：字符串 schema、空 recordId、缺少 previousRecordId 的 tombstone 可被迁移标为已验证，但随后读取失败。原字节仍在，然而“工作已保留”的完成状态不准确。 | 已修复。`mokina-profile-migration.ts:219–222` 已与 `mokina-recovery-store.ts:147–152` 对齐：schema 严格数值、recordId 非空、deleted=true 仅允许 schema 2 且 previousRecordId 非空。三类负例检查目标未发布。live value、不等于 true 的 deleted、可选 updatedAt 均保持 actual store 的既有接受方式，不扩大迁移语义或改写原始值。 |

## 已核对的设计边界

- 来源仅允许已列明的两个旧 namespace；稳定目标为版本无关 `mokina-local`。已有目标包括空目录都不合并、不覆盖；任意来源名与版本化目标拒绝。
- 源数据仅离线读取：先检查 namespace 中的进程和目录的打开句柄，复制每个文件并校验摘要，发布前再次检查进程与源清单。损坏 SQLite、未知数据项、符号链接和不支持的表结构拒绝发布。源数据库只作为普通字节复制，数据库修正发生于私有 staging。
- 迁移只重映射明确的可变路径字段和 adoption journal 目标路径，固定提示、版本、来源快照与恢复记录保留原字节；恢复 recordId 与请求 clientRequestId 保留。原生 CLI 会话指向迁移目录的部分清除，历史消息保留，定时任务暂停；不复制 Chromium 自动发送标志和 agent 临时 stdin/process 文件。
- SQLite 仅作进程间 OS mutex，未创建产品业务表、未把 SQLite 锁作为另一恢复状态系统。锁文件不 unlink，避免双 inode 并行锁；已有 SIGKILL 用例确认内核释放锁，私有 staging 下次重建。
- staging 与正式目标分开，目录 rename 是发布点；此前失败不启用目标，发布后的 journal 清理失败不把已完成迁移报成失败。用户取消不创建目标，“全新开始”对已有旧 profile 需要额外确认。
- tools-pack 的 launch config 与桌面 stdout 日志移到工具 output；稳定 profile 不从源码目录 seed config，避免首次迁移前创建目标。新 sidecar namespace 进程查询使用既有 stamp parser 和严格进程快照，没有新建进程身份机制或把读取失败当空列表。

上述结论来自冻结源码、恢复记录运行 parser、定向用例及实际 Electron JSON 证据的独立只读检查。实现者报告 16 个迁移用例、25 个 startup/config/handoff 用例、2 个 sidecar 用例和 1 个集成用例通过；本审查未重复执行。最终安装候选的完整 GUI 交接、实际项目与重启验收以主交付记录为准。

## 普通后续事项

`tools-pack mac start` 使用 `convergeSidecarLaunch` 的 45 秒收敛期限。首次交互选择或大 profile 复制若超过此期限，工具会终止 launcher，留下可重试 staging；直接启动应用和独立 `profile-migrate` 不受该工具期限约束。建议明确这个工具入口限制，再按实际大 profile 证据决定是否需要分离迁移准备与启动收敛，不凭假设放宽所有超时。

R03 诊断修复此前已独立核对：使用与连接检测相同的配置 CLI/HOME，区分 CLI 检出与登录状态，保留脱敏检查；本次没有发现新问题，未重复测试。
