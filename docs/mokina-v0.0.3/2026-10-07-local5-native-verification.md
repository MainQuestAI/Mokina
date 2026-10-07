# local.5 原生候选验证台账

日期：2026-10-07。产品源码 `0ed77171b07afcb4225252c4569ab4eb28196ceb`，base `93531732e2e01e6bfdf5153f3685af4bf132f850`，分支 `codex/mokina-v003-repair-a-input`。

候选 `0.0.3-local.5`，macOS arm64，Electron 41.3.0。使用现有 tools-pack 隔离 namespace `mokina-local-repair-v003-5`；源码目录外从 DMG 安装，实际启动版本与 executablePath 均核对。未签名、公证或公开发布；未创建 PR、推送或合并。验证文档后续提交不改变此产品代码或资源。

## 包、资源与安装

构建命令在 `open-design` 目录执行：

```sh
OD_WEB_OUTPUT_MODE=standalone pnpm tools-pack mac build --dir /private/tmp/mokina-v003-qa.zt5jxC --namespace mokina-local-repair-v003-5 --portable --to all --app-version 0.0.3-local.5 --json
```

exit 0，构建完成时间 2026-10-07 03:59:45 UTC。安装、启动与停止均使用同一工具的 `mac install/start/stop`。首次安装后的 PID 11158，退出重开 PID 13225，均为此候选；旧应用不停止、不替换。

| 文件 | 字节数 | SHA256 |
|---|---:|---|
| DMG | 408125013 | `690c9b6960e1ab1e0f791913dadc1a734e267c6beda45838e1edbba1ba6ec690` |
| ZIP | 405148143 | `1c35bb2afa5c4beed0d3115bd7e573700cab74dfce1afcf386a7c9893d43b354` |
| payload ZIP | 428052381 | `0213beeeed57731ca81414980bf2be9beeac94d5f761d8f1637a6097aa1ab9fd` |

资源根清单含 `agent-runtimes`、`bin`、`community-pets`、`craft`、`data`、`design-systems`、`design-templates`、`frames`、`pdf`、`plugins`、`prompt-templates`、`skills`。递归按目录项排序，对所有常规文件记录 `[相对路径, 字节数, SHA256]` 后 JSON 序列化计算汇总摘要：7,203 文件、338,741,250 字节，清单摘要 `f6f3803d45822aa05d923da3edac0240e3c3cd12ef0b38cddc6760f58a5519d1`。符号链接不重复计入常规文件。远端 CI run 未运行，本地完整验证见实施记录。

## 干净配置：实际 CSV 任务

首次启动连接 Codex CLI 0.160.0，测试返回 `ok`，26,929ms。经原生文件对话框选择本轮合成 `native-input.csv`，85 字节，用途切为资料，通过首页运行。没有私有 API 写入、直接改数据库或手工伪造运行。

完整可见请求（英文用于规避自动化工具的中文键盘输入失真，不等于中文原生输入已验收）：

> CSV acceptance test. Discussion only; do not generate HTML or edit files. Use only the selected frozen CSV. Show every channel budget, spend, and leads. Calculate total budget, total spend, total leads, remaining budget, and total CPL = spend/leads rounded to 2 decimals. Show arithmetic. Describe the data without causal claims.

| 身份 | 值 |
|---|---|
| project | `6920c4e2-787e-4e62-baf1-270ffb9d2146` |
| conversation | `0b5620a5-b76d-42c3-bd7b-89a513f5473b` |
| run | `282be789-0fa7-4cb6-a75d-c0b02cdf8932` |
| snapshot | `c4cf483d-7e68-4f99-88d0-bc8a14c57159` |
| fingerprint | `471ec7b28f0227d9f31577c8f3ed325b86b098f641c20aa1d92d599152d9f9b2` |

运行完成约 27 秒。结果表的三行 budget/spend/leads 为 search 1000/600/30、social 2000/1500/50、offline 500/400/10。成果明确不推断单位、日期或因果，未生成 HTML。

独立读取原 CSV 分字段复算：预算 `1000+2000+500=3500`，支出 `600+1500+400=2500`，线索 `30+50+10=90`，剩余 `3500-2500=1000`，CPL `2500/90=27.78`。模型逐项一致。此为合成 CSV 数值核对，不是专业策略签收。

依据卡展开显示四行实际固定正文（含行间双换行）、来源行号、摘要 `f2a2c83c68ab8f0fd6c6d1fb19fec7475aabeb33f18a3c9ebd7c88c80faaefce` 及 CSV 单位/日期限制，并明确“已提交只证明资料已传输，不代表模型已采纳”。截图：`output/playwright/mokina-v003-repair-2026-10-07/native-csv-evidence-local5.png`。

通过现有 stop 正常退出（remainingPids 空），同包重开，无需重连。经侧栏最近项目重新进入同一 project/conversation，原模型完整结果和依据入口仍可读。干净配置及数据已移入独立保护副本，升级验证不覆盖这份成果。

## 升级配置与完整矩阵

升级输入为旧静态备份的独立副本，原归档 SHA256 `4bf866ebed014849574ca459f0c310b0b539af9f9a0acf785531b1a3f8466fc9`。升级前 18 项目、20 会话、18 chat_artifact_snapshots、18 workspace_artifacts、18 message_artifacts、16 chat_artifact_blobs；347 项目文件、16 Mokina 快照、30 version manifest。项目文件摘要清单汇总 `2eebf62a477a7a3020e5d900009602f9efd5b4b0e47db37920565ef29c279e57`。

该旧备份只有 daemon 数据，没有旧 Electron 恢复存储，故不冒称旧待发送输入/接续 journal 的实际原生升级已验证。自动化兼容覆盖与原生历史迁移分别记录。

升级首开完成，六类数据库计数均与上述基线一致；347 项目文件逐项摘要比较没有新增或改变，汇总摘要完全一致。原生首页呈现历史正式成果、未采用候选和接续项目，进入多版本页面后 LOGO 与三章节均可读，无需 reload 或重启。初次摘要比较曾使用不同遍历排序得出不同汇总值；统一相同的 relativePath localeCompare 排序并逐文件比较后确认零差异，没有忽略内容变化。

### 同包九份导出与取消

使用升级副本的合成项目 `529956e4-f9f5-4cbd-83cf-2cbfebbabaa1`，同一个长路径中文空格 HTML。旧 v1 未保存 frozenContent，历史导出拒绝读取当前素材，报 `Missing local dependency`。相关代码 `import-export-routes.ts` 明确历史版 readAsset 返回 null，防止读入今天的资源；不修改历史正文、不补造历史冻结资源，也不把该失败改为通过。

仅在隔离副本通过版本界面显式恢复 v1，产生新的 v4 当前稿 `cd977297-1e9f-442b-a3e4-023d7a4e0ba3`，新稿冻结资源；保留原历史 v2 `2756f19d-44ef-422e-86b4-334284bd1157` 与未采用候选 v3 `a61a07d4-4392-463d-ac13-b10c2bd1f726`。以下九份从版本界面的对应身份导出，全部实际落盘；此前 v2 仍为当前稿时的三份过程导出另存，不混入九份矩阵。

| 身份 | HTML SHA256 | ZIP SHA256 | PDF SHA256 |
|---|---|---|---|
| current v4 | `b5193db2efb1ac44e9f3360593ce5a557152cf554504781d1dc8b42b0972b577` | `1230ff63dc331fba2655243121e1f5dc04cfb72735b1d96c45857a82601d70ed` | `ffb6ef537404debead3355308578f058ff556c8b1e526f3080be6832ca7189ed` |
| historical v2 | `aeb72e4892313040a483cb925b190906d7793237d6dd8fd7b3c54acd11cb08dd` | `d616d519ec29f734f993a55a25c4914cb305b46dcf57f711cd5168622870d0b8` | `c979cf570faf413fb649c951a20411501ab388e1b6e4e4283ea4f96f3a5cf748` |
| candidate v3 | `7e7411e37d3739eb9e7be3b0c10c4dfb6571caa752975ad7eac3e6bfa9c067ae` | `a352e5e8107a691d47995cf55f77fe5e263daad3756a1a81c26bac270670a99f` | `b4db1d1d00fd3774e14c951ca00b98719d4a24e3c605287b8ab3b0a11bb8bb3e` |

逐份读取独立 HTML 与 ZIP 的 index.html：均有内嵌 LOGO A、预算 30 万元和三章节；仅 candidate 有“长路径中文空格修订验收成功”。ZIP 同时有 DESIGN-HANDOFF.md 与 DESIGN-MANIFEST.json，不只验证存在。PDF 均为四页图像型文件，经 Poppler 应用外完整渲染并查看全部 12 页，LOGO、预算、各章节和 candidate 独有修改正确，没有空白页；图片型输出保留屏幕滚动条，不称专业印刷排版或可搜索文字 PDF。使用 PDF skill 的逐页视觉核对，不用空的 pdftotext 结果判失败或成功。

候选 v3 HTML 再次导出时在原生保存框取消，无新文件、无成功提示，仍为“所选：v3 · 候选稿”；manifest 当前指针仍为 v4。导出不采用候选。

应用外 HTML/解压 ZIP 网页打开：**未验证**。Chrome browser tool 拒绝 `file:` 协议，并明确不得用其他浏览器、服务绕过；只做了文件内容/资源静态核对。此项需要用户手动打开，不能把 Poppler PDF 渲染代替网页打开。

### 原生接续与退出重开

从上述未采用候选 v3 仅选 strategy 和 `品牌-logo.svg`，补充合成验收要求后点“创建接续项目（不发送）”。目标 `dc58ec50-7d50-4ec3-b537-74114f9559ca`、会话 `d9f1e287-22ad-4865-90ea-e7f0c2630412`、operation `8fb59b29-9458-4d40-80e3-8d08635c4b56`、snapshot `bd30dfa3-1918-410b-a4f7-c33560fd2835`。目标实际资源 path 为 `asset-1.svg`，161 字节；草稿包含 strategy 正文、candidate 独有修改与补充要求，不包含 budget/channels 正文，没有自动模型运行。

MOKINA-CONTINUATION.json 记录候选源版本 ID、state、digest 与章节摘要。正常退出、同包重开，从最近项目进入仍是原目标/会话、原素材与完整可编辑草稿；未创建新目标、未自动发送。截图 `native-continuation-local5.png`。仅完成后退出恢复已原生验证，检查点中途强制中断矩阵仍是工程测试，不冒称全部原生断点实跑。

### 实际恢复包与正式入口导入

在最近项目“更多操作 → 导出恢复包”经原生保存框取得 `local5-project-recovery.zip`，203,108 字节，SHA256 `ff459b7ac494dc825da5177c1c05ec5e640b57bc1b86245617f58c8de2818cb7`。实际读取 `mokina-recovery.json`：schema `mokina.project-recovery.v1`，exportId `ca443ec3-d7f3-4ecc-a3e2-2d2c054272ac`，源项目如上；42 成员（21 original、10 version、9 frozen-version、1 context-snapshot、1 asset）、10 版本与 1 固定快照。所有 42 成员的实际字节数和 SHA256 与 manifest 一致。

通过“新建项目 → 导入恢复包（zip）”与原生文件对话框导入，目标新项目 `e6a99673-9140-4324-8b0a-79e19c1c2868`，会话 `fb604bff-6628-4ab4-88bf-ad00d50f5c72`，不覆盖源项目。21 原始文件逐项摘要一致；原生打开当前稿显示 LOGO A，版本界面保留 v4 当前、v3 未采用候选、v2/v1 历史。此证据来自 ZIP 实际内容和正式导入，不使用 `.mokina-recovery-import.json` 标记替代。

恢复后进一步核对全部 10 个版本的正文摘要、current/candidate 状态和 9 份 frozenContent 字节，零差异；没有只依赖界面标签。

### 同资料、不同预算与禁投：两组真实模型任务

输入均为本轮合成 `budget-brief.md`，源摘要 `18d9462995e6860705c30343458f00572edc23245e17b3dda0de8f70320a45dd`。原生选择资料用途后通过首页实际发送。两份快照均为六个精确片段、固定正文 1,405 UTF-16 units，实际正文逐字一致，正文摘要 `650d5b768ddab40d7419d4ab794fd6d7fc51ecf3de4f7155acb4760eab1a8ffc`。没有以不同文件替代“同资料”。

| 项 | A | B |
|---|---|---|
| 预算与限制 | 300,000 CNY，禁止四类付费/买名单渠道 | 180,000 CNY，同样禁投，额外禁止线下品鉴/活动 |
| project | `930f1a0e-0f15-43c1-b107-68a66f1900d7` | `96cf7ad9-4594-4406-8e5a-d3b288797a69` |
| run | `ba9652e3-7dcf-4ce1-9a9a-2ff9affdbe3c` | `f72e21cd-98cd-4fbc-84ae-736d50d5c347` |
| snapshot | `a1f046e0-faf9-4a50-adae-cde2021e957d` | `da374a4f-0a62-4247-aef1-2f8e96ce3031` |
| 独立复算 | 90,000+60,000+45,000+30,000+30,000+45,000=300,000；比例 100% | 54,000+63,000+27,000+18,000+18,000=180,000；比例 100% |
| 禁投 | 四行均为 0 | 五行（含门店品鉴接待）均为 0 |
| 比例/金额核对 | 每行 `预算×百分比=金额`，零错误 | 同左，零错误 |

两项运行均 succeeded、artifactCount 0。B 以社群教育、同意登记与后续沟通替代线下执行，明确不把禁止项目改名后转到其他类别；没有沿用 A 的门店活动。两份成果均区分事实、建议和缺失信息，不承诺 ROI 或转化结果。完整请求、模型正文和提交回执保存于 `2026-10-07-local5-budget-results.md`，可供独立专业评审，不以本轮数值核对冒领专业签收。

### 已有品牌目录的实际 A→B 与新副本

采用仓库内 Stripe/Vercel 的 `Design System Inspired by ...` 参考，不称品牌官方套件或用户业务品牌。初选 Airbnb 原文 29,268 units，冻结被客户端明确阻止，提示超预算；没有静默截断或新增模型运行。改用预算内 Stripe（20,552）与 Vercel（19,433）完整原文。

| 项 | A：Stripe | B：Vercel |
|---|---|---|
| run | `125b4d63-cb0a-4bdb-aa51-43dbed7c4cde` | `c185f54e-4e8f-47de-98e2-9b142ed2d4ef` |
| snapshot | `f115eca2-0668-4717-8466-0edc52476bef` | `4af2d277-a45c-4bd2-b3ca-6adbda7ede06` |
| 固定源摘要 | `66dea910aa4e4d7a2cbda9ad93496da5d464f40f343e7a14b8b8029d873535ae` | `17d533f0ff2e1b5d9be3e69335ab7fc599d1ddf52bc9ac2f2dd36479676cbd3d` |
| 结果核对 | #533afd、sohne-var、300 标题字重、ss01、4–8px 圆角 | #171717、Geist、600 标题字重/负字距、shadow-as-border |

均实际 succeeded，结果与对应冻结正文核对一致，明确风格参考不是官方规范。A 运行中切换并固定 B 后，A 完成未清除 B 绑定；B 使用自己的正文而非 A。A 快照文件 SHA256 在 B 固定/发送前后均为 `29d624f3a8921b71d40f3e65fd2be9ea7113b96765e6148a28baa1a3edc78e7c`，旧快照未漂移。

再次回到同一 candidate 源选择 strategy、原合成 LOGO A 素材与 Vercel 参考，补充说明 LOGO 非 Vercel 官方标志。点击创建后出现原生确认“选择已改变。新建接续副本，并保留原稿和原恢复记录？”，明确确认才产生新 target `5af3f31a-843d-4005-9e27-b0686bed79dd`、conversation `b5a2bb68-eec9-4992-ac31-75d4362d98ed`、operation `379d330d-3960-4cd9-b662-315030447f71`、snapshot `2e92a8a7-fc2d-4b17-b448-46326ae6b04e`。

实际目标快照含 strategy 固定摘录/候选源身份、补充说明、asset-1.svg 和完整 Vercel 规则，品牌摘要与 B 相同；不包含未选章节。权威桌面存储中原 operation 的 completed 与备份仍指向旧 target `dc58ec50`，新 completed 指向 `5af3f31a`，活动记录为条件删除墓碑，两侧身份未合并或丢弃；新目标未自动运行。截图 `native-brand-continuation-local5.png`。此项补充真实目录/存储/模型接入证据，但仍不代替业务真实品牌 T33 和专业评审。

新副本正常退出后，同一 local.5 重开（PID 26054），从最近项目回到原 `5af3f31a` / `b5a2bb68`，完整 strategy/补充要求草稿、asset-1.svg 和固定资料列表中的 Vercel 均可读；快照为 4 项、20,143 UTF-16 units，未自动发送。最终仅停止本次 namespace，stop exit 0、remainingPids 空；旧应用未动。

剩余：应用外网页手动打开；旧待发送输入/journal 的实际原生升级（旧备份缺该存储）；双原生窗口及强制中断矩阵；业务真实品牌 A/B 与专业评语/用户签收；[依赖安全告警](./2026-10-07-dependency-audit.md)处置。未跑不记通过。

原白屏相关代码和五项定向回归已检查，当前未复现；用户允许暂时跳过，故不标根因修复。

后续字节核对勘误（2026-10-07 local.7）：上文新副本 `5af3f31a` 的“原合成 LOGO A 素材”描述不准确，实际已复制并固定的是 161 字节红色合成 **LOGO B**，SHA-256 `fef79a73e0fadcb72ecc8225ff11be8a6960587a54f045e66dba1738ccb1dbf7`。原背景文案仍写 LOGO A，模型在 local.7 实际讨论中指出冲突；原快照/原稿没有回填。正确新意图、源缺失与实际下游页面另见 [local.7 第 3、6 节](./2026-10-07-local7-native-verification.md)，不把勘误变成 local.5 未跑项目的通过证明。
