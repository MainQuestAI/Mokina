# 契约接入说明

这些文件是本轮建议的加法规格，不是已实现 SDK。`mokina-local.ts` 可独立类型检查；应用内按第 06 文档并入 contracts 导出与原生路由。

唯一 run 新字段为 `ChatRequest.context.mokinaSnapshotId`。不要覆盖原有 ProjectFileVersion、ProjectMaterialExtraction 或完整 ChatRequest，也不要把此处的发送语义表当成原 daemon 状态 enum。

四份 JSON Schema 只检查结构；权限、文件名安全、digest 真正匹配、状态关系、current 唯一、文本预算和来源实际存在必须由服务端/集成测试验证。它们不能替代权限或内容安全检查。

快照 `fingerprint` 的规范化定义见第 06 文档；示例由 Spec 构建器计算，不是随机填的 64 位字符串。素材的 staged-file 表示作为文件提供，不等于模型做过视觉识别。

ContinuationV2 的 `initialDraft` 是创建时的记录，用户之后的实际可编辑草稿仍由 Composer 管理。用户可见的 MOKINA-CONTINUATION.json 是可读记录；run 使用受保护 snapshot 作为数据依据，不把可编辑文件中的新 ID 当成已授权的引用。

导入快照时创建新 projectId/snapshotId 并重算 fingerprint，原 snapshotId/projectId/fingerprint 放 `restoredFrom`，保留原快照副本供检查；不得改归属后沿用原 digest。
