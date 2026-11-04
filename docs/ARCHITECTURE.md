# 架构说明与本轮重构记录

## 1. 形态：只有静态导出

站点现在**只有一种形态**：`npm run build:static` 产出 `out/`，任何静态托管都能跑。
上一版还保留过「服务端 + PostgreSQL CMS」的分支，两条路要走两套心智、两套部署、两套安全面，
而这一版的产品需求（个人作品集、内容变化不频繁）完全不需要请求时读库。于是整条服务端链路被删掉了：

| 删掉的东西 | 为什么 |
|---|---|
| `src/portfolio/server/*`（连接解析、存储、鉴权、会话、备份、状态） | 只有静态站，没有请求时可写的地方 |
| `src/app/api/*`（content / media / session / backup / status / health） | 同上；`output: "export"` 也装不下 route handler |
| `src/db/*`、`drizzle.config.*`、`netlify/database/`、迁移 SQL | 没有数据库 |
| `pg`、`drizzle-orm`、`@netlify/database`、`@opennextjs/cloudflare`、`wrangler` | 依赖少了 5 个，安装体积和攻击面一起下降 |
| `Dockerfile`、`docker-compose.yml`、`deploy/`、`scripts/{setup,deploy,vps-install,doctor}.sh` | 不再需要跑一个进程 |
| `export/react-router/`（第二份工程）、`/adam` 只读路由、`admin/Login.tsx` | 重复入口；静态站没有「登录」这回事 |
| `docs/{DEPLOY,PLATFORM_DEPLOY,NETLIFY_DEPLOY,SETUP}.md` | 并入 `STATIC_EXPORT.md` / `QUICKSTART.md` |
| `netlify.toml` | 只部署 GitHub Pages，配置由 `.github/workflows/static.yml` 承担 |
| `/admin` 路由、`portfolio/admin/*`、`portfolio/client/*`、`admin.css`、`content:export` 脚本 | 静态站没有可写的地方，浏览器内的编辑器只是模拟器（见第 2 节） |

保留并强化的部分：`src/portfolio` 作为与路由解耦的领域模块、`content/` 作为唯一内容契约、
`public/sw.js` 离线缓存、SEO/PWA 全套。

## 2. 当前结构与数据流

```
浏览器 ── / ──► page.tsx ─ getSiteContent() ─► content/published.json  （有就用）
                                              └─ content/defaults.ts    （没有就用）
                              └► Portfolio(content)   ← 内容就是构建时的那一份，没有任何运行时覆盖
```

- **内容来源**：`content/source.ts#getSiteContent()` 是唯一入口，`node:fs` 读构建期快照，
  读不到就退回 `defaults.ts`。没有数据库分支，也没有客户端草稿覆盖——访问者看到的就是构建出来的那一份。
- **发布**：改 `published.json`（或 `defaults.ts`）→ 提交 → CI 重新导出。部署即发布。
- **没有 `/admin`**：静态站没有会话可保护、没有接口可写，浏览器内的「编辑器」只能是个模拟器：
  改动存本地、再由用户手动导出文件提交。既然发布本来就是提交一个文件，那一步就没必要多一层。
  于是 `/admin` 路由与整套 `portfolio/admin/*`、`portfolio/client/*` 一并删除（约 1,300 行）。
  内容出错时由 TypeScript 在 `types.ts` 上兜底，而不是由表单校验兜底。

## 3. SEO

- `layout.tsx`：`metadataBase`、title 模板、description、Open Graph / Twitter 卡片（分享图统一经 `seo/site.ts#absoluteUrl()` + `seo/asset.ts#asset()` 补齐子路径前缀）、`lang`（随默认语言 zh-Hans / en）、robots、canonical、`themeColor`。
- `page.tsx`：JSON-LD（WebSite + Person + 每个作品 CreativeWork）；内容经 SSR 输出，爬虫无需执行 JS 即可读取全部文案。
- `/works/[id]`：每个作品独立可收录页面（标题、详情介绍、详情图、BreadcrumbList）。
- `robots.txt`、`sitemap.xml`（含全部作品页）、`manifest.webmanifest`、`icon.svg`、`apple-icon.png`——均由构建期内容生成。
- `/offline` 设为 noindex / Disallow。
- 站点 URL 在**构建期**定死（`NEXT_PUBLIC_SITE_URL` → `SITE_URL` → 平台注入变量 → localhost，见 `seo/site.ts`），
  静态托管没有请求时的 Host 可读。
- `sitemap.xml` 的 `lastmod` 取 `published.json` 的 `exportedAt`，而不是构建时间，否则每次部署都等于「全站更新」。

## 4. PWA / 离线

`public/sw.js`（无构建依赖）：

| 请求 | 策略 |
|---|---|
| `_next/static`、`images`、`fonts`、`icons`、`gltfs` | cache-first |
| 页面导航 | network-first → 缓存副本 → `offline` |
| manifest | network-first，离线读缓存 |
| 非 GET | 不缓存 |

**没有一处写死绝对路径**：GitHub Pages 项目站在 `/repo/` 下，worker 用 `self.registration.scope`
反推出自己的前缀（`BASE`），CORE 列表、静态资源前缀、离线兜底页全部由 `at()` 拼出来。
`PwaRegister` 同时把脚本地址和 scope 都带上 `BASE_PATH`——注册在源站根目录的 worker 会 404，
而且万一存在会接管整个 `*.github.io` 域（包括别人的项目）。实测：scope 是
`/repo/`、缓存键全部带前缀、断网刷新仍能从缓存打开首页。

`PwaRegister` 仅在生产构建注册；开发模式反而会注销旧 SW。manifest 提供 192/512/maskable 图标
与快捷方式，可安装为桌面应用（`id`/`start_url`/`scope`/icons 都带部署前缀，否则装上去会打开站根）。
更新缓存：修改 `sw.js` 的 `VERSION`。

## 5. 图片「画框」约定（换图不用管尺寸）

Hero、肖像、画廊、两张点缀图、电视封面、作品详情页的所有图片都放在**设计固定尺寸的容器**中，
`<img>` 绝对定位铺满、`object-fit: cover`、`max-width: none`，容器带 `overflow:hidden; contain: layout paint`。
因此任意比例/像素的新图都只会被裁切，不会改变容器尺寸、不会触发回流，GSAP 时间线的测量值不变。
电话亭改为 WebGL 模型（见第 6 节），模型未就绪时用透明抠图 `/images/phone-booth-cutout.png` 兜底，`object-fit: contain`。

**响应式尺寸**：静态导出没有图片优化服务，`public/` 里是什么、访客就下载什么。所以
`scripts/build-images.mjs`（`npm run images`，`build:static` / `dev` 之前自动执行）会把
`public/images/**` 压成 480 / 800 / 1200 三档 WebP，写进 `public/images/opt/`，同时生成
`src/portfolio/content/image-manifest.json`；`ui/Img.tsx` 按清单给每个 `<img>` 挂
`srcSet` + `sizes`（`sizes` 是各版面实测的 vw 值，见组件调用处）。两条例外：`.webp` 源
（也就是被换成照片的电视图）同样进管线；`tv.webp` 用 `OVERRIDES` 里单独的一档
（1280/1920/2560，q76）——它的 `sizes` 不是视口宽度，而是 `max(160vw, 230vh)`。三条不变量：

1. `src` 永远是真实文件——清单没跟上、浏览器不支持 `srcSet`、图被删掉，都只是"没有优化"，不会 404/空白；
2. 不包 `<picture>`——`.story-photo-mask img`、`.tv-frame` 这类选择器，以及 flex 几何，都要求 `<img>` 自己就是那个盒子；
3. 清单是提交进仓库的生成物，脚本按 mtime 增量跳过，几十毫秒就跑完。

**指针水波**：`ui/Img.tsx` 默认给非装饰图片挂 `data-water="true"`；`hidden` 图片默认排除，
可用 `water="subtle"` / `water="strong"` 显式开启，`water={false}` 始终关闭。Hero 主图使用
`"subtle"`（幅度 0.7），两条仍标记为装饰图的 `.hero-bar-image` 显式使用 `"strong"`（幅度 1.15）；
默认档幅度为 1。`ui/WaterHover.tsx` 在全页复用**一个**惰性创建的 canvas/WebGL context，同一时刻
只画一张图；方向拖动、较宽的波纹和较弱的后方 wake 共用衰减中的速度与强度，不替换原图，也不增加色差。
它只在 `(hover: hover) and (pointer: fine)` 且未开启 `prefers-reduced-motion` 时运行；纹理取自该 `<img>`
已经加载好的 `currentSrc`（经离屏 2D canvas 按 `object-fit` / `object-position` 裁好），图层每帧同步
原图的 position、尺寸、margin、transform、圆角与裁切，所以能跟着 Hero 视差、画廊横向位移与 coda 漂移走。
指针离开或页面滚动后，canvas 随波纹衰减移除；标签页隐藏或组件卸载时立即清理，空闲时没有 RAF。
`.tv-frame`、`.tv-frame-alpha` 等电视图层、视频、CRT 层和电话亭 canvas 都不带标记——电视合成层不会叠第二套扭曲。

**电视图的分层**：未选中作品时只显示完整的 `tv.webp`。选中作品时，项目画面和雪花
铺在 `works.tv.screen` 矩形内，外扩覆盖 `tv-alpha.webp` 的透明开口；抠好的电视图放在
画面上层，边缘由真实 alpha 决定，不再使用猜测的圆角或混合模式。整个预览层通过透明度
切换，离开作品或进入联系方式时还原原图。照片保持原生比例居中，左右不再做羽化遮罩；有余量的两侧是干净暗场，
`.tv-box` 只保留必要的下缘遮罩。顶部 `.tv-seam` 继续负责较大范围的天空衔接，单独的 3px seam guard
处理接缝；作品列表出现时的 scrim 改为轻量纵向渐暗。透明图按原尺寸加载，避免缩放生成物损伤边缘。
鼠标悬停或键盘聚焦切换作品；触屏则跟随滚动选择。视频在选中时静音循环播放。

## 6. 转场与 Contact 区动效

**电视留言 → 穿屏 → Contact**（`scroll/choreography.ts#television` 的 `createMessage` / `createDive` + `contact()`）。

1. 作品列表滚过后，电视「开机」：亮点 → 横线 → 整屏展开，第一行 `@BrainEno`（荧光字），第二行
   `nodeman24@outlook.com`（字符发生器等宽小字，逐字打出 + 闪烁光标）。字幕画在 `tv-alpha.webp`
   边框**下面**（`sections.tsx#TvMessage`），带扫描线、荧光辉光、RGB 会聚误差、滚动亮带与玻璃反光；
   字号以屏幕容器单位（`cqi`）计算，任何视口都不会溢出玻璃。留言是**时间驱动**的，不再要求读者滚过
   一整屏静止画面。
2. `#contact` 从底边升到顶边的这段滚动就是转场（没有独立 spacer）：先一下雪花换台，白色联系页出现在
   屏幕里——那就是 `#contact` 本身，被一个矩阵映射进玻璃；随后镜头（`.tv-zoom`）以几何速度推进到
   玻璃铺满视口，页面随之放大并在 `scale 1` 处落地，同时摆正倾角。没有白场、没有交叉淡化、没有副本。
3. `.tv-glass` 在页面仍「在屏幕里」时叠加扫描线与反光，镜头穿过玻璃时淡出。
4. 全部几何每帧实时测量（`coverScale` 求圆角玻璃覆盖视口的最小倍数），任何视口都贴合；`prefers-reduced-motion`
   下不做穿屏，直接衔接。

各 section 之间不再用分隔细线，三个区块统一以 `01 / 02 / 03` 小标题编号；简介区去掉了与小标题重复的大标题。
简介的桌面 pinned 场景里，肖像与文案共用一套 12 列网格（肖像占 2–5 列、文案占 7–12 列，画廊沿用同一套
`--gutter` / `--grid-gap` 节奏），文案因此靠版面定位而不是先 `left: 100vw` 再按语言猜偏移；
平板与手机仍是原来的纵向 flow，不强行保留 pin。肖像只剩一个矩形画框：没有有机圆角、没有重影层，
入场也只保留矩形的 `clip-path` reveal。

Hero 的编号与标题组成同一行网格，三行略向右阶梯递进；coda 桌面构图从场景顶部起排，左侧为文字，右侧用一张竖图与一张较大的横图错位重叠。进入 flow 布局后，coda 显式清除桌面定位，并在文字下方预留图片安全区。

**加载动画**（`ui/Portfolio.tsx#Preloader` + `choreography.ts#createLoader`）：名字像电视画面一样被扫描点亮
（扫描线位置即加载进度，计数器随扫描线移动）→ 信号锁定时 RGB 枪错位 → 白色光栅自上而下翻转 →
镜头穿过 “I” 的竖笔进入首屏。

**Contact 排版**：`.contact` 不再有圆角前沿与上投影，也不做 `overflow: hidden`（电话亭要从 section 边界之外入场）。

**作品区换台（`ui/TvShowreel.tsx`）**：选中作品时以雪花和滚动亮带覆盖屏幕，
在雪花下更换图片或视频，再淡出雪花。快速切换时取消旧时间线，防止过时的画面重新出现；
离开时将预览层淡出回到原图。`prefers-reduced-motion` 下直接切换、不播放雪花。
`npm run test:tv-assets` 检查原图比例及画面矩形是否覆盖 alpha 透明开口。

**电话亭（3D 模型）入场**：从**右下角**抛出、沿一条向上鼓起的弧线落在左上方的静止位，不是对角线位移，也不是从小到大缩放：

- 起点：`x +92vw · y +46vh · rotation 7° · scale .88`（完全在屏幕右下角之外）；
- 第一段（`0→0.32`）`y → +8vh` 而 `x → +62vw`：**纵向先走、横向后走**，弧线因此朝左上鼓出来；
  实测纵向进度在整个飞行里始终领先横向，所以永远看不到两点之间的那条弦；
- 第二段（`0.32→0.82`）`x → 0`（`power1.inOut`）同时 `y → 0`、`rotation → 0`、`scale → 1`，横向在这一段扫完；
- 整条轨迹在 1280×800 上采样（横向/纵向完成度）：`0/0 → .14/.35 → .24/.60 → .33/.82 → .42/.93 → .72/.98 → 1/1`；
- **不再对画布做 `rotationY`**：CSS 3D 旋转会让画布透视压缩，模型看起来「扁平、被挤扁」；
  转动完全交给 WebGL 里的自转（`0.16 rad/s`，约 39 秒一圈，接近参考站的香蕉模型节奏），体积感因此不会丢失；
- 比例 `0.88 → 0.93 → 1`，一路轻轻变大，不出现「从小点放大」的观感。
- 落位见上文第 7 条：画布顶到版面顶部、底座踩在地板线上，是这张纸能给到的最大尺寸。

**模型与渲染**：
- `public/gltfs/telephone.glb` 由 `scripts/optimize-booth-model.py` 从原始 `assets/models/telephone.gltf`（38 MB，buffer base64 内嵌）生成：
  几何原样保留，9 张 2048² PNG 重编码为 baseColor 1024² / normal 1024² / metallicRoughness 512² JPEG，产物约 2.15 MB。
- `ui/PhoneBoothModel.tsx` 在 contact 进入前 1.5 屏时（IntersectionObserver + 动态 `import()`）才加载 `three` 与模型；
  离开视口或标签页隐藏时暂停渲染；加载失败 / 无 WebGL 时回落到抠图。
- `three/booth.ts`：PMREM 房间环境光 + 三点布光（`exposure 0.9`、key 1.85、hemi 0.78、rim 0.85、`envMapIntensity 0.32`，
  比早先版本整体压暗一档，红漆更沉）、按包围盒归一化（脚底 y=0、高度 1）、慢速自转（0.16 rad/s）、
  鼠标拖拽带惯性、`ResizeObserver` 重新取景。GSAP 管外层 `.contact-booth` 的轨迹，渲染器管内层自转，互不打架。
- **取景（不再被画面边缘切掉）**：电话亭是方箱形，转 45° 时投影宽度最大，而不是高度最大。早期按高度取景
  （`FRAME_FILL`）会让箱体在斜角时冲出画布——画布透明、底色是白纸，于是看起来像「被白色切掉一角」。
  现在 `frameCamera()` 会在 0°/15°/…/90° 的偏航角上逐个投影所有网格包围盒的 8 个角点，二分出最小的相机距离，
  使任何角度的 |NDC| 都 ≤ `SILHOUETTE_FILL = 0.97`（四周各留 3% 安全区），并随画布宽高比自适应（手机竖屏重新算）。
  代价是相机比「只看高度」时略远，模型因此按画布尺寸补偿。
- **把电话亭面板上的号码换成邮箱（这一版是真正删掉，不是盖住）**：号码不是贴图，而是四面各一块纯黑、无贴图的字面片
  （加载后名字被 glTF 规范化成 `Text` / `Text001` / `Text002` / `Text003`，扫描条件因此是 `/^Text(\d+)?$/`）；
  它们与门板共面（z-fighting），平时根本不显示，只在模型转到斜角时才从门板与铭牌之间挤出来——这正是上一版「号码穿帮」的原因。
  现在这四块字面片直接 `visible = false`，号码从渲染里消失。铭牌 `retypeLettering()` 在 `stage` 坐标系里为每个面重建一块
  `PlaneGeometry`：法线取「面片中心 − 模型中心」的水平分量并**吸附到主轴**（面片在门板上略偏心，不吸附会歪几度），
  宽度取字面片宽度 ×1.0、高宽比 3.1（正好落进门板凹槽），`MeshBasicMaterial` + `toneMapped:false` 的 `CanvasTexture`，
  沿法线外推 0.6% 防 z-fighting。铭牌挂在 `stage` 而不是字面片下面——否则会跟着父级一起被隐藏。
  已在 0°/90°/180°/270° 四个正对角度上逐帧确认：四面都是完整的邮箱铭牌，任何角度都不再出现旧号码。
  文案取自 `content.email`，后台改邮箱会跟着变。
- `prefers-reduced-motion` 下跳过入场时间线与自转，模型静态显示。

## 7. 已知限制 / 后续

- 内容改动没有图形界面：`published.json` 是 JSON，字段含义见 `docs/QUICKSTART.md` 与 `content/types.ts`。
- 更换电视照片时，需要同时更换与原图构图一致的 `public/images/tv-alpha.webp`，
  并调整 `works.tv.screen` 使矩形覆盖透明开口。仅替换原图会导致预览边框错位。
  `npm run tv-glass` 可绘出矩形辅助检查，照片比例变化时也要复核锚定尺寸。
- 仓库同时保留原始 `telephone.gltf`（38 MB，在 `assets/models/`）与优化后的 `.glb`（2.15 MB，在 `public/gltfs/`），
  只有 `.glb` 参与运行时加载。源文件**必须**留在 `public/` 之外：`public/` 会被原样拷进 `out/`，
  一个运行时从不下载的 38 MB 文件会把每次部署从 6 MB 变成 43 MB。
- 图片清单（`image-manifest.json`）是生成物：换图后没跑 `npm run images` 时，新图仍能显示，只是没有 `srcSet`。
- Aeonik 为商业字体，未随仓库分发；放入本机或自行添加 `@font-face` 源即可，缺省回退 Inter。
