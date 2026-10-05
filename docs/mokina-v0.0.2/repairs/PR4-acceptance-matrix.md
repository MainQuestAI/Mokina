# PR4 修复验收矩阵

结论：R1–R7 代码修复、定向回归和远端 CI 已通过；最终 `0.0.2-local.3` 的大部分安装包行为及真实模型运行已通过。Finder 启动、原生导出保存/取消及 PDF 文件验收尚未完成，工程收口保持未完成。用户专业签收未执行。

输入 HEAD：`7135b52fe5c03537fbc000ec0686df01692a26f4`；精确 BASE：`df4a0b2699cd2b37df2099b38da8fe8375d14b41`；最终产品代码：`6fe5d5346a0031a2459d04925a53be8e428f4ad9`。源码、版本、包大小及 SHA256 见 [manifest](evidence/artifact-manifest.json)。日期：2026-10-05。

## 功能验证

以下 evidence 文件均位于 [evidence](evidence/README.md)。

| Review / 验收点 | 结果与证据类型 | 证据文件 |
|---|---|---|
| R1 保存为 POST 前置；同 key A/B/C、写后删除、旧身份不能删除新记录 | 定向 Vitest 通过；延迟 IPC 红测先暴露提前创建项目，修复后通过 | transfer-red.txt、transfer-green.txt；CI |
| R1 桌面权威恢复、旧缓存迁移、跨 origin、容量不足 | bridge/desktop store 测试通过；真实 app 重启记录恢复一致；跨 origin 为 harness 证据 | instance-restart.json；CI |
| R1 草稿/extras 转存及发送、快照、接续删除 | 关键异步操作等待结果；失败保留恢复卡片/绑定，竞态及路由切换测试通过 | transfer-green.txt；CI |
| R2 202 丢失→原成果恢复→同 run 候选→显式采用 | 最终安装包、实际 IPC、真实模型通过；同 clientRequestId 仅一次执行，未修订章节一致 | revision-lost.json、revision-adopted.json |
| R2 job 保存/清理失败、未知 runId、新尝试、晚到结果 | 定向组件/请求测试通过；失败身份保留，切换后不覆盖成果 | CI；修复记录 |
| R3 素材选择与两条 prompt 实际字节 | 从最终 app 面板选择 SVG/摘录；冻结 A 后替换 B；legacy/OD Next 实际复制的 177 字节均为 A，整个 OD Next task completed | selected-context.json、model-input-receipts.json、odnext-completed.json |
| R3 缺失 blob | 最终包在 Agent 启动前失败；runtimeGenerationId=null、产物 0、not-submitted，未报告 staged-file | missing-blob.json |
| R4 prepare→export→import→正式 GET→运行，删除源项目 | 最终安装包及真实模型通过；原 fingerprint 保留；源项目 404 时目标 reader 200；再次导出导入仍可读 | restored-target.json、restored-legacy-run.json、reexport-restored.json、model-input-receipts.json |
| R4 篡改、伪造 fingerprint、缺失引用、错误归属 | 真实 prepare 夹具的生产校验器/HTTP 回归通过 | CI；daemon-associated-green.txt |
| R6 丢失成功响应、刷新失败、重启重试、明确副本 | 最终 app 入口通过；普通重试目标始终一个，已导入后无新增 POST；明确副本创建第二身份 | import-lost.json、import-restart-copy.json、instance-restart.json |
| R5 PDF 包内递归依赖、加载路径、许可/签名/缓存 | 25 个安装二进制无 Homebrew/开发目录引用；sandbox 禁止外部工具仍读取中文英文多页 | pdf-resource.json；CI |
| R5 PDF reader 扫描件、损坏、超限 | 最终 app 正式 reader 通过；扫描无 OCR、损坏 unreadable、10 MB+1 拒绝 | pdf-reader.json、pdf-errors.json |
| R7 根 CI 与真实 daemon 回归 | 托管 Ubuntu、Node 24、pnpm 10.33.2；guard/typecheck/i18n/定向测试和 13 项真实 daemon + fake Agent 浏览器测试成功 | [运行 37303305689](https://github.com/MainQuestAI/Mokina/actions/runs/37303305689)，SHA 6fe5d534；ci-run.json |

## 最终安装包验证

| 项目 | 状态 | 证据与剩余边界 |
|---|---|---|
| 最终提交重建 app/DMG/ZIP | 通过 | sourceSHA 6fe5d534、local.3、包 SHA256 固定；artifact-manifest.json |
| DMG 挂载复制，源码之外运行 | 通过 | 安装后核对 local.3；二进制和运行目录均位于 Mokina-PR4-QA；无源码开发服务依赖 |
| Finder 原生打开同一 app | **未完成** | 原生操作返回 Mac locked；tools-pack 启动不代替 Finder 验收 |
| 资料冻结、真实生成、修订恢复/采用、接续活动页 | 已有单项通过 | 最终包运行真实模型；多组场景，未冒称单项目完成所有步骤；marketing-generation.json、marketing-browser.json、revision-adopted.json、landing.json |
| 退出重开、实例隔离 | 通过 | 主实例停止/重启期间第二实例存活，之后清理第二实例；记录恢复、reader 200、全局配置摘要相同；instance-restart.json |
| 历史 v1、当前 v3、未采用 v4 的 HTML/ZIP | 内容/外部打开通过 | 最终 app 实际版本选择和导出后截取 blob；候选标记只在 v4。三个 HTML、三个解压 ZIP、活动页外部 Chromium 打开无 JS 错误/缺图/远程请求；exports.json、browser-exports.json |
| HTML/ZIP 原生保存与取消 | **未完成** | 锁屏阻止 Save As；blob 检查不代替此项 |
| 各版本原生 PDF 文件、取消与目视核对 | **未完成** | native PDF 单元回归通过；实际 save dialog/printToPDF 文件待执行。PDF 文本解析通过不代表 PDF 导出通过 |
| 恢复包导入新项目，源项目删除后继续运行/再次恢复 | 通过 | 正式 API/最终 app 入口和 legacy 真实模型；保留完整内容及来源关系 |

## 全量结果与专业签收

最终代码 Web 全量：1260 文件，1254 通过、6 失败；12818 用例，12798 通过、8 失败、1 expected failure、11 skipped。八个失败名称和错误签名均在精确 BASE 重现，见 web-full-failures.txt、web-base-failures.txt 和修复记录。

daemon 全量在 0b3042：904 文件，894 通过、7 失败、3 skipped；11960 用例通过、18 失败、15 skipped。关联的历史导出/重复导入两个旧断言已在最终代码更新并定向通过（50 项）。其余 14 个失败名称在精确 BASE 重现；两个 brand 用例仅全量失败，BASE 和 HEAD 单独运行都通过，保留为全量环境/时序疑点，未宣称已证明历史失败。详见 daemon-failure-comparison.json 和 daemon-*-failures.txt。没有把全量套件写成绿色。

营销策略、预算及页面是否满足真实业务质量要求，仍由用户专业签收。模型成功写文件、测试通过和页面可打开均不等于专业签收。本轮未合并 PR。

## 保留的失败与最后一步

早期 symlink 运行目录被 Codex 文件工具拒绝：受理身份恢复成功但未生成候选。放弃旧结果后换为真实目录，显式新尝试完成候选。两个使用错误 prompt 字段的 API 夹具被 BAD_REQUEST 拒绝，修正为正式 message/currentPrompt 后成功；旧安装副本被检查发现 local.2 后重新复制并核对 local.3。这些失败没有计为成功，见 failed-fixtures.json。

Mac 解锁后继续使用本 manifest 对应 app，无需重建产品代码：Finder 打开；从版本面板导出历史/当前/候选原生 PDF，核对内容与分页；对 HTML/ZIP/PDF 各取消一次，核对没有误写文件或消耗版本；再核对 app 退出重开。随后更新工程状态，用户专业签收另记。
