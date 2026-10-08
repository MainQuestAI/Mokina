# Mokina V0.0.3 未收口项接续核查

日期：2026-10-07。起点 `2b6ded9d`，分支 `codex/mokina-v003-repair-a-input`。本轮新增原生回归、纠正验收台账并复验安全缓解。**整体仍不可工程收口**，剩余项目见下表；没有修改运行代码、重打候选、推送、触发 CI、合并或发布。

## 已落实

- 原 P1/P2 修复仍在当前提交中，未重复修改产品。
- 在原 mac opt-in 入口新增一个跨层原生用例：真实项目文件写入、面板读取、源文件变化、实际 HTTP 409 `MOKINA_SOURCE_CHANGED`、重新读取与勾选、201 冻结、同项目第二会话独立冻结、回到第一会话后绑定不变、再次更新源文件后旧快照磁盘字节不变。失败/重新准备过程没有 POST `/api/runs`。
- 测试使用同一 `0.0.3-local.11`，产品源码 `764114a1`；没有修改安装包；本轮重新计算 DMG 与 ZIP SHA-256，均与原候选登记一致。数据为新建合成 Markdown，文件经正式 API 写入，选择和冻结由实际 Electron UI 完成。该用例不证明原生文件选择器、双窗口、真实品牌或模型采用。
- 修正旧台账 T08/T12/T22/T25 的过时描述。T12 根据此前同包断点 9/10 和 P2 受控证据改为通过；其余条目保留未满足条件，尤其不再声称“新候选缺失”或“关闭回归未提交”。

[结构化证据](./evidence/local11-source-change-scope.json) 保留产品身份、实际请求状态、会话绑定和快照指纹。完整原生报告及失败日志在仓库 `output/remaining-closeout-2026-10-07/`，仅含本轮合成资料。

## 验证记录

环境：Node 24.15.0、pnpm 10.33.2。命令从 `open-design` 执行。

| 检查 | 结果 |
|---|---|
| 新用例单独运行 | exit 0；1 passed，30 个非选定用例未执行 |
| guard、完整 typecheck | exit 0 / exit 0 |
| 最终 guard、E2E typecheck | exit 0 / exit 0 |
| daemon `project-watchers`、`image-parser-security` | exit 0；18 passed |
| tools-pack `download-cache-security` | exit 0；1 passed |
| 新增用例与原 DOCX/中断恢复组合 | exit 0；15 passed，16 个非选定用例未执行；257.07 秒 |

原生命令使用 `OD_PACKAGED_E2E_MOKINA_RECOVERY=1`、namespace `mokina-local-repair-v003-11`、原隔离 tools-pack 根，再执行：

```sh
pnpm --filter @open-design/e2e exec vitest run -c vitest.config.ts specs/mac.spec.ts -t 'Mokina (recovery native interruption|native DOCX|native source change)' --maxWorkers=1
```

新增用例初次三次失败分别来自测试的文件选择就绪假设、误把摘要当全文且没有勾选片段、误写成功状态为 200（实际创建返回 201）。按真实产品修正测试后通过，未改产品以迎合测试，三次失败日志保留。这些不是产品 red/green 修复证据。

## 安全与远端现状

只读 GitHub 核实 PR5–10 均 MERGED；修复分支最新成功 CI 为 [37603369750](https://github.com/MainQuestAI/Mokina/actions/runs/37603369750)，head `7ced0cf9`，没有当前 `2b6ded9d` 的 CI 证据。两个关闭回归及 FileWorkspace 已在根 CI 显式执行列表中。新增原生用例属于 mac opt-in，不冒称 Linux CI 覆盖。

本轮只按已知公告 ID 读取公共公告，没有上传依赖清单。现有生产审计报告的 `2 high / 3 moderate / 1 low` 是前轮快照，并非本轮全量刷新结果。

| 项目 | 当前核查与边界 |
|---|---|
| braces 3.0.3 / GHSA-vfj7-8cjw-p6xm | [公告](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 仍显示无补丁。现有 watcher 使用 disableGlobbing，已测文件事件路径通过；未把它推广为所有依赖/构建模式都不适用。high 保留。 |
| http-cache-semantics 4.2.0 / GHSA-ch52-4w7c-c8xp | [公告](https://github.com/advisories/GHSA-ch52-4w7c-c8xp) 仍显示无补丁。实际 GotDownloader 的 A/B/B 授权请求隔离通过；这不是启用自定义 HTTP cache 或制品磁盘缓存的全面隔离证明。high 保留。 |
| nanoid / image-size 已处置链 | 未变更 owner/override；本轮畸形图片/正常转换相关既有 daemon 回归通过。未重做全部新包 Mermaid 编辑保存/重开链。 |
| 其他 moderate/low | 继续按既有安全台账跟踪；未接受风险，也不因本次未触发而取消。 |

## 剩余项目与下一步

| 项目 | 尚缺什么 / 下一步 |
|---|---|
| 对应 HEAD 的 CI | 完成本轮测试/台账审阅后，推送当前修复分支并 dispatch 既有 `ci.yml`；须保持无合并、无发布。原接续计划对此单列授权，本轮未自动执行。 |
| 刷新安全审计 | 原会话的依赖清单外发被自动审批拒绝，理由是可能包含私有包名/版本。仍需明确允许该外发，或提供已批准的审计报告；读取公共公告不等于全量审计。 |
| 两项 high 的最终处置 | 上游无补丁；现有缓解不足以关闭。需独立完成全部适用路径证明，或实施并验证本地依赖修补；本轮未引入未经验证的 fork。不能仅用风险接受代替默认工程门槛。 |
| 同包完整候选链 | local.11 的原生 CSV/真实模型、两预算复算、三版本×HTML/ZIP/PDF 九文件、正式恢复 ZIP、完整错误格式、原生尺寸/键盘等仍未全齐，local.10 通过记录不迁移。新增实际 409 仅补足源变化拒绝这一子场景。 |
| 真实旧 profile 升级 | 待明确旧 profile 路径及应用退出，先做保护副本再验证工作副本；未擅自复制当前用户资料。已请求最小输入。 |
| 品牌与人工验收 | 授权真实品牌 A/B、模型目的地，中文 IME、外部打开及专业评审/用户签收仍需对应资料和人员。合成 Markdown 会话隔离不能替代品牌验收。 |
| 白屏与双业务窗口 | 白屏依先前明确意见暂跳过、未关闭；单窗口双会话不证明同 profile 双原生业务窗口。 |

旧 profile、旧包、旧失败证据与恢复记录均保留。本轮生成的数据只属于原隔离 QA namespace；组合原生测试 afterAll 使用 tools-pack stop 结束应用。源码差异仅新增测试与验收文档，后续若修改运行代码或资源，须递增候选并重验，不能拼接不同包的通过记录。
