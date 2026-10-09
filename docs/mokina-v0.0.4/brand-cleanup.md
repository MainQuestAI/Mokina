# v0.0.4 旧品牌清理与内容保护

本轮清理的是 Mokina edition 中由应用控制的产品身份。不能把源码中的所有 OpenDesign 字符串机械改为 Mokina。当前记录对应实施源码和真实 Web 检查；原生截图待 macOS 候选生成。

## 已接线的应用表面

| 实际路径（open-design/） | 应用表面 / 处理 | 证据和限制 |
|---|---|---|
| apps/web/app/layout.tsx；src/components/HomeHero.tsx、EntryNavRail.tsx、AssistantMessage.tsx | 标题/favicon/Apple图标、静态首页A、展开/折叠导航及通用产品助手改用统一Mokina品牌；实际供应商保留 | Web1440/1280/390及组件/资源回归；逐入口完整辅助树签收待验 |
| apps/web/src/styles/mokina.css；packages/components/src/button.module.css | edition限定中性玻璃、主操作蓝及交互/正文/标题角色 | 真实首页三状态computed style与尺寸；全表面对比/trace待验 |
| apps/web/src/i18n/product-brand.ts、index.tsx；locales/*.ts | 先处理应用产品模板再插值，客户文件名/内容不被替换；十九语言新增文案和回退路径；连写词尾及产品复合词定向处理 | locale-audit.json和product-brand单元；原生fallback/tooltip/菜单实际画面待验 |
| apps/web/src/components/SettingsDialog.tsx、InlineModelSwitcher.tsx、AvatarMenu.tsx | 上游Cloud入口隐藏；旧Cloud选择不可用，有现有模型设置入口 | browser旧Cloud无POST、保留选择；设置/切换器回归 |
| apps/web/src/App.tsx、EntryShell.tsx、ProjectView.tsx、ChatPane.tsx | 提前阻断Mokina旧Cloud发送和自动登录/计费恢复，社区深链转既有首页；旧Cloud错误仅不可用说明及设置动作，本地手动重试沿原门控 | request观察及错误阶梯/ProjectView回归；不清历史/凭据，不自动换模型/发送 |
| apps/web/src/components/HandoffButton.tsx、DesignFilesPanel.tsx、EntryNavRail.tsx | 隐藏上游Cloud网站、带上游链接的提示、贡献PR和社区；本地真实工具/文件提示保留 | off-profile/Handoff/DesignFiles/Nav定向回归；无伪造Mokina服务URL |
| apps/web/src/components/FileWorkspace.tsx、FileViewer.tsx、mokina/MokinaCandidateCompare.tsx | 初始/运行等待文案、当前输入器聚焦、比较弹窗动作及焦点；复用真实文件/版本能力 | empty及长比较浏览器/版本恢复回归；客户文件显示层保护 |
| apps/desktop/src/main/mokina-brand.ts、mokina-splash.ts、runtime.ts；apps/packaged/src/index.ts | 自包含静态A首帧/崩溃页，显式profile接线，无Logo扫描/WebGL/网络；完成仍由真实启动决定 | 静态内联/阶段/replay/上游扫描回归；native断网画面待验 |
| apps/desktop/src/main/index.ts、diagnostics.ts；apps/packaged/src/paths.ts | Mokina原生Help去上游支持/社区、保留本地诊断导出；对话框/目录错误标题用实际产品，原路径/协议保持 | 诊断/paths定向回归；实际菜单、关于、Finder/Dock待验 |
| tools/pack/src/resources/generate-mokina-brand.ts、resources/mokina/、mac/builder.ts | 同一SVG生成专属Mac PNG/ICNS/iconset，Windows ICO静态生成；仅Mokina Mac profile选新资源，上游资源未覆盖 | manifest/hash/重生成；未构建Mac/Win/Linux安装包 |

路径是实际改动责任入口，不能替代完整 B01–B20 原表面定义。附件只附 B编号与责任包，因此总账按已实现责任包和待验层级填写，不虚构丢失的表面释义。当前安装说明见 runbook.md；已签收历史安装版和旧截图保留原身份。

## 保留字符串分类

`locale-audit.json` 加载十九语言字典、逐键调用生产品牌助手，记录39个保留key及各语言原文版本。静态结果不等于可达性证明；分类与真实调用者一起审查：

- `cloud` / `amr`、上游社区/分享/支持：保持真实上游服务身份，Mokina入口与自动恢复按edition gate隐藏或提前返回；旧Cloud用户看到的是新不可用说明，不呈现历史服务文案。包含 settings、entry、chat 和 avatar 的历史服务模板。
- `handoff.promptIntro`、`chat.contextPrompt.referenceProject`：既有生成/交接指令内容保留，避免换肤改变模型指令语义。
- `settings.mcpBuildHint`、HTTP/技能说明中的 `@open-design/*`、`.open-design`：真实命令、合约包名、数据目录和协议保留；同一句产品展示身份仍应换名。
- `pluginDetail.officialBadge`、`pluginsView.scope.official`：实际上游插件发布者归属，不冒充Mokina官方插件。
- `entry.*X*`、`designFiles.usefulInfoTip8`：真实上游handle保留；Mokina导航/提示不显示上游推广入口，不生成虚构handle。
- `library.openDesignSystem`：动词“打开设计系统”；不是产品商标，应保留其语义。

默认上游 profile、原 PixelScan 引擎及资产、许可证、源代码归属、环境变量/namespace协议和历史证据保持原样。客户文案在模板处理后插值，不重写用户文件的 OpenDesign 或其他商标。源文件仍包含上游分支不代表 Mokina产品显示泄漏；反之，静态排除也不能代替 native 现场验证。

## 品牌候选与平台状态

黑色mark母版 SHA256：`857b1c745e40f2f3f01190ecf6f2ac11e1f0933f6b0a0dc2269c55c6c83d2836`。八个SVG及全部派生hash保存在 Web/native 各自 manifest；生成文件再生成逐字节检查见 resource-repro.json。Logo确认状态为 `candidate_not_finally_approved`，正式品牌发布 blocked。

Web/browser、资源及源码回归已执行；本轮应用仅浅色主题，深底样张是静态资源检查。macOS实际品牌画面、VoiceOver和同一DMG验收尚未执行。Windows/Linux仅图标静态生成；不声明新增平台支持。
