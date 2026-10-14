# M5 验证与交付记录

基线 `3efd8aea5ee6bfd2005003c0c40a403dd559d0f1`（PR #20 已合并）。main push [38505885062](https://github.com/MainQuestAI/Mokina/actions/runs/38505885062) 成功后开始本轮。最终提交与完整 PR CI 以 PR head/checks 和本轮 output 下 delivery.json 为准；本文件不预先声明未来 CI 成功。

## 用户可感知结果

P04 可以明确读取无登录的公开 HTML/纯文本，看到读取范围、失败原因、固定来源版本；完成后显式选择网页文本并冻结任务快照。刷新或断线后的未知请求只查询；同操作 ID 不重复读取已保存网页，部分保存只补写文件，当前文件被修改时保留用户字节。冲突输入、损坏草稿均可先备份再恢复。

成果质量面板区分真实读取回执和自填 URL，显示所选来源版本、支持摘录、限制并定位对应章节。候选、恢复、恢复包和指定版本 HTML 导出保留同一来源字节与回执，不把今天的网页充当历史证据。HTML 是有限静态文本，不宣称已读脚本/图片/动态图表。回执不证明事实真假、发布日期或专业批准。

## 检查台账

| 检查 | 状态 | 证据 / 边界 |
|---|---|---|
| guard、全仓 typecheck、i18n | PASS | output/mokina-next-2026-10-14 的最终日志；没有 schema 迁移或模型配置变更 |
| contracts / daemon / web 构建 | PASS | contracts 在全仓检查中构建，daemon-build-final / web-build-delivery；不代表已安装版 |
| 新后端边界及证据回归 | PASS | 7 文件 58 项；URL guard、403/格式/超限/超时、同操作并发、部分保存、排他文件写入、版本/错误声明闭包、伪造回执不升级 |
| 相邻版本、资料、上下文、恢复及导出 | PASS | 12 文件 193 项；正文提取变更后再跑 4 文件 38 项 |
| 新前端与持久恢复回归 | PASS | 4 文件 38 项；未知查询、明确重试、新读取备份、草稿损坏、CAS 与项目/会话隔离 |
| 相邻资料与工作区组件 | PASS | 122 项通过、3 项既有 skip；不将 skip 算通过 |
| 浏览器 | PASS | 14 项通过；P04 私网输入拒绝与刷新、既有准备/会话/项目/修订/继续制作恢复 |
| 真实公开页面 | PASS | example.com HTML、RFC8259 UTF8 纯文本；真实 HTTP403 拒绝且 lookup=null，见 live-summary.json |
| 真实 P04 读取/选择/冻结 | PASS | materials-live-1440.png、context-selected.json；只选网页文本，sourceRef 固定 versionId，全文文件 SHA 保留 |
| 真实引用章节定位 | PASS | quality-live-1440/900.png、located-900.json；目标 finding 有预览临时高亮，原 HTML 没有定位属性 |
| 真实历史恢复、恢复包与离线指定版本交付 | PASS | recovery-summary.json / report-frozen.html；新恢复版本、包往返质量/冻结字节/回执一致 |
| 同数据前后视觉 | PASS | before/after-1440.png（1440×900）、before/after-900.png（900×600）；baseline.json 记录同一受控报告与入口 |
| 独立缺陷复审 | PASS | 首轮发现两项 P2：错误声明先丢原文、CAS 冲突无出口；均修复并独立定向复验，无新增阻断 |
| 资源清理 | PASS | cleanup.json；本轮 tools-dev/browser 停止，48170/48171 释放，合成 profile/runtime 与红测 scratch 已移除 |
| 新原生安装包 / 现用应用替换 | NOT_RUN | 本轮没有宿主或安装行为变更，按规则不重复打包/安装；现用应用仍为 0.0.4-local.1 |
| 新模型任务、Codex 首次连接与专业人工签收 | NOT_RUN | 继续单列；本轮报告是使用真实来源的受控工程验收成果，不是专业营销结论 |

日志保存在 `output/mokina-next-2026-10-14/`（未将大构建日志加入 Git）。真实取证回执、来源文件、成果与必要截图保存在本目录 evidence/。受控报告有意加入长空隙，以验证离屏章节定位。

## 实现取舍与后续边界

- 复用已有 public DNS/redirect/连接保护；新增有界匿名静态读取，不引入外部服务、动态浏览器、登录抓取、PDF/OCR 或自动爬取。
- 来源正文只存在于现有项目 Markdown/文件版本仓库；回执是版本元数据，不是独立的可写成果仓库。普通 API 与模型声明不能设置可信 webCapture。
- 原文大小/UTF8/SHA 校验先于可修复的声明检查。错误的 URL/kind/章节/摘录仍保留已验证的字节，支持离线修复；真正损坏继续报完整性错误。
- 排他发布修复了已有 overwrite:false 的竞争覆盖窗口。常规覆盖路径维持原子 rename，非覆盖用 wx 或同目录 hard-link；没有放宽异常吞并。
- 两套 scenario 的证据协议升为插件 0.0.4，新增 capture/read 与固定 versionId 用法；方法正文版本未改。两套插件 validate 均通过。
- 其他语言新增键暂沿英语 fallback；简中/繁中完整，后续可独立人工翻译。读取到的诊断和限制保留原文。
- 新 PR 保持 Draft、未合并，不发布、不替换用户选定应用。动态站点能力、事实交叉核验和专业人工签收是后续独立范围。
