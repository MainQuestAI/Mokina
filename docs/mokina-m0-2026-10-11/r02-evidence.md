# R02：可验证的项目恢复包

本轮基于 `98851a978840ef84a649379cfe3fa86cb63a8212`，在 `codex/mokina-m0-daily-reliability` 实施。这里记录源码工作树验证；最终提交、PR、安装候选由 M0 总交付绑定，不能将本记录当作现用应用已更新。

## 用户可以完成的工作

- 正常数据导出为 `mokina.project-recovery.v2`，并明确记录 `complete`。目录不可读、版本清单损坏、冻结素材缺失、导出期间变化、非法版本身份或超限都会阻止完整导出，并列出具体路径与原因。
- 完整导出失败后，用户先看到缺失清单，再选择“仅导出可恢复内容”。系统重新读取项目生成部分抢救包；没有自动降级或自动重发。`partial` 包只保留可导入的引用闭包，缺失父版本、循环关系或缺失素材不会用旧内容补位，也不会提升其他版本为当前版本。
- 下载与重导入显示来自同一 ZIP manifest 的完整性报告。重新选择同一包保留原 `operationId + targetProjectId + archiveDigest`，已导入的部分包仍显示原缺失清单；再次复制须显式选择。
- 外部目录项目按实际存储约定读取：原件来自授权工作目录，版本及冻结来源来自管理目录。导入后检查原件、历史 HTML 与冻结素材的真实字节。
- 900×600 窗口恢复入口现在可达：Mokina 的侧栏打开态不再被通用窄窗规则强制压成零宽；收起仍使用现有状态。长缺失清单在弹窗中滚动，主操作保持可见。

旧 v1 包可以导入，但显示“完整性未知”，不会声称不存在遗漏。新 v2 包不能被只认识 v1 的旧 reader 误认为完整包。包的范围继续是原件、版本/冻结内容、固定来源/素材和接续记录；并非机器配置、凭据、完整聊天数据库或运行任务备份。

## 复现与修复证据

| 问题 | 红例 / 复现 | 完成标准与结果 |
| --- | --- | --- |
| 读取失败/损坏被吞掉，剩余原件仍被视为完整备份 | `r02-red.log`：新增 5 个真实文件用例在原实现全部失败 | 默认 complete 拒绝；显式 partial 可导入且缺失清单一致 |
| 版本循环、重复编号、错误 candidate 类型或未知 schema 可混淆身份 | 定向损坏持久化 manifest | 导出完整失败，抢救排除异常引用闭包；导入拒绝不合法版本图 |
| 满额文件再加 manifest，导出包可能超过自己的导入限制 | 2000 个真实小文件及单文件超限 | 为 manifest 保留条目，含报告的实际总量再次核验；超限明确 `limit` 原因，partial 可导入 |
| 外部项目漏掉 managed 历史和固定来源 | `r02-external-root-red.log`：真实版本/快照已存在却导出 versions=[] | 双根读取后通过完整导出—导入—再次导出—再次导入，原件/历史/素材字节正确 |
| 900 宽恢复入口被隐藏，顶栏仍显示展开 | `r02-ui-3.log`、[修复前](evidence/r02-900-entry-before-fix.png) | 同合成数据、同 900×600 视口，[修复后可操作入口](evidence/r02-900-recovery-entry-before.png)，整个恢复流程通过 |
| 摘要/上传期间切换工作区，操作与结果可能使用不同归属 | Web 定向延迟回归 | 摘要等待期间切换不上传；上传期间切换仍写原 scope journal，但不更新新工作区 UI / 导航 |
| 重复选择恢复包或成功后日志保存失败造成错误理解 | NewProjectPanel 双选回归、导入 journal 保存故障 | 同一活动导入只调用一次；后写失败明确“项目已导入”，重选保留原操作，不新建身份 |

导出复核发现文件或目录发生变化时阻止完整导出；它并不冻结用户整个文件系统。恢复的是已校验的捕获内容。沿用现有导入 staging、提交标记与 operation/digest 归属检查，没有新增第二套恢复状态源。

## 验证结果

Node：`/Users/dingcheng/.local/share/fnm/node-versions/v24.15.0/installation/bin`。以下命令从项目根运行，需将该目录加到 PATH。

| 验证 | 结果 |
| --- | --- |
| `corepack pnpm --dir open-design --filter @open-design/contracts build` | PASS，实际 dist 确认为 v2 并导出两个报告函数 |
| daemon 定向 4 文件 | **49/49 PASS**，7.50s |
| web 定向 3 文件 | **15/15 PASS**，2.83s |
| daemon typecheck（含源码、测试） | PASS；最终新增用例又跑 `tsc -p tsconfig.tests.json --noEmit` PASS |
| web typecheck | PASS |
| e2e typecheck | PASS |
| 真实 daemon + Chromium，两视口 | **2/2 PASS**，30.1s；用例执行 5.4s / 3.4s，无重试 |
| `git diff --check` | PASS |

定向测试命令：

```sh
corepack pnpm --dir open-design --filter @open-design/daemon exec vitest run \
  tests/mokina-recovery-integrity.test.ts tests/mokina-recovery-package.test.ts \
  tests/mokina-cli-recovery.test.ts tests/mokina-recovery-routes.test.ts
corepack pnpm --dir open-design --filter @open-design/web exec vitest run \
  tests/runtime/mokina-recovery-package-client.test.ts \
  tests/runtime/mokina-recovery-import-journal.test.ts \
  tests/components/NewProjectPanel.recovery-import.test.tsx
OD_E2E_RUN_NAMESPACE=mokina-r02-<unique> corepack pnpm --dir open-design \
  --filter @open-design/e2e exec playwright test -c playwright.config.ts \
  ui/mokina-recovery-integrity.test.ts --workers=1
```

CLI 双端语义：`od mokina recovery export --project <id> --out <path.zip>` 默认要求完整；明确使用 `--allow-partial` 才请求抢救。错误输出包含服务端缺失清单；成功 JSON 包含从实际 ZIP 读取的 `integrity` 与 warnings，下载前不相信单独 preflight。导入保留现有 `--operation-id`、`--target-project` 幂等语义。

浏览器仅模拟测试环境的代理/应用配置，不模拟恢复 API。测试创建真实项目、写入真实 HTML、损坏 11 个真实版本清单：第一次 POST 是 complete/409，用户操作后第二次是 partial/200；下载真正 ZIP，再通过文件选择导入并核验同一缺失清单与恢复文件。所有 ID 均为合成测试数据。

- 1440×900：[完整失败](evidence/r02-1440-recovery-complete-failed.png)、[部分下载](evidence/r02-1440-recovery-partial-downloaded.png)、[重导入范围](evidence/r02-1440-recovery-imported-partial.png)、[结构化证据](evidence/r02-1440-recovery-evidence.json)。
- 900×600：[完整失败](evidence/r02-900-recovery-complete-failed.png)、[部分下载](evidence/r02-900-recovery-partial-downloaded.png)、[重导入范围](evidence/r02-900-recovery-imported-partial.png)、[结构化证据](evidence/r02-900-recovery-evidence.json)。

截图已肉眼核验：900 窗口标题、说明和两个操作在屏内，长清单独立滚动；导入后的单关闭操作在屏内。前两次 UI 定位修正与一次其他基线构建覆盖共享 contracts/dist 的失败均保留原始日志，未当作通过证据。最终 daemon/web/UI 均在重新构建当前 v2 后运行。恢复后再导出检查另为 PASS，未发现缺陷，未扩展产品改动。

## 改动与清理

主改动：daemon `mokina/recovery-export.ts`（捕获与闭包）、`mokina/recovery-package.ts`（兼容与导入校验）、`import-export-routes.ts`、`cli.ts`；contracts `api/mokina-recovery.ts`；web `recovery-package-client.ts`、既有 `recovery-import-journal.ts`、App / NewProjectPanel 与 `MokinaRecoveryReportDialog`。Web 使用已有 daemon 同版本的精确 `jszip@3.10.1` 读取下载包，19 语言键及 lockfile 同步。

原始日志、实际下载 ZIP、浏览器 JSON 报告保存于 `output/mokina-m0-2026-10-11/r02-*`。R02 创建的四个 `mokina-m0-r02-ui-*-w0` 生命周期均已停止，合成项目与 worker scratch 根已移除，临时 Playwright 配置已删除，进程核对无所属运行进程。单元测试临时目录由 afterEach/afterAll 清理。本轮 R02 未创建原生应用副本、挂载镜像或 LaunchServices 注册，未改现用应用及用户数据；清理记录为 `r02-cleanup.json`。

M0 全仓 guard、统一类型检查、最终生产构建及候选绑定以主交付记录为准。
