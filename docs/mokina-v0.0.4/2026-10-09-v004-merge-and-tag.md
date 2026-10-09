# V0.0.4 源码合并与标签

2026-10-09，用户明确授权「合并PR，推远端，打 tag，V0.0.4」。PR13 已合并，原生验证记录、测试后清理规则及本地历史开发基线一并整合到 main。标签沿用仓库已有 `V0.0.2` 的大小写约定，使用 annotated tag `V0.0.4`，指向 main 合入本轮记录后的提交。

| 身份 | 值 |
| --- | --- |
| PR | [PR13](https://github.com/MainQuestAI/Mokina/pull/13) |
| PR 已审产品 HEAD | `9eb266c826e85e558778254cfd43ba03346b921c` |
| PR 合并提交 | `edd4cdd8196c10bb937b97dc15423ccd3d366ce7` |
| GitHub 合并时间 | 2026-10-09 13:18:37 Asia/Shanghai |
| 原生验证记录提交 | `b8d8b0c7` |
| 原生候选实际构建提交 | `a7f190a59d645eb196b173ca687e0dfcc0ac8079` |
| 候选版本 | `0.0.4-local.1` |
| 源码标签 | [V0.0.4](https://github.com/MainQuestAI/Mokina/tree/V0.0.4) |

合并前 live 核验 PR13 为 MERGEABLE/CLEAN，产品 HEAD 与独立复审一致，精确 HEAD 的 [CI 37871856376](https://github.com/MainQuestAI/Mokina/actions/runs/37871856376) completed/success。取消 Draft 后通过 `--match-head-commit` 锁定同一 HEAD 合并。后续整合内容限于规则、文档和本地验证证据；最终 `open-design/` 与 `.github/` 相对已审产品 HEAD 无差异。

使用正常合并保留 PR、本地治理与验证记录的提交历史；main 和 annotated tag 在同一次 atomic push 中同步到 origin。最终 ref 与 tag peeled commit 以远端读回为准；新 main push 自动触发的 CI 与已有已审 HEAD 的 CI 分别归属，不把运行中的新 CI 写成通过。

本次是源码合并和 Git 版本标签。候选 DMG/ZIP/payload 仍是原构建提交产物，摘要与路径见 [原生验证记录](2026-10-09-native-validation.md)，没有重标为新 main SHA 构建的包。已签收版本仍为 `0.0.2-local.6`，现用 `0.0.3-local.11` 保留。本轮真实 CLI 超时、诊断默认文件名旧前缀、工具测试夹具失败及其他尚未完成的验收继续按原记录保留，标签不代表这些事项通过。

[2026-10-09 原生验证记录](2026-10-09-native-validation.md) 是标签前的阶段快照，其中 Open/Draft、未推送、未合并和验证分支等表述对应当时状态；当前源码发布状态以本记录及远端 PR/tag 为准。原始诊断 ZIP、runtime 日志与全机进程 cwd 列表继续仅在本地保留，未纳入本次提交。
