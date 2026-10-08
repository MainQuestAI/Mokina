# local.7 原生候选验收记录

日期：2026-10-07。本记录只证明下列实际运行范围，不覆盖 local.5 的历史记录，也不宣称全部 31 条 AC、原生中断矩阵、安全或专业签收完成。

## 1. 固定候选与环境

- product source / validation SHA 均为 `4cf68e9c7feda8cc5222825ba209f179490cabbf`。后续只有文档和合成截图提交，不改变此包的运行代码或资源。
- namespace `mokina-local-repair-v003-7`；版本 `0.0.3-local.7`；macOS arm64 / Electron 41.3.0；Node 24.15.0 / pnpm 10.33.2。
- 原基线、兼容依赖 head 和实际候选源码的 CI 分别通过；本包对应 [run 37579971288](https://github.com/MainQuestAI/Mokina/actions/runs/37579971288)，head 与 source 一致。完整日志为 QA 根目录 `r0-evidence/local7-ci-log.json`。
- 本地对应业务回归 566、打包 owner 75，合计 641 tests passed；guard/typecheck/i18n 及 tools-pack typecheck/build exit 0。不是 641 个原生场景。
- QA 根目录：`/private/tmp/mokina-v003-qa.zt5jxC`。安装在该目录的 `out/mac/namespaces/mokina-local-repair-v003-7/install/Applications/Mokina.app`，从源码目录外启动，实际 `source: installed`。
- 未签名/公证的隔离 QA 包；没有公开发布或修改旧用户应用。local.6 因真实 Sharp pin 不符停止，失败记录保留，未作为成功候选。

| 包 | SHA-256 |
|---|---|
| DMG | `58b6145e5b7cd9497d9b0e058fc67909d008fc96dd31db645ff5ca15923376a9` |
| ZIP | `60cde365ac5c122a8e72268783e773fe7ba8db957490a6181e75269cd328d176` |
| payload ZIP | `bf8ad04737a8f54aa1654a17969d8bb327444f28303cf4f2a32118b42b027e18` |

实际安装 Resources 清单为 `local7-installed-resource-inventory.json`：15,295 个文件、11 个 symlink、746,039,833 字节，清单 SHA-256 `b6b2422362aad3261e7ba47a68172fcc1340921cf270b30fb7b12e274ef54380`。完整本机清单保持 QA 私有，不放入公开夹具。

包内实读 Sharp 0.35.5、adm-zip 0.6.1、Next 16.3.6；macOS 外置 NPM 树实际 PostCSS 8.5.29，区别于工作区锁文件 8.5.23，记录解析差异而非假称逐包版本相同。实际外置 NPM 树的 audit exit 1，0 critical / 0 high / 5 moderate affected packages；这是 203 个外置依赖的范围，不含所有编译进 Web/daemon 的依赖。工作区生产 audit 仍为 0 critical / 7 high / 4 moderate / 1 low，不以包外置树结果消除这些告警。

## 2. 干净配置：连接、文字、CSV、依据与重开

在新的 data/user-data 中首次连接 Codex，原生连接测试实际返回 `ok`（33,438 ms）。普通文字直发得到 `OK`，未增加资料确认或生成文件。该项目为 `ace628af-1dc4-4be9-bac5-2aa0ce5a219a`，会话为 `ba23c631-b144-4ffd-96ba-c84b8aa6b389`。

通过原生文件选择器选入合成 `native-input.csv`（85 字节），在资料面板读取、选择四个精确片段，再固定一项正文（87 UTF-16 units，含分隔符）：

```csv
channel,budget,spend,leads
search,1000,600,30
social,2000,1500,50
offline,500,400,10
```

- snapshot `7a378d86-2d7d-40c2-8c37-4707f5c9d2eb`；fingerprint `ce656f14a9daee8bea96b67b22a91dd59d27bfe879b2b66f25f005c4b86637e3`。
- run `d14be84f-6947-4e44-87aa-99cc545ce604`，原 requestId `db087011-5740-408e-bb80-b3b263dbf509`，实际 `succeeded` / artifactCount 0。
- 实际提交 `S1 / inline-text`，回执时间 2026-10-07 06:18:11.453 UTC；正文摘要 `f2a2c83c68ab8f0fd6c6d1fb19fec7475aabeb33f18a3c9ebd7c88c80faaefce`。
- 独立复算预算 3500、支出 2500、线索 90、余额 1000、每条线索成本约 27.78；模型结果一致，未把缺失的单位/日期当作已知。
- 展开运行依据可读实际四行、源位置和摘要，保留“提交证明传输，不等于模型采纳”的边界。
- 正常退出 `graceful: true / remainingPids: []`，从同一安装包重开，原会话、结果、snapshot 和依据仍可读；未另发请求恢复 CSV 结果。

证据：[原生 CSV 与实际正文截图](../../output/playwright/mokina-v003-repair-2026-10-07/native-csv-evidence-local7.png)。CLI 原始结果为 `local7-csv-inspect.json`、`local7-stop-clean.json`、`local7-restart-clean.json`。一次不存在的 `--detached` 参数调用失败后，使用正式默认 detached 的 start 入口，不增加启动框架。

中文自动输入有驱动失真：`typeText` 丢失 Han 字符。本轮没有据此判定产品中文输入失败，也没有据英文输入判定中文通过；仍需人工实际输入核验。

## 3. 保护副本与目标优先恢复

停止 local.7 后，将本轮干净配置保留到 `local7-clean-backup/data` 和 `user-data`，把已停止的 local.5 QA data/user-data 复制到 local.7 namespace。原 local.5 数据、旧用户 profile 和旧应用未修改。这是 **local.5 → local.7 代表性 QA 升级**，不是缺失的完整历史 V0.0.2 Electron pending/journal 验收。

原完成接续记录：operation `379d330d-3960-4cd9-b662-315030447f71`、目标 `5af3f31a-843d-4005-9e27-b0686bed79dd`、会话 `b5a2bb68-eec9-4992-ac31-75d4362d98ed`、snapshot `2e92a8a7-fc2d-4b17-b448-46326ae6b04e`，journal v3 / draft-ready。固定四项、20,143 UTF-16 units。

把 QA 副本源 `品牌-logo.svg` 移到有明确路径的可恢复备份，再从原项目“恢复至原接续稿”进入原目标。目标 `asset-1.svg`、完整可编辑草稿、已固定 Vercel 参考和 snapshot 仍可读。正常退出重开再次回到同目标/会话；原已固定输入没有重建，不自动运行模型。升级副本在这次显式发送前的 run 数量仍为 25，与源 QA 副本一致。

前后实际内容摘要相同：snapshot JSON `5b7faee3b887398c1610b8455f3d4651eae1ce0608602378bff8b9c613116959`；接续 JSON `f09e6944a5cf3f71af3b1e593dbebb3d32a263da33d8e11c15061cffb218fd88`。源文件随后恢复，未永久删除资料。

**历史证据勘误**：local.5 台账曾把该源写成 LOGO A，但真实已复制 SVG 是红色合成 **LOGO B**，161 字节，SHA-256 `fef79a73e0fadcb72ecc8225ff11be8a6960587a54f045e66dba1738ccb1dbf7`。原快照不改写；本记录以实际字节为准，文案矛盾保留为可审查的测试结果。

证据：[原目标源缺失恢复截图](../../output/playwright/mokina-v003-repair-2026-10-07/native-source-loss-recovery-local7.png)。这里只证明 **完成后的源缺失、恢复与重开**，不能冒领任一中途响应丢失断点。

## 4. 历史资源缺失、显式恢复与九份导出

合成源项目 `529956e4-f9f5-4cbd-83cf-2cbfebbabaa1`，所选长路径文件为 `资料/中文 空格目录/revision-continuation-path-00/.../revision-continuation-path-05/营销 方案.html`。

原生选择 v1 后分别导出 ZIP/PDF：明确显示该历史版本缺少自己的资源和恢复为新版本动作，未出现保存框、伪成功或不完整 fallback 文件。显式“切换到此版本”确认恢复为新版本后，得到 v5 `c0646e80-88d8-4ed7-a7b1-006715217663`；v1 原 ID/正文/缺资源状态不变，v3 候选没有被采用。

| 选定身份 | HTML SHA-256 | ZIP SHA-256 | PDF SHA-256 |
|---|---|---|---|
| current v5 `c0646e80` | `b5193db2efb1ac44e9f3360593ce5a557152cf554504781d1dc8b42b0972b577` | `4ef8083f9588d4a1200952df40420217b6cdb778d6e5ab66e0d365fb0b2744f6` | `d91b18d05b268d1a555e2f2c2467a2212ef222eb3cc9742ce45b6f678b5d45c9` |
| historical v2 `2756f19d` | `aeb72e4892313040a483cb925b190906d7793237d6dd8fd7b3c54acd11cb08dd` | `2ecd454c3367ee639a6d4d43cee98047f210ffd3926cefcadb85703627a95221` | `50179830fbc2a33308bf71f2d647146670a01e40b9c8580c13b0383f0eb02d31` |
| candidate v3 `a61a07d4` | `7e7411e37d3739eb9e7be3b0c10c4dfb6571caa752975ad7eac3e6bfa9c067ae` | `986a7ec8c7c15ca6ed3372be65a3bbb3d30fce93a127ca9cf0bbc319759388a4` | `db127babd952348ac51063f04a5dca189e2e7486aaf8d133774f0e83241b2f37` |

九份文件均在原生保存框实际保存到 `local7-exports`。逐份读取 HTML 和 ZIP 的实际 index.html：LOGO A 内嵌，无未解析的本地 SVG；仅候选含独有修订标记；ZIP 同时含实际 DESIGN-HANDOFF.md、DESIGN-MANIFEST.json，三个成员的 bytes/SHA 均记录在 `local7-artifact-check.json`。三份 PDF 均四页，应用外完整渲染并查看全部 12 页，中文、LOGO、章节、预算和候选标记可读，**右侧滚动条入图仍是开放质量项**，不标专业印刷排版完成。

候选 HTML 保存框中取消 `cancelled-must-not-exist.html`：实际无该文件、无成功提示；current v5 指针和 v3 未采用候选状态不变。

HTML/ZIP 的应用外浏览器打开仍需手动完成。工具明确拒绝 `file:` 且禁止等价绕过，没有换浏览器、搭服务或借 CDP 绕过。静态内容与 PDF 渲染不代替此项。

## 5. 正式恢复 ZIP 与导入

最近项目的正式“导出恢复包”入口经原生保存框取得 `local7-project-recovery.zip`，219,224 字节，SHA-256 `ba56fdf1790f899f4dd47d1ce6a8f28a9e278f6f7da54066a7e34304cb920928`。

实际读取 `mokina-recovery.json`：schema `mokina.project-recovery.v1`，exportId `82f516c9-b132-4a1f-a027-114789cf4861`，原项目如上；44 成员（21 original、11 version、10 frozen-version、1 context-snapshot、1 asset）、11 个版本和 1 个 context。所有实际成员的字节数/SHA 均与 manifest 一致，不使用导入标记文件代替证明。

经“新建项目 → 导入恢复包（zip）”与原生文件选择器，恢复为新项目 `bc2554bb-ef33-4268-b073-24a22275064f`、会话 `b6db70e6-18d4-4626-abbc-f8d8ee68ee88`，源项目未覆盖。21 原始文件摘要全部相同、11 版本正文摘要相同；原生 current v5 / historical v1-v2-v4 / candidate v3 状态保留，当前页 LOGO A 可读。新恢复身份与源身份分开登记。

证据：[正式恢复导入后的版本截图](../../output/playwright/mokina-v003-repair-2026-10-07/native-recovery-import-local7.png)。完整 ZIP 成员及导入核对见 `local7-artifact-check.json`。

## 6. 明确新副本与下游成果

首轮旧意图的完整草稿因自动化 `typeText` 中换行触发 Enter 被发送：run `7edb7bba-ce60-476f-80cd-eb667ebb24c5`，requestId `9a9140d5-effd-4cae-bdac-7417e37dbe4f`，`succeeded` / artifactCount 0。模型指出旧补充背景 LOGO A 与实际固定 SVG LOGO B 冲突，只讨论并要求确认。该结果和原输入保留，不将它记为目标页面生成通过，也不靠清空原记录规避冲突。

一次屏外 AX 操作误触后产生的 QA 讨论副本 `6787de1b-5a85-4ec6-9f1f-34a33f415a8d` 只固定章节，没有品牌/素材、未自动运行，仍保留。滚动至可见控件后才正确配置新意图；不把自动化误触认定为产品重复创建根因。

在原候选 v3 仅选 strategy，活动页目标，勾选实际 LOGO B 为 `logo`、写明非 Vercel 官方标志，选择完整 Vercel 风格参考，再明确补充生成要求。原生确认“选择已改变。新建接续副本，并保留原稿和原恢复记录？”后创建：

- operation `805a4431-622f-4566-9d0e-7d5874394683`；intentDigest `ddb86388afa711b74343f5d8836a7126b008835a2e24f8f6a795d43bfa54947d`。
- 目标 `5e8f703b-2a47-48e0-a7be-1e2b1e07c8e4`，会话 `882f4a39-439c-4654-9749-6394c9c153bc`。
- snapshot `5180326c-ad56-4fb8-b964-e4d3908c21e9`，fingerprint `e17e073835d162dfa572a24023bfb042199097ac4e3dfa931f1a9568e39a9232`。
- 实际固定四项、20,406 UTF-16 units：candidate strategy、补充要求、LOGO B、Vercel 参考。未选 budget/channels 正文没有进入快照。旧 target/completed records 保留，新副本未自动发送。

再次移走 QA 源 `品牌-logo.svg`，只从目标明确发送。第一轮 `ddd74d38-fc67-4802-94fa-3d86c737baa7` / request `25257161-34d1-47b1-a277-87cb91144147` 实际提交四项：三个 inline-text、素材 staged-file；`succeeded` / artifactCount 0。模型沿草稿的“先确认结构”返回结构稿，保留首轮结果。没有把发送受理当作生成完成。

用户动作式的第二次明确确认生成，run `e88e5ca1-ab42-4cd0-8678-ff1503da549d` / request `7c491e86-f089-4102-9039-926996923538`，同一会话，`succeeded` / artifactCount 1。这是显式后续请求，不是自动重试或重发第一次快照；第二轮没有新的 pending 快照回执。

实际 `local7-continuation-result.html` 31,604 字节、SHA-256 `899b68e9f78ed344ee08b78eb36a1883fde793934b7aa78ea7ba2212b5cd5d06`，原生预览可读。内嵌 SVG 的实际字节 SHA 与目标 161 字节 LOGO B 一致；正文无 LOGO A、无 30 万元/300000 未选预算，预算/价格/排期等缺失信息明确待确认，只含页内锚点，无外部 src/href；没有伪装已发布或真实预约成功。旧目标接续 JSON 与 snapshot SHA 仍与第 3 节一致，新目标原接续 JSON 为 `3ee9bc18daf35de24a4bc56dee7839212ff25c662958ee42b655d7939b8de51b`。核对时源文件确实不存在，完成后从备份恢复，源摘要再次匹配。

完整请求、可见模型正文、提交回执、固定选区和独立结果在 [local7-run-evidence.json](../../output/playwright/mokina-v003-repair-2026-10-07/local7-run-evidence.json)，公开副本 SHA-256 `2189c34417321c9c622b2343c6547d5c547d01903f4e9953d51174a5ade85285`。仅将模型结果链接中的本机 QA 根替换成 `[QA_ROOT]`，原始私有 JSON SHA-256 `24f1b69b8cfa030d7c89832fee4a93fcdfe6a02d869be1862358ba1e8f4050f6` 仍保留；不包含内部 prompt stack、凭据或推理日志。合成生成页为 [native-downstream-local7.html](../../output/playwright/mokina-v003-repair-2026-10-07/native-downstream-local7.html)，这是实际模型结果，不是产品代码或用户专业签收。

## 6.1 同资料、不同预算与禁投：local.7 两组任务

两次都通过原生文件选择器选入同一个合成 `budget-brief.md`，用途设为资料，通过首页正常准备/固定/交接。源摘要均为 `18d9462995e6860705c30343458f00572edc23245e17b3dda0de8f70320a45dd`；六个精确片段合成 1,405 UTF-16 units，实际正文和摘要 `650d5b768ddab40d7419d4ab794fd6d7fc51ecf3de4f7155acb4760eab1a8ffc` 完全相同。未把不同材料当作同资料对照。首页“资料与背景”目前按既有 B1 入口进入设计体系，往返草稿与用途仍保留；本任务使用资料用途后的正常首页准备，不伪称已在首页打开选区面板。

| 项 | A | B |
|---|---|---|
| 限制 | 300,000 CNY，四类默认禁投 | 180,000 CNY，同样禁投；额外禁止线下品鉴/活动 |
| project | `2163ea62-6a81-4299-a7a4-7cbd980ce48c` | `f3e87488-1775-486c-af8a-79a7f7e2eb70` |
| run | `7f2675a8-b7f1-406d-8819-098ba25be330` | `7a3eda92-6c42-4a98-b524-0e7db7354c5c` |
| snapshot | `6bb52d4f-de24-46cc-bd6d-f6ab40f210a9` | `03f14be7-4325-45ca-961b-9a09228ead4e` |
| 独立金额复算 | 105000+60000+45000+30000+30000+30000=300000 | 54000+63000+27000+18000+18000=180000 |
| 独立比例复算 | 35+20+15+10+10+10=100% | 30+35+15+10+10=100% |
| 逐行金额＝预算×比例 | 全部一致 | 全部一致 |
| 禁投零支出 | 四行均为 0 | 五行（含门店品鉴接待）均为 0 |
| 实际终态 | succeeded / artifactCount 0 | succeeded / artifactCount 0 |

B 的执行计划明确转向自有社群、教育内容、同意/退订管理与跟进，不保留线下报名或接待步骤，也未把禁止费用换名塞入预备金。两组区分输入事实、建议和缺口，没有 ROI/收入/转化承诺。完整模型正文、实际回执和独立表格复算均在上述 JSON，供专业评审，不代替专业签收。

全部任务结束后再次正常退出（`local7-stop-final.json`，exit 0 / graceful / remainingPids 空），同包重开（`local7-restart-final.json`，exit 0 / source installed）。从最近项目实际进入 A、B 和原接续目标：金额表、提交依据、同一页面及原目标/会话可读。总 run 数量仍为 30（源 QA 的 25 加本轮 5 次明确请求），无 running run、无重开新 run；页面 SHA 仍为上述 `899b68e9…`。两预算各只有一个实际逻辑 run，结构确认和明确生成是两次人工意图，不混作重试。

## 7. 剩余验收与修复入口

| 项目 | 当前结论 / 后续入口 |
|---|---|
| R0 对应源码 CI | 通过；本包 source 对应真实 success |
| R1 依赖风险 | 兼容升级与包内核对完成；7 high 及其他告警仍开放，沿 owner 真实调用验证，不强制不兼容升级 |
| R2 真实旧 profile | 待完整受保护 Electron pending/journal 副本；QA 升级不替代旧用户数据验收 |
| R2 同 profile 双原生业务窗口 | 当前宿主只有一个可信业务主窗口，属能力缺口；不放宽恢复 IPC |
| R3 十个中途断点 | 未跑原生矩阵；completed 后源缺失/重开单独记录，不按比例折算 |
| R4 应用外 HTML/ZIP | 用户手动待验；保留同包九份 actual 文件 |
| R4 PDF 滚动条 | 已核查非 deck 的 PDF 走逐 viewport 截图，preparePageForCapture 仅冻结运动，未隐藏 scrollbar；需隔离导出样式的对照验证，保持页面本身可滚动，再决定最小修复/新候选 |
| R5 同包两预算/禁投 | local.7 两组 actual 模型任务与独立计算完成，禁投均为零；专业评语仍待评 |
| R5 真实业务品牌 A/B / T33 | 待授权输入及允许模型目的地；公开风格参考不替代业务签收 |
| R5 原生中文及两尺寸 | 中文驱动失真、两原生尺寸未完整核验；浏览器两尺寸结果另列 |
| R5 长路径接续面板 | 原生已观察横向溢出/嵌套滚动；已定位 205px max-height 的独立滚动区及带长路径的 fieldset，需 fieldset 最小尺寸/输入宽度的浏览器对照及两尺寸核验；不先把 AX 误触当产品竞态 |
| R6 专业与用户 | 待评/待签；数值、传输和页面落盘分别记录，不代签 |
| D1 原卡加载/白屏 | 用户明确允许未复现先跳过；保持未关闭，不标根因修复 |

全部 profile、失败过程、首轮结果和可恢复源备份保留在私有 QA 根目录。公开截图仅含本轮合成资料/仓库公开风格参考，不上传旧客户资料。

## 8. 下一步按证据推进

1. **交付/布局质量**：在现有 Electron 导出测试中做 scrollbar 隐藏与原页面滚动的对照，确保页数/完整正文/固定资源/滚动触发内容不变；只在离屏导出窗口应用 capture CSS。长路径接续以已有 FileViewer 为对象，验证 fieldset 的 min-content 宽度、输入与 select 宽度、嵌套滚动，避免修改恢复协议。两项先有用户结果 red，再做最小修复；若改运行代码，递增候选并重跑受影响 PDF/布局及共同输入链，local.7 结果保留。
2. **安全剩余项**：按 owner 真实 nanoid 转换、image-size 可达路径、watcher 花括号目录、下载缓存隔离和日志精度输入逐项验证；无补丁/不兼容主版本不强行覆写。告警、可达证据与最终处置三列独立登记，不以功能测试 green 关闭风险。
3. **原生补验**：旧恢复 profile 和授权 A/B 资料取得后，沿 R2/R3/T33 的原编号复验。十个断点只用既有隔离机制和可稳定控制的请求，不通过延迟猜测命中；当前单业务主窗口能力缺口不得通过扩大 IPC 来“修复”。应用外 HTML/ZIP、人工中文和两原生尺寸按实际动作补记录。
4. **专业签收**：使用保存的原始输入、两份完整预算正文及实际接续页面作独立评审；只将发现的具体偏差转成下一条规格。未完成安全/原生/专业门槛前不合并签收状态或宣布 V0.0.3 收口。
