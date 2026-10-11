# CI 发现与修复

PR #16 的首轮提交 `2140fca9a0bc8fa7b828f268e7c842ff50049fd1` 在 GitHub 的 `pnpm install --frozen-lockfile` 阶段失败，尚未运行 guard、类型检查和产品测试。[失败运行](https://github.com/MainQuestAI/Mokina/actions/runs/38108519030)

具体错误为 `tools/pack/src/index.ts(126,51): TS2307 Cannot find module '@open-design/desktop/profile-migration'`。该新增 CLI 能力从桌面包复用迁移实现，package exports 指向生成的 `dist/main/mokina-profile-migration.js/.d.ts`；安装脚本的 `buildTargets` 未包含 `apps/desktop`，其依赖排序只能识别列表内的包，导致干净 runner 构建 tools/pack 时缺少声明。本地已有桌面 dist，使此前检查未暴露该错误。

修复只有 `open-design/scripts/postinstall.mjs` 的一个构建目标：增加 `apps/desktop`。沿用既有 workspace 依赖图，使其在所需共享包之后、tools/pack 之前构建；未调整 CI 校验标准、跳过安装脚本或另建构建流程。

## 本地验证

2026-10-11，使用 Node 24.15.0 / pnpm 10.33.2：

1. 将 `apps/desktop/dist` 和 `tools/pack/dist` 移至本轮独立备份目录，确认原路径均不存在。这里验证受影响的干净构建产物，未删除 node_modules，不能声称全新机器安装。
2. 运行真实 `corepack pnpm --dir open-design install --frozen-lockfile`：**PASS，24.2s**。日志顺序明确为 `apps/desktop` → `tools/pack`，安装及 postinstall 均以 0 结束，lockfile 未变化。
3. 核验重新生成的迁移 JS、声明文件和打包工具入口均存在；在 tools/pack 上下文动态导入 `@open-design/desktop/profile-migration`，确认导出 `migrateMokinaProfile`：**PASS**。没有执行迁移。
4. `node --check open-design/scripts/postinstall.mjs` 与 `git diff --check`：**PASS**。

原始证据位于 `output/mokina-m0-2026-10-11/`：

- `ci-failure-2140fca9.log` / `ci-result-2140fca9.json`：GitHub 原始失败日志与精确 SHA。
- `ci-clean-dist-start.json`：两处 dist 移走和原路径不存在的记录。
- `ci-clean-install-green.log`：完整冻结安装日志。
- `ci-module-resolution-green.log`：真实模块解析结果。
- `ci-clean-dist-result.json`：新生成文件 SHA-256 与清理记录。

两处原有生成产物的临时备份已删除，保留重新生成的工作区产物及必要证据。安装进程已正常退出，本次未创建服务、临时应用、挂载或 LaunchServices 注册，未访问或迁移用户数据。最终修复提交的 GitHub 检查与安装候选身份由 M0 总交付继续核验；初轮失败提交的旧候选不能代表修复后提交。

## 启动配置路径边界

提交 `921b2b7649a60a5593c478dece4c6328b8fd3d3e` 的 GitHub 检查已通过冻结安装、guard、全 workspace 类型检查和 i18n；安装修复获得干净 runner 验证。[运行记录](https://github.com/MainQuestAI/Mokina/actions/runs/38109028158)

该次检查在 `mac-lifecycle.test.ts` 的 missing-config 和 portable 启动用例失败：非 Mokina namespace `local-test` 的启动配置被移到 output/launch，破坏了原有 runtime/runtime 路径。迁移只在稳定 `mokina-local` 启用，不需要改变其他 namespace。修复将 `writeLaunchPackagedConfig` 的目录调整收窄到该稳定 namespace，与现有 `desktopLogPath` 边界一致，保留原有两条生命周期断言。

`mac.test.ts` 的启动准备回归现分别使用真实 `mokina-local`、`release-beta`，每个用例的 namespace 与 output/runtime roots 保持一致；核验实际配置内容、内嵌配置不变，以及 stable 写完配置和日志后目标 profile 仍不存在。原有全局测试夹具未调整。

- 改生产代码前运行这组用例：release-beta **RED**（错误 output 路径），stable **PASS**；CI 的两个已有生命周期用例也已提供独立红证据。
- 新增完整 `startPackedMacApp` stable 用例，在 native spawn 前检查目标目录不存在，并核验启动 env、配置内容及日志实际文件。临时将唯一的启动配置路径表达式恢复为基线 `98851a97` 行为，得到 **RED**（spawn 前目标已被建立）；随后立即恢复修复代码。此红例只复现该历史行为，不宣称重跑整个旧提交。
- 修复后 `mac-lifecycle.test.ts` 全文件：**PASS，9/9**。
- 修复后 `mac.test.ts -t writeLaunchPackagedConfig`：**PASS，2/2**（其他 21 条按过滤未运行）。
- `@open-design/tools-pack` typecheck 与 build：**PASS**。
- 原始日志保留在 `output/mokina-m0-2026-10-11/ci-failure-921b2b76.log`、`ci-launch-scope-red.log`、`ci-launch-scope-green.log`、`ci-mac-stable-lifecycle-red.log`、`ci-mac-lifecycle-green.log`、`ci-tools-pack-typecheck-green.log`、`ci-tools-pack-build-green.log`；最终 SHA 另由 PR CI 核验。

这轮验证仅使用测试自己的 mkdtemp 目录，均在 finally 中清理；没有启动真实应用或后台服务，也没有新增挂载、注册或用户数据。
