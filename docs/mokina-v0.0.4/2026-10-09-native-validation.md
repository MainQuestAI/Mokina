# PR13 本地安装与原生验证

本轮已完成 `0.0.4-local.1` macOS arm64 候选的首轮实机安装与原生验证：同一 DMG 安装、原生 About/菜单、诊断保存与取消、重启，以及 15 项资料选区和中断恢复用例已有证据。Finder 全新配置启动后的真实 Codex CLI 连接探测超时，诊断默认文件名仍带旧品牌前缀，须继续处理。当前使用的 `0.0.3-local.11` 未被覆盖；用户视觉、Logo 与专业签收没有发生，正式发布仍待验。

## 审查与源码身份

读取「审查PR13 റിപ്പോർട്ട്」最新复审：两项遗留 P2 均已修复，未发现新的 P0/P1/P2 合并阻断项。复审锁定 `9eb266c826e85e558778254cfd43ba03346b921c`。2026-10-09 本地重新核对 [PR13](https://github.com/MainQuestAI/Mokina/pull/13)，仍为 Open/Draft，远端 HEAD 与复审一致，validate 成功，对应 [CI 37871856376](https://github.com/MainQuestAI/Mokina/actions/runs/37871856376)。本轮没有远端合并、推送或发布。

| 身份 | 值 |
| --- | --- |
| 已审产品提交 | `9eb266c826e85e558778254cfd43ba03346b921c` |
| 本地构建提交 | `a7f190a59d645eb196b173ca687e0dfcc0ac8079` |
| 本地主工作分支 | `codex/mokina-v0.0.4-native-validation-20261009` |
| 候选版本 / namespace | `0.0.4-local.1` / `mokina-local-v004-1` |
| 环境 | macOS 27.0.1 arm64 / Node 24.15.0 / pnpm 10.33.2 / Electron 41.3.0 |
| QA 根目录 | `/Users/dingcheng/Mokina-PR13-QA` |

本地 merge 纳入旧分支的清理规则及历史开发基线记录。七处规格文档冲突保留 PR13 的 v0.0.4 实施记录；`open-design/` 与 `.github/` 相对已审提交无差异。文档提交与产品提交分列，不冒充同一 Git SHA。

## 安装包

安装包最终保留于 `/Users/dingcheng/Mokina-PR13-QA/releases/0.0.4-local.1/`，含 `manifest.json` 和 `SHA256SUMS`。摘要对应实际构建产物；构建后迁移输出根目录，清理前将三个包移入交付目录并再次核对摘要，没有修改应用字节。

| 产物 | 字节数 | SHA256 |
| --- | ---: | --- |
| `Mokina-mokina-local-v004-1.dmg` | 408738737 | `4f77b578432c0e26ffac6d76226e70056655e0f1b7cff422027d0390697e9ae6` |
| `Mokina-mokina-local-v004-1.zip` | 611406022 | `bc850590e7a28be1294bbe0737bac64a56b67e43464aa83da879632542650eb9` |
| `Mokina-mokina-local-v004-1-payload.zip` | 430568489 | `2a30269b4d4eb092cb3285366e9a66fd5bdd712fee3b3267de72861dc81605b2` |

通过 tools-pack 挂载 DMG、复制安装并自动卸载镜像；安装路径为 `install/Applications/Mokina.app`。启动回执为 `source: installed`、`od://app/`、版本 `0.0.4-local.1`。builder 与安装副本均通过 `codesign --verify --deep --strict`；这里只确认本地签名完整性，没有 Developer ID 签名或公证。

Finder 实际显示 Mokina 名称和抽象黑色图标。安装副本的 Info.plist 与 builder 一致，ICNS 摘要与本轮源码资源一致；PDF 资源 338 个文件摘要全部匹配。新安装首次进入本地 CLI 配置页；其后原生恢复套件使用隔离合成配置和合成代理，不能据此声明真实模型或客户资料验收。

## 本轮验证

- guard、workspace typecheck、生产构建通过。
- desktop 单元回归 517 passed / 1 skipped；packaged 回归 335 passed。
- 打包工具命令的 `--` 转发导致首次执行了整个工具测试集：342 passed / 8 skipped / 1 failed。失败位于 `tests/mac.test.ts`，临时 fixture 缺少 PDF manifest；该测试及资源复制代码与 main 一致。首次失败日志保留。改用直接 Vitest 文件选择后，本轮品牌资源定向检查 1/1 通过；不把它写成整个打包工具测试集通过。
- 原生资料选区、源变化和恢复中断：首轮 14 passed / 1 failed，另 16 项未选择。失败的 interruption 11 在产品执行前被测试夹具的 `/private/tmp/...` 路径保护拦截；改用符合保护条件的隔离临时根目录，硬链接同一 DMG（inode 一致），定向补验 1 passed，另 30 项未选择。15 个所选用例分别有通过证据，不能写成一次完整测试集全绿。首次失败与补验结果均保留。
- 这些用例运行真实安装的 Electron、daemon、持久化、源文件变化与文件权限故障；代理输出和业务资料为合成 fixture。覆盖 DOCX 前/后/双段精确选区、源变化后重新确认、会话隔离、恢复意图不被覆盖、缺失源和修改目标、已接受请求不重复发送。
- 原生 About 显示 `Mokina 0.0.4-local.1（0.0.4-local.1）` 和本轮图标。Mokina 菜单含 About/Hide/Quit；Help 只含 Export Diagnostics，无上游社区/支持入口。
- 诊断保存对话框标题为 `Export Mokina diagnostics`；取消后回到 Home，另一次实际保存 ZIP 成功（178701 字节、28 项、CRC 校验通过）。默认文件名仍是 `open-design-diagnostics-2026-10-09T03-04-12Z.zip`，不能据标题正确就判定所有品牌表面通过。
- 工具生命周期重启后回到原生 Home。随后退出、确认旧测试进程停止，再从 Finder 双击同一安装副本，以此前不存在的独立 namespace profile 冷启动；真实 CLI 扫描成功，选择 Codex CLI 后连接探测在 45143 毫秒超时，仍停留在 onboarding。

关键结果、摘要与截图已复制到 [本轮证据目录](evidence/native-2026-10-09/README.md) 并纳入本地版本管理。完整日志、JSON、截图和本地诊断 ZIP 保存在仓库 `output/native-validation-2026-10-09/`，诊断 ZIP 不提交。历史 CI 和浏览器结果仍归属原提交，不并入本轮原生计数。

## 本轮未通过与后续处理

| 项目 | 实机证据与影响 | 下一步 |
| --- | --- | --- |
| 真实 Codex CLI 连接 | `codex-cli 0.160.0` 在 45143 毫秒后超时，新配置未进入生成工作流；日志中自动选择的 Antigravity 也有一次 45 秒超时。未重复盲试，尚不能判断是凭据、网络、代理启动还是模型响应问题 | 保留首个失败截图和探测日志，独立诊断 CLI 适配与本机连接，再用新候选验证真实模型闭环 |
| 诊断默认文件名 | 原生保存对话框仍显示 `open-design-diagnostics-*`；`apps/desktop/src/main/diagnostics.ts` 使用公共 contract 的固定前缀 | 后续按 Mokina edition 修正用户可见文件名并定向验证；本轮没有改产品代码，包仍对应已审源码 |
| 打包工具测试夹具 | 全集有一项 fixture 的 PDF manifest ENOENT；实际包的 338 个 PDF 资源摘要全部匹配 | 后续修正夹具；本轮保留失败，不将工具全集描述为通过 |

## 工作区与清理

按用户本轮「清理掉，不保留」指令删除 `Mokina-worktrees/v0.0.2-local-preview`，包含其约 18GB `.tmp` 历史测试数据与产物，以及其余旧工作区文件；没有另存这些数据。旧工作区源码已是当前验证分支的祖先，工作区无未提交源码。

删除前发现 11 个以该路径为 cwd、运行约四天的遗留 Hermes ACP/MCP 进程，已定向停止。注销该路径下两条 Electron 应用注册，删除后核对注册记录为空。旧 v0.0.2、v0.0.3 本地分支已删除，现在只保留当前验证分支与 main；远端历史分支未修改。主工作区原有 `output/app-cleanup-2026-10-08/` 保持原样。

本轮新候选测试结束后已通过 tools-pack stop/uninstall/cleanup 停止并移除 tool-managed 安装和 builder 副本、runtime、launcher；已注销本轮实际注册的应用及 Helper 路径。另删除 interruption 11 的临时根目录、合成 fixture，以及 Finder 本轮新建的 profile 和对应 launcher namespace；没有删除用户其他 profile、项目或凭据。

最终复核：本轮进程、应用副本、LaunchServices 注册、挂载镜像和 canonical namespace 残留均为零。未注册 Helper 的注销命令返回 `-10814`，实际已注册的三条路径注销成功，最终 dump 无残留。现用 `/Users/dingcheng/Applications/Mokina.app` 仍为 `0.0.3-local.11`，Info.plist 摘要与开始前一致，再次通过 deep strict codesign。安装包、验证证据和现用应用及运行数据继续保留；新候选不作为常驻应用入口保留。

## 后续验收边界

尚未取得用户视觉/Logo/专业签收；真实业务模型与品牌、受控离线冷启动、Dock 独立显示检查、旧 profile 副本、两个真实窗口、VoiceOver 实际通知、对照性能 trace，以及完整版本采用/导出外部打开流程须按各自证据继续验证。本轮未改变系统网络设置，网络沙箱预探测不作为离线实机通过证据。原 19 条 AC 的历史状态不因为新包生成或局部原生测试通过而整体改为通过。
