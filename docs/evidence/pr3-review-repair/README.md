# PR #3 修复证据索引

固定 base `33fa8434d14869ab4310d8b0f570116781d34c8d`，修复前 head `58dbf1cf717e71d88daf9995195df72fde6ea84c`。Node v24.15.0、pnpm 10.33.2；命令从 `open-design/` 执行。原始失败、后续诊断、最终结果均保留，以 `修复记录` 中的最终条目为当前结论；日志中的绝对路径只是当时环境，不要求复用该数据目录。

## 可复制检查

```sh
pnpm guard
pnpm typecheck
pnpm i18n:check
pnpm --filter @open-design/contracts test
pnpm --filter @open-design/web test
pnpm --filter @open-design/web test tests/runtime/send-request-state.test.ts tests/providers/daemon-run-create-recovery.test.ts tests/components/ProjectView.retry-gating.test.tsx tests/components/MokinaEntryChooserDialog.test.tsx
pnpm --filter @open-design/web test tests/hooks/mokina-summaries.test.tsx tests/components/FileViewer.test.tsx
pnpm --filter @open-design/daemon test tests/project-file-version-routes.test.ts tests/cli-files-write.test.ts tests/run-create-workspace-gate.test.ts tests/run-request-idempotency.test.ts
```

完整 Web 八项失败按 `baseline-failures.json` 的测试名和签名与精确 base 核对，不能称全套全绿。base 对照复用相同已安装依赖，独立源树从 `git archive 33fa8434` 得到；不在 main 强求新增 B1 测试通过。

## 生产浏览器

依次执行，完成 on 验证后才覆盖为 off，再恢复 on。`OD_WEB_PROD=1` 让 suite 的 tools-dev Web sidecar 加载 `.next` 生产构建；daemon 从相同工作树启动，namespace/data 由 suite 隔离。构建 ID 和使用的环境写在 `production-builds.json`。只换 env 而不独立构建不算版别验证。

```sh
NEXT_PUBLIC_MOKINA_EDITION=on OD_WEB_OUTPUT_MODE=server pnpm --filter @open-design/web build
OD_WEB_PROD=1 NODE_ENV=production OD_WEB_OUTPUT_MODE=server NEXT_PUBLIC_MOKINA_EDITION=on MOKINA_LOCAL_EDITION=on pnpm --filter @open-design/e2e exec playwright test -c playwright.config.ts ui/real-daemon-run.test.ts ui/mokina-navigation.test.ts ui/mokina-workspace-actions.test.ts --grep 'Mokina PR3|Mokina open-resolution|Mokina panel|Mokina continuation' --workers=1
NEXT_PUBLIC_MOKINA_EDITION=off OD_WEB_OUTPUT_MODE=server pnpm --filter @open-design/web build
OD_WEB_PROD=1 NODE_ENV=production OD_WEB_OUTPUT_MODE=server NEXT_PUBLIC_MOKINA_EDITION=off MOKINA_LOCAL_EDITION=off pnpm --filter @open-design/e2e exec playwright test -c playwright.config.ts ui/mokina-edition-off.test.ts ui/real-daemon-run.test.ts --grep 'Mokina off production|real daemon run streams, persists, and previews an artifact' --workers=1
```

实际运行另设 `PLAYWRIGHT_JSON_OUTPUT_NAME`、`--reporter=list,json` 与隔离 `--output` 保存证据。JSON 内的附件 body 为 base64；`production-screenshots/` 是便于直接查看的 PNG；导航截图关闭捕获瞬间的有限入场动画，避免把过渡帧当成最终页面，原 run 受理回执另存 JSON。普通 click/Tab/Enter/Space，无 force 或节点 dispatch。

故障注入使用真实 daemon 受理记录：浏览器在真实受理后分别丢弃 POST 响应和返回通用结构化 500，再点击实际错误重试、刷新、核对与重开，浏览器 POST 计数始终一。另一个用例先截留原请求，真实 GET 返回空后保持待确认，再递送完全相同的原请求内容，最终只对应原 run。模型端是既有 fake Agent，不能把这一层称为营销专业质量或真实外部 AMR 账户验收。
