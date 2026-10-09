# v0.0.4 开发与原生候选 Runbook

2026-10-09 已构建 `0.0.4-local.1` macOS arm64 DMG/ZIP，完成首轮同包原生安装、菜单/诊断导出与 15 项资料选区/恢复验证。真实 CLI 连接超时及诊断默认文件名旧品牌前缀待处理。安装包保留于 `/Users/dingcheng/Mokina-PR13-QA/releases/0.0.4-local.1/`，本轮临时应用、注册和数据已清理；实际源码、摘要和证据见 [PR13 本地原生验证记录](2026-10-09-native-validation.md)。已签收版仍为 v0.0.2-local.6；现用 local.11 及此前签收记录保持原样。候选验证不等于用户签收或发布。

## 检出与开发

PR13 分支为 `codex/mokina-v0.0.4-brand-ui`，最新复审产品提交为 `9eb266c8`，base `52219d8c`。本地已把 PR13 和旧分支治理记录合并到 `codex/mokina-v0.0.4-native-validation-20261009`；包构建提交 `a7f190a5` 的产品目录与最新复审提交一致。`c79843ba` 是首次实施的历史冻结点，不能代表复审修复后的候选。在 `open-design/` 读取 [AGENTS.md](../../open-design/AGENTS.md) 及目标子目录指令，Node24，Corepack pnpm10.33.2，安装锁定依赖：

```sh
corepack pnpm install --frozen-lockfile
```

开发启动必须沿 AGENTS 的显式、空 `OD_DATA_DIR` 契约；namespace 不能隔离真实数据。原生旧 profile 验证只用备份副本。不要连接或复制真实 profile 作为普通工程 fixture。

品牌资源再生成（仓库根目录，输出仍为候选）：

```sh
cd open-design
corepack pnpm --filter @open-design/tools-pack exec tsx \
  src/resources/generate-mokina-brand.ts \
  ../../../docs/specs/Mokina-Brand-UI-Spec-2026-10-08/assets/brand-candidate \
  ../..
```

上例由 pnpm filter 在 `open-design/tools/pack` 执行，相对输出 `../..` 为 `open-design`。生成后检查 manifest、hash 和 diff；确认八个来源未变。Web/native 使用同一候选，不手工修某个组件的 Logo 形状。

## macOS arm64 后续候选

以下是 2026-10-08 Linux 实施阶段留下的构建模板。2026-10-09 已在 Mac 上分配并构建 `0.0.4-local.1`；后续新候选按实际构建递增，不覆盖现用 local.11。`<next-v004-local-candidate>` 保留为模板占位，实际操作使用明确版本与独立 namespace：

```sh
cd open-design
NEXT_PUBLIC_MOKINA_EDITION=on OD_WEB_OUTPUT_MODE=standalone \
  corepack pnpm --filter @open-design/web build
corepack pnpm --filter @open-design/tools-pack build
corepack pnpm tools-pack mac build --dir .tmp/mokina-v004-pack \
  --namespace mokina-local-v004 --portable --to all \
  --app-version '<next-v004-local-candidate>' --json
```

按 tools/pack/AGENTS.md 和 CACHE.md 核对 Mac 本地前置、资源选择、缓存报告和产品 profile。命令参数为 `--app-version`。没有完整 build 输出前，不填写候选版本、DMG/ZIP hash 或安装可用状态。确认打包 manifest 对应 Mokina，Windows/Linux 选择路径不借本轮 Mac 结果声明支持。

如果从包含文档提交的最新分支HEAD构建，先确认产品路径相对冻结源码无差异，并将实际构建HEAD记录为包source SHA；不要将文档HEAD构建出的包记成冻结提交。

保存 source SHA、Git clean 状态、产品版本、平台、Node/pnpm/Electron版本、资源与 DMG/ZIP SHA256。安装同一新候选后，逐条执行当前 [acceptance.json](../specs/Mokina-Brand-UI-Spec-2026-10-08/acceptance.json) 和 [QA计划](../specs/Mokina-Brand-UI-Spec-2026-10-08/08-QA验收计划.md)，分别记录 browser/native/读屏/用户证据。真实两个应用窗口不能用两会话代替；旧 profile 必须使用备份副本。源码变化后更新候选，不能复用旧包证据。

Logo 仍 `candidate_not_finally_approved`。最终视觉与专业签收分别记录，在这些门槛完成前正式品牌发布保持 blocked。
