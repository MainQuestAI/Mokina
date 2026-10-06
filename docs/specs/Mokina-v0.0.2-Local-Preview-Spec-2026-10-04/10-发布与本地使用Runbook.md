# 10｜发布与本地使用 Runbook

本文分为开发者和最终用户两条路径。开发命令是基于当前工具界面的实施模板，须在 T01–T18 完成对应改造后在实际机器执行；**本 Spec 包没有附带已构建的 Mokina.app**。

## 10.1 开发者准备

读取根及 apps/packages/tools/e2e 的 AGENTS，保留既有工作树与用户资料，在隔离 worktree 开发。只使用 `MainQuestAI/Mokina`，不要从上游重新拉一份 OpenDesign 替换它。重新核对 PR3 和精确基线。

运行环境遵循仓库 Node `~24`、pnpm `10.33.2`，用 Corepack 对齐；命令内再次调用 pnpm 时也必须命中该版本。不要为了方便改变用户全局 Codex/Node 配置。[S03]

```sh
cd open-design
node --version
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm guard
corepack pnpm typecheck
```

单元/构建命令保持 package/tool-scoped，以各目录实际 package.json 与 AGENTS 为准；不增加根 `pnpm build/test/dev/start` 别名。CI 同样不使用历史根目录原型命令。

## 10.2 开发态和生产态分离

需要开发查看时使用既有 tools-dev；OD_DATA_DIR 必须由操作者选择合法隔离目录并遵守根 AGENTS，namespace 不代替数据隔离。下面变量由操作者明确设置，不提供另一个默认数据路径。

```sh
: "${MOKINA_QA_DATA_DIR:?设置按 AGENTS 契约选择的隔离 QA 数据目录}"
OD_DATA_DIR="$MOKINA_QA_DATA_DIR" corepack pnpm tools-dev start web   --namespace mokina-local-qa --daemon-port 18613 --web-port 18614 --no-env-file
# 用既有 tools-dev status/logs 核对归属；结束后只停止本 namespace。
corepack pnpm tools-dev stop --namespace mokina-local-qa
```

端口只是示例传输配置，不参与目录或持久身份；占用时按工具机制选择可用端口。生产构建和开发热更新不能共用同一构建输出进行并行验收。[S13]

## 10.3 构建本地预览候选包

T01 的 Mokina profile 接线完成后，复用已存在的 flags，不发明当前未支持的 `--product` 参数。打包默认产品由显式 Mokina build profile/edition 配置决定，并在构建结果中检查。

```sh
: "${MOKINA_PACK_DIR:?设置本轮包输出/验证目录}"
corepack pnpm tools-pack mac build   --dir "$MOKINA_PACK_DIR"   --namespace mokina-local   --app-version 0.0.2-local.1   --portable --to dmg --json
```

`--dir` 不是 daemon 数据根，也不是 cache 根；不要随意加隔离 cache 参数隐藏热缓存身份错误。实际 dmg/app 路径以命令 JSON 和产物清单为准，不根据展示名猜路径。

候选包必须扫描开发路径、凭据、外部 symlink 和缺失资源；检查 profile/版本/架构和 PDF 依赖。先以现有 tools-pack 安装/启动 smoke，再由用户从 Finder 手动启动。两者均记证据。

## 10.4 发行清单

T18 交付：目标架构的安装包；SHA256；产品/源码/构建/依赖清单；真实签名和 notarization 状态；最低支持系统的实际验证范围；已知限制；用户说明；可复现测试记录。engineVersion 取实际构建信息，不能为了显示 0.0.2 批量修改所有底座包版本。

填写 `examples/release-evidence.json` 的实际值并改状态；未知保持 null/not_run。公开发布、自动更新域名、发布账号和签名证书不由本包默认授权使用。首版本地包如未签名/公证必须如实标明；不能把关闭 Gatekeeper 作为标准安装步骤。[E03]

## 10.5 最终用户上手路径

开发完成后，用户应只需要：安装交付包并从 Finder 打开 Mokina；进入模型设置检查已有 Codex；按照明确说明完成一次性 CLI/登录前置；点击真实连接测试；回首页输入自己的营销任务或加载合成测试资料。

如果 Codex 已登录，尊重已有认证，不要求重新登录。若缺少 CLI，显示当前检测结果和官方安装/登录说明，用户完成后重新检查。生成任务依赖外部模型网络和账号，不把本地产品宣传为离线推理。

输入任务时可选择资料，也可直接讨论。结果在原生项目/成果工作区查看；使用“修订章节”生成候选并手动采用；“继续制作”创建新草稿；在版本面板选定版本导出。退出应用后重新打开，从项目目录继续，不需要进入源码目录。

## 10.6 故障处理表

| 用户看到的问题 | 产品应提供的动作 | 禁止的做法 |
|---|---|---|
| 无法启动/连接 daemon | 显示本实例状态、重试自身服务、复制脱敏诊断 | 让用户杀全部 node/Codex 进程 |
| CLI 未发现或未登录 | 跳转原 Agent 设置/官方说明、重新检测 | 静默安装工具、覆写全局配置 |
| 网络/配额/权限错误 | 标出已知类别与原任务状态；允许离线看文件 | 当作“未受理”自动重发收费任务 |
| 发送结果待确认 | 核对原请求、打开已找到的原 run | 普通重试偷偷换 requestId |
| 文件部分读取 | 显示定位和局限，选择可用部分或补文本 | 提示“全文已理解” |
| 候选采用冲突 | 比较最新当前稿和原候选，用户决定下一步 | 自动覆盖或自动 rebase |
| 导出失败/取消 | 重试锁定版本或重新选择保存位置 | 用最新版本替代失败版本 |
| 项目损坏/误操作 | 从已导出的恢复包恢复到新项目 | 直接覆盖原数据、自动恢复运行中的任务 |

诊断默认只含脱敏标识和状态，不上传正文或凭据。用户选择附加更多内容前有预览和说明。

## 10.7 最后签收

用户实际 Mac、实际安装包、实际 Codex 完成 A/B/C 与重启、导出、恢复后，记录“可开始本地持续使用 / 尚有阻断项”。签收人、日期、安装包摘要与最终 sourceSha 对齐。只有该步骤完成才能把本轮从“开发完成”升级为“已交付”。
