# v0.0.3 开发基线与 Spec 复核

用户授权：PR 最新提交 CI 通过后合并，清理多余分支和 worktree，基于合并后的 main 固定 v0.0.3 开发基线，复核并同步 Spec。

## 新基线

- PR [#12](https://github.com/MainQuestAI/Mokina/pull/12) 最终 head：`810ca2e65b370896f486f5d198e0804e02024051`。
- [CI 37746517804](https://github.com/MainQuestAI/Mokina/actions/runs/37746517804)：completed / success，head 与合并来源一致。
- 普通 merge，使用 `--match-head-commit` 核对来源；合并时间 2026-10-08 08:10:14 UTC。
- 新 main：`52219d8c8f71460d3776a96b9ebe84fa9ce65501`。已 fetch 并同步本地 main，Git tree 与已通过检查的 PR head 完全一致。
- 新开发分支：`codex/mokina-v0.0.3-brand-ui`，从上述 main 创建。此处 v0.0.3 表示开发基线，不宣称已经生成对应安装包、视觉发布或用户签收。

## Spec 配套修改

相对 PR11 功能基线 `9a6ba583df35c01f6b34a41fdbb8d414377ba513`，PR12 仅增加规格、设计参照和治理文档，没有 `open-design/`、根演示工程或产品资源改动。41 个既有目标文件均存在，当前生产行为与原审查一致，因此七个开发包和19条AC继续适用。

必要修改仅为 Spec v1.1 的基线同步：`backlog.json.baseline` 指向新 main；`sources.json` 分开保存原审查身份和新开发身份；README、00、执行提示词及校验说明同步。重新生成包内 SHA256SUMS 和 ZIP；原 v1 ZIP 保留在仓库外基线档案中。没有更改已确认的品牌、状态、主题、Cloud入口、恢复或导出要求。

[当前 Spec](../specs/Mokina-Brand-UI-Spec-2026-10-08/README.md)仍为七包 `not_started`、19条AC `not_run`。本次开启开发分支并提交基线说明，尚未实施S01–S07；实际产品实现、同一候选验收和最终视觉签收保持各自证据要求。

## 分支与 worktree 治理

PR12 来源分支 `codex/mokina-brand-ui-spec-20261008` 已合并，确认 head 是新 main 的祖先后删除本地及远端引用。删除前保存并验证 `../Mokina-archives/2026-10-08-v003-baseline/merged-pr12.bundle`。

旧 `4921/Mokina` 原型 worktree 已完整移至仓库同级 `../Mokina-archives/2026-10-08-worktree-4921/checkout/`，并移除旧 worktree 登记。归档包括嵌套 OpenDesign 独立 Git 仓库、其33项未提交改动、外层文档/证据以及全部忽略文件和缓存，没有选取或丢弃源码。共196,279个文件/符号链接，普通文件9,663,168,003字节；移动前后逐文件SHA-256及符号链接目标一致，嵌套仓库status一致。外层历史bundle、暂存/未暂存patch、完整manifest及验证结果一并保留。

旧 `v0.0.2-local-preview` worktree 与分支仍被11个OpenDesign后台进程使用，归类为在用环境并保留。已向用户询问是否停用；在没有停用选择前不终止这些服务，也不更改其在运行的源码。它不作为新开发基线。主工作区的另两个应用清理记录仍保留，未混入本次提交。

## 验证与边界

复核主线功能差异为空，目标文件可定位，七包依赖与B01–B20完整，8个候选SVG和全包哈希可校验；ZIP逐文件与目录一致，19条AC内容和状态未改。新基线说明只改变文档与元数据，不借静态校验证明产品验收。

PR12 CI成功已用于授权合并；后续main push运行和新开发分支的检查应分别记录，不借用不同head的结果。没有创建版本标签、GitHub Release或新安装包，也没有改长期规则或用户项目数据。
