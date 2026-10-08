# 历史证据归档与提交

2026-10-08。用户授权按已确认建议整理文件并提交。本轮处理此前 457 个未跟踪文件快照：59 个 Spec 文件已在 PR #12 提交；397 个历史证据/备份文件归档到仓库外；`.zcodeignore` 保留为本地配置。

## 实际归档

归档根目录：仓库同级 `../Mokina-archives/2026-10-08-history-closeout/`。原目录结构保存在 `payload/` 中。逐文件索引见 [evidence-archive-20261008.json](evidence-archive-20261008.json)，包含原路径、SHA-256、字节数、原权限和分类。

| 分类 | 文件数 | 处理结果 |
|---|---:|---|
| 原快照中的审查、截图、运行证据 | 379 | 仓库外归档，保留 red、green、失败回执及原报告 |
| 原快照中的历史治理/恢复备份 | 18 | 仓库外归档，保留历史治理回执和原 Git bundle |
| 同目录中已被忽略的相关日志 | 31 | 一并归档，避免报告与 red/green 原日志断链 |
| 上轮新生成的分支治理结果和恢复 bundle | 5 | 一并归档，保留刚完成的分支清理记录 |
| 合计实际证据文件 | 433 | 569,918,490 字节，逐文件哈希通过 |

归档流程为复制、校验、完整恢复演练、再移出原始文件。全部 433 个文件从归档复制到临时恢复目录后再次读取，路径集、大小与 SHA-256 一致；两个 bundle 通过 `git bundle verify`。恢复演练的临时副本已清理。

13 个历史路径保留本地符号链接，指向仓库外的归档数据，兼容旧文档中的截图和报告引用。这些链接及 `.zcodeignore` 仅加入 `.git/info/exclude` 的精确路径规则，没有扩大共享 `.gitignore`。原始证据内容、59 个 Spec 文件和 Spec ZIP 未改动。原快照 457 个文件均可按原路径读回并核对原 SHA-256。

归档 payload 设为只读，防止历史截图生成器误写。若要重新生成某个历史路径的输出，先移除对应本地符号链接、创建新的普通目录，再执行生成命令；不向归档目标写入新结果。

## 正式结论覆盖与补齐

| 历史材料 | 正式入口与状态 |
|---|---|
| V0.0.2 合入 main、tag、旧分支备份 | PR [#3](https://github.com/MainQuestAI/Mokina/pull/3)、[#4](https://github.com/MainQuestAI/Mokina/pull/4) 与归档中的治理回执；本轮未改标签或签收包 |
| 三态/成果工作台原型截图 | `docs/designs/mokina-v0.3-*.md` 保留设计结论；截图仍属原型证据，不提升为真实应用验收 |
| 93531732 外部复审及迭代计划 | `docs/mokina-v0.0.3/2026-10-07-repair-implementation.md`、`2026-10-07-remaining-repair-and-acceptance-plan.md`；原静态误判与纠正记录保留，旧规划不覆盖后续执行状态 |
| 4517bd67 两项 DOCX/缓存缺陷与修复 | [local.11 两项关闭记录](../mokina-v0.0.3/2026-10-07-local11-two-defect-closeout.md)；旧失败与后续关闭分别保留，local.11 仍非完整签收 |
| 后续会话/源变更和 CI 失败跟进 | [后续验证台账](../mokina-v0.0.3/2026-10-07-remaining-closeout-followup.md)及归档 `ci-followup.md`；两个 CI SHA 和失败/成功身份不混用 |
| 首次准备记录保存失败与 PR #11 合并 | 原先缺少统一仓库摘要，本轮补入[修复与合并摘要](../mokina-v0.0.3/2026-10-08-home-preparation-fix-and-merge.md) |
| 本轮品牌/UI 设计及工程审查 | [完整 Spec](../specs/Mokina-Brand-UI-Spec-2026-10-08/README.md)的 06、07、08 及 README 已收口；原始复核和撤回草稿归档；19 条 AC 仍为 `not_run` |
| 本轮分支清理 | [分支治理记录](2026-10-08-brand-ui-spec.md)；逐引用备份和执行 JSON 在归档中 |

原始日志、内部依赖详细清单和未整理的外部复核输出不提交到 Git；本次提交只含结论、元数据索引和恢复说明。文件归档不改变任何产品或验收状态。

## 恢复方法

在仓库根执行以下命令，将证据恢复到一个新临时目录。原归档和当前工作目录均不覆盖：

```sh
mokina_restore_dir=$(mktemp -d /tmp/mokina-evidence.XXXXXX)
cp -a ../Mokina-archives/2026-10-08-history-closeout/payload/. "$mokina_restore_dir/"
```

恢复后文件仍按原 `output/…` 路径排列。可按索引逐文件核对 SHA-256；如果需要编辑恢复副本，使用索引中的原权限或只修改该副本的权限。恢复 Git 引用时，原分支治理记录中的 bundle 命令仍能通过本地兼容链接执行。

## 覆盖边界

本轮验证对象仅为索引列出的现存 433 个文件，不包含旧报告引用的外部安装包、临时 namespace 或完整用户 profile。旧清理记录还引用 `774f-local-files.tar.gz` 和 `b0-b1-local-files.tar.gz`；本轮盘点时这两份文件已不在其记录位置，未纳入归档，不能凭旧 `archives-verified.json` 宣称现在仍可恢复完整旧 worktree。本轮没有移除这两份旧文件。

两个原有 worktree 未修改。盘点期间另出现 `output/app-cleanup-2026-10-08/` 的两个独立未跟踪文件，不属于原 457 文件或本次处理范围，保留且未加入排除规则。

本轮只做文件治理与文档提交，没有产品实现、新安装候选、merge、tag 或发布。上轮 PR #12 的 CI 在 `3a5e4b9f` 上成功，不冒用为后续追加提交的 CI 结论。
