# 全仓代码审查报告（Full Code Review）

- **审查基线**：`721a023dcf7f835b8279eae9d99ae09d9035dbe1`（main @ 2026-11-03，CI run 41586168061 = success）
- **审查分支**：`arena/918dcefa-braineno-github-io`（由 main 分出，工作树干净）
- **审查日期**：2026-11-03（UTC）
- **审查范围**：整个仓库（源码 / 脚本 / 内容契约 / CI / 全部开放 Issue / 本地构建产物）
- **特别关注**：后续 UI、动画交互设计改进
- **备注**：仓库中另有开放 PR #78（分支 `arena/2507118d-braineno-github-io`）也提交了一份审查报告 `docs/full-code-review.md`；本报告是本分支独立完成的一次审查，二者相互印证、不完全相同。

---

## 1. 项目概况

BrainEno 的个人主页 / 作品集：**纯静态导出的单页滚动叙事站**（Next.js 16 App Router + `output: "export"`），部署到 GitHub Pages 用户主页。没有服务器、没有 API 路由、没有数据库；内容是构建期读取的静态文件（`src/portfolio/content/defaults.ts`，可被 `published.json` 覆盖），部署即发布。

页面形态：首页四幕滚动叙事（旋转标题 hero → 肖像长卷 journey → 电视机作品索引 works → 白场转场 + 3D 电话亭 contact）+ 每个作品一个 `/works/<id>/` 详情页 + `/offline` PWA 兜底 + `robots/sitemap/manifest` 元数据路由。

技术栈：Next.js 16.2.6 · React 19.2.6 · TypeScript 5.9.3（strict）· GSAP 3.15（ScrollTrigger + ScrollSmoother）· three.js 0.181（懒加载 chunk）· Tailwind 4 仅挂了 postcss 插件但**没有任何 `@tailwind` 指令**（死依赖，见 #65）· 自托管字体（@fontsource）· sharp（构建期图片管线）。

## 2. 代码规模

| 类别 | 文件数 | 行数 | 说明 |
|---|---|---|---|
| 应用源码 `src/` | 27（24 TS/TSX + 3 CSS） | 3,407 行 TS/TSX + 2,141 行 CSS | 生产代码，无测试文件 |
| 构建/运维脚本 `scripts/` | 9（8 `.mjs` + 1 `.py`） | 1,207 行 | `build-static` / `build-images` / `smoke` / `preview` / `art` / `tv-glass` / `test-tv-assets` / `optimize-booth-model.py` |
| 文档 | 10 `.md`（含本报告前的 5 篇 docs + 根部 4 篇） | ~728 行（docs/ 之外另有 README/TERMS 等） | |
| 静态资产 `public/` | 61 webp + 10 jpg + 4 png + 1 glb + sw.js 等 | 9.4 MB | 含 61 个生成的响应式 WebP（`images/opt/`） |
| 模型源文件 `assets/models/telephone.gltf` | 1 | 38.6 MB | 不进导出目录；导出用的 `public/gltfs/telephone.glb` 为 2.2 MB |
| CI | `.github/workflows/static.yml` | 1 个 workflow，verify + build + deploy 三 job | |
| 构建产物 `out/`（本地实建） | — | 12 MB | 含 13 个页面 + 全部资产；混入 RSC `.txt` 载荷（#63） |

无测试代码目录；唯一的"测试"是 `scripts/test-tv-assets.mjs`（TV 透明洞几何校验）和 `scripts/smoke.mjs`（导出后逐页爬虫式校验，CI 也跑）。

## 3. 架构与数据流

```
构建期： content/defaults.ts ─┐
                             ├─> content/source.ts#getSiteContent() ─> normalizeContent() ─> 各页面 SSR 输出
      content/published.json ─┘        （整个站点唯一的内容入口，node:fs 读文件，无运行时覆盖）

页面路由（全部静态预渲染）：
  /                     src/app/page.tsx            → <Portfolio/>（client）+ JSON-LD
  /works/[id]/          src/app/works/[id]/page.tsx → 详情页 + BreadcrumbList（generateStaticParams 枚举全部作品）
  /offline/  /robots.txt  /sitemap.xml  /manifest.webmanifest  /icon.svg

客户端分层：
  ui/Portfolio.tsx（壳：语言、导航、preloader、自定义光标、两个大 effect）
    ├─ ui/sections.tsx（Hero / Journey / Works / Contact 四幕，纯渲染）
    ├─ ui/TvShowreel.tsx（电视换台状态机：idle / 首次开机 / 切台 三条 GSAP 时间线）
    ├─ ui/PhoneBoothModel.tsx → three/booth.ts（懒加载 WebGL 电话亭：自转/拖拽/取景/铭牌替换）
    ├─ scroll/choreography.ts（全部 ScrollTrigger/时间线：hero 视差、长卷 pin、电视 pin+推镜+白场、contact 跑马灯）
    └─ ui/Img.tsx + content/image-manifest.json（统一响应式 <img>，srcSet 由 scripts/build-images.mjs 生成）

SEO/部署约定：
  seo/asset.ts#asset() 统一给内容里的根绝对路径加 NEXT_PUBLIC_BASE_PATH 前缀（子路径部署的关键）
  seo/site.ts#siteUrl()/absoluteUrl() 构建期固化站点 URL（canonical / sitemap / robots / og:image / JSON-LD）
  public/sw.js 从 registration.scope 反推前缀，cache-first 静态资产 + network-first 导航 + /offline 兜底
```

**架构评价**：分层清晰、职责单一，"静态导出 + 构建期内容 + basePath 统一处理"是一套自洽且经过 CI 双形态（根路径 / 子路径）验证的设计。主要债务集中在：动画编排与 React 生命周期的耦合（#80）、reduced-motion 覆盖不全（#61）、无 JS 时的黑屏（#60），以及内容契约的文档与实现不一致（#51）。没有循环依赖；`three` 被动态 import 成独立 chunk；GSAP 插件只在 client effect 中注册。

**接口/契约清单**：

- 路由：如上 7 类。无 API。
- 内容契约：`content/types.ts` 的 `PortfolioContent`（version 2）——`identity / navigation / hero / intro / works(items+tv) / contact / theme`；`normalize.ts#normalizeContent` 是 published.json → 类型化内容的唯一 coercion 层（字符串截断 6000 字、列表上限 40、语言白名单、slug 去重）。
- 构建期环境变量契约：`NEXT_PUBLIC_SITE_URL`（站点 URL）、`NEXT_PUBLIC_BASE_PATH`（子路径前缀）；CI workflow 自动按仓库名是否为 `<owner>.github.io` 解析。
- 依赖：生产 7 个（next/react/react-dom/gsap/three/两个 fontsource），dev 9 个；`legacy-peer-deps=true` 写在 `.npmrc`。

## 4. 实际执行记录（均为本次审查真实执行）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm ci --no-audit --no-fund` | 0 | 安装成功（Node v22.22.3 / npm 10.9.8） |
| `npm run typecheck`（tsc --noEmit, strict） | 0 | 无错误 |
| `npm run lint`（eslint 9 flat config） | 0 | 0 error / 0 warning |
| `npm run test:tv-assets` | 0 | 19,465 个透明像素被 screen 矩形覆盖；洞口 (656,670)–(820,791) |
| `npm audit` | — | **1 critical（next 16.2.6 中间件绕过 + Server Actions DoS，可升级到 16.4.4）、2 high（postcss XSS/文件读取、sharp/libvips+libheif）、14 moderate（大多经 eslint/minimatch 链）、共 17** |
| `NEXT_PUBLIC_SITE_URL=https://BrainEno.github.io npm run build:static` | 0 | 13 个页面全部静态预渲染，`out/` 12 MB |
| `npm run smoke`（根路径形态） | 0 | 6 个 sitemap URL 全 200；`/admin/ /nope/ /works/not-a-project/` 全 404；89 个页面引用资产 URL 全部存在；6 个页面均有 og:image/twitter:image 且可解析；HTML 走 Brotli |
| `NEXT_PUBLIC_BASE_PATH=/subpath-check … build:static` + `smoke` | 0 / 0 | 子路径形态同样全绿（manifest start_url/scope、icons、og:image 均带前缀） |
| `npm run dev -- --port 3105` + curl | HTTP 200 | dev server（webpack）正常（与 CI 的 dev 探针一致） |
| CI（GitHub API） | — | main 最新 run 41586168061 @ 721a023 = success |
| 经验复现：`node --experimental-strip-types` 直接调用 `normalizeContent` | — | 包装格式 `{exportedAt, content:{…自定义…}}` → `identity.name` 仍为 `"BrainEno"`（内容被静默丢弃）；裸对象格式 → `"CUSTOM-NAME"` 生效。**实测确认 #51** |
| 静态产物核对 `out/index.html` | — | 含 SSR 输出的 `.preloader`（`preloader-count">000`）且无 `<noscript>`（确认 #60）；`href="/works/…"` 链接数 = **0**（确认 #3）；JSON-LD 中作品 URL 均带尾斜杠（**#71 已在基线修复**） |
| `grep -c will-change portfolio.css` | — | 22 处（确认 #66 的量级） |
| `ls public/images` vs `scripts/art/generate-art.mjs` | — | art 脚本会无条件覆盖 4 张现役作品图、并产出 `no-wave.jpg / figure.jpg / tree*.jpg / accent-*.jpg / phone-booth-cutout.png / tv-placeholder.webp` 等现行命名体系下不存在的文件（确认 #56） |
| `grep @tailwind/@import src/**/*.css` | — | 无任何命中 → Tailwind 为死依赖（确认 #65 的一部分） |

**未执行（环境限制）**：无浏览器自动化（沙箱无 Playwright），因此动画竞态/命中测试（#49、#53、#80 的视觉复现）只做到源码控制流确认；`gh` 集成在本沙箱只能创建 issue/PR 和 push，**不能 edit/close/comment**（403），所以本文只提出关闭建议，不擅自关闭。

## 5. 多维度评估

### 5.1 架构 [改进]
- 分层与依赖方向健康：`app/` 薄路由 → `portfolio/` 领域模块 → `content/` 唯一数据入口；无循环依赖。
- `asset()`/`absoluteUrl()` 统一处理子路径是整站最关键的约定之一，且被 smoke 双形态 CI 锁住。
- 债务：动画编排整体挂在一个随 `lang`/`layoutKey` 重建的 effect 上（新登记 **#80**）；内容 coercion 层静默丢弃/截断数据（#68、#51）。

### 5.2 健壮性 [BUG][风险]
- **[BUG 实测] #51**：文档化的 `published.json` 包装格式 `{exportedAt, content}` 被 `normalizeContent` 当作内容本身，自定义内容静默丢弃、回退默认模板，构建 exit 0 无任何警告。本次用 `normalizeContent` 直接实测复现。
- **[风险] #49**：CRT 快速往返切台——提前返回只比较已提交的 `shownRef`，进行中的时间线不会被取消，旧回调可能覆盖新目标（源码控制流确认，浏览器复现待验）。
- **[风险] #50**：电话亭异步加载与可见性/页面隐藏两个观察器竞争同一个 `paused` 标志，离屏时渲染循环可能持续运行。
- **[风险] #55**：sw.js 预缓存 `at("/offline")`（无尾斜杠），在 `trailingSlash: true` 下 GitHub Pages 返回 301，`cache.add` 对重定向响应会 reject（install 用了 allSettled 所以不炸，但离线页没被缓存，兜底失效）。
- 正例：preloader 有 3.2s 超时竞赛；`heroImage.decode()` 失败被 catch；booth 加载失败回退到抠图；`readPublishedSnapshot` 异常回退 defaults（但只打印 console.warn，见 #68）。

### 5.3 安全性 [改进]
- 无服务端、无认证、无用户输入面；唯一输入是仓库内的内容文件。JSON-LD 两处均做了 `<` → `\u003c` 转义（#14/#58 已修复，本次核对代码确认）。
- [改进] `work.url` 直接进 `<a href>`，未校验协议（`javascript:` 理论上可注入，但内容为作者自控，风险低）；`robots.txt` 的 `host:` 指令已废弃；构建期依赖 `npm audit` 无 CI 门禁且当前 1 critical/2 high（#65）。

### 5.4 UI/UX（重点关注域） [BUG][风险][改进]
- **[BUG] #60**：preloader 由 SSR 输出、只能被 JS 隐藏；JS 失败/无 JS 时整站停在黑屏 `000`（产物已实证，无 `<noscript>` 兜底）。
- **[BUG] #61**：`prefers-reduced-motion` 只覆盖首屏入场、电视换台、电话亭自转、contact 入场；作品区 pin+推镜（`.tv-box` scale 到 ~5.2）与肖像长卷 pin 横移在 reduce 下全量播放，`journeyMobile` 甚至没有 reduce 分支；电视视频 `<video>` 只有 onClick，无键盘操作（tabIndex/role/keydown）。CSS 侧的 reduce 块（portfolio.css:2052）只停了雪花/滚动条/浮动动画和一批 transition。
- **[BUG 新登记] #80**：切换语言或 resize 触发 `mm.revert()` 全量重建，已入场的 `gsap.from` reveal 会先 revert 成隐藏态再重播 → 内容闪烁。
- **[BUG] #53**：视频作品点击链路被 `.works-list` 层叠拦截 + 指针移向屏幕途中触发断电（源码 + CSS 证据见 issue）。
- **[BUG] #3**：首页作品行是 `li[tabIndex]` + onClick，没有 `<a>`、没有 role、Enter/Space 无响应；`out/index.html` 中 `href="/works/…"` 计数为 0 —— 详情页对爬虫只靠 sitemap、对用户完全不可达。
- **[风险] #54**：`/#works` 锚点跳转在 ScrollSmoother+pin 下失效；桌面端电话亭侵入顶栏；CSS 断点（767/1023px）与 GSAP 断点（768px）临界值需人工对齐。
- **[改进] #74**：详情页把封面图渲染两次（`[work.image, ...detailImages]` 未去重，5/5 作品全中）。
- **[改进] #75**：未知 URL 落到 Next 默认英文 404，无站内设计/返回入口/本地化；smoke 只校验状态码。
- **[改进] #66**：22 处常开 `will-change`、`.tv-box` 超视口合成层、电话亭 CSS 浮动动画在视口外也运行（只有 WebGL 循环被暂停）。
- **[改进] #76**：滚动热路径每帧同步布局读取（`onUpdate` → `syncPointer` → `document.elementFromPoint`），跑马灯 `onUpdate` 每帧新建 4 个 tween。
- **[改进] #17（部分缓解）**：断点现有 767px + 1023px + 若干 hover/aspect 媒体查询，但平板横屏、超宽屏仍无专门处理。
- 正例：自定义光标在粗指针设备隐藏（CSS + matchMedia 双保险）；语言切换用 `useSyncExternalStore` 避免 hydration 闪烁；焦点也能触发作品预览（`onFocus`）；`aria-pressed`/`aria-current` 齐备；装饰层普遍 `aria-hidden`。

### 5.5 性能 [风险][改进]
- 正例：全部图片走构建期 WebP 多档 srcSet + `sizes`，`src` 永远是真实文件（不会 404）；hero `fetchPriority=high`；booth GLB 压到 2.2 MB 且懒加载 + 离屏暂停；字体自托管；smoke 验证 Brotli。
- [风险] #63/#77：hero 源图 `headline.png` 1.93 MB 竖版 PNG 直接作为 `src` 兜底，og:image 也是它（分享抓取会下 1.93 MB）；`out/` 混入 6+ RSC `.txt` 载荷。
- [改进] #76（见上）；长列表 pin 段落的 `dwell()` 按文案长度计算滚动距离，是不错的设计。

### 5.6 测试 [缺口]
- 无单元测试框架；仅有 `test-tv-assets.mjs`（且只读 `defaults.ts`，用户换内容后校验恒绿——已关闭的 #67 其实质仍在，建议并入 #68）和 `smoke.mjs`（较强的导出后 e2e：页面/404/资产/og/JSON-LD/压缩）。CI 双形态（根路径+子路径）build+smoke 是质量门禁的亮点。
- 盲区：无任何组件/状态机测试（TV 换台、语言切换、booth 加载竞态均无覆盖）；smoke 不校验 404 页内容与本地化（#75）。

### 5.7 CI/CD [改进]
- `.github/workflows/static.yml`：PR/push 跑 verify（typecheck → lint → tv-assets → dev-server 200 探针 → 双形态 build+smoke），main push 再 build+deploy Pages（自动识别 user site 根路径 vs 项目子路径，`.nojekyll` 处理正确）。main 最新 run success。并发取消、最小权限都配置正确。
- [改进] 无 `npm audit` 门禁（#65）；`legacy-peer-deps=true` 掩盖依赖冲突（#65）。

## 6. 重点专项审查

### 6.1 内容管线端到端（UI → content → 构建 → 产物）

调用链：`defaults.ts`/`published.json` → `source.ts#getSiteContent()`（node:fs，构建期）→ `normalize.ts#normalizeContent`（coerce：模板驱动、字符串截断 6000、MAX_LIST=40、语言白名单、slug 去重、未知字段透传）→ 各页面 SSR → `out/`。

- **实测 Bug（#51）**：文档（README.md:55、QUICKSTART.md:40-44）教用户写 `{ "exportedAt": …, "content": { … } }`，但 `getSiteContent` 把整个包装对象传给 `normalizeContent`，coerce 按模板键匹配不到任何字段 → 全量回退默认值，且 `exportedAt`/`content` 作为"未知字段"被透传保存（所以 round-trip 不丢，更隐蔽）。本次用 strip-types 直接调用实测：包装格式下 `identity.name` 仍是 `BrainEno`。而 `getContentUpdatedAt` 又只认包装格式里的 `exportedAt` —— 两头都按包装格式写，内容却被丢弃。**P1**。
- [风险] #68：coerce 静默截断（6000 字/40 条）、无效 JSON 只 console.warn、缺图不校验（smoke 运行时才发现）。
- 正例：slug 去重保证 `generateStaticParams` 不会产出重复路由；`t()`/`pickText()` 的语言回退一致。

### 6.2 滚动编排 / 电视 / 电话亭状态机（含竞态与降级）

- 主 effect（`Portfolio.tsx`）依赖 `[lang, layoutKey]` → 任何一次语言切换/resize 都 `mm.revert()` + 重建全部 ScrollTrigger；`gsap.from` reveal 重播闪烁 → **新登记 #80**。
- TV 状态机（`TvShowreel.tsx`）：idle → 开机（雪花→锁定）→ 切台 三条时间线；提前返回只比对 `shownRef` 已提交值 → 快速往返竞态 **#49**；视频播放被层叠与 hover 状态机阻断 **#53**；reduce 下整段被跳过（好），但作品区/journey 的 pin+scrub 不受 reduce 约束 **#61**。
- 电话亭（`PhoneBoothModel.tsx` + `three/booth.ts`）：IntersectionObserver 预加载（150% rootMargin）+ 暂停（20%）两个观察器分管，但异步加载完成时的 `handle` 赋值与观察器回调竞争 `paused` → **#50**；取景用 13 步二分 × 7 角度的轮廓投影，适配任意画布比例，设计在线；dispose 链完整（geometry/material/environment/pmrem/renderer/canvas 全清理）。
- 降级路径：无 WebGL/加载失败 → 抠图兜底（`data-fallback`）；reduce → 停自转；页面隐藏 → 暂停渲染循环。三条降级都有，但 #50 指出的"加载完成后才同步可见性"的空窗仍在。

## 7. 问题索引

### 7.1 本次新登记

| Issue | 优先级 | 问题 | 证据 |
|---|---|---|---|
| [#80](https://github.com/BrainEno/BrainEno.github.io/issues/80) | P2 | 切换语言/resize 重建整套编排，已入场 reveal 重播闪烁 | `Portfolio.tsx:281-292` effect 依赖；`choreography.ts` teardown `mm.revert()` + reveal 定义。源码确认，浏览器复现待验 |

注：登记 #80 前曾因 shell 转义事故产生正文损坏的 **#79**（同一问题），`gh` 集成无法 edit/close，**建议人工关闭 #79 为 #80 的重复项**。

### 7.2 既有开放 Issue 核验结论（42 个开放 + 本次新增）

**建议关闭——已在基线 721a023 修复（有证据）**：
- **#71**（JSON-LD/Breadcrumb 尾斜杠）：实查 `out/index.html` 的 JSON-LD `url` 与详情页 breadcrumb `item` 均以 `/works/<id>/` 结尾 → 已修复，建议关闭。

**建议关闭——过时（旧"服务端+PostgreSQL+/admin"架构已在 PR #30/#73 删除，相关代码不存在）**：
- #4（文档声称的残留文件仓库里没有）、#5（`/api/media` SVG XSS，无 API 路由）、#6（pg TLS，pg 已不在依赖）、#8（Demo/Live 实时更新，无 admin）、#15（DB 回退/Pool/DDL，无数据库）、#20（认证/会话，无认证面）、#21（三份 DDL/wrangler/构建期 Google Fonts——字体已自托管）、#24（admin 编辑器体验，路由已删）。
- #9（依赖审计 1 critical/6 high）→ 与 **#65** 重复，#65 有最新实测数据（1 critical/2 high/14 moderate），建议关 #9。
- #10（无测试无 CI、eslint 6 error）→ CI 已存在且 main run success、lint 0 error；残余"无单元测试框架"建议并入 #68 的构建期校验主题。建议关闭。
- #13（图片零优化）→ 已有 build-images + srcSet + width/height + 画框裁切；残余（hero PNG 1.93 MB 兜底）已被 #63/#77 跟踪。建议关闭。
- #14（详情页 JSON-LD `</script>` 注入）→ 两页均已转义（代码核对），与已关闭的 #58 一致。建议关闭。
- #19（SW 立即接管/版本号）→ 现行 sw.js 有 VERSION + allSettled；残余离线兜底问题由 #55 跟踪。建议关闭为 #55 的重复。
- #23（effect 内同步 setState 反模式）→ 现行代码已用 `useSyncExternalStore` 正确读 localStorage；残余的 lang/layoutKey 重建问题已新登记为 #80。建议关闭。

**建议保留并重新定 scopes（部分解决或问题仍在）**：
- **#3**（P1，保留）：作品行不是链接、键盘不可达；本次实证 `out/index.html` 中 `href="/works/…"` = 0。
- **#51**（P1，保留，本次实测复现）：published.json 包装格式静默丢弃。
- **#60**（P1，保留，产物实证）、**#61**（P1，保留，代码核对 reduce 覆盖缺口 + 视频键盘不可操作）、**#53**（P1，保留）。
- #11（详情页与主站割裂——现为有意设计，但主题 accent 在 `work-detail.css:16,18` 与 `offline/page.tsx` 硬编码 `#e55139`，建议并入 #22 重新定范围）、#12（无 hreflang、SSR 只输出默认语言、客户端改写 `<html lang>`——仍成立）、#16（详情字段仍缺富文本/标签/排序/发布态）、#17（断点已增至 767/1023px 两档，建议重定范围为平板横屏/超宽屏）、#18（a11y 缺口，与 #61/#3 交叉，建议合并跟踪）、#22（设计令牌空心——仍成立，3 个 :root 令牌 + 硬编码 accent + 死依赖 Tailwind）、#25（可观测性，仅 console.warn，P3 保留）、#26（SEO 细节：lastmod 无 published.json 时仍等于构建时间、无 hreflang、keywords，"每次打库"已过时，建议重写后保留）。
- **#49、#50、#54、#55、#56、#62、#63、#64、#65、#66、#68、#74、#75、#76、#77**（均保留）：本次核对基线代码，问题描述与 721a023 仍一致（详见各 issue；其中 #56、#60、#63、#65、#66、#71、#74、#77 已在本次执行中拿到新的产物级证据，见 §4）。

**已关闭 Issue 核对**：#57/#58/#59/#52（published.json 包装、详情页 JSON-LD 转义、子路径 og 前缀×2）——#58/#59/#52 的修复已在代码中确认；但 **#57 关闭而 #51 仍开且本次实测仍复现**，属于同一根因的重复登记，建议保留 #51 为唯一跟踪项。#67（tv 校验只读 defaults.ts）已关闭，但实质仍在（`test-tv-assets.mjs` 只解析 `defaults.ts`），建议并入 #68。

## 8. 推荐开发顺序（含依赖）

1. **#51** 内容契约修复（unwrap `{content}` 或改文档二选一 + 构建期校验告警）—— 阻塞所有内容自定义，P1，无依赖。
2. **#60 + #61** 降级体验：preloader 加 `noscript`/CSS 兜底；reduce 贯穿 journey/television（把 reduce 传进 `television()`/`journeyMobile()`，跳过 pin 或改非 scrub）；视频加键盘操作。P1，与 #80 同属动画层，建议一起改。
3. **#3**（作品行改为真正的 `<Link>` + 键盘可激活，顺手修复 SEO 内链）— P1，独立。
4. **#80 + #49 + #53 + #50** 动画/交互竞态与状态机整治（choreography 重建策略、TV 时间线取消、点击命中、booth 暂停汇合）。P2，彼此相关，建议一轮做完。
5. **#76 + #66** 性能热路径（elementFromPoint 改缓存命中测试、跑马灯 tween 复用、will-change 按需化）。P2。
6. **#65 + #62** 依赖升级（next→16.4.4、postcss、sharp；去掉死 Tailwind 或真启用；CI 加 audit 门禁）+ preview.mjs 的 URIError。P2。
7. **#55 + #63 + #74 + #75 + #77** 产物与分享卫生。P2/P3。
8. **#68 + #56 + #64 + #26/#22/#25/#16/#17/#18/#11** 内容校验、脚本/文档对齐、小体验项。P3。
9. 最后清理过时 Issue（§7.2 建议关闭的 12 个），保持 issue 列表可信。

## 9. 审查边界与未验证项

- 无浏览器自动化：#49/#53/#80/#54 的"视觉复现"均为源码控制流层面的确认，未做像素级验证；建议在真实浏览器（含触屏设备）上按 issue 的复现步骤走一遍。
- `npm audit` 结果依赖 2026-11-03 当天的 advisory 库；next 的 critical 修复版本 16.4.4 为 audit 输出，未实装升级。
- sw.js 的 redirect 行为（#55）是在规范层面推断（`cache.add` 拒绝重定向响应），未在真实 GitHub Pages + 真机上验证。
- 本次未修改任何业务代码/配置/依赖，未合并 PR、未关闭 Issue；唯一的仓库改动是新增本报告。

## 10. 可审计的工作记录

- **工具与权限**：bash（读写文件系统、运行 npm/node/git）、`gh`（issue/pr/run 只读列表 + issue create 可用；issue edit/close/delete/comment 返回 403——因此 #79 正文损坏无法修复，只能新登记 #80 并建议人工关闭 #79）、web/GitHub API 只读查询。具备终端、文件系统与 GitHub 实际读写权限（创建 issue、读 PR/CI 成功）。
- **执行过的命令**：见 §4 表（`npm ci` / `typecheck` / `lint` / `test:tv-assets` / `npm audit` / 根路径与 `/subpath-check` 两次 `build:static` + `smoke` / dev server 200 探针 / `gh issue|pr|run list|view` / `git log|rev-parse` / 对 `out/` 产物的 grep 核对 / `node --experimental-strip-types` 复现 normalize 行为）。
- **阅读的核心文件**：`src/app/*` 全部路由文件、`src/portfolio/content/{types,defaults,source,normalize}.ts`、`seo/{site,asset}.ts`、`ui/{Portfolio,sections,TvShowreel,PhoneBoothModel,Img,PwaRegister,cx}.tsx`、`scroll/choreography.ts`、`three/booth.ts`、`styles/*.css`（关键段落）、`scripts/*.mjs|py`、`public/sw.js`、`.github/workflows/static.yml`、`docs/*.md`、`README.md`。
- **关键判断的验证方式**：① 构建/CI 质量——实际执行并全部通过（§4）；② #51 内容丢失——用 strip-types 直接调用 `normalizeContent` 实测复现；③ #60/#3/#71/#74/#66/#56/#65——在真实构建产物 `out/` 与源码中拿到证据；④ #49/#50/#53/#80——源码控制流确认，标注"浏览器复现待验证"。
- **限制与修正**：沙箱无浏览器，动画类问题无法做视觉验证（已如实标注）；`gh issue edit/close` 被 403 阻止，导致 #79 正文损坏且无法当场修复——已新登记干净版本 #80，并在本报告中建议关闭 #79；最初以为 JSON-LD 缺尾斜杠（#71）仍存在，查产物后发现已在 721a023 修复，已更正结论为"建议关闭"。
- **最重要的三个技术判断**：
  1. 该站作为纯静态导出工程是健康的：typecheck/lint/双形态 build+smoke/dev 探针在本基线全部真实通过，CI 最新 run success —— 证据见 §4。
  2. 内容管线存在一个"构建全绿、内容静默丢失"的 P1 契约 Bug（#51），已用最小 harness 实测复现 —— 证据：wrapper 格式下 `identity.name` 仍为默认值，README/QUICKSTART 与 `source.ts` 矛盾。
  3. 首页到作品详情页没有任何可点击/可爬取的链接（#3），详情页只靠 sitemap 可达 —— 证据：`out/index.html` 中 `href="/works/` 计数为 0，作品行为 `li[tabindex]` 纯 onClick。

## 11. 运行环境信息（可确认部分）

- Node.js v22.22.3，npm 10.9.8；OS 为 Linux 沙箱。
- Agent 框架：Arena.ai Agent Mode；模型提供商与具体模型 ID：环境未提供，**未知**；是否启用推理模式及推理配置：环境未提供，**未知**。
- 可用工具：终端（bash）、文件系统读写、`git`、`gh`（部分写操作受限 as above）、web 搜索/抓取；工具调用权限：读写仓库、创建 GitHub issue/PR、读取 CI/issue/PR。
- 外网限制：仅 github.com / codeload / api.github.com / registry.npmjs.org / pypi.org / files.pythonhosted.org（`npm ci` 与 `npm audit` 因此可用）。
