# 2026-10-09 首轮原生验证证据

对应产品复审 `9eb266c8`，构建提交 `a7f190a5`，候选 `0.0.4-local.1`。结论、环境、命令边界和后续事项见 [验证记录](../../2026-10-09-native-validation.md)。

- `summary.json`：所选 15 项原生用例的逐项结果和两次执行归属；首轮失败与定向补验分列。未选择用例不计为通过。
- `native-recovery-results.json` / `native-fault11-results.json`：Vitest 原始结果。临时根目录补验硬链接同一 DMG，见 `isolated-fault-root.json`。原生进程、持久化和文件故障为真实执行，资料和代理为合成 fixture。
- `release-manifest.json` / `installed-identity.json` / `pdf-resource-check.json`：实际交付包摘要、安装身份和 PDF 资源校验。
- `native-ui-observations.json`：原生 About/菜单、诊断取消与实际保存 ZIP 校验；记录默认文件名旧品牌问题。原生对话框截图另在当前聊天现场记录，不能用内容页截图代替系统对话框证据。
- `native-reopened.png`：工具生命周期重启后的原生 Home。`finder-cli-timeout.png` / `finder-cli-timeout-observations.json`：随后 Finder 全新配置冷启动的真实 CLI 连接失败；`finder-profile-before.json` 证明配置此前不存在。
- `pack-brand-tests.log`：打包工具全集首次失败；`pack-brand-focused.log` 仅证明品牌资源定向检查通过。desktop/packaged 日志分别记录其计数。
- `native-final-*.json` / `native-cleanup-result.json`：工具生命周期清理与额外 Finder profile/launcher、注册、挂载及现用 local.11 保留复核。`old-worktree-cleanup-result.json` 是先前旧工作区删除时点的回执，不代表最终候选仍安装。

完整日志和合成场景截图留在仓库 `output/native-validation-2026-10-09/`；诊断 ZIP、全机进程 cwd 列表及 runtime 日志只在本地保留，不纳入本证据目录。三个安装包和摘要保留在 `/Users/dingcheng/Mokina-PR13-QA/releases/0.0.4-local.1/`。本目录不声明真实模型、离线、VoiceOver、性能、品牌或用户签收通过。
