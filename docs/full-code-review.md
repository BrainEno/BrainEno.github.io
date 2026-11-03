# 全仓代码审查报告 · BrainEno.github.io

> **审查基线**：`721a023dcf7f835b8279eae9d99ae09d9035dbe1`（`main`，2026-11-03 05:49 UTC，`Merge pull request #73`）
> **审查分支**：`arena/2507118d-braineno-github-io`（自上述 commit 拉出，本次未改动任何业务代码）
> **审查日期**：2026-11-03（UTC）
> **审查范围**：整仓（源码 / 脚本 / 内容 / CI / 全部开放 Issue / 实际构建产物）
> **本次特别关注**：后续 UI、动画交互设计改进
> **状态同步（2026-11-03 07:10 UTC）**：仓库所有者已关闭 18 条 issue（§8.4 的 16 条确认项 + §8.3 的 #63 + 重复单 #79），并新登记 #80。本版据此更新 §5（新增 §5.7）、§8.1–§8.5、§9、§10.2、§11.5；关闭建议保留原样并追加「结果」列，便于对照。

本报告区分四类结论，不把优化建议包装成 Bug：

| 标记 | 含义 |
|---|---|
| **[BUG]** | 已在当前代码或构建产物中确认的行为错误 |
| **[风险]** | 当前不一定触发，但在已知条件下会出错（含未实测的性能/平台差异） |
| **[改进]** | 架构 / 可维护性 / 设计质量问题，不影响当前正确性 |
| **[缺口]** | 产品功能缺失，不是错误 |

---

## 1. 执行摘要

### 1.1 三个最重要的技术判断

**① 站点的内容管线是这个仓库唯一的「数据边界」，而它的入口同时缺少解包与校验——按官方文档配置内容会 100% 静默失效。**
`source.ts:37-40` 把整个 `published.json` 当成内容对象传给 `normalizeContent()`，但 README / QUICKSTART 要求写 `{ exportedAt, content }` 包装格式。我按文档生成了包装格式内容并构建：退出码 0、无任何 warning、`<title>` 仍是 `BrainEno`、`out/works/` 仍是模板的 5 个作品，而我写的 `WRAP TEST` 只出现在 `sitemap.xml` 的 `lastmod` 里（因为 `getContentUpdatedAt()` 只认包装格式的 `exportedAt`）。改成裸格式后同一份内容立刻生效。这是全仓最严重的问题，且已有 Issue #51 在跟踪（本次复现确认它仍然存在）。

**② 首页到作品详情页没有任何链接，作品详情页是孤岛；承载交互的作品行是 `<li tabindex="0" onclick>`，键盘与读屏用户无路可走。**
构建产物里 `out/index.html` 的 `href="/works/…"` 计数为 **0**；`out/works/*/index.html` 只有一条回首页的链接。也就是说 5 个精心写好的详情页（含 JSON-LD、OG、独立 canonical）只能通过 sitemap 或手输 URL 到达。作品行同时是「悬停预览电视」的触发器与「唯一可聚焦元素」，但 Enter/Space 不触发任何动作，也没有 `role`。这是产品闭环 + 可访问性 + 内链 SEO 的同一个断点（Issue #3，仍开放）。

**③ 动效层已经比文档记录的状态前进了一到两代，而可访问性与降级策略没有跟上。**
`prefers-reduced-motion` 只覆盖首屏入场、电视换台、电话亭自转与 Contact 入场；作品区 `pin` + 推镜（缩放到 4.56 倍）与肖像长卷（整屏横移、抛入）**完全不看这个媒体查询**。同时加载遮罩是 SSR 输出的 `position: fixed` 不透明黑层，只由客户端 JS 隐藏，没有 `noscript` 兜底——JS 失败即整站黑屏。两者都有明确代码与产物证据（Issue #60、#61）。对「以 GSAP 滚动叙事为核心卖点」的站点，这不是边缘项：它是同一套编排的另一半。

### 1.2 结论概览

| 维度 | 评级 | 一句话 |
|---|---|---|
| 架构 | 良好 | 路由薄、领域模块清、单一内容入口；但 `normalize.ts` 残留了已删除 CMS 的反射式复杂度 |
| 健壮性 | 中 | 构建期无校验、内容静默回退/截断；运行时降级路径只有一条（WebGL 兜底做得好） |
| 安全 | 可接受 | 无服务端、无认证、无输入；JSON-LD 已转义；风险集中在依赖链（1 critical / 2 high） |
| UI/UX | 中上 | 视觉完成度高；缺 404 页、详情页图片重复、详情页与首页两种语言/主题体验 |
| 可访问性 | 中下 | 焦点样式有；动效不可关、无 JS 黑屏、作品行不可键盘激活、视频不可键盘操作 |
| 性能 | 中上 | 首屏图片管线做得很好（480/800/1200 WebP + srcSet），three.js 延迟加载；但滚动热路径有每帧同步布局读取 |
| 测试 | 弱 | 无单元测试；smoke（304 行）+ tv-assets（36 行）是全部，且对内容管线零覆盖 |
| CI/CD | 良好 | 双路径（根 / 子路径）构建 + smoke + dev 探针，门禁设计明显高于同规模项目；缺依赖审计与性能断言 |

---

## 2. 项目规模

统计口径：`git ls-files`（共 135 个受版本控制的文件，47 MB，其中 37 MB 是建模源文件）。

### 2.1 代码行数

| 类别 | 文件 | 行数 | 说明 |
|---|---|---|---|
| 生产代码（TS/TSX） | 22 | **3,407** | `src/app`（路由层，319）+ `src/portfolio`（领域层，3,088） |
| 生产代码（CSS） | 3 | **2,141** | `portfolio.css` 2,079 · `work-detail.css` 29 · `globals.css` 33 |
| 工具脚本（Node/Python） | 8 | **1,207** | 构建、图片管线、预览、smoke、素材生成、模型优化 |
| 测试代码 | 2 | **340** | `scripts/smoke.mjs` 304 + `scripts/test-tv-assets.mjs` 36（**无测试框架、无单元测试**） |
| 文档（Markdown） | 10 | **1,241** | README、ARCHITECTURE、QUICKSTART、STATIC_EXPORT、ROADMAP、CONTRIBUTING、TERMS、Issue 模板 |
| 生成物（受控） | 2 | 197 + 55 文件 | `content/image-manifest.json`（17 源 → 55 个 WebP 变体）、`public/images/opt/` |
| 静态资源（受控） | 77 | 9.4 MB | 图片 7.2 MB（opt 3.1 MB / 55 文件）、`telephone.glb` 2.2 MB、图标 48 KB |

生成的导出产物 `out/` 实测 **12 MB**（文档多处写「≈6.2 MB」，已漂移，见 §6.1）：

```
out/images        7.2M  （60%，含未优化的 headline.png 1.9M）
out/gltfs         2.2M  （18%，telephone.glb）
out/_next/static  1.8M  （15%，最大单块 584 KB，含 three 相关代码）
out/**/*.txt      173K  （29 个 RSC 载荷，客户端路由必需）
```

### 2.2 技术栈与依赖

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 16.2.6（App Router，`output: "export"`） | 纯静态导出，无 server / API / DB |
| UI | React 19.2.6 | 全站只有 5 个客户端组件（`"use client"`） |
| 动效 | GSAP 3.15（ScrollTrigger + ScrollSmoother） | `choreography.ts` 587 行是全部时间线 |
| 3D | three 0.181 | 动态 `import()`，仅 Contact 前 1.5 屏加载 |
| 字体 | `@fontsource-variable/inter`、`@fontsource/inria-serif` | 自托管，构建不联网 |
| 构建脚本 | Node 22 + `sharp` 0.34 | 图片管线、GLB 优化（Python + ImageMagick） |
| 样式 | 手写 CSS（2,141 行） | `@tailwindcss/postcss` 已接但**全仓无 `@import "tailwindcss"` → 死依赖** |
| 质量 | TypeScript 5.9 strict、ESLint 9 + `next/core-web-vitals` | 均通过（见 §8） |

### 2.3 架构分层与数据流

```
构建期（Node，无运行时）
┌──────────────────────────────────────────────────────────────────────┐
│ scripts/build-static.mjs                                             │
│   ├─ scripts/build-images.mjs   public/images/** → opt/*.webp       │
│   │                             + src/portfolio/content/image-manifest.json
│   └─ next build            ┌──────────────────────────────────────┐  │
│                            │ content/source.ts#getSiteContent()   │  │
│                            │   published.json（若存在）──┐        │  │
│                            │   defaults.ts（否则）───────┴► normalize.ts
│                            └──────────────┬───────────────────────┘  │
│                                           ▼                          │
│      src/app/layout.tsx  ── metadata / JSON-LD / fonts / PwaRegister │
│      src/app/page.tsx    ── <Portfolio content> + jsonLd             │
│      src/app/works/[id]  ── 详情页（独立 canonical / OG / Breadcrumb）│
│      src/app/{sitemap,robots,manifest,icon}  ── 构建期生成的元数据路由 │
└──────────────────────────────────────────────────────────────────────┘
                              ▼  out/（纯文件）
浏览器
┌──────────────────────────────────────────────────────────────────────┐
│ Portfolio.tsx (client)                                               │
│   ├─ useSyncExternalStore → localStorage 语言（zh | en）              │
│   ├─ ScrollSmoother + setupChoreography()  ← scroll/choreography.ts  │
│   │     ├─ heroScroll      首屏 scrub                                │
│   │     ├─ journeyDesktop  肖像长卷：pin + 横移（move → push → coda） │
│   │     ├─ television      电视：pin + 换台 / 号码推镜 / 白场退场      │
│   │     └─ contact         跑马灯 + 电话亭入场                       │
│   ├─ sections.tsx  Hero / Journey / Works / Contact                  │
│   │     └─ TvShowreel.tsx   CRT 状态机（snow → commit → lock）       │
│   └─ PhoneBoothModel.tsx → three/booth.ts（IntersectionObserver 懒加载）│
│ PwaRegister.tsx → /sw.js（cache-first 静态资源 / network-first 导航）  │
└──────────────────────────────────────────────────────────────────────┘
```

**依赖方向是干净的**：`app/* → portfolio/{ui,content,seo,styles}`，`ui/* → {content,scroll,seo,three}`，`three/booth.ts` 不反向依赖 UI。逐文件核对 `import` 图未发现循环（`tsc` 只能证明类型可解析，不能证明无环，故此处为人工核对结论）。

### 2.4 路由 / 接口清单

站点**没有任何 API、没有数据库、没有认证**。全部可访问地址都是构建期生成的静态文件：

| 路径 | 类型 | 生成方式 | 备注 |
|---|---|---|---|
| `/` | 页面 | SSG | 四幕滚动叙事 + JSON-LD（WebSite/Person/CreativeWork） |
| `/works/<id>/` | 页面 ×5 | `generateStaticParams()` | 独立 canonical / OG / BreadcrumbList |
| `/offline/` | 页面 | SSG | PWA 离线兜底，`noindex` + robots Disallow |
| `/404.html` | 页面 | Next 内置 | **未定制**（Issue #75） |
| `/sitemap.xml` | 元数据路由 | `sitemap.tsx` | `lastmod` 取快照 `exportedAt`，否则构建时间 |
| `/robots.txt` | 元数据路由 | `robots.tsx` | 仅 `Disallow: <base>/offline` |
| `/manifest.webmanifest` | 元数据路由 | `manifest.tsx` | `id/start_url/scope/icons` 全部带 basePath |
| `/icon.svg` | 元数据路由 | `src/app/icon.svg` | — |
| `/sw.js` | 静态文件 | 手写 | `VERSION = v4`，手动升版 |

### 2.5 数据模型（`content/types.ts`，`version: 2`）

```
PortfolioContent
├─ identity   { name, siteName{L}, pageTitle{L}, description{L}, defaultLanguage: "zh"|"en" }
├─ navigation { intro|works|contact: {zh,en} }
├─ hero       { headlines[3]{L}, image{src, alt{L}} }
├─ intro      { heading{L}, portrait, portraitCredit{L}, primaryText{L},
│               gallery[], accentImages[2], secondaryText{L} }
├─ works      { heading{L}, period, tv{src, alphaSrc?, width, height, screen{top,left,width,height}},
│               items[]: Work }
│   └─ Work   { id, title{L}, year, credit{L}, image{src,alt{L}}, video?{src,poster?},
│               url, description{L}, detailImages[] }
├─ contact    { phone, email, headlines[3]{string}, marquee{L}, image, copyright,
│               credit{prefix{L}, name, url} }
└─ theme      { accent, stage }
```

持久化 = 仓库里的文件（`published.json` 或 `defaults.ts`）；构建期派生 = `image-manifest.json`。**没有数据库结构**。

---

## 3. 实际执行结果（可复现）

环境：`Node v22.22.3` · `npm 10.9.8` · Linux · 无可用浏览器（`chromium/chrome/firefox/playwright` 均不存在，无法做 Lighthouse / 真机 / 视觉回归）。

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `npm ci` | 0 | 380 包，`audit` 报 17 漏洞（1 critical / 2 high / 14 moderate） |
| 2 | `npm run typecheck` (`tsc --noEmit`) | 0 | 无输出 |
| 3 | `npm run lint` (`eslint .`) | 0 | **0 error / 0 warning** |
| 4 | `npm run test:tv-assets` | 0 | `19465 transparent pixels covered; opening: (656,670)–(820,791)` |
| 5 | `NEXT_PUBLIC_SITE_URL=… npm run build:static`（根路径） | 0 | 13 页，`out/` 12 MB |
| 6 | `npm run smoke`（根路径） | 0 | 全部通过：6 页 200、3 条 404、89 个资源 URL 全部存在、OG/JSON-LD 图片带前缀且可解析、Brotli 生效 |
| 7 | `NEXT_PUBLIC_BASE_PATH=/subpath-check npm run build:static` | 0 | 子路径产物；`manifest` / `canonical` / `og:image` / `icon` 均带 `/subpath-check` 前缀 |
| 8 | `npm run dev -- --port 3105` + `curl` | 200 | `next dev --webpack` 正常（`next.config.ts` 的 `pageExtensions` 守卫有效） |
| 9 | `npm audit --json` | 非零（有漏洞） | next **critical**（direct）、postcss **high**（direct）、sharp **high**（direct） |
| 10 | 实测：`published.json` 包装格式构建 | 0 | **内容被静默丢弃**（§4.1，Issue #51） |
| 11 | 实测：`published.json` 裸格式构建 | 0 | 内容生效（`<title>WRAP TEST — BrainEno</title>`，`out/works/` 只剩 1 个） |
| 12 | 实测：`preview.mjs` 收到 `/%zz` | — | **进程因未捕获 `URIError` 退出**（`preview.mjs:74`，Issue #62） |
| 13 | 实测：`grep -c 'href="/works/' out/index.html` | — | **0**（Issue #3） |
| 14 | 实测：每个详情页 `<img src>` 去重统计 | — | 5/5 页面同一张图出现 **2 次**（Issue #74） |

CI 现状（GitHub Actions `Static site → GitHub Pages`）：`main` 最近 12 次运行 11 绿 1 红（2026-11-01 的失败在下一轮合并后恢复）。门禁包含：类型检查 → lint → 电视素材几何断言 → **dev server 探针** → 根路径构建 + smoke → 子路径构建 + smoke → 发布。

---

## 4. 重点专项一：内容管线端到端（UI → 内容 → 构建 → 产物）

这是本站唯一的业务链路（没有登录、没有会话、没有写操作），因此它也是唯一可能「静默上线错误」的地方。

### 4.1 [BUG] 文档格式与读取实现不一致，内容被静默丢弃（P1 · Issue #51）

调用链逐层核对：

| 层 | 位置 | 行为 |
|---|---|---|
| 文档 | `README.md:64`、`QUICKSTART.md:34-38` | 要求 `{ "exportedAt": …, "content": { … } }` |
| 读取 | `source.ts:21-40` | `JSON.parse` → `normalizeContent(published)`，**没有解包 `content`** |
| 归一化 | `normalize.ts:18-61` `coerce()` | 只遍历**模板的键**；模板没有 `content` 键 → 每个字段回落到模板值 |
| 向前兼容 | `normalize.ts:43-45` | 把未消费的 `content` / `exportedAt` 原样搬进结果，此后无人读取 |
| lastmod | `source.ts:43-50` | 正则只匹配**顶层** `exportedAt` → 依赖包装格式 |
| 产物 | `out/index.html`、`out/works/` | 仍是模板内容，**退出码 0、无 warning** |

实测对照（同一份自定义内容，只改外层形状）：

```
包装格式 { exportedAt, content }  → <title>BrainEno</title>            works=5   exit 0
裸格式   { version, identity, … } → <title>WRAP TEST — BrainEno</title> works=1   exit 0
包装格式的 sitemap                → <lastmod>2026-01-01T00:00:00.000Z</lastmod>  ← 只读到了 exportedAt
裸格式的 sitemap                  → <lastmod>2026-11-03T06:02:47.315Z</lastmod>  ← 回落构建时间
```

**根因（已证实）**：`getSiteContent()` 少一层解包；同一文件的 `getContentUpdatedAt()` 证明包装格式才是设计意图。**后果**：所有照文档建站的人第一步就踩空，且因为无日志，只能在「上线后发现站点还是别人的」时才察觉。

### 4.2 [BUG] 无法表达「空列表」与「删除字段」（P2 · Issue #68）

`normalize.ts:21-29`：

```ts
const list = (source.length ? source : template).slice(0, MAX_LIST);
```

- `gallery: []` → 回落到模板的 5 张图（无法清空画廊）；
- `works.items: []` → 回落到模板的 5 个作品；
- 超过 40 项 → 静默截断（`MAX_LIST = 40`）；
- 字符串 > 6000 字符 → 静默 `slice`；
- 删掉 `works.tv` → 模板的 `/images/tv2.webp` 无声填回（此时电视矩形与实际照片不匹配，画面会歪）。

五种情况全部「成功构建 + 无提示」，与 §4.1 是同一类根因：**normalize 的契约是「缺什么补什么」，而使用者需要的是「我写了什么就是什么，错了告诉我」**。

### 4.3 [改进] `normalize.ts` 是已删除 CMS 的遗留复杂度

`coerce()` 用模板反射 + 字符串路径（`"works.items[].detailImages"`）+ 白名单（`VARIABLE_LISTS`）+ 模板表（`LIST_TEMPLATES`）来实现「任意 JSON 安全落库」。这套设计的原始用途是浏览器内编辑器（第七轮已删除，见 `docs/ARCHITECTURE.md:1-30`）。现在它只服务一个**作者自己写的、受 TypeScript 约束的**文件，却引入了：

- 近 70 行的通用反射 + 归一化逻辑（`normalize.ts` 全文件 96 行），行为只能靠读代码推断（`source.length ? source : template` 这类隐式规则）；
- 三处与类型系统重复的约束（6000 字符、40 项、语言白名单）；
- 「向前兼容保留未知键」的循环——在静态站里没有任何消费者，却让**拼错的字段名**（如 `work.detailImage`）悄然进入数据对象。

**建议**：`published.json` 只需 `JSON.parse` + 一个显式校验器（zod 风格的 20 行手写 schema 即可），失败时打印「第 N 个作品的 detailImages[0].src 缺失」并 `process.exit(1)`；`NEXT_STRICT_CONTENT=1` 控制是否阻断。这一处同时解决 #68，并把 `types.ts` 从「只有 TS 作者能看到的约束」升级为「构建期可执行的约束」。

### 4.4 [改进] 内容契约在 JSX 里被绕过

`contact` 区块有三段本应属于内容的文案被硬编码在组件中（`sections.tsx:326-330`、`370`）：

```tsx
<span className={cx(zh && "is-zh")}>{zh ? "联系" : "Contact"}</span>          // 序号 03 也是硬编码
{zh ? "独立设计与工程合作" : "Design & Engineering Inquiries"}
{dialable ? (zh ? "电话" : "Phone") : "GitHub"}
```

模板使用者要改这三句必须改 TSX。同类问题：`manifest.tsx:30` 的 `theme_color: "#000000"` 与 `background_color: content.theme.stage` 不一致；`work-detail.css:20` 与 `offline/page.tsx:27` 把强调色硬编码为 `#e55139`，所以改 `theme.accent` 只会影响首页（Issue #22 的有效部分）。

### 4.5 图片管线：这个子系统做得对

`build-images.mjs` → `image-manifest.json` → `Img.tsx` 的链路有三条被文档明确写下的不变量，我逐条核对均成立：

1. **`src` 永远是真实文件**（`Img.tsx:88`）——清单没跟上、浏览器不支持 `srcSet` 都不会 404；
2. **不套 `<picture>`**——`<img>` 自己就是那个盒子，`.story-photo-mask img`、`.tv-frame` 这类选择器与 flex 几何不被破坏；
3. **文件名带源图哈希**——避免 `/images/*` 长期缓存导致的「回访用户看旧照片」。

尺寸阶梯（480/800/1200，`MIN_STEP 1.15` 去重）与 `OVERRIDES`（电视图 1280/1536 @84、alpha 100）也合理。唯一的浪费是**原图仍以 `src` 形式随产物发布**（`headline.png` 1.93 MB），见 §6.5 与 Issue #77。

---

## 5. 重点专项二：滚动编排与电视 / 电话亭状态机

这是全站最复杂的部分（`choreography.ts` 587 行 + `TvShowreel.tsx` 345 行 + `booth.ts` 518 行），也是「后续动画交互改进」的主战场。逐层追踪 UI 事件 → React 状态 → GSAP 时间线 → CSS 层 → WebGL。

### 5.1 状态机总览

```
指针 / 滚动 / 焦点
      │
      ├─ sections.tsx#Works  onMouseEnter / onFocus / onClick ──► preview(index)
      │                                               └─► activeWork: -1 | 0..n-1
      ├─ choreography.ts  ScrollTrigger(onUpdate) ──► syncPointer()
      │        └─ document.elementFromPoint → evaluateTarget → preview(index)   ← §7 性能
      └─ 触屏：ScrollTrigger.onToggle(index) ──► preview(index)
                              │
                              ▼
            TvShowreel(active)  ──[useEffect, 依赖 active 对象身份]──►
              ├─ 早退：nextId === shownRef.id && active === rigActiveRef  ← #49 竞态
              ├─ kill 旧 timeline（在早退之后）
              ├─ reduce / 缺 ref → 直接切换
              ├─ active == null → 断电（snow → commit(null)）
              ├─ 首次激活     → 雪花 → commit(active) @0.09 → 锁定 @0.26
              └─ 切换作品     → 塌陷 0.11 → 雪花 → commit(active) @0.20 → 锁定 @0.26

            PhoneBoothModel  ──IntersectionObserver(150%)──► import('three') → mountBooth
                              └──IntersectionObserver(20%) ──► handle?.setPaused(!visible) ← #50 竞态
```

### 5.2 [BUG] CRT 快速往返切台会被旧回调覆盖（P2 · Issue #49，本次确认成立）

`TvShowreel.tsx:92-95` 的早退发生在 `timeline.current?.kill()`（第 117 行）**之前**：

```ts
const nextId = active?.id ?? null;
const currentId = shownRef.current?.id ?? null;
if (nextId === currentId && Boolean(active) === rigActiveRef.current) return;   // ← 早退
…
timeline.current?.kill();                                                       // ← 永远不会执行
```

复现序列（纯控制流推导，无需动画精度）：显示 A → 悬停 B（时间线启动，`commit(B)` 排在 0.20s）→ 在 0.20s 前回到 A。第三次 effect 时 `shownRef` 仍是 A、`rigActiveRef` 仍是 true，于是**直接 return**；B 的时间线继续运行，0.20s 后把画面切成 B，而选中的行是 A，且不会再有 effect 来纠正。键盘 `Tab` 快速划过列表同样触发。

**建议**：把 `kill()` 提到早退之前，或把早退条件改成「目标与**计划中的**目标一致」（用 `requestedRef` 记录，而不是 `shownRef`）。

### 5.3 [BUG] 电话亭加载完成前滚离视口 → 离屏渲染循环（P2 · Issue #50，本次确认成立）

`PhoneBoothModel.tsx:94-101` 的回调只调用 `handle?.setPaused(!visible)`，**不记录最新可见状态**；`booth.ts:487-488` 在模型就绪后无条件 `renderer.render()` + `start()`。若在 2 MB 模型载入期间滚离 Contact（`rootMargin: 150%` 保证会被预加载），暂停回调早已用 `null` handle 执行过一次，之后没有新的交叉事件 → WebGL 以 60 fps 在视口外渲染，直到再次进出视口或切标签页。`booth.ts:490` 的 `visibilitychange` 又用 `document.hidden` 单变量覆盖同一个 `paused`，两个来源互相踩。

**建议**：`const state = { viewport: true, document: true }`，`setPaused(!(state.viewport && state.document))`，并在 `mount()` 完成后立即用当前状态同步一次。

### 5.4 [BUG] 视频作品在当前交互下不可播放（P1 · Issue #53，本次确认「可达性」问题成立，但功能未被内容启用）

三处叠加：

1. **层叠**：`.tv-stage` 被 pin 后成为覆盖视口的固定层（`z-index` 未显式提升），而 `.works-list`（`z-index: 4`、`min-height: 90vh`、在文档流中从下方滚过）只在 `phone`/`exit` 阶段才 `pointer-events: none`（`portfolio.css:1164-1174`）。`rows` 阶段它会盖住电视屏幕区域。
2. **断电竞态**：从作品行移向电视必然离开 `<ol>`（`sections.tsx:229-233` 的 `onMouseLeave`）→ `onPreview(-1)` → 电视断电、`shown` 被置空，视频组件在指针到达之前就已卸载。
3. **键盘**：`<video>` 没有 `tabIndex`，`.tv-play-btn` 是 `aria-hidden` 装饰层，`onClick` 只挂在 `<video>` 上 → 键盘与读屏都无法播放。

**重要限定**：`defaults.ts` 里 5 个作品的 `video` 全部被注释掉（`defaults.ts:103-108`），所以**线上当前不会**出现这个问题；它是「按文档启用视频功能后必然踩到」的缺陷。修复时建议把「进入电视区域的路径」改为电视自己的点击/聚焦区，而不是依赖行悬停的副作用。

### 5.5 [BUG] `/#works` 锚点与 CSS/GSAP 断点失步（P2 · Issue #54，部分确认）

- 详情页返回链接 `works/[id]/page.tsx:80` 是 `<Link href="/#works">`，manifest 快捷方式也是 `/#works`；但 `Portfolio.tsx` 从不读取 `location.hash`，`createSmoother({ effects: true })` 也不处理锚点。内容被 ScrollSmoother 以 `transform` 平移、且上方有 pin 段落，原生 hash 滚动必然落到错误位置（静态推断；本环境无浏览器，需实测确认落点偏移量）。
- **断点失步（已证实）**：GSAP 用 `DESKTOP_QUERY = "(min-width: 768px)"` 决定 `desktop` 分支，而 Contact 的版面在 `@media (max-width: 1023px), (max-aspect-ratio: 11/10)` 切换（`portfolio.css:1748`）。768–1023 px 区间内，编排按桌面计算位移，版式却按平板堆叠。
- 该 Issue 中「桌面端电话亭侵入顶栏」「`sections.tsx` 用 Range 量字宽写 `--contact-fs`」两处描述**已与代码不符**：Contact 现为「居中电话亭 + 两条反向跑马灯」，`--contact-fs` 在仓库中搜索不到（`grep -rc` 于 CSS 与 `sections.tsx` 均为 0）。

### 5.6 [BUG] `prefers-reduced-motion` 没有覆盖滚动编排的主体（P1 · Issue #61，本次确认成立）

`setupChoreography()` 建立了 `reduce` 条件，但只有 `contact()` 使用它（`choreography.ts:560-567`）：

```ts
heroScroll(desktop);                 // 不看 reduce：scrub 位移/缩放照跑
if (desktop) journeyDesktop(scope);  // 不看 reduce：pin + 整屏横移 + 图片抛入
else journeyMobile(scope);           // 不看 reduce：pin: true 的横向长卷
television(scope, opts, desktop);    // 不看 reduce：pin + 推镜到 4.56×
contact(scope, desktop, reduce);     // 唯一处理 reduce 的
```

用户明确要求「减少动态效果」后仍会看到：pin 住整屏并横向平移的肖像长卷、缩放到 4.56 倍的电视推镜、从视口下方抛入的图片。WCAG 2.3.3（Animation from Interactions）在这类大幅位移上是有明确期望的。CSS 侧也只在 `@media (prefers-reduced-motion: reduce)` 里关掉了雪花与电话亭浮动（`portfolio.css:2052-2080`），滚动编排的位移不受影响。

### 5.7 [BUG] 语言切换 / 窗口尺寸变化会重建整套编排，已入场的 reveal 重播（P2 · Issue #80）

> 本条由仓库所有者在审查结束后登记（#79 为同题的残缺重复单，已关闭）。本版在 HEAD 上按源码复核了控制流；**视觉重播仍需浏览器实测**，行号已按 HEAD 更正（issue 原文的行号略有偏移）。

`setupChoreography()` 的调用是一个以 `[lang, layoutKey, preview]` 为依赖的 effect：

```ts
// Portfolio.tsx:307-317
const teardown = setupChoreography({ scope, onSection: setSection, onWork: preview, ... });
return teardown;
// `layoutKey` bumps on a viewport-size change: the choreography measures the
// DOM, so it has to be rebuilt against the new geometry.
}, [lang, layoutKey, preview]);
```

两条触发路径都来自上面这个依赖数组：

- **语言切换** → `lang` 变 → effect 重跑；
- **窗口宽度变化** → `layoutKey` 自增（`Portfolio.tsx:210-226`，250 ms 防抖、宽度差 < 2 px 时忽略）→ effect 重跑。

teardown 走 `mm.revert()`（`choreography.ts:581-586`），它会 kill 并 **revert** 该 `gsap.matchMedia` 上下文里的全部动画与 ScrollTrigger。重建后，`from` 类 reveal 全部从「隐藏」重新开始，而 `ScrollTrigger.refresh()`（`choreography.ts:572-574`）时若 trigger 已在视口内或已被滚过，就会按 `toggleActions` 重新 play：

| 位置 | 动画 | 初始隐藏态 |
|---|---|---|
| `choreography.ts:255-274` | 长卷：`.story-photo-mask`（`clipPath`）、`.story-title-text`、`.story-copy p / .coda-text` | `inset(100% …)` / `yPercent:110` / `y:40 + autoAlpha:0` |
| `choreography.ts:343-367` | 作品区：`.works-heading-text`、`.work-row-line`、`.work-row-title` 等（`toggleActions: "play none none reverse"`） | `yPercent:110` / `scaleX:0` |
| `choreography.ts:497-515` | Contact：`.contact-topbar > *`、`.contact-cta-*`、`.contact-footer > *`（同为 `play none none reverse`） | `autoAlpha:0` + 位移 |

用户可见结果：已经读完的作品行、标题与联系区块，在点一次「中文 / English」或拖动一下窗口后**先闪回隐藏态、再重播一遍入场动画**。

- **不受影响**：scrub 类动画（hero 视差、电视推镜），因为 refresh 时会立即按当前滚动位置重算。
- **未验证**：`.tv-stage` / `.journey` 的 pin 在 `revert()` → 重建的瞬间是否有一帧错位；帧率代价未知。
- **修复方向**（按成本排序）：重建前对已完成的 reveal `progress(1)`；或将 reveal 从 `choreography` 拆成独立 effect，不随 `lang` / `layoutKey` 重建；若重建只是为了让 `dwell()` 按新语言文案长度重算滚动距离，用定向的 `ScrollTrigger.refresh()` 替代 `mm.revert()` 全量重建更轻。

### 5.8 动画设计改进的具体建议（针对「后续 UI / 动画交互」关注点）

1. **先立降级契约，再加新动效**：把「reduce 下每个段落只保留 ≤ 0.3 s 的透明度变化、不 pin、不位移超过 8 vh」写成 `choreography.ts` 顶部的一段注释 + 一个 `reduced(scope)` 分支，新增时间线必须显式声明 `reduce` 行为（否则 lint 层面无法发现，但代码评审有据可依）。
2. **把状态机与动画解耦**：`TvShowreel` 现在用「effect 早退 + 延迟 `commit`」表达状态，竞态正来自这里。建议引入一个显式的 `requested / committed` 两态 reducer（`useReducer`），动画只读 `committed` 并在 `onComplete` 里 dispatch —— 早退条件只比较 `requested`，`#49` 这类问题在结构上消失。
3. **`will-change` 的声明式管理**：全仓 22 处常驻 `will-change`（`.hero-word`、`.rail`、`.coda-pic`、`.contact-reel-track`、`.contact-booth*` 等长期存在的大元素）。GSAP 会在 tween 期间自动处理，常驻声明通常只换来内存与层预算。建议只保留 `.contact-booth` 这类「确实长期 transform」的少数几个，其余交给 `onStart/onComplete` 或 `gsap.set(el, {willChange:"transform"})` 临时开启（Issue #66 的核心主张成立，但其选择器清单已过期——`.tv-box` 在 HEAD 中已经**没有** `will-change`）。
4. **Contact 跑马灯改用常驻 tween + 变量驱动**（详见 §7.1），避免每帧新建 tween 导致的 `timeScale` 抖动。
5. **给每个段落一个「静止帧」**：目前四幕都是「滚动即变化」，没有可停留的构图。若后续要做视觉打磨，优先给第二幕（长卷）和第三幕（电视）各一个 0.6 屏的 `hold`，让用户看清作品，而不是一直被推着走。
6. **电视玻璃的分层策略值得保留并复用**：`tv-screen`（z1）→ `tv-alpha`（z2，真 alpha 遮罩）→ `tv-ambient`（z3，`mix-blend-mode: screen`）这套「用真实 alpha 而不是猜圆角」的思路，是本站动画最干净的部分，`scripts/test-tv-assets.mjs` 还把它变成了可执行断言。后续换素材时应继续遵守这个契约（换 `tv2-alpha.webp` 必须同步 `works.tv.screen`）。

---

## 6. 多维度评估

### 6.1 架构

| 结论 | 证据 |
|---|---|
| **[改进]** 分层与依赖方向良好 | `src/app` 只做路由与元数据（319 行），领域逻辑在 `src/portfolio`；`three/` 不被 UI 反向依赖；无循环依赖 |
| **[改进]** 单一内容入口是对的 | `source.ts` 是唯一读文件的地方，组件只消费 `PortfolioContent`；换内容不动组件 |
| **[改进]** `normalize.ts` 过度设计 | 见 §4.3（反射 + 字符串路径 + 与前端的 round-trip 语义，源自已删除的 CMS） |
| **[改进]** 文档与代码的代差是主要技术债 | `ARCHITECTURE.md` 描述的 Contact 版式（`--contact-fs`、`top:0/bottom:22.4svh`、`-56vh` 叠压）、兜底图（`phone-booth-cutout.png`）、`tv.webp` 文件名、`OVERRIDES 1280/1920/2560`、`sizes: max(160vw,230vh)` 均与 HEAD 不符（Issue #64，实际比其列出的更多）；ROADMAP/QUICKSTART 的 `out/` 体积仍写 6.2 MB / ≈6 MB，实测 12 MB |
| **[改进]** 单文件巨型时间线 | `choreography.ts` 587 行含 5 条时间线 + 3 个 ScrollTrigger 工厂，随段落增多会继续膨胀；建议按幕拆分（`hero.ts / journey.ts / tv.ts / contact.ts`）并共享 `scrollToSection` 等工具 |

### 6.2 健壮性

| 结论 | 证据 |
|---|---|
| **[BUG]** 内容静默降级 | §4.1 / §4.2（Issue #51 / #68） |
| **[BUG]** 无 JS / JS 失败 → 永久黑屏 | `Portfolio.tsx:95-105` 无条件 SSR 出 `.preloader`；CSS `position: fixed; inset: 0; z-index: 2000; background: var(--stage)`（`portfolio.css:123-133`）；全仓无 `noscript`；`grep -i noscript src public` = 0 结果。首页全部文案其实已在 HTML 里（对爬虫友好），但人类用户看不到（Issue #60） |
| **[改进]** 每一处外部依赖都有兜底，这是本站的强项 | 模型失败 → 抠图（`PhoneBoothModel.tsx:74-78`）；无 WebGL → 同上；字体缺失 → Inter；构建断网 → 自托管字体；图片清单过期 → 原图 |
| **[风险]** 构建产物依赖 `new Date()` | 裸格式快照下 `sitemap` 的 `lastmod` 回落到构建时间（实测），同一 commit 两次构建产物不同，也会让「每次部署都像全站更新」重演 |
| **[风险]** 重复内容没有防线 | 详情页重复图片（Issue #74）说明「内容层写错、渲染层无感」这一类问题目前只能靠肉眼 |

### 6.3 安全性

| 结论 | 证据 |
|---|---|
| **[改进]** 攻击面极小 | 无服务端、无 API、无认证、无表单、无 cookie；唯一的动态输入是 `localStorage` 的 `pf-lang`，只用于在两个枚举值间取一个（`Portfolio.tsx:186-188`） |
| **[改进]** JSON-LD 注入已封堵 | 首页 `page.tsx:14` 与详情页 `page.tsx:78` 均 `.replace(/</g, "\\u003c")`；`#58` 的修复有效 |
| **[风险]** 依赖链是唯一实质风险 | `next` critical、`postcss` high、`sharp` high（均为 direct）。注意**实际暴露面**：`next` 的 CVE 绝大多数是 Server Actions / Image Optimization / middleware / RSC 服务器路径，本站 `output: "export"` 不运行服务器；`sharp`/`postcss` 只在构建期使用。因此「1 critical」不等于线上可被利用，但 CI 与开发机是真实暴露面（Issue #65 已按此说清，保持） |
| **[改进]** 外链处理正确 | 所有 `target="_blank"` 都带 `rel="noreferrer"`（含 `noopener` 语义） |
| **[缺口]** 无 CSP | GitHub Pages 不能设响应头；若在意，可用 `<meta http-equiv="Content-Security-Policy">`，但对纯静态首方资源收益有限，列为可选 |

### 6.4 UI / UX

| 结论 | 证据 |
|---|---|
| **[BUG]** 详情页图片重复 | Issue #74 |
| **[BUG]** 404 是 Next 默认页 | Issue #75 |
| **[缺口]** 首页无任何入口到详情页 | `out/index.html` 中 `href="/works/` 计数 = 0；作品行只 `onPreview` |
| **[缺口]** 两种体验的语言不一致 | 首页语言存 localStorage 并即时切换；`/works/<id>/` 是 Server Component，永远只用 `defaultLanguage`（`works/[id]/page.tsx:31,62`），且没有语言切换控件 → 英文用户从首页进入详情页会被切回中文（`/offline/` 则是写死的中英双语）。Issue #11 / #12 |
| **[改进]** 焦点可见性已修好 | `.pf :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px }`（`portfolio.css:100-103`），`#18` 中「焦点缺失」部分已不成立 |
| **[缺口]** 作品行不是可激活元素 | `<li tabindex="0" onClick>`（`sections.tsx:243-252`），无 `role`、无 Enter/Space 处理、无链接 → 键盘用户只能「预览」，不能进入 |
| **[风险]** 自定义光标对精确操作的影响 | `.cursor` 为 `mix-blend-mode: difference` 的 10 px 圆点，只在 `(hover:hover) and (pointer:fine)` 下启用，未替换系统光标（`cursor` 仍显示）——相比常见实现算克制，保留 |

### 6.5 性能

| 结论 | 证据 |
|---|---|
| **[改进]** 首屏图片策略优于同规模项目 | 单个 preload（`imageSrcSet` 480/800/1086 WebP）、装饰条改 `lazy`、`fetchPriority=high` 只给 hero、`width/height` 来自清单避免 CLS |
| **[改进]** three.js 分块延迟加载 | 最大 chunk 584 KB（含 three），只在 Contact 前 1.5 屏 `import()`；`booth.ts` 在离屏与标签页隐藏时停 RAF（除 §5.3 的竞态） |
| **[风险]** 滚动热路径每帧同步布局读取 | §7.1（Issue #76，静态推断，未 trace） |
| **[风险]** 22 处常驻 `will-change` | §5.8-3（Issue #66 核心成立、清单过期） |
| **[改进]** 产物体积 | `out/` 12 MB，其中 60% 是图片、18% 是 GLB；`headline.png` 1.93 MB 只作为 `src` 兜底却仍随产物发布（带 `srcSet` 的浏览器不会请求它，但仓库与部署体积照算） |

### 6.6 测试

| 结论 | 证据 |
|---|---|
| **[缺口]** 无单元测试、无测试框架 | 全部断言在 `smoke.mjs`（HTTP 层）与 `test-tv-assets.mjs`（像素几何）里 |
| **[改进]** 这两个测试挑得准 | smoke 断言「sitemap 里的每一页 + 每一页引用的每一个资源 + 子路径前缀 + 404 + Brotli」，正是静态托管最容易裂的地方；tv-assets 把「玻璃矩形必须盖住 alpha 开口」变成可执行断言 |
| **[缺口]** 内容管线零覆盖 | §4.1 的 P1 Bug 能长期存在，正是因为没有任何测试喂过 `published.json`；`test-tv-assets.mjs` 用正则读 `defaults.ts`（`test-tv-assets.mjs:8`），用户换成 `published.json` 后这条断言恒绿（#67 已按重复关闭，但该盲区仍在） |
| **[缺口]** 无链接爬取 | smoke 按 sitemap 取页，从不断言「站内链接是否互通」→ §6.4 的孤岛问题不可能被发现；建议加一条「从 `/` 出发 BFS，所有站内 `href` 必须 200」 |
| **[缺口]** 无 a11y / 性能断言 | 无 axe、无 Lighthouse CI、无预算 |

### 6.7 CI / CD

| 结论 | 证据 |
|---|---|
| **[改进]** 门禁设计成熟 | `.github/workflows/static.yml`：typecheck → lint → tv-assets → **dev server 探针（`next dev --webpack` 必须 200）** → 根路径 build+smoke → 子路径 build+smoke → 才允许 deploy；`concurrency` 按 ref 取消 |
| **[改进]** 子路径双构建是本项目最有价值的 CI 决策 | `basePath` 只管路由与 `_next/`，内容里手写的 `/images/…` 与 OG 图不会自动加前缀——这是这类站点的头号线上事故源，被 CI 固定在两种模式下各跑一次 |
| **[改进]** 部署即发布、无需服务器 | `upload-pages-artifact` + `deploy-pages`，`touch out/.nojekyll` |
| **[缺口]** 无依赖审计门禁 | `npm audit` 不在 CI 中（Issue #65） |
| **[缺口]** 无性能/视觉回归 | ROADMAP 的 Lighthouse 预算表仍是人工记录，没有断言（Issue #66 的第 4 条建议） |
| **[风险]** `verify` 与 `build` 各跑一次 `npm ci` + 构建 | 单次 PR 约 3 次完整构建；可接受（缓存 `setup-node` 已启用），若变慢可合并 job |

---

## 7. 其他实证发现

### 7.1 [风险] 滚动热路径的每帧布局读取（P2 · Issue #76，静态推断，未 trace）

`choreography.ts:387-388` 把 `syncPointer` 挂在 `onUpdate` 上 → `Portfolio.tsx:146` 的 `document.elementFromPoint()`。ScrollSmoother 滚动时每帧驱动 `ScrollTrigger.update()`，因此在作品区滚动段内该链每秒约执行 60 次。同一文件 `choreography.ts:530-535` 又在 `onUpdate` 里为 2 条跑马灯各新建 2 个 tween（含带 `delay` 的复位 tween，默认 `overwrite: false`）→ 滚动 1 秒约创建 240 个 tween。

**这是推断，不是测量**：本环境无浏览器，无法给帧率/长任务数据。可执行的验证方式写在 Issue 的验收标准里（4× CPU 降速 trace 前后对比）。

### 7.2 [BUG] 开发工具链：`preview.mjs` 遇畸形 URL 直接退出（P2 · Issue #62，已复现）

```
$ curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3311/%zz"   → 000
$ curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3311/"      → 000  （进程已死）
URIError: URI malformed
    at decodeURIComponent (<anonymous>)
    at resolve (scripts/preview.mjs:74)
```

`resolve()` 里的 `path.join(root, clean)` + `startsWith(root)` 还能被「同名前缀的兄弟目录」（`out-xxx/`）绕过，属于同一函数的次要问题（`preview.mjs:73-90`）。

### 7.3 [BUG] `npm run art` 会毁掉真实素材（P3 · Issue #56，已确认）

`scripts/art/generate-art.mjs` 与现行素材命名脱节：无条件覆盖 `profilephoto.jpg`（真实肖像）与 `works/{lyric-forge-ktv,remix-partfolio,scribeforge,win7-book-management}.jpg`（4 张真实作品封面，`generate-art.mjs:204,239`），并额外产出 `figure.jpg`、`tree1-5.jpg`、`accent-1/2.jpg`、`no-wave.jpg`、`tv-placeholder.webp`、`phone-booth-cutout.png` 等无人引用的孤儿文件。README 只承诺「不会覆盖 `tv.webp`」，没有覆盖其余。

### 7.4 [改进] 构建脚本的对外承诺有细微不一致

- `npm run build`（= `next build`）与 `build:static` **不等价**：后者会写 `out/build-meta.json`（`preview`/`smoke` 靠它判断子路径）并注入默认 `SITE_URL`。README 却写「`build` 是同一个东西」。
- `build-meta.json` 会被发布到 Pages（无害，但等于公开构建时间）。

### 7.5 [改进] 安全/隐私方面无附加问题

无第三方分析、无 cookie、无外链字体；`localStorage` 只存语言偏好与 `pf-preloaded`。`public/sw.js` 会缓存同源资源，无跨源缓存风险。这一项没有发现值得登记的问题。

---

## 8. 问题索引

### 8.1 本次新登记的 Issue（4 条）

| # | 优先级 | 标题 | 类别 |
|---|---|---|---|
| [#74](https://github.com/BrainEno/BrainEno.github.io/issues/74) | P2 | 作品详情页把同一张图片渲染两次（封面 + detailImages[0]），5/5 作品全中 | [BUG] UI/UX |
| [#75](https://github.com/BrainEno/BrainEno.github.io/issues/75) | P2 | 未知 URL 落到 Next 默认 404：无站内设计、无返回入口、无本地化，smoke 只校验状态码 | [BUG] UI/UX |
| [#76](https://github.com/BrainEno/BrainEno.github.io/issues/76) | P2 | 滚动热路径每帧同步布局读取（`elementFromPoint`）+ 跑马灯每帧新建 4 个 tween | [风险] 性能 |
| [#77](https://github.com/BrainEno/BrainEno.github.io/issues/77) | P3 | og:image 是 1.93 MB 竖版 1086×1448 PNG；JSON-LD `dateCreated` 非 ISO 8601 | [BUG] SEO/分享 |

> **审查结束后新增（所有者登记，非本报告建议）**：[#80](https://github.com/BrainEno/BrainEno.github.io/issues/80)「语言切换 / 窗口尺寸变化重建整套编排，已入场 reveal 重播」（P2）——本版已按源码复核并写入 §5.7；[#79](https://github.com/BrainEno/BrainEno.github.io/issues/79) 是同一问题的重复单（正文代码片段在提交时丢失），已于 07:00 关闭。
>
> 只登记了「未被现有 Issue 覆盖 + 有独立根因 + 有可执行验收」的四条。其余发现（§4.3、§4.4、§7.4）作为改进建议写在本报告，并通过 **重定义** 归入已有 Issue（#68 / #16 / #22 / #64），没有另开新单。

### 8.2 本次确认仍然成立的既有 Issue（必须保留）

| Issue | 级别 | 本次验证方式 | 结论 |
|---|---|---|---|
| [#51](https://github.com/BrainEno/BrainEno.github.io/issues/51) | P1 | 实测：包装格式构建被静默忽略 | **成立**，全仓最高优先级 |
| [#60](https://github.com/BrainEno/BrainEno.github.io/issues/60) | P1 | 产物 + CSS + 全仓无 noscript | **成立** |
| [#61](https://github.com/BrainEno/BrainEno.github.io/issues/61) | P1 | `setupChoreography` 只把 reduce 传给 `contact()` | **成立** |
| [#80](https://github.com/BrainEno/BrainEno.github.io/issues/80) | P2 | `Portfolio.tsx:307-317` 的 effect 依赖 `[lang, layoutKey]` + `choreography.ts:581-586` 的 `mm.revert()` 全量重建 | **成立**（静态控制流已核对；视觉重播待实测，详见 §5.7） |
| [#3](https://github.com/BrainEno/BrainEno.github.io/issues/3) | P0 | `grep -c 'href="/works/' out/index.html` = 0 | **成立**（本条为全站最严重的产品断点） |
| [#49](https://github.com/BrainEno/BrainEno.github.io/issues/49) | P2 | 早退在 `kill()` 之前 | **成立** |
| [#50](https://github.com/BrainEno/BrainEno.github.io/issues/50) | P2 | 回调不记录可见状态、`start()` 无条件 | **成立** |
| [#53](https://github.com/BrainEno/BrainEno.github.io/issues/53) | P1 | 层叠 + `onMouseLeave` 断电 + `<video>` 不可聚焦 | **成立**，但线上未启用视频内容 |
| [#54](https://github.com/BrainEno/BrainEno.github.io/issues/54) | P2 | 第 1 条（锚点）为静态推断；第 4 条的断点失步 768 vs 1023 已证实 | **部分成立**：第 2 条（`.contact-booth` `top:0; right:-0.6vw`）、第 3 条（`end: "top -4%"`，现为 `top 0%`）与第 4 条的字号探针（`--contact-fs` / `useLayoutEffect`）在 HEAD 中均已不存在，需在正文更正 |
| [#62](https://github.com/BrainEno/BrainEno.github.io/issues/62) | P2 | 复现：`/%zz` 使服务器退出 | **成立** |
| [#56](https://github.com/BrainEno/BrainEno.github.io/issues/56) | P3 | 逐行核对写入目标 | **成立** |
| [#68](https://github.com/BrainEno/BrainEno.github.io/issues/68) | P2 | 代码 + 实测（`works.tv` 缺失静默回填） | **成立** |
| [#64](https://github.com/BrainEno/BrainEno.github.io/issues/64) | P2 | 逐条比对，实际不符处比其列出的更多 | **成立**，建议扩写 |
| [#65](https://github.com/BrainEno/BrainEno.github.io/issues/65) | P2 | `npm ci && npm audit` | **成立** |
| [#19](https://github.com/BrainEno/BrainEno.github.io/issues/19) | P2 | `sw.js:24,33,14`（skipWaiting / clients.claim / 手写 VERSION）、无缓存上限 | **成立** |
| [#11](https://github.com/BrainEno/BrainEno.github.io/issues/11) | P1 | 详情页无壳、无语言切换、强调色硬编码 | **成立** |
| [#12](https://github.com/BrainEno/BrainEno.github.io/issues/12) | P1 | localStorage + SSR 只出默认语言 + 无 hreflang | **成立** |
| [#16](https://github.com/BrainEno/BrainEno.github.io/issues/16) | P1 | `types.ts` 确认缺 tags / 多链接 / 排序 / 发布状态 | **成立**，建议降为 P2 并补上 §4.4 的硬编码文案 |
| [#18](https://github.com/BrainEno/BrainEno.github.io/issues/18) | P2 | 焦点样式已修；作品行语义、视频键盘、动效关闭仍缺 | **部分成立**，建议重写验收项 |
| [#22](https://github.com/BrainEno/BrainEno.github.io/issues/22) | P2 | `theme.accent` 只作用首页；`#e55139` 硬编码于 `work-detail.css:20`、`offline/page.tsx:27` | **部分成立**（Tailwind 死依赖已并入 #65） |

### 8.3 建议合并 / 重定义

| Issue | 建议 | 依据 |
|---|---|---|
| [#55](https://github.com/BrainEno/BrainEno.github.io/issues/55) → 并入 [#19](https://github.com/BrainEno/BrainEno.github.io/issues/19) | 同一根因（Service Worker 缓存策略），建议关闭 #55，把「`/offline` 缺尾斜杠」「预缓存图标进了 PAGES 桶」作为 #19 的子项 | `sw.js:20,78,37`：`CORE` 用 `at("/offline")`（导出产物是 `/offline/index.html`），`icon-192.png` 被预缓存进 `PAGES` 而请求时走 `STATIC`（`isStaticAsset`）→ 预缓存命中不到 |
| [#63](https://github.com/BrainEno/BrainEno.github.io/issues/63) —— **已关闭**（建议为重写，所有者选择直接关闭） | `.txt` **不是垃圾**：共 29 个 / 173 KB，是 App Router 客户端导航（`Link` 预取）的载荷，删掉会破坏 `/#works` 返回链接的软导航。真实问题只剩「`headline.png` 1.9 MB 随产物发布」与「`out/` 12 MB vs 文档 6.2 MB」 | 实测 `find out -name '*.txt'` 计数 = 29，合计 173 KB；`works/[id]` 的 `<Link>` 依赖 home 的 `index.txt`。**关闭后的残留已改派**：`headline.png` 1.93 MB → #77；`out/` 12 MB 与文档 6.2 MB 的漂移 → #64；「`.txt` 不能删」这条纠正仍然有效（见 §8.5.3） |
| [#66](https://github.com/BrainEno/BrainEno.github.io/issues/66) 需重写 | 核心主张成立（22 处常驻 `will-change`、`.contact-booth-float` 的 9 s 无限动画在视口外仍运行），但清单已过期：`grep -c will-change` = **22**（非 23）；`.tv-box` **已无** `will-change`（`portfolio.css:723` 注释明确说明移除）；`.contact-headlines/.contact-line-text` **在 HEAD 中不存在**；行号整体偏移 | 同上；`document.getAnimations()` 那条验收标准仍然可执行 |
| [#10](https://github.com/BrainEno/BrainEno.github.io/issues/10) 需重定义 | 「没有 CI」「eslint 6 error」都已不成立（CI 三层门禁通过、`eslint .` 退出码 0）。剩下的真实缺口是**单元/契约测试为零**，建议改标题为「测试盲区：内容管线无任何自动化测试」，并把 §4.1 的四种输入列为用例 | 本报告 §3 表格第 2–3 行（`typecheck` / `lint` 均退出码 0） |
| [#54](https://github.com/BrainEno/BrainEno.github.io/issues/54) 正文需更正 | 第 2 条（电话亭侵入顶栏：`top:0`/`right:-0.6vw`）与第 3 条（`end: "top -4%"`）在当前代码中不存在——Contact 已重排为居中电话亭 + 双跑马灯，入场 `end` 为 `top 0%`；第 4 条的字号探针（`useLayoutEffect` + `--contact-fs`）也已删除，只剩「断点 768 vs 1023」成立 | `sections.tsx:305-398`、`choreography.ts:466-480`、`portfolio.css:1386-1470,1748` |

### 8.4 关闭建议与执行结果（已完成 / 已不适用 / 重复）

> 前三列是 2026-11-03 的审查建议；「结果」列由 07:10 UTC 的仓库状态回填。关闭动作由仓库所有者手动完成（沙箱集成的尝试记录见 §8.5.1）。

| Issue | 建议 | 证据 | 结果（2026-11-03 复核） |
|---|---|---|---|
| [#71](https://github.com/BrainEno/BrainEno.github.io/issues/71) | **关闭（已被 #73 顺带修复）** | HEAD 的产物里 `"@id":"https://braineno.github.io/"`、`"url":"…/works/scribeforge/"`、`"item":"…/works/scribeforge/"`、`canonical`、`og:url` **全部带尾斜杠**；`seo/site.ts:79-105` 与 `works/[id]/page.tsx:69-70` 均为模板字符串 + `/`。Issue 建于 04:47，PR #73（改 `seo/site.ts` +29/−15、`works/[id]/page.tsx` +24/−7）于 05:49 合并。**残留项**：其验收标准里的「smoke 增加尾斜杠一致性断言」未做，可转到 #68 或 #10 | ✅ 已关闭<br>07:06–07:08 |
| [#1](https://github.com/BrainEno/BrainEno.github.io/issues/1) | 关闭（已不适用） | 服务端与 Demo 模式随第七轮删除，仓库无 `src/portfolio/server`、无 `/api` | ✅ 已关闭<br>07:06–07:08 |
| [#2](https://github.com/BrainEno/BrainEno.github.io/issues/2) | 关闭（已完成） | `output: "export"` + `build-static.mjs` + Pages workflow 已存在 | ✅ 已关闭<br>07:06–07:08 |
| [#4](https://github.com/BrainEno/BrainEno.github.io/issues/4) | 关闭（已修复） | 已删除的 `server/*`、`api/*`、`db/*` 确实不在仓库；当前文档漂移由 #64 跟踪 | ✅ 已关闭<br>07:06–07:08 |
| [#5](https://github.com/BrainEno/BrainEno.github.io/issues/5) | 关闭（已不适用） | 无上传接口、无媒体路由 | ✅ 已关闭<br>07:06–07:08 |
| [#6](https://github.com/BrainEno/BrainEno.github.io/issues/6) | 关闭（已不适用） | 无 `pg`、无连接串 | ✅ 已关闭<br>07:06–07:08 |
| [#7](https://github.com/BrainEno/BrainEno.github.io/issues/7) | 关闭（DB 部分已不适用；40 项上限转 #68） | `MAX_LIST = 40` 仍在 `normalize.ts:10`，但根因与验收已在 #68 覆盖 | ✅ 已关闭<br>07:06–07:08 |
| [#8](https://github.com/BrainEno/BrainEno.github.io/issues/8) | 关闭（已不适用） | 无「Live 模式」概念 | ✅ 已关闭<br>07:06–07:08 |
| [#9](https://github.com/BrainEno/BrainEno.github.io/issues/9) | 关闭（重复于 #65） | #65 为同一实测的更新版本（1 critical / 2 high / 14 moderate） | ✅ 已关闭<br>07:06–07:08 |
| [#13](https://github.com/BrainEno/BrainEno.github.io/issues/13) | 关闭（已完成） | `Img.tsx` 已提供 `srcSet/sizes/width/height`，hero 有单一 preload；详情页 4:3 现为**有意设计**（`work-detail.css:27` 注释） | ⏸ 仍开放<br>待所有者判断 |
| [#14](https://github.com/BrainEno/BrainEno.github.io/issues/14) | 关闭（已修复） | `works/[id]/page.tsx:78` 与 `page.tsx:14` 均转义 `<`（#58 已据此关闭） | ✅ 已关闭<br>07:06–07:08 |
| [#15](https://github.com/BrainEno/BrainEno.github.io/issues/15) | 关闭（已不适用） | 无数据库、无冷启动 | ✅ 已关闭<br>07:06–07:08 |
| [#17](https://github.com/BrainEno/BrainEno.github.io/issues/17) | 关闭（前提不成立） | 现有断点：`767px`、`1023px / (max-aspect-ratio: 11/10)`、`(hover:hover) and (pointer:fine)`、`(hover:none),(pointer:coarse)`；「只有一个 767」已不成立。若仍有平板问题，应以具体截图新开 | ⏸ 仍开放<br>待所有者判断 |
| [#20](https://github.com/BrainEno/BrainEno.github.io/issues/20) | 关闭（已不适用） | 无会话、无认证 | ✅ 已关闭<br>07:06–07:08 |
| [#21](https://github.com/BrainEno/BrainEno.github.io/issues/21) | 关闭（已不适用） | 无 DDL/drizzle/wrangler；字体已自托管（`layout.tsx:12-15`） | ✅ 已关闭<br>07:06–07:08 |
| [#23](https://github.com/BrainEno/BrainEno.github.io/issues/23) | 关闭（已修复） | 语言改由 `useSyncExternalStore` 读取（`Portfolio.tsx:186-188`），`eslint .` 退出码 0、无 `set-state-in-effect` 报告 | ✅ 已关闭<br>07:06–07:08 |
| [#24](https://github.com/BrainEno/BrainEno.github.io/issues/24) | 关闭（已不适用） | `/admin` 已删除 | ✅ 已关闭<br>07:06–07:08 |
| [#25](https://github.com/BrainEno/BrainEno.github.io/issues/25) | 关闭（已不适用；构建期诊断转 #68） | 无服务端、无 `/api/health` | ✅ 已关闭<br>07:06–07:08 |
| [#26](https://github.com/BrainEno/BrainEno.github.io/issues/26) | 关闭（大部分已修复） | `lastmod` 已取快照 `exportedAt`（`source.ts:43-50`，实测生效）；OG 有 hero 兜底（`works/[id]/page.tsx:34`）；无 `force-dynamic`、无 DB。仅剩「无快照时回落构建时间」，已归入 #51 | ⏸ 仍开放<br>待所有者判断 |

**统计（2026-11-03 07:10 UTC 复核）**：审查开始时开放 **42** 条；本次登记 4 条（#74–#77）→ 46 条；审查结束后所有者另登记 #80（#79 为重复单，已关闭）。截至本版：**已关闭 19 条建议中的 16 条**（§8.4 表内 16 个 ✅），#13 / #17 / #26 保持开放待判断；另有 §8.3 的 #63 与重复单 #79 也被关闭，合计本轮关闭 **18** 条。**当前开放 30 条** ＝ §8.2 表中 20 行（原有 19 条 + #80）＋ §8.3 待处理 4 条（#55、#66、#10、#54，其中 #54 亦在 §8.2）＋ 待判断 3 条（#13、#17、#26）＋ 本次新登记 4 条（#74–#77）；即 20 + 3 + 3 + 4 = 30（#54 重复计入 §8.2 与 §8.3）。其中 #3、#51、#60、#61 仍为最高优先。

### 8.5 关闭执行记录与最终状态（2026-11-03）

#### 8.5.1 沙箱侧：尝试被拒（权限边界）

审查阶段尝试直接关闭 §8.4 中已确认完成的 issue，全部被沙箱的 GitHub 集成拒绝：

| 尝试路径 | 结果 |
|---|---|
| `gh issue close <n> --comment …`（GraphQL `closeIssue`） | 403 `Resource not accessible by integration` |
| `gh api -X PATCH /repos/{owner}/{repo}/issues/<n> -f state=closed`（REST） | 403；响应头声明 `X-Accepted-Github-Permissions: issues=write` |
| `gh issue comment <n>`（对照：写评论） | 403，同上 |
| `gh issue create`（对照：建 issue） | **可用**（#74–#77 即由该集成创建） |
| `git push` / `gh pr create` / `gh api -X PATCH /pulls/78` | 可用 |

**结论**：该集成的权限边界是「可新建 issue/PR、可推代码、可改 PR，**不可修改已有 issue**」。
注意 `gh api repos/{owner}/{repo} --jq .permissions` 会报 `admin: true`，那是 GitHub App 安装视图的假象，**不能**据此判断可写；判定可写与否要以实际写请求的 403 为准。

#### 8.5.2 所有者侧：实际关闭 18 条

| 批次 | 时间（UTC） | 关闭的 issue | 条数 |
|---|---|---|---|
| 第一批 | 06:46 | #1、#2 | 2 |
| 第二批 | 07:00 | #79（重复单） | 1 |
| 第三批 | 07:06–07:08 | #4、#5、#6、#7、#8、#9、#14、#15、#20、#21、#23、#24、#25、#63、#71 | 15 |

与建议的比对：

- **一致**：§8.4「确认可关」的 16 条（#1、#2、#4–#9、#14、#15、#20、#21、#23、#24、#25、#71）**全部关闭**，16/16。
- **一致**：#13、#17、#26 三条「待所有者判断」**保持开放**，未误关。
- **不一致（需知情）**：#63 被关闭，而 §8.3 的建议是「重写而非关闭」；#79 被关闭，它是 #80 的重复单。两条的处置见 8.5.3。

#### 8.5.3 #63 关闭后，它说的两件事并没有消失

#63 的标题是「构建产物卫生」，其中**「`out/` 混入 6 个 RSC `.txt` 载荷」这一条是错的**——`.txt` 是 App Router 客户端软导航的载荷（实测 29 个 / 173 KB），删掉会破坏 `/#works` 返回链接的软导航。关闭 #63 不会让这个错误消失，所以后来者改产物前请先读本节：

| #63 的原始论点 | 现状 | 承接位置 |
|---|---|---|
| `.txt` 是垃圾，应删除 | **不成立**，是软导航载荷 | 本报告 §8.3、§10.2 |
| `headline.png` 1.93 MB 随产物发布 | **成立**，仍是 `og:image` 与 `src` 兜底 | **#77**（换 JPEG/WebP + 控制尺寸） |
| `out/` 12 MB vs 文档 6.2 MB | **成立**，属文档漂移 | **#64**（文档校订） |

因此 #63 无需重开；只有当日后再出现「产物体积」类回归时，才需要按 #77 / #64 的验收标准处理。

#### 8.5.4 当前状态

| 状态 | 数量 | 明细 |
|---|---|---|
| 已关闭 | **23** | 审查前已关 5 条（#52、#57、#58、#59、#67）+ 本轮 18 条 |
| 开放 | **30** | §8.2 表 20 行（含 #80）+ §8.3 的 #55 / #66 / #10（#54 已计入 §8.2）+ #13 / #17 / #26 + #74–#77 |

本轮**由沙箱关闭的 issue 数 = 0**；能够关闭 18 条的只有仓库所有者的账号。

---

## 9. 推荐开发顺序与依赖

```
第一批（P0/P1，互不依赖，可并行）
  ① #3  首页 → 详情页入口 + 作品行语义化（<a> + Enter/Space + role）
  ② #51 published.json 解包（+ 同步 README/QUICKSTART 的格式说明）
  ③ #60 预加载遮罩：CSS 动画兜底 / noscript / 内联 3s 超时隐藏
  ④ #65 依赖升级（next / postcss / sharp）+ CI 加 audit

第二批（依赖 ① 和 ②）
  ⑤ #68 构建期内容校验（依赖 #51：先解包，校验才有意义）
  ⑥ #10（重定义）内容管线单元测试：包装 / 裸 / 缺字段 / 超限 四种输入
  ⑦ #74 详情页图片去重（依赖 ⑤ 的「重复图告警」更彻底）

第三批（动画交互，必须一起做，避免二次返工）
  ⑧ #61 reduce 覆盖 journey / television（先写降级契约）
  ⑨ #54 锚点跳转 + 断点统一（同一文件、同一批测量）
  ⑩ #49 / #50 / #53 TV 与电话亭状态机收敛（requested/committed 重构）
  ⑪ #80 重建策略：reveal 与 lang / layoutKey 解耦（与 ⑧⑨⑩ 同改 setupChoreography）

第四批（体验补全）
  ⑫ #75 自定义 404
  ⑬ #77 分享图 + JSON-LD 日期
  ⑭ #11 / #12 详情页与首页的语言 / 主题一致化（依赖 ①，工作量最大）

第五批（清理与测量）
  ⑮ #76 性能：先测（trace）再改
  ⑯ #66 / #55(#19) / #56 / #62 / #22 / #16 / #18 重写与收口（#63 已关闭，残留见 §8.5.3）
  ⑰ #64 文档：在每个 PR 里同步，最后一轮统一校订（不要在代码稳定前先改文档）
  ⑱ #13 / #17 / #26 由所有者定夺：接受现状即关闭，否则按验收标准重开
```

**关键依赖说明**：

- `#68` 必须排在 `#51` 之后 —— 在包装格式仍被丢弃时加校验，会把「格式错」误报成「字段缺失」。
- `#61` 与 `#54` 必须同批 —— 两者都改 `setupChoreography` 的条件分支与断点常量，分开做会互相冲突。
- `#11/#12` 应最后做 —— 它可能引入 `/en/` 路由或 `?lang=` 方案，会改变 canonical / sitemap / hreflang，进而影响 #71 相关的断言，以及 ① 的链接结构。
- `#64` 放最后：文档目前描述的是两代之前的版面，先改文档只会再漂一次。
- `#80` 与 `#61`、`#54` 同批：三者都在改 `setupChoreography()` 的 `matchMedia` 结构与条件分支（`#61` 加 reduce 分支、`#54` 统一断点、`#80` 决定是否全量重建），分开做会反复推翻同一段代码。

---

## 10. 本次审查的边界与未解决问题

### 10.1 未能验证（环境限制）

| 项 | 原因 | 影响 |
|---|---|---|
| 真实浏览器渲染、帧率、Lighthouse | 沙箱内无浏览器（`chromium/chrome/firefox/playwright` 均不存在），无外网安装通道 | §7.1、§5.5 的锚点行为、#66 的层/掉帧数据均为**静态推断**，已在对应 Issue 中标明「待实测」 |
| iOS Safari / Android Chrome 真机 | 同上 | pin + ScrollSmoother、`100svh`、WebGL 拖拽的真实表现未知（ROADMAP P0 也仍是未勾选状态） |
| 分享卡片的实际抓取效果 | 无法访问 `braineno.github.io`（出网白名单限制）与各平台调试器 | Issue #77 只断言尺寸/体积/格式，不断言平台裁切结果 |
| 变更历史 / 逐行 blame | 仓库为 **shallow clone**（`git rev-list --count HEAD` = 1），父提交不可达 | #71 的修复来源只能通过 GitHub API（PR #73 的文件列表）间接佐证，无法给出 diff |
| 线上当前版本 | 同上 | 所有结论以本地 `build:static` 产物为基准（与 CI 同一命令、同一 env） |

### 10.2 被证伪的初始判断（自我更正记录）

初次看到 `metadata.manifest: "/manifest.webmanifest"` 时，我按「Next 不会给自定义 metadata URL 加 `basePath`」的常见经验判断为子路径 Bug。**随即用子路径构建核对，产物是** `<link rel="manifest" href="/subpath-check/manifest.webmanifest"/>`，**Next 16 确实加了前缀**，该判断被证伪，未写入报告，也不作为 Issue。同理，`og:image` / `canonical` / JSON-LD 在子路径下均带前缀（与 #59 的修复一致），我最初怀疑的 `absoluteUrl()` 问题在当前 HEAD 已不存在。

另外两处「看起来像 Bug、实测后降级」的项：

- `out/**/*.txt`（29 个 RSC 载荷）看着像构建垃圾，实际是客户端软导航所需（#63 已关闭，但「不能删」这条纠正仍然成立，见 §8.3 与 §8.5.3）。
- `test-tv-assets.mjs` 用正则读 `defaults.ts` 看似简陋，但它校验的是「矩形是否盖住 alpha 开口」这一几何不变量，对默认内容有效，因此没有升级为新 Issue（只指出「用户换 `published.json` 后失效」这一盲区）。

### 10.3 已知但本次未登记的问题（建议并入已有 Issue）

- Contact 三处硬编码文案（§4.4）→ 并入 #16（内容模型）。
- `manifest.theme_color` 硬编码 → 并入 #22（设计令牌）。
- `npm run build` 与 `build:static` 不等价、`build-meta.json` 被发布 → 并入 #64（文档）。
- smoke 缺少「站内链接爬取」→ 并入 #10（测试盲区）。
- `preview.mjs` 的「同前缀兄弟目录」穿越（次要）→ 已写在 #62 正文里。

---

## 11. 工作记录（可审计）

### 11.1 工具、接口与命令

| 类别 | 具体使用 |
|---|---|
| 终端 / 文件系统 | 真实 bash（cwd = 仓库根），读写仓库内文件；`git`（只读：`log/status/show/rev-list/ls-files/diff`）、`gh`（`issue list/view/create`、`pr view --json files`、`run list`、`api …/pages`） |
| 构建与检查 | `npm ci`、`npm run typecheck`、`npm run lint`、`npm run test:tv-assets`、`npm run build:static`（根 / `/subpath-check` 各一次）、`npm run smoke`、`npm run dev`、`npm audit --json`、`node scripts/preview.mjs`、`curl`、`sharp`（读图片元数据）、`node --experimental-strip-types`（导入 `defaults.ts` 生成测试内容） |
| GitHub API | `gh issue list --state open --json …`（审查开始时 42 条开放 Issue 全文）、`gh issue view 57`、`gh pr view 73/70 --json files`、`gh run list --json`（12 次运行）、`gh api repos/…/pages`、`gh label list` |
| 未使用 | 浏览器自动化、Lighthouse、axe、图像/语音生成、外部搜索（均不适用于本次静态审查） |

### 11.2 核心文件与调用链

**通读**：`README.md`、`docs/{ARCHITECTURE,ROADMAP,STATIC_EXPORT,QUICKSTART}.md`、`next.config.ts`、`tsconfig.json`、`eslint.config.mjs`、`package.json`、`.github/workflows/static.yml`。

**逐行阅读**：`content/{source,normalize,types,defaults}.ts`、`seo/{site,asset}.ts`、`app/{layout,page,sitemap,robots,manifest}.tsx`、`app/works/[id]/page.tsx`、`app/offline/page.tsx`、`ui/{Portfolio,sections,TvShowreel,PhoneBoothModel,Img,PwaRegister}.tsx`、`scroll/choreography.ts`、`three/booth.ts`（关键段）、`public/sw.js`、`styles/{portfolio,work-detail}.css`（关键选择器）、`scripts/{build-static,build-images,preview,smoke,test-tv-assets}.mjs`、`scripts/art/generate-art.mjs`、`scripts/tv-glass.mjs`。

**追踪的调用链**：
1. 内容：`published.json → getSiteContent → normalizeContent → Portfolio/sections → Img/asset → out/*.html`（并做两次真实构建对照）。
2. 电视：`row.onMouseEnter → preview → activeWork → TvShowreel effect → GSAP timeline → commit → shown`（含早退与竞态）。
3. 电话亭：`IntersectionObserver(150%) → import(three) → mountBooth → start() / setPaused` 与 `IntersectionObserver(20%)`、`visibilitychange` 三方关系。
4. 分享元数据：`layout.generateMetadata → pageTitle/pickText/absoluteUrl → asset/BASE_PATH → out/index.html <meta>`（根 + 子路径双构建核对）。
5. SW：`PwaRegister(scope) → sw.js install/activate/fetch` 与 `trailingSlash` 的交互。

### 11.3 哪些判断经过源码验证 / 测试验证

| 判断 | 验证方式 |
|---|---|
| 内容包装格式失效 | **执行验证**（两次真实构建 + 产物比对） |
| 无 JS 黑屏 | **源码 + 产物验证**（SSR 标记、CSS 规则、全仓无 noscript）；未做浏览器验证 |
| reduced-motion 覆盖不全 | **源码验证**（唯一传参点）+ 全仓 grep |
| 详情页重复图 / 首页无链接 | **产物验证**（`grep`/统计构建后的 HTML） |
| CRT 竞态 | **源码控制流验证**；未做浏览器复现 |
| 电话亭离屏渲染 | **源码控制流验证**；未测量功耗 |
| preview URIError | **执行验证**（复现崩溃） |
| 依赖漏洞 | **执行验证**（`npm ci` + `npm audit`） |
| 子路径前缀（manifest/OG/canonical/icon） | **执行验证**（子路径构建产物） |
| #71 已修复 | **产物验证** + GitHub API（PR #73 改动文件） |
| 滚动热路径性能 | **静态推断**（未 trace，已在 #76 标注） |

### 11.4 运行环境与权限（能确认的与不能确认的）

| 项 | 值 |
|---|---|
| 执行框架 | Arena.ai Agent Mode（本会话） |
| 模型提供商 / 模型 ID | **未知** —— 执行环境未暴露；按平台说明，Arena Agent Mode 会在多个模型间调度 |
| Agent 版本 | **未知**（未暴露版本号） |
| 推理模式与配置 | **未知**（不可见；本报告不含私有思维链，只保留可审计的工作摘要） |
| 终端 / 文件系统 | **有**真实读写权限（仓库内） |
| GitHub 读写 | **有**（已实际创建 Issue #74–#77；`gh` 认证由沙箱提供） |
| 浏览器 / 网络抓取 | **无**浏览器；出网仅限白名单（GitHub / npm / PyPI），无法访问 `braineno.github.io` |
| 操作系统 / 运行时 | Linux · Node v22.22.3 · npm 10.9.8 · 仓库为 shallow clone（depth 1） |
| 审查期间的仓库改动 | 仅新增本文件 `docs/full-code-review.md`；未改业务代码、未改数据库、未合并 PR、未关闭 Issue |

### 11.5 审查后的状态同步（2026-11-03 07:10 UTC）

为响应「所有者已关闭一批 issue」，按最新仓库状态做了一次只读复核，并据此改写 §5.7、§8.1–§8.5、§9、§10.2：

| 动作 | 命令 / 依据 | 结果 |
|---|---|---|
| 拉取关闭列表 | `gh issue list --state closed --limit 100 --json number,closedAt,title` | 23 条（审查前 5 条 + 本轮 18 条） |
| 拉取开放列表 | `gh issue list --state open --limit 100 --json number,title` | 30 条，与 §8.4 统计一致 |
| 核对 #79 / #80 | `gh issue view 79/80 --json author,state,createdAt,body` | #79 正文代码片段丢失（残缺重复），07:00 关闭；#80 完整，开放 |
| 复核 #80 的控制流 | 读 `Portfolio.tsx:205-230,307-317`、`choreography.ts:250-274,343-367,497-515,570-586` | 依赖数组、`layoutKey` 防抖、`mm.revert()`、三处 reveal 全部对上（issue 原文行号有偏移，已按 HEAD 更正） |
| 比对建议与实际 | §8.4 逐行 | 16/16 确认项已关闭；#13 / #17 / #26 保持开放；#63 被关闭（建议为重写），残留改派 #77 / #64 |

> 本轮仍未改动任何业务代码：`git diff --stat main...HEAD` 只有 `docs/full-code-review.md` 一个文件。

---

*本报告的全部结论以 `721a023` 的工作树与本地构建产物为准；每条 Bug 都给出了可复现命令或可直接对照的代码位置。报告中标注为「静态推断 / 待实测」的项，均已在对应 Issue 的验收标准里写明如何测量。*
