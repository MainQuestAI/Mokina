# S01 · Web品牌与资产

状态：implemented；工程回归已执行，完整分层签收见 acceptance.json。前置依赖：无；以当前 main 为代码基线。

## 改动边界

- `open-design/apps/web/app/layout.tsx`
- `open-design/apps/web/src/components/HomeHero.tsx`
- `open-design/apps/web/src/components/EntryNavRail.tsx`
- `open-design/apps/web/src/components/AssistantMessage.tsx`
- `open-design/apps/web/src/styles/primitives.css`

原替换账对应：B01, B02, B03, B04, B08, B09。上述为主要改动文件；相邻 CSS module、i18n 与定向测试可随之修改。runtime、daemon、持久化 schema 和用户数据默认只读；若视觉实施暴露功能缺陷，单列缺陷修复，不混入视觉重构。

## 开发任务

1. 从 assets/brand-candidate 复制母版到 public/mokina/，增加来源、候选/确认状态和 SHA 清单；不在各组件粘贴不同版本路径。
2. 新增 src/components/mokina/MokinaBrand.tsx，按契约接入首页、展开/窄导航、明确产品助手身份；供应商选择器与 agentId 不变。
   - 品牌可访问性按01既有契约验收：首页、展开导航、折叠导航、助手行逐处检查实际可访问树；已有相邻名称/父按钮accessible name时图形保持decorative，独立身份图形显式decorative=false并输出Mokina名称，避免漏读和重复朗读。
3. layout 的 favicon/apple icon 采用适合目标格式的派生资源；深浅底与缓存升级可验证。Apple PNG 不是直接把 SVG 改后缀。
4. 搜索 mokina-icon.svg、brand-icon.svg 的活动引用，逐条转接；旧路径若仍需兼容须记录调用者，不盲删。
5. 交付首页、头像、Dock 模拟承载底三场景的 1x/2x 样张供确认。Dock 实际生成属于 S06。

补充任务：落实05旧品牌清理清单，覆盖本包用户可见文字、图形、动画和辅助标签。S06允许仅为此修改Mokina桌面runtime的显示文案/资源选择，其他runtime语义不变。

## 完成条件

- **S01-AC01**：身份与像素。在首页、展开/折叠导航及助手行展示 mark；16/20/24/32px、浅深底无裁切/拉伸。供应商选择器仍显示实际品牌。逐处核对首页、展开/折叠导航、助手行的可访问树：独立身份有Mokina名称，已有相邻或父控件名称的装饰图形不重复播报。 证据层：browser+asset。
- **S01-AC02**：母版确认边界。8 个 SVG 可解析且无外部资源；记录候选 hash 和用户确认状态。未确认时可完成候选接线，正式品牌发布状态必须保持 blocked。 证据层：asset+user。

## 验证、交付和回退

按03文档选择该包定向检查；更改状态分支必须保留现有回归断言。交付PR应列文件、前后截图、AC证据、资产hash及未验项。不得只交截图而不交实际可达入口。

回退仅还原本包资产引用/组件/CSS与测试；不清空用户数据、journal、草稿或历史成果。涉及共享 HomeView/ProjectView/FileViewer 的包按依赖顺序集成，不以整文件覆盖解决冲突。


## 本轮实施追踪

源码 `c79843bafa7a7e2a61f33d81fcd78edf03c7236f`；[实施与测试记录](../../../mokina-v0.0.4/2026-10-08-implementation.md)。开发任务已接线，native/读屏/用户层仍按 acceptance.json 的分层状态待验，不将工程单元结果记为安装候选通过。
