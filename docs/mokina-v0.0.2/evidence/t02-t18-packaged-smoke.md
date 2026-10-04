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
