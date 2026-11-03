# 全仓代码审查报告 — BrainEno.github.io

> **审查基线**：`main` @ `721a023dcf7f835b8279eae9d99ae09d9035dbe1`（Merge PR #73，2026-11-03）
> **审查分支**：`arena/9ed8e4c5-braineno-github-io`（自基线切出，未改动任何业务代码）
> **审查时间**：2026-11-03（UTC）
> **审查范围**：默认整个仓库 —— 源码（`src/`）、构建/测试脚本（`scripts/`）、PWA（`public/sw.js`）、内容契约、CI workflow、文档、全部开放 GitHub Issues 与近期 CI 运行
> **特别关注**：后续 UI、动画交互设计改进
> **执行原则**：只审查、报告与登记问题；不修改业务代码、不合并 PR、不关闭 Issue。所有结论区分【已证实（执行/运行时验证）】【静态推断】【待验证】。

---

## 0. 摘要（TL;DR)

这是一个**架构上做对了的项目**：纯静态导出的个人作品集，内容即仓库文件，构建即发布，无服务器、无数据库、无运行时 API。核心工程实践（子路径部署适配、响应式图片管线、双模式冒烟测试、WebGL 懒加载、动画分层设计）显著高于同类个人主页的平均水平。

真正需要优先处理的问题集中在三类：

1. **P0 —— 作品详情页是孤岛**（#3）：首页作品行没有任何指向 `/works/<id>` 的链接（构建产物实测 `href="/works/` 计数为 0），5 个 SSG 详情页只能靠 sitemap 被搜索引擎发现，站内用户永远到不了；行元素 `tabIndex=0` 但 Enter/Space 无动作、无 button/link 语义。
2. **P1 —— 降级与内容管线**：`published.json` 按 README/QUICKSTART 文档的 `{ exportedAt, content }` 格式配置会被**静默丢弃**（运行时复现证实，#51）；JS 失败或被禁用时整站停在全屏黑色预加载层（#60）；`prefers-reduced-motion` 只覆盖首屏入场与 Contact，作品区 pin/推镜照常全量播放（#61）；视频作品实际上无法点击播放（#53）。
3. **动效系统生命周期（本审查关注域）**：语言切换/窗口宽度变化会 revert 并重播整套 reveal 动画（#80）；CRT 换台状态机存在「早退不杀旧时间线」的 stale-commit 竞态（#49）；滚动热路径每帧同步布局读取 + 跑马灯每帧新建 tween（#76）。这些都属于「后续 UI/动画交互设计改进」应最先治理的动效基建。

本次实测：`typecheck / lint / test:tv-assets / build:static / smoke / dev-server` 全部通过（退出码 0），`npm audit` 1 critical + 2 high + 14 moderate（#65 属实）。**本次未新增 GitHub Issue**：全部经证实的发现均已被现有 46 条开放 Issue 覆盖，去重后不制造重复登记（见 §8.2）；另有 2 组重复/过期 Issue 需要清理（#79/#80、#55→#19，见 §8.3）。

---

## 1. 项目概况与设计理念

**产品形态**：BrainEno 个人主页/作品集（<https://BrainEno.github.io>），单页滚动叙事（Hero → 简介长卷 → 电视机作品索引 → 白场转场 → 3D 电话亭 Contact），外加每作品一个详情页 `/works/<id>` 与 PWA 离线兜底 `/offline`。

**设计理念**（从代码与文档双向核实，言行一致）：

- **「部署即发布」**：内容是仓库里的静态文件（`content/defaults.ts` / 可选 `content/published.json`），构建期读一次，没有运行时内容源。刻意删除了上一版的 PostgreSQL + `/admin` 形态（`docs/ARCHITECTURE.md` §1 有完整删除清单，经核实对应文件确实不在仓库）。
- **「换图不破版式」**：所有图片放在设计固定尺寸的「画框」容器中裁切（`object-fit: cover` + `contain: layout paint`），GSAP 测量值不随素材比例变化。
- **「子路径不踩坑」**：所有内容持有的根绝对路径统一经 `seo/asset.ts#asset()` 补 `BASE_PATH`，`smoke.mjs` 在根路径与子路径两种构建下逐页校验资源与分享图。
- **「动效分层」**：GSAP 拥有外层元素的滚动轨迹，WebGL 渲染器拥有模型内部自转/拖拽，两者互不打架（`three/booth.ts` 模块注释即契约）。

**技术栈**：Next.js 16.2.6（App Router，`output: "export"`）· React 19.2.6 · TypeScript 5.9.3 · GSAP 3（ScrollTrigger + ScrollSmoother + matchMedia）· three.js 0.181（按需动态加载）· 自托管 @fontsource 字体 · sharp（构建期图片管线）· GitHub Pages（Actions 部署）。

---

## 2. 代码规模

以 `git ls-files`（135 个受版本控制文件）与逐文件 `wc -l` 为准（2026-11-03）：

| 类别 | 文件 | 行数 | 说明 |
|---|---|---|---|
| 生产代码 · TS/TSX | 23 | **3,457** | `src/app`（路由壳 8 文件）+ `src/portfolio`（领域模块 15 文件） |
| 生产代码 · CSS | 3 | **2,141** | `portfolio.css` 2,079 · `globals.css` 33 · `work-detail.css` 29 |
| 运行时脚本 | 1 | 84 | `public/sw.js`（无构建依赖的 Service Worker） |
| 构建/工具脚本 · mjs | 7 | ~1,050 | build-static / build-images / smoke / preview / test-tv-assets / tv-glass / art/generate-art |
| 构建/工具脚本 · py | 1 | 157 | `optimize-booth-model.py`（38 MB glTF → 2.2 MB GLB） |
| 配置 | 3 mjs/ts + yml | — | `next.config.ts` · `eslint.config.mjs` · `postcss.config.mjs` · `.github/workflows/static.yml` |
| **测试代码** | **2** | **~340** | `smoke.mjs`（304 行，逐页爬取/资源/分享图/编码校验）+ `test-tv-assets.mjs`（36 行，电视玻璃几何断言） |
| 生成物（入库） | 2 组 | — | `content/image-manifest.json`（图片清单）+ `public/images/opt/*`（64 个 WebP 派生图） |
| 资产 | 61 webp + 10 jpg + 4 png + glb/gltf | — | `assets/models/telephone.gltf` 37 MB（建模源，**刻意留在 public/ 之外**）；`public/gltfs/telephone.glb` 2.2 MB |
| 文档 | 10 md | — | README / ARCHITECTURE / QUICKSTART / ROADMAP / STATIC_EXPORT / LICENSE / TERMS / CONTRIBUTING 等 |

**没有传统意义的单元测试框架**（无 vitest/jest/playwright）；`smoke.mjs` 是事实上的集成测试（CI 强制执行），`test:tv-assets` 是唯一的资产断言测试。测试盲区见 §7「测试」。

---

## 3. 架构、数据流与契约

### 3.1 分层图

```
浏览器
 ├─ 静态导出 out/（GitHub Pages / 任意静态托管）
 │   ├─ /                  page.tsx ── getSiteContent() ──┐
 │   ├─ /works/<id>/       works/[id]/page.tsx（SSG×5）    │  构建期一次性读取
 │   ├─ /offline · /robots.txt · /sitemap.xml · /manifest.webmanifest
 │   └─ sw.js              离线缓存（cache-first 静态资源 / network-first 导航）
 │
 └─ 页面运行时
     Portfolio.tsx（壳：Preloader · Cursor · Header/语言 · ScrollSmoother）
       ├─ sections.tsx     Hero · Journey · Works · Contact（纯展示组件）
       ├─ scroll/choreography.ts   全部 GSAP 时间线（hero/长卷/电视/Contact/分节跟踪）
       ├─ TvShowreel.tsx   CRT 换台状态机（雪花/切台/雪花落/环境光/视频）
       ├─ PhoneBoothModel.tsx ──(IO 预载)──► three/booth.ts（WebGL 电话亭，独立 chunk）
       └─ Img.tsx          统一 <img>：srcSet（image-manifest）+ asset() 前缀 + 尺寸防 CLS

内容契约（唯一入口 content/source.ts#getSiteContent）
   content/published.json（可选快照） ──normalize.ts──► PortfolioContent
   content/defaults.ts（默认双语内容）◄──回退──────────┘
```

依赖方向干净：`app → portfolio`，`ui → content/seo/scroll/three`，无反向依赖、无循环依赖。`three` 仅通过动态 `import()` 进入首屏外 chunk。

### 3.2 数据模型（`content/types.ts`，`PortfolioContent` v2）

`identity / navigation / hero / intro / works{tv, items[]}/ contact / theme`；`Work` 含 `id、title(双语)、year、credit、image、video?、url、description、detailImages[]`。全部字段双语（`LocalizedText {zh,en}`）。`normalize.ts#coerce` 按模板递归兜底：字符串截 6000 字、列表截 40 项、未知键前向保留、`works.id` 自动 slugify 去重。**注意**：该兜底全部静默执行，是 #68 的根因。

### 3.3 接口清单

**运行时 API：无**（`output: "export"`，无 route handler、无数据库、无鉴权、无 cookie）。构建期产物路由：

| 路由 | 产物 | 数据来源 |
|---|---|---|
| `/` | index.html（SSR 全文，爬虫免 JS 可读） | getSiteContent |
| `/works/<id>/` ×5 | SSG（`generateStaticParams`） | works.items |
| `/offline/` | 离线兜底（noindex） | 静态 |
| `/robots.txt` `/sitemap.xml` `/manifest.webmanifest` `/icon.svg` | metadata routes | siteUrl/BASE_PATH/内容 |
| `/_next/static/*` `/images/*`（含 `opt/`）`/gltfs/*` `/icons/*` | 静态资产 | 构建管线 |

分享/结构化数据：`og:image`/`twitter:image`/JSON-LD `image` 统一走 `absoluteUrl(asset(src))`（子路径前缀已验证）；JSON-LD 为 WebSite + Person + CreativeWork×5（`<` 已做 `\u003c` 转义，#14/#58 已修复属实）。

### 3.4 依赖表（`package.json`）

| 依赖 | 版本 | 用途 | 备注 |
|---|---|---|---|
| next / react / react-dom | 16.2.6 / 19.2.6 | 框架 | — |
| gsap | ^3.15 | 滚动编排 | 首屏必需 |
| three | ^0.181 | WebGL 电话亭 | 动态加载，2.2 MB GLB 独立拉取 |
| @fontsource-variable/inter、@fontsource/inria-serif | ^5.3 | 自托管字体 | 构建不依赖外网 |
| tailwindcss、@tailwindcss/postcss | 4.1.17 | **死依赖** | postcss 配置挂了插件，但全仓无 `@import "tailwindcss"`、无 Tailwind 类名（实测）→ #65 |
| sharp | ^0.34.5 | 构建期图片 | audit high（libvips 等，构建期工具，不进产物） |
| eslint / typescript / @types/* | — | 质量工具 | — |

`.npmrc` `legacy-peer-deps=true` 掩盖 peer 冲突（#65 属实）。`npm audit` 实测：**17 项（1 critical / 2 high / 14 moderate）**，主要在 `postcss`（next 内嵌）与 `sharp`，均不进入浏览器产物，但应按 #65 升级。

### 3.5 架构评价

- **合理性：高**。单页叙事 + 静态内容 + 构建期生成 SEO 资产，是该产品需求下的正确形态；相比仓库历史中的「服务端 CMS」形态，删除了约 1,300 行后台与整条服务端链路，复杂度显著下降。
- **无循环依赖、无职责混乱**。唯一的「双入口」痕迹是 `normalize.ts` 中遗留的 `works.items[].detailItems`（类型中已不存在的字段）——死代码，无害。
- **技术债**主要在：动效层的生命周期管理（§5）、内容校验缺失（§6）、测试盲区（§7），而非架构本身。

---

## 4. 实际执行记录（验证矩阵）

全部在沙箱内真实执行（Node v22.22.3 / npm 10.9.8 / ubuntu）：

| 命令 | 退出码 | 结果 | 备注 |
|---|---|---|---|
| `npm ci` | 0 | 380 包安装成功 | legacy-peer-deps 生效 |
| `npm run typecheck`（tsc --noEmit） | 0 | 无错误 | |
| `npm run lint`（eslint .） | 0 | 0 error / 0 warning | |
| `npm run test:tv-assets` | 0 | 19,465 个透明像素被 screen 矩形覆盖，开口 (656,670)–(820,791) | 唯一资产断言测试 |
| `npm audit` | — | 1 critical / 2 high / 14 moderate | #65 佐证 |
| `NEXT_PUBLIC_SITE_URL=https://BrainEno.github.io npm run build:static` | 0 | out/ 12 MB，13 路由（含 5 个作品 SSG） | Turbopack 构建 |
| `npm run smoke`（根路径模式） | 0 | 全部通过：6 页面 200、3 个 404 路径正确 404、robots/manifest/sitemap 正常、**89 个资源 URL 全部 200**、og/twitter/JSON-LD 图片 6/6 可达、Brotli 生效 | CI 同款流程 |
| `npm run dev -- --port 3210` | HTTP 200 | 首页可服务；SSR HTML 中含 `.preloader`（#60 佐证） | webpack 模式 |
| `gh run list` | — | 近 8 次 CI 全绿（main push、PR #72/#73/#78 分支均 success，2m24s 内） | |

**运行时复现**（非静态推断）：

1. **#51（published.json 包装格式被静默丢弃）**：用 `tsc` 编译 `normalize.ts` 后实际调用——
   `normalizeContent({exportedAt, content:{identity:{name:"WRAPPED-MARKER"}}})` → `identity.name` 仍是模板的 `"BrainEno"`，且 `exportedAt`/`content` 作为未知键被原样保留；裸格式 `{identity:{name:"BARE-MARKER"}}` 正常生效。**README/QUICKSTART 教的包装格式确实静默失效**，退出码 0、无任何 warning。
2. **#3（详情页孤岛）**：构建产物 `grep -o 'href="/works/[^"]*"' out/index.html | wc -l` → **0**；作品行是 `<li class="work-row" tabindex="0">`，无 `<a>`/`<Link>`。
3. **#74（详情页重复图）**：逐作品比对 `defaults.ts`——5/5 作品的 `detailImages[0].src === image.src`，`works/[id]/page.tsx:63` 的 `[work.image, ...work.detailImages]` 会把同一张图画两次。
4. **#60（预加载层）**：`curl` dev 首页 HTML 含 `.preloader`（`position:fixed; inset:0; z-index:2000`，portfolio.css:124-135），全仓 `grep noscript` **零命中**。
5. **#65（死依赖）**：postcss 配置挂 `@tailwindcss/postcss`，但 `grep -rn "tailwind|@apply|@theme" src` 零命中、无 Tailwind 类名。

---

## 5. 重点专项 A：动效与交互系统全链路（特别关注域）

> 本节按「UI → 状态管理 → 动效编排 → 渲染层」逐层追踪四幕的动画/交互链路，主动排查竞态、降级、失败恢复与边界。

### 5.1 调用链与状态清单

```
输入源（4 路）                      状态中枢                     执行层
──────────────                    ──────────                   ──────
① 指针移动  Cursor.evaluateTarget → preview(index) ┐
② 行 hover/focus/click（sections.tsx:249-251）─────┤→ activeWork ∈ [-1..n]
③ 触屏滚动  ScrollTrigger per-row（choreography）──┤   TvShowreel 状态机
④ 滚动相位  television() setPhase(rows|phone|exit) ┘   （雪花/切台/断电）
语言 localStorage + useSyncExternalStore → lang ──→ 整套 choreography 重建（#80）
窗口宽度 resize(250ms 防抖) → layoutKey ──────────→ 同上
```

TV 相位状态机 `rows → phone → exit`（`choreography.ts#television`）：rows 段 hover/滚动预览；phone 段（`.tv-phone-spacer`）推镜展示 `@BrainEno` 号码层并**主动断电**（`onWork(-1)`）；exit 段白场溶解进 Contact。相位写入 `#works.dataset.tvPhase`，与 `Cursor` 的 hover 判定联动。

### 5.2 已证实的缺陷（均映射既有 Issue）

| # | 缺陷 | 证据（行号） | 机制 | Issue |
|---|---|---|---|---|
| 1 | **CRT 快速往返切台被旧时间线覆盖** | TvShowreel.tsx:95（早退）先于 :117（`timeline.current?.kill()`） | A→B→A 快速切换时，第 3 次 effect 因 `shownRef` 仍是 A 而**在 kill 之前**早退返回，B 的时间线继续跑完并在 0.2s 处 `commit(B)`——画面停在 B 而选中行是 A，直到下一次切换才纠正 | #49（机制描述准确，本次复核确认） |
| 2 | **视频作品无法点击播放** | portfolio.css:1164-1173（`.works-list` z-index:4 覆盖舞台）+ :764（`.tv-video` 仅 `data-active=true` 时 `pointer-events:auto`） | rows 阶段 `elementFromPoint` 永远命中 `.work-row`，点击被列表层拦截；且指针从行移向屏幕的路径必先触发 `onMouseLeave→onPreview(-1)` 断电（Cursor 的 `.tv-video` 特判只救 pointermove，救不了 mouseleave 序列）；phone 阶段列表 `pointer-events:none` 时视频又已断电 | #53 |
| 3 | **reduced-motion 降级只覆盖一半** | choreography.ts:562-566：`heroScroll/journey*/television` 不看 `reduce`，仅 `contact(scope, desktop, reduce)` 接收 | 「减少动态效果」用户仍被 pin + 推镜 + 白场推镜全量播放；CSS 层（portfolio.css:2052）只关了雪花/悬停过渡 | #61 |
| 4 | **语言/resize 重建整套编排导致 reveal 重播闪烁** | Portfolio.tsx:304-317（effect 依赖 `[lang, layoutKey]`）+ choreography.ts:585（teardown `mm.revert()`） | revert 会把已播完的 `gsap.from` reveal（作品行、标题、Contact 块）还原成隐藏态再重播；scrub 类动画不受影响 | #80（#79 为其损坏重复件，见 §8.3） |
| 5 | **滚动热路径每帧同步布局读取 + 跑马灯 tween churn** | Portfolio.tsx:146（`document.elementFromPoint` per scroll frame）+ choreography.ts:529-536（每次 onUpdate 对每个 loop 新建 2 个 `gsap.to`，2 行共 4 个/帧） | forced layout + GC 压力，低端机滚动掉帧风险 | #76 |
| 6 | **电话亭可见性竞争** | PhoneBoothModel.tsx:83-101：`pause` IO 回调只操作已存在的 `handle`；`mountBooth` 完成时无条件 `start()` | 快速滚过 contact 后才加载完成时，`setPaused` 回调不再触发，渲染循环在视口外常驻（`document.hidden` 兜底只救切标签页） | #50 |
| 7 | **锚点/断点失步** | choreography.ts:15-16（768px 一刀切）vs portfolio.css:1748（1023px + aspect-ratio 布局突变）；`/#works` 深链（manifest shortcuts、详情页返回链 `href="/#works"`）经 ScrollSmoother 变换容器后原生锚点定位失效 | 768~1023px 区间 CSS 已是「堆叠布局」而 GSAP 仍按桌面参数跑；深链落点不可信 | #54 |

### 5.3 交互设计改进方向（非 Bug，产品/设计建议，供后续 UI 迭代参考）

1. **hover-intent 防抖（治 #49 的最短路径）**：行 hover 触发换台前加 60–100ms 意图延迟（快速掠过不换台），既消除快速往返竞态，又减少雪花动画的「频闪」感。与 #49 的序列号方案互补，可作为其验收项之一。
2. **给作品行一个真正的「查看」动作**：`data-cursor="view"` 承诺了 "view"，但 click 等于 hover（重复预览）。建议行主体变链接/按钮进详情页（与 #3 一并解决），预览改由悬停/聚焦独占，形成「悬停看片、点击进入」的两级交互。
3. **TV 状态的无障碍播报**：换台成功后 `aria-live="polite"` 播报「CH 02 · <作品名>」，视频播放键给 button 语义与键盘空格/回车操作（并入 #61/#18 验收）。
4. **语言切换用 View Transitions**：`document.startViewTransition` 包裹 `setLangOverride`，把 #80 的「revert 重播闪烁」直接变成一次平滑交叉淡入；同时为将来第三种语言留出通用机制。
5. **CSS 滚动驱动动画做渐进增强**：marquee 与部分 reveal 可用 `animation-timeline: view()` 实现零 JS 版本，JS 只做增强——既减小 `choreography.ts`（587 行）的维护面，也天然规避 #76 的帧开销。
6. **白色 Contact 幕的 `theme-color` 动态化**：用 `matchMedia`/滚动相位切换 `meta[name=theme-color]`（黑→白），移动端浏览器顶栏与内容融合（细节打磨，目前恒为 `#000000`）。
7. **换台音效/噪点强度与 `prefers-reduced-motion`、系统音量联动**（若未来加音效），以及移动端 CRT 玻璃高光的强度复核（ROADMAP P1 已列，保持）。

---

## 6. 重点专项 B：内容发布管线端到端（唯一「业务流程」）

```
作者编辑 defaults.ts / published.json → npm run build:static
  → build-images.mjs（sharp：480/800/1200 WebP + OVERRIDES + image-manifest.json）
  → next build（generateStaticParams 枚举作品）
  → smoke.mjs（双模式校验）→ CI deploy → GitHub Pages
```

逐层检查结论：

1. **快照契约自相矛盾（P1，已运行时证实）**：README/QUICKSTART 教用户写 `{ "exportedAt": …, "content": … }`，而 `source.ts:38-39` 直接 `normalizeContent(published)` 不解包 → 内容被 `coerce` 当未知键吞掉，**站点静默回退默认模板**且构建全绿。同时 `getContentUpdatedAt()`（source.ts:43-49）只认包装格式的 `exportedAt`——即：**两种格式各对一半**，无论怎么配都有一半功能失效。→ #51（复现脚本见 §4）
2. **校验缺失（P2）**：`normalize.ts#coerce` 静默截断/兜底（6000 字、40 项、缺图、id 冲突均无告警）；`test-tv-assets.mjs` 只读 `defaults.ts`（#67 已关但事实依旧——用户换 `published.json` 后该测试恒绿，属已接受的取舍，建议在 #68 验收里补「校验对象=最终生效内容」）。→ #68
3. **图片管线（良好）**：`Img.tsx` 三条不变量（src 永远是真文件、无 `<picture>`、清单为入库生成物）可靠；`src` 兜底就是原始文件——代价是 hero 的 1.98 MB PNG 直出为兜底 `src`（#63/#77）。
4. **SEO 产出（基本良好）**：canonical/sitemap/OG 均带尾斜杠与 BASE_PATH（#71 已修属实）；`dateCreated: work.year`（如 `"2026.04.22"`）非 ISO 8601、og:image 为 1.98 MB 竖版 PNG（#77）；`sitemap.lastmod` 在无快照时回退构建时间（#26 残留项）。

---

## 7. 多维度评估

> 分类标记：【BUG】可复现的错误行为；【风险】边界/条件触发的隐患；【改进】架构/工程改进建议；【缺口】功能/流程缺失。

### 7.1 健壮性

- 【BUG】#51 内容快照双契约矛盾（运行时证实，见 §6）。
- 【BUG】#49 CRT 状态机早退竞态（机制复核属实）；#50 电话亭加载/可见性竞态（静态控制流证实，浏览器复现待验证）。
- 【风险】#60 预加载层只能由 JS 隐藏，JS 慢/失败/被禁 = 黑屏 `000`（SSR 实测存在，无 noscript）。
- 【风险】#62 `preview.mjs:74` 对畸形 URL `decodeURIComponent` 未捕获 URIError 可击穿预览服务器；`:81` `startsWith(root)` 缺少分隔符可被同名前缀目录绕过（开发工具，非线上面）。
- 【改进】`normalize.ts` 静默兜底 → 构建期收集并打印（并入 #68）。
- 【良好】预加载有 3.2s 竞速超时、`sessionStorage` 二次访问快进、字体/图片 decode 失败均兜底；WebGL 加载失败回落抠图（PhoneBoothModel.tsx:70-76）。

### 7.2 安全

- 【已清零】历史 P0/P1（SVG 上传 XSS #5、TLS #6、会话 #20、JSON-LD 注入 #14/#58）在纯静态形态下**攻击面不存在**（无上传、无服务端、无凭据；JSON-LD 两处均 `\u003c` 转义，实测确认）。
- 【风险（低）】内容字段直出 `mailto:`/`tel:`/`href`（contact.credit.url 等）——内容源是仓库文件（作者自控），非用户输入，不构成实际注入面；若未来启用「Git 内容后端 PR 表单」（ROADMAP P2）需重新评估。
- 【改进】CI 无 `npm audit` 门禁（#65）；GitHub Actions 未固定 action SHA（供应链加固建议，附于 #65）。

### 7.3 架构

- 【良好】分层清晰、依赖单向、three 按需加载、内容契约单一入口。
- 【改进】#22 设计系统空心化：Tailwind 死依赖（实测确认）与手写 CSS 双轨；设计令牌仅 `--accent/--stage` 等少数几个，主题色 `#e55139` 在 `work-detail.css:20` 等处硬编码（#11/#22）。
- 【改进】`normalize.ts` 遗留 `works.items[].detailItems` 死字段（附于 #68 清理项）。

### 7.4 UI/UX（含无障碍）

- 【BUG】#3 作品行无法到达详情页、键盘 Enter/Space 无动作（构建产物证实，P0）。
- 【BUG】#53 视频无法点击播放（层叠+断电时序，静态推断链完整）。
- 【缺口】#61 动效不可完全关闭（reduced-motion 半覆盖）；#18 行语义（`<li tabindex=0>` 无 role/无动作）、TV 状态无播报、视频无键盘操作。
- 【风险】#80 语言/resize 闪烁重播（高频交互路径，视觉体验直接可感）。
- 【缺口】#75 未知 URL 落 Next 默认 404，无站内导航/本地化；#12 语言切换不进 URL、无 hreflang、详情页永远显示默认语言（works/[id]/page.tsx:31,62 实测）；#54 深链锚点失步。
- 【良好】focus-visible 全局描边、aria-pressed/aria-current/aria-label 齐全、双语密度对等、触屏与精细指针两套交互路径、固定画框防版式抖动（CLS=0 的设计基础）。

### 7.5 性能

- 【风险】#76 滚动热路径 `elementFromPoint` 同帧布局读取 + 跑马灯 tween churn（代码证实）；#66 22 处 `will-change` 常开（实测计数 22，Issue 写 23 需修正）。
- 【风险】#63/#77 hero 源图 1.98 MB PNG 直出为 `src` 兜底与 og:image（分享场景下载 2 MB）。
- 【良好】three 2.2 MB 延迟 1.5 屏预载、离屏/隐藏暂停（#50 的竞态除外）；图片管线 3 档 WebP + sizes 实测值；smoke 校验 Brotli；`out/` 12 MB（gltf 2.2 + images 7.2）。
- 【推断】`booth.ts:382` ResizeObserver 全量 silhouette 重取景（13×7 二分投影）无节流——真实窗口拖拽时每帧数 ms，**移动端 URL 栏收放不会触发**（`--booth-h` 基于 `svh`，尺寸稳定——见 §10 被证伪判断）。

### 7.6 测试

- 【缺口】#10（重定义版）：smoke/test:tv-assets 覆盖「静态导出可用性」，但**内容管线（normalize/published.json）零测试**（#51 正因此静默存活）、动效状态机零测试（#49 只能人工复现）、无浏览器级 UI 测试（无 Playwright）。
- 【良好】smoke 设计质量高（软 404、子路径、分享图、编码逐项验证），是全仓最好的测试资产。

### 7.7 CI/CD

- 【良好】verify job：typecheck + lint + tv 几何 + dev-server 探活 + **根/子路径双构建双冒烟**，再 build/deploy Pages；`.nojekyll` 正确；并发组防重。近 8 次运行全绿（实测 `gh run list`）。
- 【风险】`concurrency: cancel-in-progress: true` 覆盖 deploy job——连续两次 push 可能取消进行中的 Pages 部署（GitHub 通常自愈，偶发需手动重跑；附于 #65 的 CI 加固项）。
- 【缺口】无 audit 门禁、无 Lighthouse 预算门禁（ROADMAP 已列）、无产物体积守门（ROADMAP 已列）。

---

## 8. 问题索引与 GitHub Issues

### 8.1 本次核实的问题总表（按优先级）

| 优先级 | 问题 | Issue | 验证方式 |
|---|---|---|---|
| P0 | 作品列表无法跳转详情页，/works/[id] 成孤岛 | [#3](https://github.com/BrainEno/BrainEno.github.io/issues/3) | 构建产物 grep=0（已证实） |
| P1 | published.json 包装格式被静默丢弃 | [#51](https://github.com/BrainEno/BrainEno.github.io/issues/51) | 运行时复现（已证实） |
| P1 | 预加载遮罩 JS 失败即黑屏 | [#60](https://github.com/BrainEno/BrainEno.github.io/issues/60) | SSR HTML + 无 noscript（已证实） |
| P1 | reduced-motion 半覆盖 | [#61](https://github.com/BrainEno/BrainEno.github.io/issues/61) | 源码控制流（已证实） |
| P1 | 视频无法点击播放 | [#53](https://github.com/BrainEno/BrainEno.github.io/issues/53) | CSS 层叠 + 时序链（静态推断，链完整） |
| P2 | CRT 快速换台 stale-commit | [#49](https://github.com/BrainEno/BrainEno.github.io/issues/49) | 源码控制流（已证实） |
| P2 | 语言/resize 编排重建闪烁 | [#80](https://github.com/BrainEno/BrainEno.github.io/issues/80) | 源码控制流（已证实） |
| P2 | 电话亭加载/可见性竞态 | [#50](https://github.com/BrainEno/BrainEno.github.io/issues/50) | 源码控制流（待浏览器验证） |
| P2 | 滚动热路径布局读取/tween churn | [#76](https://github.com/BrainEno/BrainEno.github.io/issues/76) | 源码（已证实，帧率影响待测） |
| P2 | 锚点失效 + 断点失步 + 电话亭侵入 | [#54](https://github.com/BrainEno/BrainEno.github.io/issues/54) | 断点差异已证实；锚点/侵入待真机 |
| P2 | 详情页重复图 5/5 | [#74](https://github.com/BrainEno/BrainEno.github.io/issues/74) | defaults 比对（已证实） |
| P2 | 404 页无站内设计 | [#75](https://github.com/BrainEno/BrainEno.github.io/issues/75) | 构建产物（已证实） |
| P2 | 构建期无内容校验 | [#68](https://github.com/BrainEno/BrainEno.github.io/issues/68) | 源码（已证实） |
| P2 | SW 缓存桶错位/接管风险 | [#55](https://github.com/BrainEno/BrainEno.github.io/issues/55)/[#19](https://github.com/BrainEno/BrainEno.github.io/issues/19) | 源码（静态推断） |
| P2 | preview.mjs URIError/路径绕过 | [#62](https://github.com/BrainEno/BrainEno.github.io/issues/62) | 源码（已证实） |
| P2 | 产物卫生（RSC txt/hero PNG） | [#63](https://github.com/BrainEno/BrainEno.github.io/issues/63) | 构建产物计数（已证实，描述需修正） |
| P2 | 文档漂移 7 处 | [#64](https://github.com/BrainEno/BrainEno.github.io/issues/64) | grep 逐处（已证实） |
| P2 | 依赖漏洞/死依赖/无门禁 | [#65](https://github.com/BrainEno/BrainEno.github.io/issues/65) | npm audit + grep（已证实） |
| P2 | 合成层/will-change 常开 | [#66](https://github.com/BrainEno/BrainEno.github.io/issues/66) | grep=22（数量需修正） |
| P2 | 设计系统空心化 | [#22](https://github.com/BrainEno/BrainEno.github.io/issues/22) | grep（已证实） |
| P2 | 多语言架构 | [#12](https://github.com/BrainEno/BrainEno.github.io/issues/12) | 源码（已证实） |
| P3 | og:image 1.98 MB + dateCreated 非 ISO | [#77](https://github.com/BrainEno/BrainEno.github.io/issues/77) | 文件尺寸 + 源码（已证实） |
| P3 | generate-art.mjs 与素材脱节 | [#56](https://github.com/BrainEno/BrainEno.github.io/issues/56) | 脚本输出名比对（已证实） |

（另 #11/#13/#16/#17/#18/#26 为部分完成项，见 §8.3。）

### 8.2 本次新登记 Issue：**0 条**

按「合并重复、不追求数量」原则，对本次全部经证实的发现做了与现有 46 条开放 Issue 的逐条映射（§8.1），**没有产生既有 Issue 未覆盖的新根因**，因此未创建任何新 Issue。两个接近「新登记」线的观察降级为报告记录：

1. `three/booth.ts` `dispose()`（:495）释放几何/材质但不释放贴图（glTF map 与 CanvasTexture 铭牌）——仅影响卸载/HMR 场景，单页站实际不触发，不值得独立 Issue。
2. `booth.ts:382` ResizeObserver 重取景无节流——影响面限于桌面拖拽窗口（移动端 `svh` 尺寸稳定），并入 [#76](https://github.com/BrainEno/BrainEno.github.io/issues/76) 的性能验收即可。

⚠️ **重复登记提示**：[#79](https://github.com/BrainEno/BrainEno.github.io/issues/79) 与 [#80](https://github.com/BrainEno/BrainEno.github.io/issues/80) 标题相同、根因相同，且 #79 正文损坏（代码块丢失、验收标准粘入构建日志）。建议**关闭 #79、保留 #80**。

### 8.3 开放 Issue 清理（46 条，逐条对照最新代码）

#### A. 建议关闭 —— 已不适用/已修复（13 条）

| # | 结论 | 证据 |
|---|---|---|
| [#4](https://github.com/BrainEno/BrainEno.github.io/issues/4) | 不适用 | `server/*`、`api/*`、`db/*`、`drizzle.config.*` 均已不在仓库（`git ls-files` 实测）；残余文档漂移由 #64 承载 |
| [#5](https://github.com/BrainEno/BrainEno.github.io/issues/5) | 不适用 | 无上传接口/文件写入，存储型 XSS 输入通道不存在 |
| [#6](https://github.com/BrainEno/BrainEno.github.io/issues/6) | 不适用 | 无 `pg`/连接串/TLS 配置 |
| [#7](https://github.com/BrainEno/BrainEno.github.io/issues/7) | 不适用 | JSONB/DB 已删；残余「40 项静默截断」并入 #68 验收 |
| [#8](https://github.com/BrainEno/BrainEno.github.io/issues/8) | 不适用 | Demo/Live 双模式随 `/admin` 删除 |
| [#9](https://github.com/BrainEno/BrainEno.github.io/issues/9) | 重复 | 与 #65 同根因，#65 数字为最新实测（1c/2h/14m） |
| [#14](https://github.com/BrainEno/BrainEno.github.io/issues/14) | 已修复 | `page.tsx:14`、`works/[id]/page.tsx:78` 两处 JSON-LD 均 `\u003c` 转义（源码+产物实测） |
| [#15](https://github.com/BrainEno/BrainEno.github.io/issues/15) | 不适用 | 无 DB/连接池；构建失败即 CI 红 |
| [#20](https://github.com/BrainEno/BrainEno.github.io/issues/20) | 不适用 | 无登录/会话/密钥 |
| [#21](https://github.com/BrainEno/BrainEno.github.io/issues/21) | 不适用 | DDL/drizzle/wrangler 已删；字体 @fontsource 自托管（layout.tsx:14-17） |
| [#23](https://github.com/BrainEno/BrainEno.github.io/issues/23) | 大体已修复 | 语言改 `useSyncExternalStore`（Portfolio.tsx:187-188）；eslint 0 error；残留 effect-setState 均为事件驱动的合法用法。建议关闭，若需留痕并入 #10 新定义 |
| [#24](https://github.com/BrainEno/BrainEno.github.io/issues/24) | 不适用 | `/admin`、`portfolio/admin`、`portfolio/client` 全删 |
| [#25](https://github.com/BrainEno/BrainEno.github.io/issues/25) | 不适用 | 无服务端可观测性对象；构建期诊断缺口由 #68 承载 |

#### B. 建议合并/重写后再议（7 条，先别关）

| # | 处理建议 | 依据 |
|---|---|---|
| [#79](https://github.com/BrainEno/BrainEno.github.io/issues/79) | **关闭**（损坏重复件） | 与 #80 同根因同标题，正文损坏 |
| [#55](https://github.com/BrainEno/BrainEno.github.io/issues/55) | 并入 [#19](https://github.com/BrainEno/BrainEno.github.io/issues/19) | 同一 SW 缓存根因（`at("/offline")` 无尾斜杠 + icons 落错缓存桶 + skipWaiting 接管） |
| [#63](https://github.com/BrainEno/BrainEno.github.io/issues/63) | 重写 | RSC `.txt` 是客户端导航载荷（实测 61 个/多页），不是垃圾应删除的对象；hero PNG 直出部分仍成立 |
| [#66](https://github.com/BrainEno/BrainEno.github.io/issues/66) | 重写 | `will-change` 实测 22 处（非 23）；`.tv-box` 已按设计移除常驻 will-change（portfolio.css:723 注释）；清单需按现行 CSS 更新 |
| [#10](https://github.com/BrainEno/BrainEno.github.io/issues/10) | 重定义 | 「没有测试/CI/6 个 lint error」已不成立（CI 全绿实测）；真实缺口=内容管线与动效状态机零测试（§7.6） |
| [#54](https://github.com/BrainEno/BrainEno.github.io/issues/54) | 正文更正 | 第 2、3 条与字号探针描述已与代码不符（Contact 改为 CSS 共享尺寸变量，无 JS 探针）；锚点失效与 768/1023 断点失步仍成立 |
| [#17](https://github.com/BrainEno/BrainEno.github.io/issues/17) | 重定义 | 「仅 767px 一个断点」前提失效（实有 1023px + `(max-aspect-ratio: 11/10)` + 767px 三档）；遗留真问题=断点与 GSAP 失步（并入 #54） |

#### C. 部分完成 —— 保留但收窄范围（6 条）

| # | 已完成 | 仍需工作 |
|---|---|---|
| [#11](https://github.com/BrainEno/BrainEno.github.io/issues/11) | 详情页已有 wd 壳/返回链/主题字体 | 主题色硬编码 `#e55139`（work-detail.css:20）、语言不跟随首页（page.tsx:31,62 用 defaultLanguage）、无站内导航 |
| [#12](https://github.com/BrainEno/BrainEno.github.io/issues/12) | `useSyncExternalStore` 已消除水合闪烁 | 语言不进 URL、无 hreflang、SSR 只出默认语言、`<html lang>` 客户端改写仍在 |
| [#13](https://github.com/BrainEno/BrainEno.github.io/issues/13) | srcSet/width/height/priority 全部落地（Img.tsx） | 仅剩「详情页 4:3 裁切」为**有意设计**（work-detail.css:27 注释）——接受则关，不接受则改需求 |
| [#16](https://github.com/BrainEno/BrainEno.github.io/issues/16) | description/detailImages/video/url 已入模型 | 缺标签/技术栈、多链接、排序、发布状态、图片适配方式 |
| [#18](https://github.com/BrainEno/BrainEno.github.io/issues/18) | focus-visible、aria-label/pressed/current 齐全 | 行语义（#3）、视频键盘（#61）、TV 状态播报、动效完全关闭 |
| [#26](https://github.com/BrainEno/BrainEno.github.io/issues/26) | lastmod 已取快照 exportedAt、OG 有图、无 force-dynamic | keywords 残留（无害）；无快照时 lastmod 回退构建时间（并入 #51） |

#### D. 必须保留（真实问题，16 条）

#3 · #49 · #50 · #51 · #53 · #56 · #60 · #61 · #62 · #64 · #65 · #68 · #74 · #75 · #76 · #77 · #80（17 条，含 #80）；其中 **#3 / #51 / #60 / #61 / #53 为最高优先**。

> 本报告只提出关闭/合并建议，未改动任何 Issue 状态（任务约束）。

---

## 9. 推荐开发顺序与依赖

```
第 1 批（P0/P1 体验完整性）
  #3 作品行→详情页（含键盘语义）──依赖──► #74（详情页重复图，同页面顺手修）
  #51 快照解包修复 ──同批──► #68（构建期内容校验，防再犯）
  #60 预加载层降级（noscript/超时兜底）   #61 reduced-motion 补全
第 2 批（动效交互正确性，本审查关注域）
  #49 CRT 状态机（建议加 hover-intent 防抖，一举两得）──► #53 视频可点击/可键盘
  #80 编排生命周期（reveal 终态保护/局部刷新，可选 View Transitions）
第 3 批（性能与布局）
  #76 热路径布局读取 + 跑马灯 tween（吸收 booth 重取景节流）
  #54 锚点 + 断点统一（768/1023 对齐）   #66/#63（清单重写后执行）
第 4 批（工程收尾）
  #19+#55（SW 合并治理）  #75（404 页）  #62（preview 加固）  #65（依赖+audit 门禁）
  #77（og:image/dates）  #64+#56（文档与脚本对齐）  #22（设计系统）  #12/#11/#16/#18（收窄后按需）
```

依赖关系：#74 依赖 #3 的详情页改造一并落地；#68 依赖 #51 先定契约；#53 的验收依赖 #49 状态机修复；#54 的断点统一影响 #76 的测量代码。

---

## 10. 审查边界、未验证事项与被证伪的判断

**未验证（沙箱无浏览器）**：帧率/滚动流畅度、锚点落点、真机 iOS Safari/Android Chrome 表现、电话亭拖拽手感、CRT 玻璃高光强度、Lighthouse 分数。上述一律标注「待实测」，Issue 中亦注明复现方法。

**外部环境限制**：仓库为浅克隆（`git rev-list --count HEAD` = 1），无法逐行 blame；并发会话活跃（审查期间 #1/#2 被关闭、#79/#80 被创建），本报告以 2026-11-03 06:50 UTC 后的 Issue 快照为准。

**被证伪/修正的初始判断**（主动更正，不保留错误结论）：

1. **「电话亭 ResizeObserver 会在移动端 URL 栏收放时反复重取景导致滚动掉帧」——证伪**。`--booth-h: min(56svh, 88vw)`（portfolio.css:1386）用的是 `svh`（最稳视口高度），宿主尺寸不随 URL 栏收放变化；重取景只在真实 resize/旋转时触发。修正后仅保留「桌面拖拽 resize 时节流可取」的轻微判断（并入 #76）。
2. **「CRT 快速切换会卡在动画中间态」——修正**。复核 #49 与 TvShowreel.tsx:95-117 的真实顺序后确认：早退发生在 kill **之前**，旧时间线会正常播完并 commit 旧目标（画面与选中行错位），而非卡中间态。#49 的原描述是准确的，本报告采纳其机制。
3. **「tv-frame-alpha 的 sizes（295vh/185vw）严重失准」——修正**。虽源自旧裁切方案，但电视图 OVERRIDES 只有 1280/1536 两档，实际显示宽度（约 150svh）与 1536 档匹配，超大的 sizes 只是恒选最大档，浪费有限，不构成独立问题。

---

## 11. 工作记录（可审计摘要）

### 11.1 工具、接口与命令

- **本地**：`git`（log/rev-parse/status/ls-files）、`bash`、`npm ci / run typecheck|lint|test:tv-assets|build:static|smoke|dev`、`npm audit`、`node`（tsc 编译 normalize.ts 做运行时复现）、`grep/sed/wc/du/find`、`curl`（dev 探活）。
- **GitHub**：`gh issue list/view`、`gh pr view/diff`、`gh run list`（未创建/修改/关闭任何 Issue 与 PR——任务约束；§8 仅提建议）。
- **审查专用工具**：Arena Agent Mode 文件读写（read_file/write_file/edit_file）、网页检索（fetch_page/web_search，仅用于核对 GitHub 页面内容）。

### 11.2 阅读的核心文件与调用链

全量精读：`content/{types,source,normalize,defaults}.ts`、`ui/{Portfolio,sections,TvShowreel,Img,PhoneBoothModel}.tsx`、`scroll/choreography.ts`、`three/booth.ts`、`seo/{site,asset}.ts`、`app/{layout,page,works/[id],offline,manifest,robots,sitemap}`、`public/sw.js`、`scripts/{smoke,preview,build-static,build-images,test-tv-assets,tv-glass,art/generate-art}`、`static.yml`、`next.config.ts`、`package.json`、四份 docs。
重点调用链：作品行→preview→TvShowreel 状态机；Preloader→HeroEntrance→ScrollSmoother→choreography 四幕；IntersectionObserver→booth 挂载/暂停；published.json→normalize→SSR→静态产物。

### 11.3 验证方式归属

- **执行验证**：§4 全部命令 + #51/#3/#74/#60/#65 的运行时复现。
- **源码验证（静态推断）**：#49/#50/#53/#61/#76/#80 的控制流与时序（行号均可复查）。
- **外部接口验证**：CI 近况（gh run list）、Issue 状态快照。

### 11.4 环境信息

| 项 | 值 |
|---|---|
| 模型提供商/模型 ID | **未知**（Arena.ai Agent Mode 不暴露具体模型 ID；该框架使用多种模型） |
| Agent/执行框架 | Arena.ai Agent Mode（版本号未暴露 → 未知） |
| 可用工具 | 终端（bash，Node v22.22.3 / npm 10.9.8）、文件系统读写（仓库内）、git/gh（GitHub 读写已配置）、进程管理、图片生成/搜索、网页抓取 |
| 推理模式 | **未知**（未暴露推理配置） |
| 网络 | 仅 GitHub / npm / PyPI 白名单出口 |
| GitHub 权限实况 | push/issue 读可用；本任务按约束未写 Issue；另一并行会话报告 issue close/comment 返回 403（无法独立复核，标注为转述） |

### 11.5 最重要的三个技术判断（及证据）

1. **内容管线存在两套互相矛盾的契约，按官方文档操作会静默丢失全部内容**（P1）——证据：`source.ts:38-39` 不解包 + `normalize.ts#coerce` 吞未知键，运行时复现「WRAPPED-MARKER 被丢弃/裸格式生效」（§4）。这是「文档写什么就信什么」的用户必然踩中的坑。
2. **详情页在站内不可达，SEO 与产品路径断链**（P0）——证据：构建产物 `href="/works/` = 0；`sections.tsx:245-251` 行元素无链接/无键盘动作；5 个 SSG 页面仅 sitemap 可达。作品集的核心转化路径（看作品→进详情）缺失。
3. **动效系统的「生命周期」而非「动画本身」是体验风险的最大来源**（本审查关注域）——证据：#80（lang/resize 全量 revert 重播）、#49（早退不杀旧时间线）、#61（reduced-motion 半覆盖）、#76（帧开销）四者共享同一层基建（`setupChoreography` + `TvShowreel` effect + `mm.revert`）；先治理生命周期，再谈动画细节打磨，是投入产出比最高的路径。

---

*报告生成：2026-11-03 · 审查分支 `arena/9ed8e4c5-braineno-github-io` · 基线 `721a023` · 未改动业务代码*
