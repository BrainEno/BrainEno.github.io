# 发布与内容协作指南（publishing-guide）

这份文件回答一个问题：**这个静态站的内容从哪来、怎么改、改错了会怎样**。不涉及审美，只讲这条管线的形状。

## 内容从哪来

整站是 `output: "export"`：构建时读取仓库里的内容文件，产出一个 `out/` 文件夹，任何静态主机都能直接挂出去。

- 没有快照时，构建用 `src/portfolio/content/defaults.ts`——仓库里写好的默认值。
- 有快照时，构建用 `src/portfolio/content/published.json`——由内容侧导出、写进仓库的副本。结构两种都接受（[#51](https://github.com/BrainEno/BrainEno.github.io/issues/51)）：

  ```json
  // 包裹形式（推荐，带导出时间戳，sitemap.xml 首页的 lastmod 从这里来）
  { "exportedAt": "2026-11-16T00:00:00.000Z", "content": { "version": 2, "identity": { ... }, ... } }

  // 裸内容（向后兼容）
  { "version": 2, "identity": { ... }, ... }
  ```

改内容就改这两个文件其中一个，然后 `npm run build:static` —— **部署本身就是编辑器**。`/admin` 路由不存在，也不应该存在：静态站既没有会话来保护，也没有地方来保存请求；浏览器里的“工作室”只会是一个界面模拟。

## 修改之前：本地校验

```bash
npm run test:content     # 单元测试：快照解包、超大字段警告、默认值必须干净
npm run typecheck
npm run lint
npm run build:static && npm run smoke   # 跑完和 CI 等价
```

`test:content`（[`scripts/test-content.mjs`](../scripts/test-content.mjs)）不需要编译：Node 22 会剥掉内容目录里的类型标注，一个极小的解析钩子把扩展名补全（详见文件头部注释）。

## 构建时的内容检查（#68）

`getSiteContent()` 在读取时做两类事情，结果都打到构建日志里：

- **`[content:warn]`** —— 结构不合理但还能渲染。包括：要回退的重复 work id（位置也一并指出，例如 `works.items[3].id`）、被截断的超长字符串（6000 字符上限）、超出 40 条的列表、指向 `public/` 里不存在文件的媒体路径、把封面图重复塞进 `detailImages`（[#74](https://github.com/BrainEno/BrainEno.github.io/issues/74)，渲染端只展示一次，但内容应自己清干净）、不认识的 `defaultLanguage`。
- **`[content:error]`** —— `published.json` 不可读或形状完全不认识。此时构建继续，但明确回退到 `defaults.ts`，并说明原因。**没有报错没有警告的静默失败从此不存在了。**

所有 issue 都带内容路径（如 `works.tv.src`、`works.items[2].detailImages[0]`），方便定位；CI 里 run `--run npm run test:content` 跑同一套逻辑，保证默认值本身零警告。

## 详情页的 `dateCreated`

`works[].year` 是给人看的标签（`"2026.04.22"`、`"2026"`、`"—"` 都可以），JSON-LD 的 `dateCreated` 需要的是机器可读的 ISO 8601。详情页在输出前做归一化（[#77](https://github.com/BrainEno/BrainEno.github.io/issues/77)）：

- `"2026.04.22"` → `"2026-04-22"`
- `"2026"` → `"2026"`
- 其它（`"—"`、空串）→ 字段从 JSON-LD 里省略，而不是吐一个解析器咽不下去的值

## 路由的样子

- 首页 `/`：频道式的作品列表。悬停/聚焦一行调台预览，点击整行把该作品放进电视机剧场放大播放（行的覆盖控件是一个真正的 `<button>`，键盘可达）。**行不导航**——作品详情页只经直接 URL 访问，首页交互保持调收音机式的原地播放。
- `/works/<id>/`：作品详情页，从 `generateStaticParams` 出来——`published.json` 里的每一个 work id 都会有独立 HTML 文件，不需要 JS 就能读。
- 其它所有路径：静态主机下发的 `404.html`（[#75](https://github.com/BrainEno/BrainEno.github.io/issues/75)），中英双语，两个链接回首页 / 到作品区，`robots` 里 `noindex`。

## 没有 JavaScript 的时候

静态导出的每一页在没有任何 JS 的情况下都可读：作品列表是 `<ol>/<li>` 加 `<a>`，详情页是纯文本。几个体验细节是靠 JS 叠上去的——以及**它们全都允许 JS 缺席**：

- 开屏的 `preloader`（[#60](https://github.com/BrainEno/BrainEno.github.io/issues/60)）由 `documentElement.classList.add("js")` 门控——`<html>` 上没这个类，CSS 直接把整块盖层 `display:none`。脚本失败时用户落到的是真内容，不是一片黑。
- 首页作品行的剧场播放依赖 JS；但每个作品详情页是纯静态文本，`/works/<id>/` 的直接链接与 sitemap 不依赖任何脚本。
- 404 页的两个回退链接同样是无 JS 可用的 `<a>`。

作品详情有实质修改时，可以在对应的 `works.items[]` 对象中维护 `"updatedAt": "2026-11-20"`，或填写带时区的 ISO 时间戳。只更新实际修改的作品；历史日期未知就不填。旧快照无需迁移。
