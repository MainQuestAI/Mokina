# R03：连接诊断与真实 CLI 身份一致

## 用户问题及原因

设置里的连接检查使用已保存的 CLI 路径/HOME，而脱敏诊断独立执行系统 PATH 的 `codex --version`，并缓存60秒。修改配置后，两处可以互相矛盾；权限等探测失败也被误报为 CLI 缺失。

## 红例与改动

新增 `apps/daemon/tests/mokina-diagnostics.test.ts` HTTP 回归：使用隔离的可执行 CLI 和 HOME，清空检测路径并限制宿主工具发现。先确认配置的 CLI 已登录，再模拟失效登录，随后切换到不存在的 CLI、模拟执行权限失败。每步同时请求连接和诊断，核对检测语义和诊断脱敏。

在本轮修改前的 `98851a97` 代码上，连接已报告 `cli_missing`，诊断仍返回 `detected`。红例日志：[r03-red.log](../../output/mokina-m0-2026-10-11/r03-red.log)。这是依赖分支基线的红例，没有把它描述为在旧 main 上实跑。

修复删除独立 PATH 探测与缓存，让诊断使用与连接检查/运行相同的已保存配置和探测入口。探测可执行时为 detected；明确缺失为 missing；权限/其他不可判定失败为 unknown。登录状态与实际模型连通性继续通过原有独立界面呈现，诊断不包含 CLI 原始输出、路径或凭据。

## 已运行验证

Node24 下定向运行 `mokina-diagnostics.test.ts`、`mokina-codex-connection.test.ts`、`mokina-codex-probe.test.ts`：3文件17项通过，最终集成复跑仍为17/17。[r03-green-final.log](../../output/mokina-m0-2026-10-11/r03-green-final.log)。测试没有执行模型任务，合成 CLI 仅支持 version/login status；测试结束恢复环境和配置并删除其临时目录。

本项没有新增用户能力、HTTP字段或命令，现有 UI/CLI 继续读取同一 diagnostics endpoint。全局类型检查、构建、最终CI及原生集成结果在本轮总记录收口。
