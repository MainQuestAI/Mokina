# 共享玻璃材质参数与边界

实现：`glass.css` + `glass-material.js`。HTML 中的 SVG 滤镜定义只作为旧基线／非本阶段页面的回退。新材质只在 `body.material-stage-one` 的方案工作区、首页现有“更多”弹出菜单，以及独立 `material-compare.html` 的新材质侧启用；方案章节修订页也沿用方案工作区材质；资料、版本、继续制作及其他项目保留原布局和行为。

| 变体 | 边缘带宽 | 最大位移 | 背景预模糊 | 用途 |
| --- | ---: | ---: | ---: | --- |
| sidebar | 11 CSS px | 3.3 px | 0.40 px | 中性环境透射；长边不过度抖动 |
| toolbar | 8 CSS px | 3.5 px | 0.26 px | 成果工具条与协作输入区共用；真实滚动内容经过背景 |
| menu | 10 CSS px | 4.4 px | 0.42 px | 更厚、更实以保持短菜单可读 |

参数校对（2026-09-30 复验）：上表已按 `glass-material.js` variants 注册值实测修正；此前文档值（10/3.0、9/3.8、10/4.2）与实现存在漂移，以代码注册值为准。

每个组件读取 `getBoundingClientRect()` 宽高和计算后的左上圆角。圆角矩形有符号距离给出外法线，位移只在边缘带内按距离平方衰减；生成 R/G 位移场 PNG data URI，并通过该组件专用内联 SVG `feImage → feGaussianBlur → feDisplacementMap` 用于 `backdrop-filter`。同一尺寸、圆角、变体复用缓存；缓存最多保留约 48 组，旧且未使用的滤镜可移除。圆角 alpha 遮罩由同一几何值生成 SVG data URI，不再拉伸固定 PNG。`ResizeObserver` 在尺寸稳定 80ms 后更新；指针只改轻微高光坐标，最多每帧一次，不重新生成位移场。

背景取样依靠浏览器实时 backdrop 合成；位移场是固定的几何光学映射，不含背景图像。侧栏透过 `.shell` 的克制灰阶环境，工具条悬于 `.result-scroll` 上方，正文滚动会改变所采样像素。实底正文和前景按钮在滤镜层之上，文字不参与位移。首页真实菜单使用同一套 `menu` 变体，原入口和“制作活动页”行为不变。

`CSS.supports` 只决定是否尝试 SVG `backdrop-filter`，不作为折射已输出的证明。对照页需在相同背景和滚动位置切换右侧折射，观察边缘像素变化；Chrome 的视觉证据与短时性能轨迹见 `ACCEPTANCE.md`。不支持时保留面层模糊、边界和文字；减少透明度时两层滤镜关闭且容器改实底。系统减少动态通过媒体查询事件清除高光与待执行 RAF；原型手动开关调用同一清理路径。卸载／离开也取消回调与观察器。

这是一条 Web 光学近似路径，不调用 Apple 原生 Liquid Glass API。苹果的[官方设计说明](https://developer.apple.com/videos/play/wwdc2025/219/)提出边缘透镜、环境适应和控制层浮于内容之上；本文只据此确定层次与交互原则。Safari／Firefox 的 SVG backdrop 位移输出、长时间 GPU 负载以及系统级偏好实时切换仍需单独验证。


输入区统一补充（2026-09-28）：`design-system/mokina-system.css` 的 `--mk-control-fill` 与 `--mk-control-blur` 为成果工具条、协作输入区共用面层参数；导航采用 `--mk-glass-fill`。三者边缘仍由同一几何引擎生成，现有最大位移不加大。面层填充为 0.58 alpha，模糊 7px，用于保障输入文本可读；两项为 Web 项目参数，非官方光学数值。尺寸更新合并队列避免协作区及工具条同时改变时遗漏组件。待验证：动态背景下文字对比、输入框下方滚动和真实位移输出。

参数同步（2026-09-29，以下均为 `design-system/mokina-system.css` :root 实测值）：交互与边缘过渡时长统一为 `--mk-duration:160ms`，玻璃 rim 高光坐标过渡与首页“更多”菜单退出过渡均引用该 token；菜单与工作区圆角 `--mk-radius:16px`，控件圆角 `--mk-control-radius:8px`，最小点按目标 `--mk-target:44px`，图标笔画 `--mk-icon-stroke:1.65`。面层 `--mk-control-fill` 0.58 alpha、`--mk-control-blur:7px` 与导航 `--mk-glass-fill` 0.32 alpha 同为 Web 实测项目参数，非 Apple 官方光学数值。

## 2026-10-03 专项验收补充

当前方案工作区由 `design-system/liquid-workspace.css` 覆盖参数：控制面层白色 alpha 0.64、导航面层白色 alpha 0.38、容器半径 token 20px；工具条自身 18px。以上为源代码声明值，历史共享样式中的 0.58/0.32/16px 不能代表当前工作区最终值。几何位移引擎仍使用 toolbar band 8px、lens 3.5px、预模糊 0.26px。

本次滚动后观察到背景透射，边缘形变未确认，不将 `refractive-declared` 标识或微小 A/B 像素差异认定为折射验收通过。详见 ACCEPTANCE.md「滚动透射与边缘折射专项验收」。

高对比校准补充（2026-10-03）：独立黑白棋盘格夹具 `evidence/high-contrast-edge-check.html` 沿用以上参数。正常面层下仍未确认可辨识位移；仅在隐藏 face 的诊断组测得顶部棋盘边界交点约 0.689 CSS px 的移动（滤镜全开/全关，包含预模糊差异）。此测量不等同最大位移参数，不代表当前产品效果通过。产品参数未改，详见 `ACCEPTANCE.md` 最新节及 `evidence/high-contrast-edge-results.json`。

## 2026-10-04 全页范围

用户已授权全页推广，`material-stage-one` 现作为兼容类在 P01–P08 及全部项目启用；前文“只在方案工作区”的范围不再适用。`liquid-pages.css` 为页面操作条、首页输入、移动导航和菜单补齐共享规则；正文和表单保持实底。toolbar/sidebar/menu 的 band、lens、blur 未改变，`glass-material.js` 与本轮开始时逐字节一致。全页接线和布局通过不代表新光学验收，现有边缘位移待验结论保留。
