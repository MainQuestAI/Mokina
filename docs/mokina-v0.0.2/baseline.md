# V0.0.2 Local Preview · 基线与环境记录（T00）

日期：2026-10-04　｜　任务：T00（R01，退出门 G0）
工作区：`/Users/dingcheng/Coding-Project/02-key-project/Mokina-worktrees/v0.0.2-local-preview`（分支 `codex/mokina-v0.0.2-local-preview`）

## 1. 固定基线与漂移核对

| 项 | Spec 规划值 | T00 实际核对值 |
|---|---|---|
| 仓库 | MainQuestAI/Mokina | `origin = https://github.com/MainQuestAI/Mokina.git` ✅ |
| PR3 状态 | open / draft / 未合并 | 2026-10-04 复核：OPEN、isDraft=true、未合并、mergeStateStatus=CLEAN ✅ |
| 规划基线 | `53da96ca9080afb5b5141490d6e95858a6e18e9a` | **已漂移**；PR3 当前 head `df4a0b2699cd2b37df2099b38da8fe8375d14b41` |
| 本分支起点 | — | `df4a0b2`（吸收 PR3 全部 R2 修复后提交，不重复实现已完成能力） |
| PR base | `33fa8434` | 与 origin/main HEAD 一致（`33fa843` Merge PR #2），main 未越过 PR3 base ✅ |

### 1.1 R2 修复轮差异（53da96c..df4a0b2，9 commits）

- `send-request-state.ts`（+56）：pending 发送新增**显式重发（同 request 身份）/丢弃出口**；容量口径改为"仅 in-flight 占容量"（unknown/draft 不占）；**oversize 硬门移除**，改为保留 receipt 身份、preview-only。
- `ProjectView.tsx`（+134）、`EntryNavRail.tsx`、`RailRecentRow.tsx`、`useMokinaProjectSummaries.ts`：pending-send 出口接入、legacy entry hints、截断计数中性文案。
- 19 locale 文件新增键；B0+B1 Spec `docs/specs/Mokina-B0-B1-开发Spec-2026-10-03.md` 收窄 FR-08/FR-09 为"仅禁止自动重发"，新增 R2 验收。
- `e2e/ui/real-daemon-run.test.ts` 增加 R2 真实 daemon 用例。

**对 Spec 的实施修正（已纳入本分支执行口径）：**

1. §6.4 发送状态表按 R2 后语义执行：`prepared/dispatching/unknown/accepted/definitive-failed` 之外，R2 增加"显式重发/丢弃"为待办出口；T03/T11 的复用对象是 R2 后实现。
2. `FileViewer.tsx`、`materials.ts`、`packages/contracts` 在 R2 delta 中**未改动**，Spec S10/S11/S12 行锚与 S06/S07/S08 声明在本分支起点仍有效。

### 1.2 Spec 审查结论的 P2 修正（门禁映射）

[审查结论](../Mokina-V0.0.2-Spec包-审查结论.md) 发现 5 处 AC 门禁早于其依赖任务门禁。本分支执行时的裁决：

| AC | 原门禁 | 依赖任务 | 执行裁决 |
|---|---|---|---|
| AC16 | G2 | T05(G2)+T15(G5) | 解析侧断言在 G2 初验；安全断言（DTD/超限）随 T15 于 G5 终验 |
| AC23 | G2 | T06(G2)+T15(G5) | 权限/注入边界 G2 初验；指令边界安全测试 G5 终验 |
| AC28 | G3 | T11(G3)+T17(G5) | G3 初验，T17 终验重跑 |
| AC41/AC42 | G4 | T14(G4)+T15(G5) | 白名单/防篡改 G4 初验，G5 终验重跑 |

## 2. 环境记录（目标 Mac）

| 项 | 值 |
|---|---|
| macOS | 27.0.1（build 26A434） |
| 架构 | arm64 |
| Node | v24.12.0（`/usr/local/bin/node`，满足 engines `~24`） |
| pnpm | 10.33.2（Corepack，与 packageManager 一致） |
| Codex CLI | codex-cli 0.160.0（`~/.npm-global/bin/codex`，`~/.codex/auth.json` 存在） |
| 依赖安装 | `corepack pnpm install --frozen-lockfile` 成功（exit 0） |
| pnpm 嵌套调用 | 全局 `pnpm`（Homebrew 10.30.1）不满足 engines；已用 `corepack enable --install-directory ~/.local/share/corepack-shims` 安装 10.33.2 shim。后续命令 PATH：`/usr/local/bin:~/.local/share/corepack-shims:$PATH`（嵌套 `pnpm` 才能命中 10.33.2，Spec S03 要求） |

## 3. 隔离与保护

- 独立 worktree + 独立分支，不切换用户 main；用户未提交资料保留在原仓库。
- 后续运行验证使用独立 `OD_DATA_DIR`（本记录随 T02/T03 补充具体值）。
- 本 T00 未运行产品构建、未调用模型、未修改任何产品代码；仅新增本记录与 implementation-map。
