# Spec 包结构验证记录

日期：2026-10-04。验证对象是本次生成的开发规格和合成夹具，**不是 Mokina 应用、PR3、真实模型或用户本机**。

## 已执行

`python scripts/validate_spec.py`：通过。

```text
SPEC VALIDATION PASSED — this is NOT a Mokina application test result.
OK: JSON parse: 19 files
OK: JSON Schema: 4 schemas and corresponding examples validated
OK: Traceability: 24 requirements, 20 tasks, 57 cases; DAG and reciprocal coverage valid
OK: Snapshots: canonical fingerprints, source asset hash, excerpt hashes and target references valid
OK: Recovery fixture: all bytes, hashes, version graph, current pointer and single-section candidate valid
OK: Synthetic CSV: independent Decimal recomputation; missing/zero, weighted ratios and -62 lead delta valid
OK: Markdown: internal file links and source IDs resolve
OK: Evidence boundary: release/app tests remain not_run; no fabricated user acceptance
```

独立加法契约类型检查：通过。

```sh
tsc --noEmit --strict --target ES2022 --module ESNext --skipLibCheck contracts/mokina-local.ts
```

工具返回：退出码 0；Version 5.8.3。此工具环境只用于检查 Spec DTO，不是产品要求的 Node 24 运行环境或应用构建证据。

## 未执行

未修改或构建 Mokina，未运行仓库测试、真实 Codex 营销任务、macOS 安装/导出、公开分发或用户签收。`acceptance.json`、`backlog.json` 和发行证据模板保留 not_run/planned。

## 完整性

封包前对所有内容生成 `SHA256SUMS.txt`；最终再次检查 SHA256SUMS，并使用 ZIP 内部完整性检查。SHA 文件不对自身计算摘要。

复验：在解压目录运行上方 Python 命令；需要 Python 的 jsonschema 包。它不访问网络或账户、不执行产品测试、不改变任何验收状态。
