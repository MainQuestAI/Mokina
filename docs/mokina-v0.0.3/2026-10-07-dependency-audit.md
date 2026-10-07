# V0.0.3 依赖审计：单列问题，未关闭

日期：2026-10-07。产品源码 `0ed77171b07afcb4225252c4569ab4eb28196ceb`，base `93531732e2e01e6bfdf5153f3685af4bf132f850`。本轮只读核查，不自动升级、不执行利用测试、不改变安全设置。

## 实际结果

打包安装最初报告 6 项（5 moderate / 1 high），组装目录缺 lockfile，`npm audit --omit=dev --json` 返回 ENOLOCK，不能以此认定安全。工作区补查：

```sh
cd open-design
set -o pipefail
pnpm audit --prod --json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{let x=JSON.parse(s);console.log(JSON.stringify(x.metadata));for(let a of Object.values(x.advisories||{})){if(a.severity==="critical")console.log(JSON.stringify({module:a.module_name,title:a.title,url:a.url,vulnerable:a.vulnerable_versions,patched:a.patched_versions,findings:a.findings}));}})'
```

exit **1**；1055 production dependencies，info 0 / low 13 / moderate 57 / high 70 / critical 4。第一次汇总管道未启用 pipefail，最后 Node exit 0 不是审计通过；重跑保留原审计失败状态。此结果包含整个 workspace 的生产依赖树及工具包，不能直接等同于安装包全部可利用漏洞，也不能与组装目录的 6 项混用。

`git diff --name-only BASE HEAD -- '**/package.json' open-design/pnpm-lock.yaml` 为空，说明本轮没有改动依赖声明/锁文件；不代表基线风险已关闭。

## Critical 定位与边界

| 依赖 / 版本 / 路径 | 审计条目与修复版本 | 只读核查结果 |
|---|---|---|
| next 16.2.6，apps/web | [Windows-hosted RCE](https://github.com/advisories/GHSA-p293-qw3h-jr36)，>=16.3.3 | 本候选为 macOS arm64，未验证 Windows 部署；不能据此删除工作区告警 |
| next 16.2.6，apps/web | [AVIF image optimization RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4)，>=16.3.3 | 需独立核查图像优化端点与实际网络暴露；本轮未做可利用性测试 |
| next 16.2.6，apps/web | [next/og ImageResponse RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)，>=16.3.6 | 在 apps/web/src 搜索未见 next/og / ImageResponse 使用；这只是已查代码路径，不是所有生成资源或运行端点无风险证明 |
| proxy-addr 2.0.7，apps/daemon > express | [IPv4-mapped IPv6 trust subnet spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)，>=2.0.8 | daemon/src 未见设置 trust proxy；server.ts 的出现为注释。未核查所有外部代理/部署配置，不声称可利用或已豁免 |

核对官方维护者关联的 GitHub advisory 原文，未只凭标题判定攻击路径。AVIF 条目涉及图像优化；next/og 条目要求把攻击者控制的值传入 Node ImageResponse 的 SVG；proxy-addr 条目涉及特定信任子网配置。这里的适用性初筛不是安全签收。

local.5 安装目录 `Contents/Resources/open-design-web-standalone/apps/web/node_modules/next/package.json` 实际版本为 **16.2.6**。`apps/web/next.config.ts` 对静态 export 配置 `images.unoptimized`，而桌面候选使用 standalone 分支，不能用静态导出配置声称该候选关闭图像优化。

## 后续处理边界

这是本轮发现的既有依赖安全问题，单列于功能修复之外，状态为「未关闭」。发布前应另行进行依赖/暴露面核查：确认包内实际依赖与端点、评估升级及兼容性、运行 Web/daemon/原生候选回归、重建新候选并重新审计。Next.js 三条告警的修复范围上界至少为 16.3.6，不能只升级到 16.3.3 后宣称全部清除；这也不保证其余 high/moderate 条目消失。

本轮不执行 blanket dependency update 或 audit fix --force；未将本地功能回归通过描述成公开发布安全通过。原始 70 high 等其他条目仍待逐项分类，不因 critical 初筛而视为关闭。
