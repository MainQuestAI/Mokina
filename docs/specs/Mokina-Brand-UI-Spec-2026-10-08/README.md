# Mokina 品牌与 UI 开发 Spec 包

2026-10-08 · v1 · 状态：方案与开发规格已整理，未实施，未取得视觉发布签收。

以已合并 PR11 为功能基线，沿用原 A 抽象 Logo 与中性玻璃方向，更新首页、对话、成果、资料、修订、恢复、绘画和桌面身份。每包可独立开发和审查；本包不授权提交、发布或修改用户内容。

## 阅读与执行

1. [00 重新审查](00-重新审查.md)：旧方案哪些结论保留、哪些被最新开发取代。
2. [01 设计与行为契约](01-设计与行为契约.md)：视觉数值、身份边界、恢复状态。
3. [02 替换总账](02-替换总账.md)：原 B01–B20 的责任归属。
4. [开发包](specs/)：S01–S07；顺序 S01 + S02 → S03 → S04 → S05 → S06 → S07。S01 母版最终确认只阻塞正式品牌发布，S02 可先用候选推进。
5. [验证与交付](03-验证与交付.md)、[执行提示词](Codex-执行提示词.md)。

[设计审查补充](04-设计审查补充.md)记录已确认状态与用户旅程。

[旧品牌清理清单](05-旧品牌清理.md)覆盖本轮新增的OpenDesign界面露出清理要求。

[设计审查结论](06-设计审查结论.md)：已确认方案收口；工程结论见本页末节。

机器可读入口：[backlog.json](backlog.json)、[acceptance.json](acceptance.json)、[sources.json](sources.json)。所有验收初始为 not_run，不将历史通过记成本轮通过。包内保存品牌 SVG 候选与最新原型参照快照，并附 SHA256SUMS.txt。

开发对象是 `open-design/` 下的真实应用；仓库根的 marketing-desktop 演示工程不是迁移目标。正式实施前读取各目标目录 AGENTS.md，并重新核对 main 是否已前移。不得直接在当前旧功能分支上堆叠本次换新。

本包可用性校验：`python3 docs/specs/Mokina-Brand-UI-Spec-2026-10-08/scripts/validate_spec.py`。此命令只检查规格完整性，不验证产品。


## 工程审查范围记录

目标保持本Spec包，报告入口为本README；不审查当前功能分支的全部diff。

- feature answers：D3–D15逐项A及用户直接新增旧品牌清理；D16不修改功能。
- structure：D16=A，Original arrangement；保留S01–S07，36个已列现有文件、拟新增MokinaBrand及必要相邻文案/菜单/测试文件；不新增服务或持久化状态系统。
- accepted scope：浅色Mokina品牌/UI换新、静态首页A标识、交互状态与可访问性、Web/native旧品牌清理、移除上游服务入口、保留本地/自配模型及用户数据、同一候选集成验收。
- pending remedies：范围选择时无待批工程修复；后续新发现逐条记Decision ledger。
- Scope Challenge：scope accepted as-is。现有Button/Icon、edition/profile、snapshot/journal/CAS和指定版本导出复用；TODOS中推荐/搜索/图谱不纳入。没有新增基础设施或并发模式需要外部方案选型。

工程方案审查完成；发现已映射到Spec与验收任务，产品尚未实施。


## Decision ledger

### E1：Cloud后台读取疑点（撤回，无需决定）

初始假设：主界面启动与focus会继续发送Cloud状态请求。追踪provider后证伪：`readVelaLoginStatus`在Mokina返回无结果，`fetchAmrModels`和`fetchAmrWalletSnapshot`直接return null（providers/daemon.ts:1484–1534）。App调用不等于网络请求。原草稿保存在output/spec-review-20261008/withdrawn-E1-draft.md，仅为失败检查证据。

State：withdrawn_false_positive。Actual answer：无，未提问；D17随后用于E3桌面启动策略。Accepted scope：无新增行为；依D14保留并回归现有edition隔离。本地接口与外部请求均未作动态网络观测，不虚构动态证明。

### E2：跨层品牌接线文件遗漏（沿已批准范围补齐）

Finding：Architecture #1，P2，置信度9/10。S06要求离线首帧品牌和上游profile隔离，但文件表漏列真正创建首个splash的apps/packaged/src/index.ts。该处在sidecar启动前调用createSplashWindow，activeConfig.product已可用；后续windowTitle单独来自resolvePackagedWindowTitle。若仅改Web和runtime文字会遗漏最早启动入口。

Plan baseline：S06既有启动身份契约、D13/D14旧品牌清理、D16七包结构。
Runtime evidence：packaged/index.ts:312–334,442；packaged/config.ts产品profile；desktop/runtime.ts的windowTitle与splash选项。上述均已存在，无需新服务。
Disposition：accepted_by_existing_scope。补列packaged启动调用者、既有product解析/标题文件及相应回归。产品身份在首个窗口创建前可用，复用既有profile，不从窗口标题猜edition、不新增持久化身份。只属于已批准跨层品牌替换的必要接线与证明，不扩大数据或服务范围。

Scope Challenge disposition：accepted as-is（D16=A）。Architecture已完成，E2/E3均有明确处置。


### E3：桌面启动动画表现（D17=A已确认）

Finding：Architecture #2，P2，置信度9/10，主审Codex。S06任务4要求splash同源且离线可见，D13只确认首页静态，未决定桌面启动是否保留扫描。现有desktop/tests/main/splash-pixel-scan.test.ts明确断言循环扫描、与Home shader相同及WebGL回退，不能把删除这些断言当作普通换图。

Plan baseline：D13=A首页静态；用户明确清理所有加载动画中的旧字样；S06要求离线启动可见、上游profile不变。桌面动效此前未批准更改。
Runtime evidence：packaged/index.ts:320调用createSplashWindow；splash-pixel-scan.test.ts的loops测试检查requestAnimationFrame循环，inlines测试要求资源内联。无真实安装候选画面验证。

|承诺|当前|A|B|
|---|---|---|---|
|Mokina桌面Logo动效|旧字标循环扫描；新图形动效未定|静态A图形|A图形保留循环扫描|
|首页Logo|D13静态|保持|保持|
|启动进度/完成判定|按真实启动状态|保持，不以Logo判断|保持，不以动画结束判断|
|离线与无WebGL|S06仍可见|资源内联，无WebGL依赖|资源内联，扫描失败回退静态A|
|上游profile|维持原状|保留旧扫描及回归|保留旧扫描及回归|
|用户数据/模型/服务入口|已确认契约|不变|不变|

Question D17:
项目：Mokina品牌/UI换新。桌面启动画面是否也采用静态A图形？之前的静态决定仅覆盖首页。现有桌面启动动画及测试要求循环扫描（splash-pixel-scan.test.ts）。建议A，统一品牌表现并减少启动对图形动画的依赖；两种方案都保留真实启动状态和离线可见。
Header：桌面启动画面
Options:
A) 静态A图形（推荐）
Mokina桌面启动显示静态A图形，保留真实启动状态与完成判定；不运行Logo扫描。上游profile继续原扫描。对应测试分产品验证内联资源、启动状态及回退，维护分支清楚。
B) 保留扫描动效
仅将Mokina启动字标换成A图形，继续循环扫描；无WebGL时回退静态A。首页仍静态。需适配新图形比例并保留动画和回退验证，后续多维护一套动态图形表现。

Completeness：视觉/运行机制取舍；两项都覆盖离线首帧、真实启动判断及上游隔离，不比较测试数量。
State：accepted。Actual answer：用户在D17后回复“A”。Accepted scope：Mokina桌面静态A图形、内联离线资源、真实启动判断不变，上游扫描路径和回归保留；无新增业务状态。
Dispositions：E1撤回；E2按既有授权补齐；E3已批准。后续分节结论见07及本页末节。


## 工程分节审查记录

Architecture：E1证伪撤回；E2按既有S06/D14授权补齐；E3=D17=A。Code Quality：E4现有取消/保存失败状态遗漏按源码与测试补齐；保留Button/Icon公共入口，不新增跨app渲染库。Tests：八组必要证明见07，均源自已批准AC；不创建测试或声称运行通过。Performance：无新增查询/缓存方案，保留50ms重复长任务回归与无transcript滤镜。

代码路径、测试质量、Value cards和分发限制见[07工程与测试映射](07-工程审查与测试映射.md)。E4置信度9/10，P2，主审Codex，证据FileViewer.mokina-revision-recovery.test.tsx:388–417。独立复核及最终结论见07与本页末节。


## Approval readiness

PASS：D16=A保留结构；E2引用S06/D14；E3引用D17=A；E4仅补真实失败状态；QA1–QA8落实D3–D17与已有AC，未加新业务政策；独立复核2/5/6按01/D12/D15既有授权补必要证明。E1证伪撤回。没有待批修复；未授权实施产品代码、发布、删除用户数据或自动更改模型。

## Implementation Tasks

- [ ] **E-T1（P2） S06 — 贯通packaged首帧与desktop品牌资源**。来源：E2、D14、D17；验证：S06-AC02/QA5。具体路径与断言见07、08及任务JSONL。
- [ ] **E-T2（P2） S02 — 验证共享按钮级联和产品作用域**。来源：D9/D10及Code Quality；验证：S02-AC01/QA4。具体路径与断言见07、08及任务JSONL。
- [ ] **E-T3（P2） S04 — 补齐失败态显示并保持恢复身份**。来源：E4及已有S04/S05契约；验证：QA3/QA7。具体路径与断言见07、08及任务JSONL。
- [ ] **E-T4（P2） S01/S02/S07 — 落实品牌名称和辅助通知的边界断言**。来源：01、D12、独立复核2/5；验证：S01-AC01/S02-AC04。具体路径与断言见07、08及任务JSONL。
- [ ] **E-T5（P2） S07 — 把QA1至QA8接入同一候选验收**。来源：D3至D17及03/07要求；验证：08完整矩阵。具体路径与断言见07、08及任务JSONL。

## 工程完成摘要

- Scope accepted as-is，七包结构保留。Architecture 2项（启动接线、桌面动画）已明确；Code Quality 1项（现有失败状态显示）已补齐；Tests 8组新增/改动行为证明仍待实施；Performance无新增问题，保留基线trace要求。
- critical_gaps=0，指无已知“无错误处理且无验证计划”的静默关键缺口；不是产品测试全绿。issues_found=11包含已映射工作，unresolved=0。
- 独立复核6项：3项因输入缺失证伪，3项沿已有授权补验收/澄清；无待决项。实际模型kimi-for-coding[1m]，Claude Code进程与标记校验完成；设计阶段旧外部复核失败不被覆盖。
- 执行以七包顺序集成为主，S01资产与S02独立样张可隔离准备；共享组件及主流程串行。未创建实施worktree。
- Lake Score：N/A，只有方案取舍，无测试深度打分。无新增TODO；不写长期记忆。
- [工程映射](07-工程审查与测试映射.md)、[QA验收计划](08-QA验收计划.md)是后续实施输入；所有19条AC保持not_run。

## Suppressed findings

E1仅看App调用推断Cloud请求，provider提前返回证伪；外部“缺决策/缺失败文案/AC04不存在”由受限输入引起，完整包实际存在。禁止据此重复改造或删已有功能。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | 未调用 | 本轮不重开产品定位 | 0 | not_run | 不借历史放行 |
| Outside Review | Claude Code | 工程独立复核 | 1 | completed / issues_found | 6项已核对，0待决 |
| Eng Review | /plan-eng-review | 架构、代码、测试、性能 | 1 | issues_open（工作已映射） | 11项，0待决，0未处理关键缺口 |
| Design Review | /plan-design-review | 七维度设计审查 | 1 | clean（Spec） | 6→8；后续D17桌面静态与其一致 |
| DX Review | 未调用 | 本轮未请求 | 0 | not_run | — |

OUTSIDE COVERAGE: 工程Claude Code completed，实际模型kimi-for-coding[1m]；设计Claude Code unavailable（旧完成标记失败），不混用覆盖。
CROSS-MODEL: 主审与工程独立复核均完成；3项补强既有验收，3项输入缺失误判均有具体证据；工具名不作为模型身份。
VERDICT: 方案审查完成，修复与验证工作已写入Spec。ENG NOT CLEARED：日志保留11项已映射工作，产品实施与19条实际验收尚未完成；不据此声称可发布。
NO UNRESOLVED DECISIONS
