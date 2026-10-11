# M1 实现与验收契约

## 用户路径

在项目的“资料”工作区展开“业务事实与任务 Brief”。这是可选准备；没有背景档案仍可在原输入框直接开始工作。

背景条目包含内容、来源、适用范围和确认状态。新增条目默认待确认，修改条目会解除原确认。个人偏好单独保存，不自动当作事实复用。Brief 单独保存目标、受众、交付项、KPI 口径、预算、周期、本次限制和缺失条件。

复用先选择可访问项目，再读取具体的背景版本，勾选已确认事实。保存 Brief 时，后端重新读取该版本、核对摘要和确认状态，将所选事实完整固定在 Brief 中。修改源背景不会改变已保存的 Brief。建议、偏好和未选条目不会自动加入。

保存只写文档和版本，不产生 run。保存后可选择本次交付项，交给已有输入框恢复接口；已有输入不会被覆盖，用户核对后通过原发送按钮开始。交接携带固定 Brief 版本与内容摘要、所选交付项、预算和限制、缺项及背景快照；它不会将未选交付项加入执行要求。技术运行仍使用原发送与 Strategy 路径。

## 唯一可写源与恢复

背景文件为 `business-background.html`，Brief 文件为 `task-brief.html`。HTML 中包含可见章节和 `mokina.business.v1` 结构标记，一次原子写入更新两者；没有独立的可写 JSON 正文。读取时验证结构与可见 HTML 一致，遇旧文件或外部改写拒绝受控覆盖，原文件仍可通过已有阅读和章节修订处理。

保存使用现有 project file version lock、版本历史与 operationId 去重。expectedRevision 是当前 HTML SHA-256。过期编辑返回409；同 operationId 改变请求含义也返回409。文件写入完成但版本保存失败不报告成功，同一请求可补完版本保存。曾保存的历史 operationId 不能再次覆盖当前版本。

编辑中的文字沿已有恢复 store，key 同时包含工作区、项目、会话及文档类型。原生镜像使用已有恢复前缀与 CAS，不增加原生存储机制。结果未知时保留原请求编号并禁止继续改动该请求；先读取当前成果，再明确核对同一保存，不自动重发或运行模型。读取失败不作为空文档。

Brief 内的来源快照自包含，HTML 与版本沿已有恢复包保存；旧恢复 schema 无新增旁路数据。导出继续使用现有指定版本机制。来源项目身份表示原始出处，不因为恢复到新项目而伪造原始归属。

## API 与 CLI

- `GET /api/projects/:id/mokina/business/background|brief`：200 `{result:null}` 仅表示文件不存在；读取失败返回错误。
- `GET ...?versionId=<id>`：读取固定正式版本；拒绝未采用候选及内容摘要不符的版本。
- `POST /api/projects/:id/mokina/business/background|brief`：请求为 `{operationId,expectedRevision,body}`；body 含 kind、value，Brief 额外含 background（未复用时必须为 null）。
- 写入要求目标项目 writeFiles 权限；复制来源前独立检查来源项目 read 权限。导入文件夹项目沿 metadata.baseDir 读取当前文件，版本继续沿原管理根保存。
- 400：格式或所选事实不合法；403：无权限；404：项目或指定来源不存在；409：版本／操作冲突；422：不认识或外部改写的 HTML；500：无法完成，必须核对。

```sh
od mokina business get --project <id> --kind background --json
od mokina business get --project <id> --kind brief --version <versionId> --json
od mokina business save --project <id> --kind brief --prompt-file request.json --json
```

`--prompt-file -` 支持 stdin。请求文件必须保留 operationId，未知结果不能换 ID 重发。一个没有背景的 Brief 请求如下；空字段明确表示待确认，不补造事实。

```json
{
  "operationId": "brief-request-1",
  "expectedRevision": null,
  "body": {
    "kind": "brief",
    "value": {
      "title": "线上获客方案",
      "goal": "明确下一轮线上获客安排",
      "audience": "内部评审",
      "deliverables": [{"id":"plan","title":"营销方案"}],
      "kpi": "",
      "budget": "不超过3万元，含制作与运营费用",
      "period": "",
      "constraints": "禁止线下活动",
      "missing": "人员、产能、报价与周期待确认"
    },
    "background": null
  }
}
```

## 本轮取舍与边界

- 使用 HTML 中的受控标记，未引入新成果库或通用文档编辑器。任意外部 HTML 修改都不会被表单静默覆盖。
- 后端确认的是“用户明确确认过这一条”，不是事实真实性的自动认证。业务审批、人员产能调查和供应商报价仍需要真实来源。
- 执行范围通过已有输入与运行路径交接，模型输出仍需按 Q01/Q05 检查；有来源的输入不等于营销成果已获业务签收。
- 成本推导、备选策略、脏数据分析和面向顾客的活动页精修保留在 M2/M3。
- 未修改原生宿主或安装身份，本轮不重新打包，不用 M0 的旧候选代表 M1。
