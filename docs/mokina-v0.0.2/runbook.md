# Mokina V0.0.2 Local Preview · 本机使用 Runbook

当前候选为 `0.0.2-local.6`，macOS arm64，产品源码 `8950986e41e5047c56aab4d3ba9fda900902aa9a`。RR1–RR5、同一 DMG 安装的 Finder 原生工程验收已完成。用户营销专业签收未执行；不自动合并 PR。全量历史失败单列，不宣称全绿。

## local.6 交付与使用

| 项目 | 值 |
|---|---|
| DMG | `Mokina-mokina-local.dmg`，408,035,059 bytes |
| DMG SHA256 | `f0b9f250a28c2d912042dc387e1e21437622a2a6bc2e319d9fa22bc9aaf5f787` |
| ZIP | `Mokina-mokina-local.zip`，405,041,739 bytes |
| ZIP SHA256 | `e24be3531f0b476fb89330dcac807a85e8dfef3cac84e85fa1bd51ca1794480f` |

交付及 manifest：`/Users/dingcheng/Mokina-PR4-QA/releases/0.0.2-local.6/`。已从该 DMG 安装到 `/Users/dingcheng/Mokina-PR4-QA/out/mac/namespaces/mokina-local/install/Applications/Mokina.app`。同一安装副本已经 Finder 启动、退出重开及实际原生界面链验收。包自带 web、daemon 和 PDF 文本工具；生成仍需要已有 Codex CLI、账号和网络。签名、公证及公开发行范围不变。

1. 启动先恢复桌面权威记录，再挂载业务入口。删除标记阻止旧窗口缓存复活。pre-v2 profile 的缺失原因无法判定时，选择「恢复这些旧记录」或「保留备份并继续」，不会自动回灌。后者保留本 origin 的独立旧缓存备份。容量不足、CAS 冲突及 IPC 失败明确阻止操作，本版不自动淘汰删除事实。
2. 单章修订收到 daemon 的明确未受理证明时，原成果保留要求并提供「结束本次未受理修订」。先保存要求草稿、再清理旧记录，全部成功后才解除生成阻塞；用户再次点击生成才创建新身份。刷新、查询空结果和裸 4xx 不创建新尝试。
3. 普通发送的拒绝回执保留至显式恢复或丢弃。恢复不覆盖已占用输入；先保留当前输入，再清空输入框并选择恢复。持久转移成功后才清理回执。
4. 恢复包普通重试保持目标、操作与归档摘要。同身份重叠请求返回同一项目，其他归属返回冲突并保留原内容；注册中断后，同身份重试校验已提交内容再补注册。

Finder 默认数据为 `~/Library/Application Support/Mokina/namespaces/mokina-local`；CLI QA 使用 `/Users/dingcheng/Mokina-PR4-QA/runtime/mac/namespaces/mokina-local`。两者不能混作同一次用户流程证据。本轮后者通过了实际 IPC 保存/删除/重开、真实 Codex API 生成、冻结 A 后换 B、四个重叠导入、源项目删除后正式 reader 与真实运行、第二代恢复。CLI 重启保留其他 Open Design 进程及全局 Codex 配置/账号文件摘要。包内 PDF 25 个二进制无开发目录依赖，中英文多页读取及扫描/损坏/超限正式 reader 验证通过。

Finder 默认 profile 的独立完整流程也已通过：原生选择资料与素材、真实 Codex 生成、受理前拒绝后结束/新尝试、丢 202 恢复同 run 并采用、选章接续及退出重开。采用前历史 v2/当前 v3/未采用候选 v4，各导出 HTML/ZIP/原生 PDF，共九份；取消不写文件，外部 Chrome/Preview 打开正确。恢复包原生导出/导入重叠四次只建一个目标，删除合成源后仍可正式读取和引用快照运行，原生再次导出及二代 reader 通过。201 字符中文/空格/子目录文件可在重开后恢复修订并接续。最终验收实例已退出，其他 11 个桌面进程及全局账号/config 摘要保持不变。

成果 PDF 不宣称可搜索或可复制正文；营销专业签收待用户另行完成。安装 app、九份导出及恢复 ZIP 已保留。完整证据见 [local.6](repairs/evidence/final-local6/README.md) 与 [矩阵](repairs/PR4-acceptance-matrix.md)。

## local.5 历史 Runbook

以下保留源码 `033c57d`、版本 `0.0.2-local.5` 的原验收与产物记录，不代表 local.6 的工程收口结果。

## 产物与身份

| 项目 | 值 |
|---|---|
| 应用 | `Mokina.app`；bundle id `ai.mainquest.mokina.preview`；`0.0.2-local.5` |
| DMG | `Mokina-mokina-local.dmg`，408,013,900 bytes |
| DMG SHA256 | `40e2b1799fab254f5af6af8cffba976548cbe5e83fb9e334d666df9a991ea2bb` |
| ZIP | `Mokina-mokina-local.zip`，405,038,728 bytes |
| ZIP SHA256 | `28a4200d0d7a4c4d32b99adae1d4438940b6e47ba63962a85f99ea05be560b77` |
| PDF runtime | Poppler 26.03.0 arm64，25 个二进制及 CMap；manifest SHA256 `34991feb5c83b6cfc0727b267a26c5bd58013d0a62aafda6f6ebf6c7f045302d` |
| 签名与更新 | app 未签名、未公证；PDF 二进制 ad-hoc 签名；自动更新关闭，手动替换 app |

正式构建产物位于工作树 `open-design/.tmp/mokina-pr4-pack/out/mac/namespaces/mokina-local/{dmg,zip}`。稳定交付副本及 manifest 位于 `/Users/dingcheng/Mokina-PR4-QA/releases/0.0.2-local.5/`。验收 app 与数据位于 `/Users/dingcheng/Mokina-PR4-QA/`，使用合成资料，独立于用户主工作区。

## 安装与启动

1. 核对包摘要，打开 DMG，将 `Mokina.app` 复制到自己的应用目录。
2. 在 Finder 打开 app。本候选未公证；如系统拒绝打开，应先查看系统给出的原因。不要关闭系统保护作为安装步骤。
3. app 自带 web、daemon、运行资源与 PDF 文本工具，不需要启动源码里的开发服务或安装 pnpm。已有 Codex CLI、登录账号与模型网络仍是生成任务的外部依赖。

工程验收将同一 DMG 挂载复制后，通过 Finder 双击实际 app 启动与重启。安装副本：`/Users/dingcheng/Mokina-PR4-QA/out/mac/namespaces/mokina-local/install/Applications/Mokina.app`；默认数据目录：`~/Library/Application Support/Mokina/namespaces/mokina-local`。生成与工程验收仅使用合成资料，用户主工作区未改动。

## 日常使用与失败恢复

1. 在项目内「资料与背景」预览资料、选择摘录；图片/SVG 选择素材角色和使用说明，然后冻结为任务快照。冻结后修改源资料不改变此次输入。
2. 发送前保存身份与快照绑定。桌面保存失败时保留输入、显示失败并停止发送。回执中 `inline-text` 表示摘录，`staged-file` 表示已校验并复制的素材；`not-submitted` 不代表模型已经收到资料。
3. 单章修订产生候选。刷新或重启后，在原成果恢复同一次请求；状态未知时先核对，普通恢复不创建第二次执行。只有明确选择新尝试或丢弃才更换/清除身份。候选必须显式采用。
4. 接续先选择版本和章节、补充背景，再创建下游草稿，不自动发送。保存接续身份失败时保留选择，修复存储后重试。
5. 版本面板分别选择历史稿、当前稿或未采用候选，导出 HTML、ZIP 或原生 PDF。内容取自选定版本。三种格式九份实际文件及取消均已验证；历史/候选导出不改变当前版本。
6. 导出恢复包后，在侧栏「新建项目」的现有恢复导入面板选择该包。响应丢失、列表刷新失败或重启后，选择同一文件复用原项目身份；文件摘要不同会冲突。只有勾选「再导入一份副本」才创建新身份。
7. 恢复快照保留原内容和指纹，由新项目封装归属并读取随包素材。源项目删除后仍能读取、运行和再次导出；不要手改原 projectId 后继续使用旧指纹。

启动先恢复桌面持久记录，再启用相关业务入口。冲突、容量不足和 IPC 失败会显示错误；不要通过清空缓存或改写记录 ID 绕过错误。纯 Web 保留 localStorage 路径。

## PDF、连接与限制

packaged daemon 仅使用包内 pdftotext；包内缺失即报错，不寻找 Homebrew 或 PATH 工具。支持中文、英文和多页文本 PDF；扫描件不做 OCR，损坏文件不可读取，超过 10 MB 明确拒绝。local.5 正式 reader 已验证上述行为。资料 PDF 的文本读取和成果的 PDF 导出是两个独立入口。

原生导出的成果 PDF 已在 macOS「预览」打开，三份均六页；本次 PDFium 文本提取为零，不将验收扩大到可搜索或可复制文字。需要可编辑正文时同时保留 HTML/ZIP。

生成需要已有 Codex CLI 登录和模型网络。离线仍可浏览、编辑和导出已有成果。连接诊断返回产品、平台、运行状态及后续动作，不应包含令牌或资料正文。退出仅停止当前实例；双实例实际检查通过，Codex 全局配置文件摘要前后相同。

此版本为本机 arm64 预览，未完成公开发行签名、公证、跨平台验收。工程验收与营销专业质量签收分开记录，详见 [验收矩阵](repairs/PR4-acceptance-matrix.md)。

## 恢复 CLI 与验收记录

现有 CLI 使用 `od mokina recovery export --project <id> --out <path.zip> --json` 和 `od mokina recovery import --file <path.zip> --target-project <new-id> --operation-id <stable-id> --json`；context 别名保留兼容。导入普通重试继续使用原 target/operation 和相同文件摘要；明确副本才选新身份。包内预捆绑 CLI 已由安装 app 的运行时实际执行导出、导入与再导出，不依赖源码。

最终候选证据见 [final-local5](repairs/evidence/final-local5/README.md)，产品 SHA 远端检查 [37317607651](https://github.com/MainQuestAI/Mokina/actions/runs/37317607651)。阶段 local.3/local.4 保留历史失败，不作为交付版本。最终源码不含后续纯文档提交，PR HEAD 与检查以 PR 当前记录为准。
