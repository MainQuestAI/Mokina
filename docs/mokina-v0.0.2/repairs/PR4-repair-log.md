# PR4 修复记录

固定输入：HEAD 7135b52fe5c03537fbc000ec0686df01692a26f4；BASE df4a0b2699cd2b37df2099b38da8fe8375d14b41。

## A：R1 / R2

- 入口：renderer recovery facade、send-request-state、App 恢复屏障、desktop recovery store、FileViewer revision intent。
- 原失败：facade 连续 A/B/C 写未留下 C；冲突无返回值；旧 origin 遮蔽 durable 记录。红测见本次执行的 mokina-r1-red.log。
- 修复：完整 mutation 按 key 排序，不盲目重试 CAS；发送准备和 dispatched 写入等待 durable；启动先恢复；容量满明确失败；原成果在创建子项目与 POST 前持久保存 intent，受理后先更新 job 再清 receipt。
- 定向验证：web 4 文件 44 项通过（新增最终用例另计）；desktop store 定向通过；web typecheck 通过。
- 证据边界：本节为 Vitest/类型检查，未完成实际 IPC、Finder 或真实模型验收。
- 待收口：最终安装包重启、跨 origin、实际故障注入在 C3 统一执行。
