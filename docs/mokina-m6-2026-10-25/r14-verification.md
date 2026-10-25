# M6 R14 验证：M5 基线候选包同包门禁

日期：2026-10-25。候选 `0.0.5-local.1`（macOS arm64，ad-hoc），源码 main `46684a78`，main CI [40183042547](https://github.com/MainQuestAI/Mokina/actions/runs/40183042547) success。完整证据台账与产物清单见 `output/mokina-m6-2026-10-25/r14/`（gate-ledger.md、manifest.json、构建/运行日志、截图、回执与冻结文件副本）。本文件为入库摘要；未完成项不标通过。

## 候选身份

- DMG `Mokina-mokina-local.dmg` 409,051,764 B，SHA-256 `e557af8354d4280a06b4189ac630c0baf20ca35c5d513a0ccaa830c4759dc6dd`
- ZIP `Mokina-mokina-local.zip` 611,719,183 B，SHA-256 `c52d69c8f892de45d8972618da672ccc60d16d72b89e4a30adf03567d85b962d`
- 构建命令与 QA 根目录见 manifest；Node v24.15.0；namespace `mokina-local`（隔离）。

## 同包门禁结果（13 项 PASS）

| 范围 | 结果 | 要点 |
|---|---|---|
| 干净安装 | PASS | 空 profile → onboarding（od://app/onboarding），与 M4 基线一致 |
| 三方进程 | PASS | desktop/daemon/web 全部 0.0.5-local.1；daemon health ok |
| 签名完整性 | PASS | codesign --deep --strict 通过（ad-hoc） |
| M5 真实捕获 | PASS | example.com 真实 200/text/html；回执含固定 versionId 与双摘要 |
| 幂等回读 | PASS | versionId/digest 与捕获一致；workingFile matched |
| 冻结字节 | PASS | 项目存储文件 SHA-256 与回执 contentDigest 逐字节一致 |
| 版本保存 + 指定版本导出 | PASS | v2 钉定导出 346 B 含固定 versionId 引用；.md 直出被正确拒绝 |
| 重启持久性 | PASS | 优雅停止→重启：项目、冻结字节、回读一致性全部保持 |
| 恢复包往返 | PASS | complete 无警告；恢复项目证据 versionId/digest/字节与原件相同 |
| P04 UI 走查 | PASS | onboarding 完成（Claude Code 真实连接通过）→ 资料面板渲染 M5 UI；捕获证据「已上传 · 0.9 KB」+ 冻结快照框定 |
| Codex 首连（R15） | PASS | MCP 缺失路径修复后探测 0.25s ready（M4 时 45s 超时×2）；登录/模型可读 |
| 真实 Codex 任务 | PASS | run `c637e650` succeeded（74s，经应用 UI 真实键盘输入）；产物 v3 正确引用固定 versionId，摘录经核验存在于冻结字节（防编造），冻结文件未被改动 |
| 升级副本迁移 | 暂缓（已登记理由） | 原生层自 M4 零改动且 local.8 已全套验证；M5 数据不漂移由恢复包往返覆盖；替换现用应用前重跑 |

## 边界与未做

- 未发布、未打 tag、未替换现用应用 0.0.4-local.1；候选保留在 QA 目录（dmg/zip + manifest）。
- R16 的 S4 评审样本需在本候选上重装执行（dmg 重装即可）。
- R17 变更（i18n 等）合入后，最终签收候选须重新构建并绑定最终 SHA 重跑关键链。
- 本机 `~/.codex/config.toml` 的 computer-use MCP 已按计划停用（应用缺失），备份与说明见 output 台账。

## 清理回执

本轮测试结束：应用已停止、测试安装副本与空壳目录已删、QA 域 LaunchServices 注册 4 条已注销（dump 复核 0）、无挂载残留、无残留进程。保留：候选 dmg/zip/manifest、隔离 runtime 内合成项目数据（证据已另存 output）、用户应用与数据未触碰。
