# S02 · Tokens图标与公共控件

状态：ready_for_implementation_planning；当前未实施。前置依赖：无；以当前 main 为代码基线。

## 改动边界

- `open-design/apps/web/src/styles/tokens.css`
- `open-design/apps/web/src/styles/shell.css`
- `open-design/apps/web/src/components/Icon.tsx`
- `open-design/apps/web/src/components/RemixIcon.tsx`
- `open-design/apps/web/src/components/FileTypeIcon.tsx`
- `open-design/apps/web/src/components/MokinaWorkspace.module.css`

原替换账对应：B10, B11, B12, B13, B17。上述为主要改动文件；相邻 CSS module、i18n 与定向测试可随之修改。runtime、daemon、持久化 schema 和用户数据默认只读；若视觉实施暴露功能缺陷，单列缺陷修复，不混入视觉重构。

**D15=A**：本轮不增加深色模式；深色参数仅保留设计文档/样张检查，不为其新增生产深色样式分支或主题入口；不删除上游已有深色兼容规则。运行验收限浅色。

## 开发任务

1. 在现有产品范围内定义01文档中的别名；旧品牌绿与成功状态绿分开处理，发出按钮引用 action。不改全站基础 token 导致上游产品漂移。
   - **D7=A**：标题别名分为首页展示、普通页面和成果文档三种角色，严格按01文档的尺寸、行高和适用范围实现；不得用普通页面28px全局覆盖另外两类。
   - **D8=A**：操作文字14/22；应用控制的成果正文段落与列表15px、行高1.9。限定成果阅读容器，不覆盖用户文件、嵌入内容、代码块和表格。
2. 对 icon-map.csv 每行定位生产调用者并记录处理：复用/改绘/引擎保留/当前不可达。原型图标源不以 window 全局注入生产。
3. 统一按钮、输入、菜单、状态标签的默认/hover/focus/disabled/loading/error；复用现有 Button 等公共组件，不新造第二套组件库。
   - **D9=A**：主按钮default/hover/pressed均按01主按钮状态表使用action色族；核对裸button与共享Button CSS module的层叠，不能hover退回#353535。仅Mokina范围，保留危险/成功语义及原禁用门控。
   - **D10=A**：应用纯图标按钮实际命中区最小44×44px；图形尺寸保持16/20/24px，扩大按钮布局盒而非叠加互相覆盖的热区；工具条按需换行。
4. 准备开发样张覆盖字体、颜色、图标、文件、状态和长标签。菜单使用已有焦点管理，不将原型 details 行为直接复制。
5. 保持长 transcript 无 backdrop-filter、split-chat-slot overflow:visible；减少透明度和无滤镜时实底。保留 tab 动效原参数。

## 完成条件

- **S02-AC01**：视觉基础和可访问性。本轮浅色主题下正文4.5:1、关键图形3:1；禁用有真实 disabled 状态；Tab焦点可见；透明度/动态回退不遮挡输入。本轮浅色主题下主按钮default/hover/pressed符合01状态表且文字对比≥4.5:1；focus外环可见，disabled无悬停/按下反馈；共享Button和实际页面入口均检查，非Mokina及危险/成功语义不变。桌面及390px窄屏的纯图标按钮实际命中区均≥44×44px，邻接点击区不重叠；工具条换行后动作仍可达，不改变图形尺寸或画布内容。 证据层：browser。
- **S02-AC02**：滚动与隔离。相同长对话 fixture 和窗口下对比基线；连续滚动/拖动/输入不出现新增长时间卡顿；性能 trace 同场景无新增超过50ms的重复滚动长任务；Mokina edition off 不改变外观。 证据层：browser+trace。

- **S02-AC03**：标题与正文角色。在1440px、1280px和390px视口核对首页展示标题、普通页面标题、应用控制的成果文档主标题；computed style符合01角色表，长中文标题完整换行，普通页面保持28/36；用户文件及自带样式嵌入内容不被全局标题规则改写。同时核对操作文字14/22、成果正文段落及列表15px/1.9；正文规则不影响用户文件、嵌入内容、代码块和表格。 证据层：browser。

- **S02-AC04**：辅助技术通知。启用VoiceOver验证资料准备到待确认及ready、接续失败和多提示共存：每次实际状态变化只收到简短通知，普通重渲染/排序不重复，错误不被父status与子alert重复播报；详细文件名单仍可访问；新操作再次失败仍通知；切换项目不播报旧项目异步结果，不自动移焦点。另检查DOM角色，但不以DOM检查替代实际读屏证据。 证据层：browser+assistive-technology。

## 验证、交付和回退

按03文档选择该包定向检查；更改状态分支必须保留现有回归断言。交付PR应列文件、前后截图、AC证据、资产hash及未验项。不得只交截图而不交实际可达入口。

回退仅还原本包资产引用/组件/CSS与测试；不清空用户数据、journal、草稿或历史成果。涉及共享 HomeView/ProjectView/FileViewer 的包按依赖顺序集成，不以整文件覆盖解决冲突。
