# QA 验证摘要

这是根据本轮工具终端输出整理的摘要，不是原始测试日志。guard/typecheck/build 的主 Agent 原始输出另存为 `guard.log`、`typecheck.log`、`build-final.log`。

环境：Node 24.15.0，pnpm 10.33.2。测试工作目录为 QA 隔离工作树的 `open-design`；生产构建工作目录为当前主工作树的 `open-design`。依赖离线安装使用 `pnpm install --offline --frozen-lockfile`，见 `install.log`，未变更依赖清单或锁文件。

## 标签身份修复

新增回归测试先证明 2 失败、1 通过；修复后执行：

```bash
pnpm --filter @open-design/web test tests/components/WorkspaceTabsBar.regression-1.test.tsx tests/components/WorkspaceTabsBar.test.tsx tests/collab/tab-scope.test.ts
# 2 个匹配文件，54 通过、1 既有跳过；1.30s。
# 第三个路径不匹配，下一条用正确路径补测。
pnpm --filter @open-design/web test tests/tab-scope.test.ts tests/components/App.project-create-race.test.tsx
# 2 文件，90 通过；6.81s。
```

合计 144 通过、1 既有跳过。

## 屏外 PDF 捕获修复

```bash
pnpm --filter @open-design/web test tests/runtime/srcdoc-export-capture.regression-1.test.ts
# 修复前：2026-10-03 00:32:07，2 失败、1 通过，889ms。
# 离屏无帧、字体就绪后仍无帧两例均因 snapshot 调用为 0 失败。
pnpm --filter @open-design/web test tests/runtime/srcdoc-export-capture.regression-1.test.ts tests/runtime/srcdoc.test.ts tests/runtime/exports.test.ts tests/components/file-viewer-version-download.test.tsx
# 修复后：00:32:23，4 文件154通过，3.58s。
pnpm --filter @open-design/web typecheck
# 初稿测试消息 spy 在第47行产生 TS7031 implicit any。
# 将消息收集加上类型后，同一命令退出码0，2.38s。
pnpm --filter @open-design/web test tests/runtime/srcdoc-export-capture.regression-1.test.ts
# 类型修正后最终新增测试：00:33:32，3通过，767ms。此3项不再重复计入总数。
pnpm guard
# 最终PDF修复后退出码0，8.09s。
```

## 主 Agent 检查

```bash
pnpm guard
pnpm typecheck
# 两项在标题修复后通过，原始输出已保存。
pnpm --filter @open-design/web build
# PDF与标题修复均回到主工作树之后构建通过，见 build-final.log。
git diff --check
# QA树源码提交前通过；主工作树最终提交范围再检查。
```

最终用 `pnpm tools-dev stop/start web --prod` 重启 `mokina-v002`，在 Web 18604、daemon 18603 做浏览器复验。数据根遵循 `open-design/AGENTS.md` 的 Daemon data directory contract。未运行新的模型任务。

浏览器采集中的 `wait 2500` 与一次 viewport 参数格式错误属于工具使用错误，未作为产品缺陷或验证成功；已改用可见元素等待及 `1440x900` 参数。Close 按钮存在不可见同名元素，通用定位报多元素后读取 DOM，改用观察到的版本面板专用按钮重试成功。
