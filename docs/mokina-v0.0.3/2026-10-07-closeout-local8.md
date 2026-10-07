# V0.0.3 剩余问题收口执行记录

依据本轮已批准方案，起点 `5959a3e4ad88f4da77524a279f335eff2f972e08`，分支 `codex/mokina-v003-repair-a-input`。local.7、旧 QA 数据、失败证据全部保留。本轮不自动合并或发布；HTTP/CLI、snapshot 和 journal schema 不变。

## 交付质量：代码及真实捕获回归

PDF 根因是非 deck 逐视口捕获没有隐藏滚动条绘制。只对一次性的离屏 page capture 注入透明 scrollbar paint；保留原滚动条宽度和 gutter，不设置 overflow:hidden、零宽度或覆盖原页面样式。

同一 1800px 长页面含正文、内外滚动条、懒加载图片、IntersectionObserver 内容、fixed/sticky：修复前实际 Electron 捕获包含 109,184 个滚动条特征像素；修复后为零。前后正文宽度 786px、高度 1800px、PDF 三页一致；图片、滚动触发内容和定位类型检查通过。测试调用编译后的生产 renderDeckSlides，再读取实际 PDF。历史版本隔离及缺资源失败沿用原回归，不回退到当前素材。此结果不是新安装包的九份交付验收。

长路径根因是 fieldset 默认 min-content 宽度及控件宽度约束缺失。新增 min-inline-size:0 和宽度约束；素材文本 title 与可访问名称保留完整路径，未改变 205px 原有分区、不增加滚动层。修复前 358px 区域被撑到 976px；修复后 1280×720、1440×900 的三项中文/空格/多层同名素材不横溢，修改用途、接续和刷新保留草稿，整文件六项浏览器回归通过。原生尺寸和键盘完整验收另列。

## 安全：告警、实际路径、缓解分列

实际 `pnpm audit --prod --json`：修改前 critical 0 / high 7 / moderate 4 / low 1，修改后 critical 0 / high 2 / moderate 3 / low 1；两次 exit 1。原始报告及完整日志保存在 `/private/tmp/mokina-v003-closeout.WwddbA`。没有使用 audit fix --force。

| 公告 | 实际处置与证据 | 当前边界 |
|---|---|---|
| nanoid GHSA-28wg-ghj8-5hjv、GHSA-2v37-7h3g-55p8、GHSA-xwg4-73v4-xw9w、GHSA-mwcw-c2x4-8c55 | 已查最新 converter 2.2.2 仍 pin 4.0.2；仅 `@excalidraw/mermaid-to-excalidraw>nanoid` 定向至 5.1.16。实际 Mermaid owner 两次转换、生成 ID 与绑定、scene JSON 重读通过 | 四项 audit 不再出现；实际 Excalidraw UI 保存/重开及新包身份尚需验证，不以 jsdom 几何替身代替它 |
| image-size GHSA-5p2g-fcmc-qvqq、GHSA-w3rx-r6r6-pgpr | PptxGenJS 4.0.1 仍依赖旧主版；只对 `pptxgenjs>image-size` 指向 2.0.3。三个畸形容器隔离子进程有限时解析及真实 PNG/PPTX 字节验证通过 | 两项 audit 不再出现；旧 ICNS 实际挂住独立子进程到 3s，旧 HEIF 对当前样例本已拒绝，不把它写作红证据。没有证明所有恶意输入都安全 |
| braces GHSA-vfj7-8cjw-p6xm | 唯一产品 chokidar 调用只接收解析后的真实目录，新增 disableGlobbing。旧配置真实花括号目录没有事件；修复后完整 14 项监听回归，以及轮询/符号链接三项通过 | [公告无补丁](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)，告警仍存在；产品 watcher 这条路径缓解，其他构建工具模式输入没有豁免 |
| http-cache-semantics GHSA-ch52-4w7c-c8xp | 实际 @electron/get 的 GotDownloader 默认不启用 got HTTP 响应缓存；同一 URL 依次授权 A/B/B 返回不同正文并三次请求服务端。磁盘制品缓存及独立 checksum 机制未删除 | [公告无补丁](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)，告警仍存在。默认下载路径验证不等于依赖已修复；今后启用自定义 HTTP cache 时必须重新评估 |
| OpenTelemetry GHSA-8988-4f7v-96qf、sprintf-js GHSA-hp3w-g68c-fv3c、KaTeX GHSA-238p-pmpm-9mq7 | 继续登记原路径和待验证输入，未做耦合版本或跨主版本改造 | moderate/low 保持开放 |

Overrides 移除条件：owner 自身依赖正常解析至安全版本，删除定向覆盖后重跑 owner 实际行为和审计。新包仍须核对编译及外置依赖，不能借用 local.7 的资源清单。

## 本地检查与 CI

Node 24.15.0 / pnpm 10.33.2。guard、完整 typecheck 通过；类型检查和 i18n 首次沙箱运行的 tsx IPC EPERM 单列为环境限制，不算产品红证据。Web 107、daemon 27、真实 watcher 14、浏览器六项及真实 Electron PDF 一项通过。下载 owner、打包资源和 pin 回归单列日志；新增 owner 和真实捕获集合已进入根 CI。新 head 远端 CI 尚待运行，不借用原 success。

## 原生和人工门槛

当前十个原生断点仍待实际命中。已只读确认宿主 bridge 不可覆写、recoveryStore 冻结；测试不得伪造持久 journal 或放宽 IPC。将沿既有 tools-pack 安装/启动/inspect/停止入口控制真实请求和隔离存储错误，逐项保留准备、命中、持久状态、中断、重开证据。

local.8 尚未构建和验收。真实完整旧 profile、授权品牌 A/B、应用外 HTML/ZIP、中文人工输入、专业评审与用户签收继续待验；单业务窗口宿主能力缺口不算双窗口通过。D1 未复现按用户意见暂时跳过，保持未关闭。
