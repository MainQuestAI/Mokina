# Mokina

V0.0.1 原生实现位于 [`open-design/`](./open-design/)。它基于固定的完整 OpenDesign 宿主，当前开发与验收状态见 [`Mokina-V0.0.1-运行与验收记录.md`](./docs/Mokina-V0.0.1-运行与验收记录.md)。下文是保留的 V6.2 原型说明，不代表原生版本的能力或验收结果。

## 历史原型：Marketing Desktop · V6.2

当前版本：0.2.1（2026-09-14）。沿用 V6.2 的首页、侧栏、对话、侧面板和成果 Canvas，不是第二套工作台。修复否定执行、计划范围、引用正文和计划模式开始；0.2.0 包及原 V6.2 基线保留。

## 打开与运行

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

## 怎么评审

从首页选择品牌战略、社媒内容或运营分析，仅填入目标；点击“使用示例资料”后发送。可在原计划面板调整交付，保存不制作；开始后在对话成果卡打开 Canvas，继续修改、比较、采用。运营分析允许真实上传 CSV，选定结论后另开工作。

- [现行 Spec 与 35 AC 分类](./docs/Marketing-Desktop-Agent-Spec-v0.2-V6.2基线.md)
- [三条演示脚本](./docs/Marketing-Desktop-演示脚本.md)
- [0.2.1 修复验收与限制](./docs/Marketing-Desktop-0.2.1-修复验收.md)
- [合成资料](./docs/fixtures/)
- [截图与真实下载样本](./output/playwright/)

产品上市从相同首页显式选择进入；“查看完整流程”在专业场景会清除本演示存储并播放完整故事，页面会先确认，请先导出自己的工作备份。普通营销工作只显示三场景操作指引，不自动启动专业演示。

## 数据与能力边界

文本读取、CSV 计算、人工编辑、版本、引用、保存、下载和恢复为真实本地操作。品牌判断、文案、计划建议和专业生成均为标注的情景演示，未接模型、后端或外部发布。自有资料可以读入和编辑，但不会冒充已据其自动生成策略。PDF/Word/图片只保留文件，未自动解析。

当前存储键 `mokina-marketing-desktop-prototype`，从首次读取起独立于原 V6.2。设置 → 恢复备份 → 选择 JSON → 合并导入；相同 ID 不重复，无法唯一判断旧会话归属的成果保留历史/共享。换浏览器或改端口属于另一存储位置，请通过备份迁移。

## 源码

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
