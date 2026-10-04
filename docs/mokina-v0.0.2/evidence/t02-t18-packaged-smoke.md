# T02/T18 冒烟证据（2026-10-04/05）

产物：`/Users/dingcheng/Coding-Project/02-key-project/Mokina-worktrees/v0.0.2-local-preview/open-design/.tmp/mokina-pack/out/mac/namespaces/mokina-local/builder/mac-arm64/Mokina.app`（949MB，mac-arm64，webOutputMode=standalone）

## Info.plist
CFBundleIdentifier: ai.mainquest.mokina.preview
CFBundleName: Mokina
CFBundleShortVersionString: 0.0.2-local.1
CFBundleExecutable: Mokina
CFBundleURLTypes: ABSENT（未接管 od:// scheme）

## open-design-config.json（节选）
namespace: mokina-local
appVersion: 0.0.2-local.1
webOutputMode: standalone
product: {"productId": "mokina", "productName": "Mokina", "productVersion": "0.0.2-local.1", "releaseKind": "local-preview", "automaticUpdates": false, "upstreamNews": false, "defaultTelemetry": false, "requiresUpstreamAccount": false, "registersOdScheme": false}
updateMetadataUrl: ABSENT
posthogKey: ABSENT
posthogHost: ABSENT
telemetryRelayUrl: ABSENT
velaWebUrl: ABSENT
velaWebUrls: ABSENT
amrProfile: ABSENT

## 运行冒烟（tools-pack mac start/inspect/stop）
- start 返回：currentVersion=0.0.2-local.1；update.enabled=false；update.supported=false
- inspect：state=running；title=Mokina；windowVisible=true
- 端口：web 127.0.0.1:51553 → 200 text/html；daemon 127.0.0.1:51547 /api/health → 200 {"ok":true,"version":"0.0.2-local.1"}
- 进程隔离：stamp namespace=mokina-local，与用户既有 Open Design（release-stable）并行；stop 仅停止本实例 6 个进程，Open Design 11 个进程不受影响
- 数据根：.tmp/mokina-pack/runtime/mac/namespaces/mokina-local/data（app.sqlite + 资源，7.8MB）

## 最终构建复验（2026-10-05）

- `pnpm tools-pack mac build --to all` exit 0；重新执行 `mac start` 冒烟：state=running，daemon `/api/health` 200（version 0.0.2-local.1），web `/` 200 text/html；`mac stop` 仅停本实例（残留进程 0，用户 Open Design 不受影响）。
- 最终产物摘要：
  - `Mokina-mokina-local.dmg` sha256 `f8399b5f…af319c2`（397,203,773 bytes）
  - `Mokina-mokina-local.zip` sha256 `00503386…83cdfcf2`（395,424,696 bytes）

## 最终构建复验（第二轮，含 T14 Web 入口）

- 重新执行 `OD_WEB_OUTPUT_MODE=standalone` web 构建 + `tools-pack mac build --to all`（均 exit 0）。
- 最终产物：
  - `Mokina-mokina-local.dmg` sha256 `795f81f3cdc17ddcc5fc24a5fa5e8dca32e8421684fb01a49d5215174d38443e`（397,216,361 bytes）
  - `Mokina-mokina-local.zip` sha256 `4b8fc5198b9f761fb239f6a48b19d2bb4e50882dec6ba93f6ce971b207904352`（395,430,300 bytes）

## 最终构建复验（第三轮，含 T12 弹窗层级修复）

- `OD_WEB_OUTPUT_MODE=standalone` web 构建 + `tools-pack mac build --to all`（均 exit 0）。
- `Mokina-mokina-local.dmg` sha256 `0fd576f2825cd7997c7ba018db67b23f475dea62266eb0cd2266b3b11e8b8f0e`（397,224,820 bytes）
- `Mokina-mokina-local.zip` sha256 `de47f41088d1846560070bbcf0e54da6d66ad31748c9eaf41a6eb8b4c691d55a`（395,430,241 bytes）

## 最终构建复验（第四轮，含 T04 设置页连接检查）

- web standalone 构建 + `tools-pack mac build --to all`（均 exit 0）。
- `Mokina-mokina-local.dmg` sha256 `0d875a6c6b2e2372176b3e002b289965cec8d292458b5dd7f39089d535cc4407`
- `Mokina-mokina-local.zip` sha256 `72924f826ac019874612b11f4f2e4da8538d444d98f049e168233b6141d2f9a1`
