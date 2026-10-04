# V0.0.2 Local Preview · 证据记录（持续更新）

规则：只记录实际执行过的命令与结果；未跑的项明确写 `not_run`，不以文档推测代替。

## T00 基线与实现映射

| 证据 | 结果 |
|---|---|
| 分支/工作树 | `codex/mokina-v0.0.2-local-preview` @ `df4a0b2`；`Mokina-worktrees/v0.0.2-local-preview`；起点 = PR3 head（含 R2 修复） |
| 环境 | macOS 27.0.1 arm64；node v24.12.0；pnpm 10.33.2（corepack shim 见 `baseline.md`）；codex-cli 0.160.0 |
| 依赖 | `corepack pnpm install --frozen-lockfile` exit 0 |
| 产出 | `docs/mokina-v0.0.2/baseline.md`、`implementation-map.md`；提交 `a6cc708` |

## T01 产品身份 profile

| 证据 | 结果 |
|---|---|
| 改动 | `packages/release/src/mokina-product.ts`（新增）+ index 导出；`tools/pack` `resources/mokina-product.json`、`config/product-profile.ts`、`mac/identity.ts`、`mac/paths.ts`、`mac/builder.ts`、`mac/app.ts`；`apps/packaged` `config.ts`、`window-title.ts`、`sidecars.ts`、`index.ts`、`headless.ts` |
| 单测 | release 9/9；tools/pack 44 文件 339 pass/8 skip（含新增 identity/mac render 用例）；packaged 23 文件 334 pass（含 window-title 用例） |
| typecheck | `@open-design/release`、`@open-design/tools-pack`、`@open-design/packaged`、`@open-design/desktop` 均 exit 0 |
| guard | `pnpm guard` exit 0 |
| 未跑 | 真实 `tools-pack mac build` 产物检查（Info.plist/包内 config）→ 归入 T18；AC02/AC03 的 network-inspection 断言归 G1/T18 |
| 提交 | `cbc030d` |

## T03 稳定桌面存储

| 证据 | 结果 |
|---|---|
| 改动 | desktop：`main/mokina-recovery-store.ts`（新增；CAS/单写者/原子写/键白名单/容量上限）、`main/runtime.ts`（4 个 IPC，sender 校验）、`main/preload.cts`（`recoveryStore` 桥）；host：`protocol.ts` 类型 + index 导出；web：`runtime/persistence/mokina-recovery-store.ts`（新增 facade：镜像/CAS 重试/hydration 不覆盖本地较新值）、`composer-draft.ts`、`send-request-state.ts`、`ChatComposer.tsx`、`ChatPane.tsx` 写入点镜像、`App.tsx` 启动 hydration |
| 单测 | desktop store 10/10（含并发 CAS、损坏记录、容量、跨实例持久）；web facade 5/5（无桥 no-op、CAS 更新、删除、hydration 不覆盖、once-per-session） |
| 回归 | desktop 52 文件 498 pass；web 受影响 6 文件 59 pass（send-request-state / composer-draft / draft-persistence / quote-send / next-step / facade） |
| typecheck | web、desktop exit 0 |
| 未跑 | 真机 IPC 联调（打包后验证跨端口恢复）→ 归入 T18/T19；AC09/AC10 故障注入待桌面包可用后执行 |
| 提交 | 见下（本次提交） |

## 待办（诚实清单）

- T02 打包依赖闭包：需真实 `tools-pack mac build`；未开始。
- T04 Codex 连接诊断：待核验既有实现后决定增量。
- T05–T14：未开始。
- T15–T19：未开始；T19 用户签收为 not_run（必须用户本人完成）。
