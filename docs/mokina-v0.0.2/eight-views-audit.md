# T16 冻结设计包核验与 P01–P08 机械对照

日期：2026-10-05　｜　环境：本机 dev 栈（tools-dev，隔离数据根，namespace `mokina-local-qa`），IAB 浏览器在 1440×900 与 1280×720 两个视口实测。

## 1. 冻结设计包核验（21/21）

- 包：`docs/designs/mokina-v0.0.2-20261002/design-baseline.zip` + `manifest.json`（project `mokina-v0-0-2-4c39`，capturedOn 2026-10-02，productBase `67d5717`）。
- 解包后逐文件核对 SHA-256 与字节数：**21/21 通过**；并直接从 zip 读取再次核对：21/21 通过。
- 包内容：设计说明（PRODUCT/DESIGN/DESIGN-BRIEF/MATERIAL-PARAMS/ACCEPTANCE/brand-spec）+ 原型实现（index.html、styles.css、glass.css、stage-two.css、glass-material.js、app.js、design-system/{mokina-system.css, liquid-workspace.css, mokina-icons.js, mokina-layout.js}、tests/×3）。
- 冻结参数（`MATERIAL-PARAMS.md` + `mokina-system.css`）：材质三变体 sidebar 11px/3.3px/0.40、toolbar 8px/3.5px/0.26、menu 10px/4.4px/0.42；`--mk-duration:160ms`、`--mk-radius:16px`、`--mk-control-radius:8px`、`--mk-target:44px`、`--mk-icon-stroke:1.65`、`--mk-control-fill` 0.58α / `--mk-control-blur:7px`、`--mk-glass-fill` 0.32α；减少动态/减少透明度降级要求；页面地图 P01–P08。

## 2. 产品侧设计与冻结包的关系（口径）

Spec 02 §2.5 明确：**保留 PR2 已实现的 360px 协作栏默认值、316–470px 可调区间、20px 工作区圆角**；冻结包是"品质参照"（材质层次、留白、状态、目标尺寸与降级要求），不是逐像素重写。产品已有自成体系的材质层：`src/styles/material.css`（ultrathin/thin/regular/thick 四档、`--scrim-*` 统一遮罩、`.od-glass-refract` SDF 折射、token 级 accessibility fallback）、`tokens.css`、`app-wash.css`；`prefers-color-scheme` 全部经 `html:not([data-theme])` 守卫（抽查 chat.css/primitives.css/tokens.css 均符合，显式 `data-theme` 优先）。

## 3. P01–P08 机械对照（截图 + 断言）

| 视图 | 产品实现 | 1440×900 断言 | 1280×720 断言 | 截图 |
|---|---|---|---|---|
| P01 开始工作 | `/`（EntryShell/HomeHero/Composer） | 无横向溢出；无用例被底部裁切；玻璃面 2 处；含「Materials & background」入口 | 无溢出/裁切 | `P01-home-1440x900.png`、`P01-home-1280x720.png` |
| P02 项目 | `/projects`（Recent 列表 + 卡片菜单） | 无溢出/裁切；4 个项目行渲染 | —（同构列表，1440 已覆盖） | `P02-projects-1440x900.png` |
| P03 工作区 | `/projects/<id>/files/<file>`（协作栏 + 成果区） | 无溢出/裁切；玻璃面 9 处；修订/继续制作/版本/Export 工具条齐备 | 无溢出/裁切；工具条完整可见 | `P03-workspace-1440x900.png`、`P03-workspace-1280x720.png` |
| P04 资料 | 资料与背景面板（T07 新增，工作区资料文件） | 三层信息实测：`brief.md · Uploaded · 0.3 KB` → `Readable` → `Selected 0 / 24,000 characters`；预览可读范围与冻结按钮在位 | —（面板随宽度收缩，无溢出已在 P03 同页验证） | `P04-materials-1440x900.png` |
| P05 章节修订 | 版本面板「修订章节」：选择章节 + 修改要求 + 生成候选（不改当前稿） | 面板打开；`生成候选（不改当前稿）` 禁用态正确；无溢出/裁切 | — | `P05-revision-1440x900.png` |
| P06 版本与导出 | 版本面板时间线 + Download 菜单 | 4 个版本（v4 current / v3..v1）；菜单 = PDF / image / .zip / **standalone HTML** 四项齐备；无溢出/裁切 | — | `P06-export-menu-1440x900.png` |
| P07 继续制作 | 版本面板「继续制作」：固定来源 + 目标任务 + 章节勾选 + 创建（不发送） | 从 v4 取 7 个章节勾选；**目标任务选择器在位**；创建按钮明确"不发送" | — | `P07-continuation-1440x900.png` |
| P08 活动页成果 | 通用 HTML FileViewer 打开 `landing.html` | 活动页真实渲染（品牌 logo、主标语、CTA）；同一工具条可修订/继续/导出；无溢出 | — | `P08-landing-1440x900.png` |

> 说明：表中 1440×900 即为断言列；1280×720 列仅列实测项。所有断言来自页面内 `getComputedStyle`/`getBoundingClientRect` 计算，不是目测估计。截图同时保留为视觉证据。

## 4. 检查中澄清与未覆盖

- **深色用户气泡不是缺陷**：浅色主题下用户消息为深底白字气泡，`chat.css` 注释写明与稿子一致（缺口右下），非主题错乱；`data-theme="light"` 时所有 `prefers-color-scheme` 块被 `html:not([data-theme])` 正确屏蔽（抽查通过）。
- 点击动作在 IAB 中多次被可操作性检查拒绝（元素未接收指针事件），审计改用页面内 DOM click 完成，属审计工具路径差异，不影响事实采集；建议后续用仓库自家 Playwright 套件复跑交互级用例。
- **未覆盖（诚实边界）**：主观审美/视觉质量终评（需要人眼或用户）；`prefers-reduced-transparency` 系统级降级的浏览器实测（token 级 fallback 存在但未逐屏截图）；其余 17 locale 的正式翻译（当前为英文回退）；Safari/Firefox 合成输出（上游原型亦未验证）。
