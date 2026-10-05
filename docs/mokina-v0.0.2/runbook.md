# Mokina V0.0.2 Local Preview · 本机使用 Runbook

候选版本 `0.0.2-local.3`，macOS arm64。产品代码 SHA：`6fe5d5346a0031a2459d04925a53be8e428f4ad9`。后续仅文档和验收证据的提交不改变本候选包。

真实模型、修订恢复与采用、接续活动页、恢复包导入后继续运行已验证。Finder 原生启动、原生保存对话框及 PDF 导出的实际文件/取消验收仍待完成，不能将此版本表述为工程收口或用户签收。

## 产物与身份

| 项目 | 值 |
|---|---|
| 应用 | `Mokina.app`；bundle id `ai.mainquest.mokina.preview`；`0.0.2-local.3` |
| DMG | `Mokina-mokina-local.dmg`，408,015,164 bytes |
| DMG SHA256 | `c44ac8ca6db7e89db12b9162e9adcd0baa6cc4a72abcf44983a701bc97350330` |
| ZIP | `Mokina-mokina-local.zip`，405,038,742 bytes |
| ZIP SHA256 | `e9ca49c2004c13e29231c0024f021d7c48fb71052a98d3b4f1d4c13b46fb1109` |
| PDF runtime | Poppler 26.03.0 arm64，25 个二进制及 CMap；manifest SHA256 `34991feb5c83b6cfc0727b267a26c5bd58013d0a62aafda6f6ebf6c7f045302d` |
| 签名与更新 | app 未签名、未公证；PDF 二进制 ad-hoc 签名；自动更新关闭，手动替换 app |

正式构建产物位于工作树 `open-design/.tmp/mokina-pr4-pack/out/mac/namespaces/mokina-local/{dmg,zip}`。稳定交付副本及 manifest 位于 `/Users/dingcheng/Mokina-PR4-QA/releases/`。验收 app 与数据位于 `/Users/dingcheng/Mokina-PR4-QA/`，使用合成资料，独立于用户主工作区。

## 安装与启动

1. 核对包摘要，打开 DMG，将 `Mokina.app` 复制到自己的应用目录。
2. 在 Finder 打开 app。本候选未公证；如系统拒绝打开，应先查看系统给出的原因。不要关闭系统保护作为安装步骤。
3. app 自带 web、daemon、运行资源与 PDF 文本工具，不需要启动源码里的开发服务或安装 pnpm。已有 Codex CLI、登录账号与模型网络仍是生成任务的外部依赖。

工程验收通过 DMG 挂载复制、已有 tools-pack 启动通道运行 app；实际二进制和运行目录均在源码目录之外。Finder 原生操作尚未完成：Mac 锁屏，原生输入工具明确拒绝操作。

## 日常使用与失败恢复

1. 在项目内「资料与背景」预览资料、选择摘录；图片/SVG 选择素材角色和使用说明，然后冻结为任务快照。冻结后修改源资料不改变此次输入。
2. 发送前保存身份与快照绑定。桌面保存失败时保留输入、显示失败并停止发送。回执中 `inline-text` 表示摘录，`staged-file` 表示已校验并复制的素材；`not-submitted` 不代表模型已经收到资料。
3. 单章修订产生候选。刷新或重启后，在原成果恢复同一次请求；状态未知时先核对，普通恢复不创建第二次执行。只有明确选择新尝试或丢弃才更换/清除身份。候选必须显式采用。
4. 接续先选择版本和章节、补充背景，再创建下游草稿，不自动发送。保存接续身份失败时保留选择，修复存储后重试。
5. 版本面板分别选择历史稿、当前稿或未采用候选，导出 HTML、ZIP 或原生 PDF。内容取自选定版本。HTML/ZIP 内容及外部打开已验证；原生保存/取消及 PDF 文件另计。
6. 导出恢复包后，首页重新选择该包导入。响应丢失、列表刷新失败或重启后，选择同一文件复用原项目身份；文件摘要不同会冲突。只有勾选「再导入一份副本」才创建新身份。
7. 恢复快照保留原内容和指纹，由新项目封装归属并读取随包素材。源项目删除后仍能读取、运行和再次导出；不要手改原 projectId 后继续使用旧指纹。

启动先恢复桌面持久记录，再启用相关业务入口。冲突、容量不足和 IPC 失败会显示错误；不要通过清空缓存或改写记录 ID 绕过错误。纯 Web 保留 localStorage 路径。

## PDF、连接与限制

packaged daemon 仅使用包内 pdftotext；包内缺失即报错，不寻找 Homebrew 或 PATH 工具。支持中文、英文和多页文本 PDF；扫描件不做 OCR，损坏文件不可读取，超过 10 MB 明确拒绝。最终安装包的正式 reader 已验证上述行为。

生成需要已有 Codex CLI 登录和模型网络。离线仍可浏览、编辑和导出已有成果。连接诊断返回产品、平台、运行状态及后续动作，不应包含令牌或资料正文。退出仅停止当前实例；双实例实际检查通过，Codex 全局配置文件摘要前后相同。

此版本为本机 arm64 预览，未完成公开发行签名、公证、跨平台验收。工程验收与营销专业质量签收分开记录，详见 [验收矩阵](repairs/PR4-acceptance-matrix.md)。
