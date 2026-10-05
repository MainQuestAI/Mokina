# PR4 修复记录

固定输入：HEAD 7135b52fe5c03537fbc000ec0686df01692a26f4；BASE df4a0b2699cd2b37df2099b38da8fe8375d14b41。

## A：R1 / R2

- 入口：renderer recovery facade、send-request-state、App 恢复屏障、desktop recovery store、FileViewer revision intent。
- 原失败：facade 连续 A/B/C 写未留下 C；冲突无返回值；旧 origin 遮蔽 durable 记录。红测见本次执行的 mokina-r1-red.log。
- 修复：完整 mutation 按 key 排序，不盲目重试 CAS；发送准备和 dispatched 写入等待 durable；启动先恢复；容量满明确失败；原成果在创建子项目与 POST 前持久保存 intent，受理后先更新 job 再清 receipt。
- 定向验证：web 4 文件 44 项通过（新增最终用例另计）；desktop store 定向通过；web typecheck 通过。
- 证据边界：本节为 Vitest/类型检查，未完成实际 IPC、Finder 或真实模型验收。
- 待收口：最终安装包重启、跨 origin、实际故障注入在 C3 统一执行。

## B：R3 / R4 / R6

- 入口：context-store 校验与暂存、两条 prompt、OD Next task-input snapshot、recovery-package、资料选择面板、导入 journal。
- 原失败：真实 prepare→export→import 后正式 reader 拒绝新项目快照（红测）。
- 修复：冻结字节实际复制并核对；OD Next 纳入既有任务附件快照；回执只报告已提供条目。恢复封装保留原内容和指纹，生产 reader 校验新归属；导入重新计算内容摘要。导入操作绑定归档摘要，UI 保存身份并支持明确副本。
- 验证：daemon 三文件 23 项通过；web 三文件 12 项通过；daemon/web typecheck 通过。
- 边界：当前为生产 helper、HTTP route、组件测试；实际安装包与真实模型在 C3 验证。原项目删除后可读/可再次导出已通过 helper 测试。
