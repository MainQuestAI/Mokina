# Mokina 品牌与 UI Spec 提交及分支治理

2026-10-08（Asia/Shanghai）。本轮依据用户“做一轮提交和分支治理”执行，提交已经审查的开发规格与候选参照，建立独立 PR。

## 提交范围与基线

- 基线：`main` / `origin/main`，`9a6ba583df35c01f6b34a41fdbb8d414377ba513`，已合并 PR [#11](https://github.com/MainQuestAI/Mokina/pull/11)。创建分支前通过 fetch、实时 GitHub PR 查询和远端 refs 再次核对。
- 新分支：`codex/mokina-brand-ui-spec-20261008`，从上述 main 建立；后续品牌与 UI 实施也应从届时最新 main 建立独立分支。
- 提交内容：[品牌与 UI Spec](../specs/Mokina-Brand-UI-Spec-2026-10-08/README.md)及本记录。七个开发包、19 条验收要求、设计和工程审查报告、QA 计划、状态矩阵、图标映射、品牌候选 SVG、原型参照快照与静态校验脚本一并保留。
- 原型 JS/CSS/HTML 仅位于 Spec 的 references 目录，属于归档参照；没有接入应用，也没有修改 `open-design/` 或根演示工程。
- 独立复核原始输出、失败草稿、历史安装与运行证据及其他未提交文件保留本地，不混入本次规格提交。可分享的完整审查结论已在 Spec 的 06、07、08 及 README 中收口。
- ZIP 是可重建的本地交付副本，按现有全局 Git 忽略规则保留；本次 Git 提交以目录内源文件为准。

## 分支清理结果

删除前逐一确认：最新同名 PR 已合并、远端 SHA 与 PR head 一致、该提交是 main 的祖先、分支没有绑定其他 worktree。远端删除使用预期 SHA 的 lease 和 atomic push，防止覆盖并发更新。

| 分支 | PR | 已合并 head | 本轮动作 |
|---|---:|---|---|
| `codex/mokina-v0.0.1` | #2 | `92e2d652` | 删除远端；本地此前已不存在 |
| `codex/mokina-v0.0.2-b0-b1` | #3 | `21d97b95` | 删除远端；本地此前已不存在 |
| `codex/mokina-v0.0.3-a-entry` | #5 | `abdb0ca1` | 删除本地及远端 |
| `codex/mokina-v0.0.3-b-context-brand` | #6 | `d93833f0` | 删除本地及远端 |
| `codex/mokina-v0.0.3-c-continuation-workspace` | #7 | `c33ab447` | 删除本地及远端 |
| `codex/mokina-v0.0.3-d-quality-package` | #8 | `23b3c702` | 删除本地及远端 |
| `codex/mokina-v0.0.3-review-fixes` | #9 | `9a5520f9` | 删除本地及远端 |
| `codex/mokina-v0.0.3-n08-candidate` | #10 | `bdc358ed` | 删除本地及远端 |
| `codex/mokina-v003-repair-a-input` | #11 | `8243d0fd` | 主工作区切换到新分支后删除本地及远端 |

合计清理 7 个本地分支、9 个远端分支。旧提交仍完整存在于 main 历史和已合并 PR 中。删除前另创建并通过 `git bundle verify` 的本地恢复包：`output/branch-governance-2026-10-08/merged-branches.bundle`。对应 SHA 清单、文件保留清单和执行结果位于同目录 `pre-governance.json`、`cleanup-result.json`。恢复包为本机治理备份，不提交到仓库。

从仓库根目录恢复一个旧本地分支时，可执行以下命令，将 `<branch>` 替换为表中的完整分支名：

```sh
git fetch output/branch-governance-2026-10-08/merged-branches.bundle \
  refs/remotes/origin/<branch>:refs/heads/<branch>
```

## 保留环境

- 主工作区切换到规格分支，本地 main 从 `93531732` 快进到 `9a6ba583`。原修复分支 `8243d0fd` 与新基线 `9a6ba583` 的 Git tree 一致，因此主工作区切换没有引入额外产品代码变化。
- `4921/Mokina`：保留 detached HEAD `691ef813` 及其中未提交的 V0.3 原型、文档和代码。
- `Mokina-worktrees/v0.0.2-local-preview`：保留 `codex/mokina-v0.0.2-local-preview`、对应远端分支和原环境；检查时 tracked/untracked 状态干净。
- 所有既有标签及安装包保留；本轮没有合并规格 PR、创建版本标签或发布产品。

## 验证与实际完成边界

包级脚本通过：7 包、19 条 AC、B01–B20 覆盖、依赖无环、8 个候选 SVG 可解析、包内文件哈希一致。ZIP 与目录全部文件逐字节一致。提交前检查没有产品源码变更；原未跟踪文件逐文件哈希用于核对内容保留。

19 条 AC 全部仍为 `not_run`。设计审查完成指规格决策完成；工程审查的 11 项实施/验证工作已映射、0 待决，仍为 `ENG NOT CLEARED`。品牌候选尚待最终视觉签收。本次提交不等于实现、浏览器/native 验收、安装包签收或发布完成；新 PR 的远端 CI 结果需独立查看。

## 后续文件归档

用户随后授权整理未跟踪文件并再次提交。历史证据与本轮恢复 bundle 已移至仓库同级的 `Mokina-archives/2026-10-08-history-closeout/payload/`，原 `output/` 路径保留本地兼容链接，因此上文恢复命令仍可用。Git 内正式结论、完整文件清单及恢复覆盖边界见[历史证据归档记录](2026-10-08-evidence-archive.md)。这次归档没有再次删除分支或处理其他 worktree。
