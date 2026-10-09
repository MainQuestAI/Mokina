# Mokina

仓库：`MainQuestAI/Mokina`（https://github.com/MainQuestAI/Mokina）。这是 OpenDesign 宿主的 Mokina fork，不要拉取或指向上游 OpenDesign 仓库。

## 当前产品（桌面版）

Mokina 是 macOS arm64 桌面营销工作产品（OpenDesign 宿主 + Mokina edition）。**当前已签收版本为 `0.0.2-local.6`**（本地候选系列；GitHub Release 未发布，公开发行另行授权）。

| 项目 | 值 |
|---|---|
| 已签收安装包 | `Mokina-mokina-local.dmg` / `.zip`，macOS arm64，摘要与 manifest 见 [`docs/mokina-v0.0.2/runbook.md`](./docs/mokina-v0.0.2/runbook.md) |
| 包产品源码 | `8950986e41e5047c56aab4d3ba9fda900902aa9a` |
| 历史 V0.0.3 修复基线 | `93531732e2e01e6bfdf5153f3685af4bf132f850`（本轮开始时 main；不是 local.6 包源码） |
| V0.0.2 标签 | 注释标签 `e3e1a7cf`，指向 `e3e8848e` |
| 支持平台 | 实测 macOS arm64；Windows/Linux、签名、公证、自动更新未纳入 |
| 开发中版本 | v0.0.4 品牌/UI换新，PR13 分支 `codex/mokina-v0.0.4-brand-ui`，复审产品提交 `9eb266c8`；本地合并验证分支 `codex/mokina-v0.0.4-native-validation-20261009`。S01–S06 实施见 [实施记录](./docs/mokina-v0.0.4/2026-10-08-implementation.md) |
| 本轮 macOS 原生候选 | `0.0.4-local.1`，build `a7f190a5`，产品目录与 PR13 复审一致；首轮同包安装、菜单/诊断导出及 15 项资料选区/恢复已有证据，真实 CLI 连接超时和诊断默认文件名旧前缀待处理；[验证与清理记录](./docs/mokina-v0.0.4/2026-10-09-native-validation.md)。现用 local.11 保留，新候选临时副本已清理，用户签收待验 |
| 历史 V0.0.3 隔离 QA 候选 | `0.0.3-local.7`，source `4cf68e9c`；[同包原生范围与剩余门槛](./docs/mokina-v0.0.3/2026-10-07-local7-native-verification.md)；未标整体验收或公开发布 |

日常打开：从 DMG 安装后在 Finder 打开 `Mokina.app`。app 自带 web、daemon 与 PDF 文本工具；**生成任务需要已登录的 Codex CLI 与模型网络**（外部依赖，不在包内）。首次使用与失败恢复指引见 Runbook「local.6 交付与使用」；连接与前置检查在 app 内「设置 → 连接诊断」。

## 源码开发入口（原生实现）

原生实现位于 [`open-design/`](./open-design/)，基于固定的完整 OpenDesign 宿主（当前基线 `ac6115406f3f780ef5c624a9aad1a87cbbad882a`）。运行数据目录契约与全部命令规范见 [`open-design/AGENTS.md`](./open-design/AGENTS.md)；启动必须显式指定空的 `OD_DATA_DIR`（namespace 本身不隔离数据）。最简启动：

```sh
cd open-design
corepack pnpm install --frozen-lockfile
OD_DATA_DIR="/path/to/empty-data-dir" corepack pnpm tools-dev start web \
  --namespace mokina-dev --daemon-port 18613 --web-port 18614 --no-env-file
```

Web 打开 `http://127.0.0.1:18614`；daemon API 在 `http://127.0.0.1:18613`。停止：`corepack pnpm tools-dev stop --namespace mokina-dev`。Mokina edition 默认 on；以 `NEXT_PUBLIC_MOKINA_EDITION=off`（Web 构建）与 `MOKINA_LOCAL_EDITION=off`（daemon）显式关闭。

V0.0.1 运行与验收记录见 [`docs/Mokina-V0.0.1-运行与验收记录.md`](./docs/Mokina-V0.0.1-运行与验收记录.md)；V0.0.2 证据见 [`docs/mokina-v0.0.2/`](./docs/mokina-v0.0.2/)；后续批次状态见 [`TODOS.md`](./TODOS.md)。

## 历史原型：Marketing Desktop · V6.2（已归档，非当前产品）

<details>
<summary>0.2.1（2026-09-14）单 HTML 原型说明，点击展开。不代表原生版本的能力或验收结果，仅作行为基准与回归素材。</summary>

沿用 V6.2 的首页、侧栏、对话、侧面板和成果 Canvas，不是第二套工作台。修复否定执行、计划范围、引用正文和计划模式开始；0.2.0 包及原 V6.2 基线保留。

### 打开与运行

需要 Node.js 22+、Python 3；打包还需 zip/unzip。无 npm 依赖安装、无外部 API 密钥。

```bash
npm run build
npm run dev
```

打开 [Marketing Desktop 原型](http://127.0.0.1:4178/Marketing%20Desktop%20Demo.html)。也可直接打开根目录 `Marketing Desktop Demo.html`；为兼容浏览器文件限制，评审建议使用上述本地地址。单 HTML 内嵌交互与样式，专业场景原图按相对路径加载，旁边的 `public/` 不要移走。

```bash
npm test                  # V6.2 74 项 + 通用营销 33 项状态/契约测试
npm run verify:repair-downloads # 检查 0.2.1 本轮真实下载样本
npm run verify:downloads  # 复核保留的 0.2.0 历史下载样本，不算本轮页面证据
npm run build:v62         # 输出 output/demo-spacemaster-v6/finalized.html，不覆盖原基线
npm run package           # 打包、解压、重建、测试、下载内容检查
```

### 怎么评审

从首页选择品牌战略、社媒内容或运营分析，仅填入目标；点击“使用示例资料”后发送。可在原计划面板调整交付，保存不制作；开始后在对话成果卡打开 Canvas，继续修改、比较、采用。运营分析允许真实上传 CSV，选定结论后另开工作。

- [现行 Spec 与 35 AC 分类](./docs/Marketing-Desktop-Agent-Spec-v0.2-V6.2基线.md)
- [三条演示脚本](./docs/Marketing-Desktop-演示脚本.md)
- [0.2.1 修复验收与限制](./docs/Marketing-Desktop-0.2.1-修复验收.md)
- [合成资料](./docs/fixtures/)
- [截图与真实下载样本](./output/playwright/)

产品上市从相同首页显式选择进入；“查看完整流程”在专业场景会清除本演示存储并播放完整故事，页面会先确认，请先导出自己的工作备份。普通营销工作只显示三场景操作指引，不自动启动专业演示。

### 数据与能力边界

文本读取、CSV 计算、人工编辑、版本、引用、保存、下载和恢复为真实本地操作。品牌判断、文案、计划建议和专业生成均为标注的情景演示，未接模型、后端或外部发布。自有资料可以读入和编辑，但不会冒充已据其自动生成策略。PDF/Word/图片只保留文件，未自动解析。

当前存储键 `mokina-marketing-desktop-prototype`，从首次读取起独立于原 V6.2。设置 → 恢复备份 → 选择 JSON → 合并导入；相同 ID 不重复，无法唯一判断旧会话归属的成果保留历史/共享。换浏览器或改端口属于另一存储位置，请通过备份迁移。

### 源码

```text
src/demo-spacemaster-v6/  原 UI/业务组件与本地专业流程
src/marketing-desktop/
  model.js               thread/计划/快照/版本/CSV/兼容
  scenes.js              合成资料、变体与示例结果
  contracts.js           有限动作识别、否定优先、范围与配置校验
  workspace.js           原 UI 的局部适配与统一动作入口
  extension.css          新字段/表格的局部样式
  build.mjs              调用原源码组合构建
  package.mjs            完整离线包与解压验证
tests/                   可复现状态测试，非浏览器验收
scripts/                 下载样本内容验证
```

旧 `marketing-desktop.js/css` 重做界面已停用，不参加构建、打包；保留于开发目录仅为历史。旧 v0.1 系列输出不是当前交付，旧完成记录已标注作废边界。本轮浏览器证据与历史结果分开。

第三方字体、品牌图、Canva 示例等保留原基线资产，本包用于本地原型评审，不新增对其商业分发授权的断言。

有限调整：品牌固定 90 天，从小红书、微信公众号、文字交流中选 1–2 个触点；社媒 1–5 条、统一小红书或微信公众号、可指定起始日期。文字和参数冲突时先修改文字或按文字同步参数，不生成相冲突的默认稿。平台选择仅改变排期，不等于平台专门改写。未知范围可保存计划，制作前停下，用户可选择人工编辑。

</details>
