# 全量失败与精确基线对照

Current full suites on stable source; exact git archive sources for pre/base, shared pinned node_modules, all failing files rerun. Baselines are selected failing-file runs, not full suites. Error signature excludes stack paths; timeout signature comes from terminal FAIL block.

产品源码 `8950986e`；稳定测试 HEAD `1ae0c139`；修复前 `a167de9`；精确 BASE `df4a0b2`。

| 包 | 当前全量通过 | 失败 | 跳过 | 文件数 | 修复前选取失败 | BASE 选取失败 |
|---|---:|---:|---:|---:|---:|---:|
| web | 12809 | 8 | 11 | 1260 | 8 | 8 |
| daemon | 11987 | 14 | 15 | 905 | 14 | 15 |

BASE/修复前只重跑对应失败文件，不能据此声称其全量结果。当前全量不是全绿；未解释的时序结果单列。

| 包/文件 | 测试名称 | 当前错误签名 | 对照 |
|---|---|---|---|
| web/tests/campaigns/deepseek-v4-flash-ui-contract.test.ts | DeepSeek V4 Flash workbench campaign entry keeps the built-in campaign entry visible across entry tabs and project detail | AssertionError: expected '// EntryShell — the centered-hero ent…' to match /topRightSlot=\{\s*topRightCampaignAud…/ | same-name-and-signature-in-both |
| web/tests/campaigns/deepseek-v4-flash-ui-contract.test.ts | DeepSeek V4 Flash workbench campaign entry keeps every CMS touchpoint host on the home view | AssertionError: expected 'import { useCallback, useEffect, useL…' to match /\{route\.kind === 'home' && route\.vi…/ | same-name-and-signature-in-both |
| web/tests/i18n/locales.test.ts | i18n locales keeps locale dictionaries aligned with English keys and placeholders | AssertionError: zh-CN.homeHero.title: expected [] to deeply equal [ 'word' ] | same-name-and-signature-in-both |
| web/tests/state/config.test.ts | mergeDaemonConfig defaults reporting on and mints an installationId when the install never opted out | AssertionError: expected false to be true // Object.is equality | same-name-and-signature-in-both |
| web/tests/components/HomeHero.rail.test.tsx | HomeHero intent rail leads the create group with the Brand Kit chip and its own action discriminator | AssertionError: expected 'mokina-market-analysis' to be 'create-brand-kit' // Object.is equality | same-name-and-signature-in-both |
| web/tests/components/HomeHero.scenario-cards.test.tsx | HomeHero scenario cards uses the fixed ten-item Home creation hierarchy in product order | AssertionError: expected [ 'mokina-market-analysis', …(11) ] to deeply equal [ 'prototype', 'deck', …(8) ] | same-name-and-signature-in-both |
| web/tests/components/chips.automatic-default.test.ts | create rail chips claim the automatic default marks every first-level output type as a product-owned automatic scenario | AssertionError: expected [ 'mokina-market-analysis', …(1) ] to deeply equal [] | same-name-and-signature-in-both |
| web/tests/components/chips.automatic-default.test.ts | create rail chips claim the automatic default binds exactly the plugin the daemon re-derives from the chip metadata | AssertionError: mokina-market-analysis: expected 'example-web-prototype' to be 'mokina-market-analysis' // Object.is equality | same-name-and-signature-in-both |
| daemon/tests/brand-prefetch.test.ts | prefetchFromHtml (extract from already-rendered DOM) flags an anti-bot challenge page as blocked and thin | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/brand-routes.test.ts | brand routes aborts an active programmatic pass before extracting from browser HTML | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/brand-routes.test.ts | brand routes synthesizes from a content-rich page whose minimalist palette the network gate would reject | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/brand-routes.test.ts | brand routes keeps a browser HTML retry recoverable (needs_input, not terminal) after aborting an active programmatic pass | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/brand-routes.test.ts | brand routes starts browser HTML retry promptly when stale finalize fallback is still settling | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/brand-routes.test.ts | brand routes keeps cancel terminal when browser HTML extraction is in flight | Error: Test timed out in 20000ms. | same-name-and-signature-in-both |
| daemon/tests/codex-model-capability-preflight.test.ts | Codex configured-model capability preflight blocks an unsupported configured default model before spawning Codex exec | AssertionError: expected 1 to be null | same-name-and-signature-in-both |
| daemon/tests/codex-model-capability-preflight.test.ts | Codex configured-model capability preflight does not overwrite cancellation while the version probe is in flight | Error: path did not appear: <temp>/codex-login-probed | same-name-and-signature-in-both |
| daemon/tests/integrations/vela.routes.test.ts | POST /api/integrations/vela/analytics-entry mirrors OpenDesign AMR entry clicks to the AMR analytics ingest shape | AssertionError: expected { mirrored: false } to deeply equal { mirrored: true, status: 202 } | same-name-and-signature-in-both |
| daemon/tests/integrations/vela.routes.test.ts | POST /api/integrations/vela/analytics-entry forwards campaignId and conversionSource on the outbound AMR analytics body | AssertionError: expected { mirrored: false } to deeply equal { mirrored: true, status: 202 } | same-name-and-signature-in-both |
| daemon/tests/integrations/vela.routes.test.ts | POST /api/integrations/vela/analytics-entry forwards optional onboarding profile (role/orgSize/useCase/source) to the AMR ingest body | AssertionError: expected [] to have a length of 1 but got +0 | same-name-and-signature-in-both |
| daemon/tests/integrations/vela.routes.test.ts | POST /api/integrations/vela/analytics-entry mirrors OpenDesign onboarding profile snapshots with the header-derived device id | AssertionError: expected { mirrored: false } to deeply equal { mirrored: true, status: 202 } | same-name-and-signature-in-both |
| daemon/tests/runtimes/codex-model-preflight.test.ts | Codex model capability preflight blocks the known-old stable CLI only with confirmed ChatGPT auth | Error: expected { status: 'unknown', …(1) } to deeply equal { status: 'incompatible', …(3) } | same-name-and-signature-in-both |
| daemon/tests/runtimes/codex-model-preflight.test.ts | Codex model capability preflight fails open for config overlays, API auth, and unconfirmed ChatGPT auth | Error: expected { status: 'unknown', …(1) } to deeply equal { status: 'unknown', …(1) } | same-name-and-signature-in-both |
| daemon/tests/export-inline-route.test.ts | POST /api/projects/:id/export/html route rejects historical entries until their dependency graph is versioned | 当前通过/不存在 | baseline-only-failure |

Web 另有 1 项 expected failure（Vitest JSON 将它计入 numPassedTests），两套全量命令均因历史失败退出 1。本轮不存在未解释新增失败。BASE 独有 export-inline 旧断言失败单列。
