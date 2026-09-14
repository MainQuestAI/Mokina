# Marketing Desktop 0.2.1 · 修复验收

2026-09-14。范围：修复 0.2.0 Review 的 R1–R4，以及有限计划参数、引用一致性和操作保护；沿用 V6.2 原界面。不是接入模型或正式产品发布。用户最终产品评审仍待用户实际试用。

## 四项缺陷状态

| 缺陷 | 本轮实际操作与结果 | 证据 |
|---|---|---|
| R1 计划不生效：已修复 | 品牌排除小红书与文字答疑，只做微信公众号，结果仅保留公众号名称与用途。社媒选三条、公众号、2026-09-21，页面和下载均为三条，日期逐日到23日。未知抖音停下；文字五条与参数三条冲突先确认 | [品牌](../output/playwright/fix021-r1-brand-touchpoint.png)、[参数冲突](../output/playwright/fix021-scope-conflict.png)、[未知范围](../output/playwright/fix021-unknown-channel-block.png)、[三条表格](../output/playwright/fix021-social-three-1280.png)、实际 CSV/文字下载 |
| R2 否定反向执行：已修复 | 三种否定表达均保持1份品牌成果、1个计划项、1次原制作；正向另做进入可取消操作，取消不增加成果，重新制作后为2份独立成果。“不要图片，只制作五条文字”实际制作五条文字 | [否定后页面](../output/playwright/fix021-r2-negations.png)、品牌备份、动作契约测试 |
| R3 引用版本错配：已修复 | 受众v1年轻租住→人工v2家庭→从v1只带受众段接续→切v2。来源预览和查看显示v2；分别建立固定v1/v2来源文档，实际备份正文与结构化片段逐一核对所选版本，旧v1不变；文字导出包含v2摘录 | [查看来源v2](../output/playwright/fix021-r3-source-v2.png)、[采用比较](../output/playwright/fix021-brand-compare.png)、`fix021-reference-v2.md`、`fix021-brand-reference.json` |
| R4 计划模式对话开始：已修复 | 先定计划保存后发送开始制作，生成五条。多项只说开始时不运行，全部制作仅新增未完成文档；完成后再次开始显示另做确认。未保存参数、目标、当前交付的改变均先选择；使用已保存计划后修改底稿仍可恢复 | [未保存选择](../output/playwright/fix021-r4-unsaved-choice.png)、[多项选择](../output/playwright/fix021-r4-multi-choice.png)、社媒备份 |

## 本轮页面回归

B＝真实隔离 Chromium 页面操作；D＝浏览器下载后核对内容；N＝本地状态/契约测试。N不冒充页面证据。所有 `fix021-*` 为本轮新证据；不使用旧 `review-*` 或 0.2.0 样本替代修复验证。

| 场景/条件 | 实际结果 | 证据类型 |
|---|---|---|
| 品牌无项目、资料、计划、另做、段落候选、比较采用 | 无产品门槛；两份独立成果；第一份保留v1/v2并采用v2，决定记录保留 | B/D/N |
| 社媒第三条缩短 | v1/v2共五条，另外四条逐字段相同；第三条仅正文变化，ID及其他字段不变 | B/D/N |
| 社媒范围调整 | 三条公众号排期和文字下载一致；旧五条原稿不覆盖；平台专门改写没有被声称完成 | B/D/N |
| 运营真实文件上传 | 通过文件选择器上传原CSV，保留只读原文；重复选中两份后明确排除一份，未使用默认数据补算 | B/D |
| 运营数值 | 总体5.25%→3.875%；实用6%→6.5%、介绍3%→3%；实用曝光75%→25%；结构−1.5pp、分组率+0.125pp，非因果解释 | B/D/N |
| 分析选择性接续 | 排除所有结论时无新成果；重新从原分析只选内容结构方向，另开工作生成三条提纲，无原CSV复制 | B/D/N |
| 取消/迟到/重复 | 另做可取消；取消后迟到与重复回调不保存；A结果不抢B草稿；刷新中断为待重新执行，重试可完成 | B/D；强制迟到/重复回调为N |
| 引用异常 | 缺失版本、删除所选段落、撤回来源阻止解析；历史错配显示提示且原快照不改写 | N；异常历史数据未冒充本轮实际用户资料 |
| CSV异常与换期 | 缺列、非数值、零分母、格式错误、明确不同前后期，不按字符串排序 | N；本轮浏览器重走原CSV主线，不重用旧异常截图充当新证据 |
| 德国七类交付 | 同一迭代HTML完整21步；成员选择、候选、退回修订和固定内部提交保持；两次提交为returned/approved且范围internal-review，无外部deliveries | B/D/N；[完成页](../output/playwright/fix021-professional-complete.png) |
| 新产品单渠道 | 新建QX-100空气净化器，仅品牌官网；人工摘录核对→选择证据→快照→同步计划→全部制作，strategy/fabe/mh/assets/web五项ready；不混入冰箱事实 | B/D/N；[完成页](../output/playwright/fix021-product-ready.png) |
| 1440×900 / 1280×800 | 原侧栏、对话和Canvas保留；计划字段纵向滚动，底部按钮可达；条数字段Tab到渠道显示焦点；窄Canvas表格横向滚动，可收起对话独立阅读 | B；[计划焦点](../output/playwright/fix021-plan-1280.png)、[B草稿](../output/playwright/fix021-late-return-b.png)、[中断](../output/playwright/fix021-interrupted.png) |

测试命令：`npm test`，74项V6.2 + 33项营销契约，全部通过。新覆盖包括统一否定、冲突范围、一次条目身份、固定部分引用、历史错配、计划开始与已完成保护、接续缺结论。旧备份合并和重复导入仍运行原契约测试；本轮未把所有35项AC宣称为重新进行过浏览器测试。

下载验证：`npm run verify:repair-downloads`，检查 `output/playwright/downloads/fix021-*`；`npm run verify:downloads`仅复核保留的0.2.0历史样本。两者分别执行。

## 实现与兼容

- `contracts.js`集中有限意图及范围检查；`model.js`固定运行归属与一次准备、解析所选版本；`scenes.js`消费config；`workspace.js`在原计划/依据/Canvas入口适配。不新建Work或工作台，不改变存储键。
- config缺失时从已知场景默认值计算，保存后保留项ID与历史；矛盾旧文字不自动执行。已完成交付不暗中重复。新社媒默认标题随数量变化，已保存历史标题不回写。
- 旧来源快照不修写；明确检测到错配时标记，再次引用从指定版本重新解析。历史快照没有足够内容时不能推断其一致性。
- 本轮测试中曾产生一份标题仍写五条的三条历史样本；标题生成已修正，保留该测试历史，最终三条下载来自修正后的新成果，不篡改旧记录。
- 原0.2.0完成记录保留并标为历史；35AC的要求分类保留于现行Spec。上述表格限定本轮B/D/N范围；模型、Runtime重连、真实权限、外部发布仍延期。

## 交付与独立包验证

当前HTML为0.2.1，源码可修改。完整包路径：`output/marketing-v62-prototype-0.2.1/Marketing Desktop V6.2 交互原型 0.2.1.zip`。0.2.0包及原V6.2 HTML/ZIP保留。

打包脚本复制完整src/public/vendor/tests/scripts/docs，解压后重建、测试、校验HTML一致、检查两组下载样本；测试和哈希记录见同目录 `package-check.json`、`tests.tap`、`unpacked-tests.tap`。包内 `SHA256SUMS` 可核对文件。

离线包浏览器冒烟：已将ZIP解压到独立临时目录，执行构建、全部测试和下载检查，再从该目录启动4179端口。在同一全新浏览器会话连续完成品牌→社媒→运营：品牌先定计划、公众号排除参数、对话开始及三种否定；社媒“不要图片，只制作五条文字”、第三条人工候选；运营本地CSV样例计算。保存的备份只有三类成果各一份，社媒两版，三个计划各一项，未自动采用；控制台无错误或警告。

解压目录页面证据：[品牌](../output/playwright/fix021-unpacked-brand.png)、[社媒1280×800](../output/playwright/fix021-unpacked-social.png)、[运营](../output/playwright/fix021-unpacked-operations.png)、`output/playwright/downloads/fix021-unpacked.json`。本轮不止以Node测试抵扣页面验收。

最终HTML SHA256：`e0df88418179a9cdb34f19ed725441b1dd4f242c3fbdc623bbe59d76ee405c67`。原V6.2 HTML SHA256仍为 `311a517496ddf2b07620d90ae554fbc405e8658d435fdd7554ca450005f4f495`。ZIP校验值以同目录package-check.json为准，文档/截图补入后不改变已验证HTML。
