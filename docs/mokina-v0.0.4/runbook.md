# v0.0.4 开发与原生候选 Runbook

当前只有已提交的产品源码和工程证据，没有 v0.0.4 DMG/ZIP。已签收版仍为 v0.0.2-local.6；既有 local.11 及此前安装包记录保持原样。本记录不能作为已生成安装包的下载/安装证明。

## 检出与开发

分支 `codex/mokina-v0.0.4-brand-ui`，产品源码冻结 `c79843bafa7a7e2a61f33d81fcd78edf03c7236f`，base `52219d8c`。在 `open-design/` 读取 [AGENTS.md](../../open-design/AGENTS.md) 及目标子目录指令，Node24，Corepack pnpm10.33.2，安装锁定依赖：

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

本轮环境为 Linux，不能执行 Finder、Dock、VoiceOver 和 DMG 同包链。Mac 上从冻结源码执行既有 pack 流程，明确设置 Mokina edition / namespace；候选号实际构建时再分配，不预占 local.12，不覆盖 local.11。`<next-v004-local-candidate>` 是待实际分配的占位，不是已生成版本：

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
