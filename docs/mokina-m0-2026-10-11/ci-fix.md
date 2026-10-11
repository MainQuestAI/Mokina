# 干净安装构建依赖补齐

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
