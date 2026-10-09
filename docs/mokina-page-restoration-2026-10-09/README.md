# Mokina P01–P08 修复与候选交付

日期：2026-10-09。状态：代码已实现，浏览器定向回归通过，原生候选检查部分通过；尚未完成用户视觉签收与完整原生验收。

## 交付身份

- 分支：`codex/mokina-full-page-restoration`。
- 产品源码／打包提交：`75dfeb8aec492e0ff0f25bb288cff89b33129419`。
- 候选：`0.0.4-local.2`，macOS arm64，portable，ad-hoc 签名。
- 安装候选：[DMG](/Users/dingcheng/Mokina-UI-Restoration-QA/releases/0.0.4-local.2/Mokina-mokina-local-v004-2.dmg)。SHA256：`8169fad8f0bc2248cb3f5474a82009a48aac214d073208fcf1bde52e5677844e`。
- 完整包身份：[release-manifest.json](../../output/page-restoration-2026-10-09/release-manifest.json)。ZIP、DMG、payload 及 SHA256SUMS 均保留在上述 releases 目录。
- 现用 `/Users/dingcheng/Applications/Mokina.app` 保持 `0.0.4-local.1`，未被本轮候选覆盖。

## 基准与对照

设计源为用户指定的 `mokina-v0-0-2-4c39`。实施开始时冻结文件和资产：[source-manifest.json](../../output/page-restoration-2026-10-09/source-manifest.json)，采集时间 14:11:49。后续品牌与行为契约覆盖历史原型中的颜色、字号和控件规则。保留已选黑白标志，不引入原型模拟数据逻辑。

[打开逐页前后对照](../../output/page-restoration-2026-10-09/comparison.html)。修复前来自 `f0e3f8de` 隔离基线；修复后来自本轮实现。八页 × 四种视口各有截图，共 64 张前后截图，另有原生截图。视口为 1440×900、1280×720、900×600、390×844；实际内容区尺寸记录在 `after/*-geometry.json`，例如 1440 的资料工作区为 1194×832。

前后截图使用相同合成内容和操作状态，项目 UUID 与创建时间由各自真实后端生成。冻结原型保留其示例内容；现有原型参考截图并未组成八页四尺寸的完全同数据矩阵，因此不把它声明为严格像素验收。页面布局、品牌和任务分区的最终视觉签收仍待用户检查。

## 逐页差异与可达入口

| 页面 | 原问题与本轮修改 | 真实入口和证据 |
|---|---|---|
| P01 开始工作 | 统一目标标题、任务和输入区，宽屏双栏／窄屏顺排；沿用附件准备、恢复与提交状态 | 导航“开始工作”；`after/*-P01.png`。附件失败、离开恢复、中文组合输入独立回归 |
| P02 项目 | 卡片集合改为项目、场景、状态、固定来源、操作的工作清单；加载／空／错误分离，不将未知推为完成 | 导航“项目”；`after/*-P02.png`。真实项目集合排序、来源读取及作用域隔离单测 |
| P03 工作区 | 统一导航／协作／成果层级；保留独立滚动、列宽和阅读模式，明确无成果／制作／失败状态 | 打开项目或成果文件；`after/*-P03.png`、`native-P03.png` |
| P04 资料 | 独立资料任务视图，选择与正文摘录对齐，显示来源、限制和排除原因；固定确认区 | 工作区“资料”；`after/*-P04.png`、`native-P04.png`。精确摘录／快照回归；进入资料聚焦工作区，返回阅读恢复原布局 |
| P05 章节修订 | 独立视图显示基础版本、章节、要求和候选；比较内容单独滚动，显式采用 | 成果工具条“修订章节”；`after/*-P05.png`、`native-P05.png`。候选比较、恢复、冲突与窄屏键盘回归 |
| P06 版本与导出 | 版本视图统一选中身份；历史／候选／正式稿区分；缺失目标版本明确失败，不回退其他版本 | 版本入口；`after/*-P06.png`、`native-P06.png`。指定版本下载／入口解析单测，原生实选历史 v1 |
| P07 继续制作 | 左侧固定来源／章节／要求，右侧品牌／素材／创建摘要，窄屏顺排；创建后为未发送草稿 | “继续制作”；`after/*-P07.png`、`native-P07.png`。浏览器和原生均创建真实接续项目，保留历史 v1 摘录 |
| P08 活动页成果 | 沿用统一成果壳、工具条和固定来源入口；HTML 留在原预览隔离边界 | 打开活动页 HTML；`after/*-P08.png`。真实 HTML 预览和返回固定历史版本路径回归 |

共享品牌覆盖导航横标、折叠 mark、空态；去除导航底部重复产品身份。Mokina edition 内统一浅色实底正文、局部中性玻璃、蓝色主要操作及状态，保留语义色、客户品牌和用户作品。19 个支持语言同步文案。

## 实现边界

新增 `MokinaProjects`、`MokinaFixedSource`、`MokinaProjectShell`、`MokinaTaskSection`，复用现有项目、文件、会话、版本及恢复控制器。独立任务视图保持挂载，不在切换时重建项目或发送请求。固定来源版本通过现有项目路由扩展携带版本身份，保留文件定位；缺失版本不会自动打开当前稿。

没有新增后端 API、持久化 schema 或数据迁移。另修复了被后续刷新取代的项目加载状态未结束问题。

## 验证结果与边界

| 检查 | 结果／证据 |
|---|---|
| 工程 | `pnpm guard`、全工作区 `pnpm typecheck`、后续 Web typecheck、Web 生产构建通过；`guard-release.log`、`typecheck-final.log`、`typecheck-material-layout.log`、`package-release-clean.log` |
| 定向单元测试 | 14 文件 144 通过；指定版本下载／输入／恢复另 5 文件 49 通过、1 跳过。`unit-release.log`、`unit-export-input.log`。跳过项是 jsdom 的 IME，另有浏览器覆盖。未宣称全仓库所有测试通过 |
| 最终四尺寸页面链路 | 4/4 通过，每项覆盖 P01–P08、真实 HTML、资料快照、视图草稿隔离和固定版本返回；`browser-final-pages.log`、`after/final-results.json` |
| 工作区行为 | 14/14 通过（含四尺寸页面链路及 10 个工作区场景）；长路径、历史稿限制、接续草稿／刷新、900 和 390 比较弹窗控件与焦点；`browser-final-workflow.log` |
| 其他浏览器检查 | 导航／品牌／空态等 8 项、附件准备与恢复 6 项通过，原始记录分别见 `browser-suite.log`、`browser-workflow.log`；早期失败修复后的复跑以上方最终记录为准，不将被中断整组计为通过 |
| 中文组合输入 | Chromium CDP 输入中文后 Enter 不误发、不创建项目且文本保留，1/1 通过；`browser-ime.log`。未替代 macOS 实体输入法验收 |
| 原生候选 | 安装和启动成功；builder 与安装副本的 deep/strict codesign 通过；图标 SHA 与已选黑白资产相同。P03–P07 入口、历史 v1 选择、接续未发送草稿通过；见 `native-*.json/png` |
| 原生材质 | 正文和工作区背景白色、无 blur；导航／工具条有局部 blur，原生截图已保存。未修改桌面设置，未将静态截图视作完整动态材质签收 |

### 明确未通过／未完成项

1. 隔离原生环境首次 Codex 连接测试约 45090ms 超时，未通过首启模型连接和真实生成链路验收。没有重发生成请求。`native-home.png`、`native-P01.png` 实际是首启配置状态，不能作为原生 P01 成功证据。浏览器 P01 已通过。
2. 八页视觉最终签收、完整动态材质检查及原型八页同数据同尺寸截图矩阵尚未完成；现有 64 张应用前后截图和冻结参考可用于审查。
3. 原生候选是 ad-hoc 本地候选，未声明完成公证或正式发布。

## 清理

原生生命周期已停止；临时安装、builder、payload stage、隔离运行数据和 launcher namespace 已删除。逐个注销本轮应用及 Helper 的 LaunchServices 记录，最终匹配为空、进程匹配为空。安装 DMG 在安装后已卸载。详见 `native-cleanup.json`、`cleanup-verification.json`。

七个本轮失败浏览器运行目录在保存 JSON／日志归档后移除，删除前均无活动进程；见 `browser-cleanup.json`。修复前基线 worktree 已归档。保留修复源码、候选包、截图、失败日志与复现脚本；现用应用和用户数据保持可用。

所有上述相对日志和截图位于 [本轮证据目录](../../output/page-restoration-2026-10-09/)。
