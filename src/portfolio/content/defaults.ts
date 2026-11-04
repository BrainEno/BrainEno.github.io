/**
 * Copyright © 2026 BrainEno. 保留所有权利。
 *
 * 本文件及其包含的代码、设计和逻辑均为 BrainEno 的原创作品。
 * 未经作者明确书面授权，禁止复制、修改、分发或用于其他项目。
 *
 * 授权申请：nodeman24@outlook.com
 * 详见：LICENSE, TERMS.md
 */
import type { PortfolioContent } from "./types";

/**
 * Site content for BrainEno (https://BrainEno.github.io).
 *
 * Used directly by the static build unless `content/published.json` is present
 * to override it. Every field the site renders is spelled out here in both
 * languages (`zh` Simplified Chinese and `en` English) at matching density.
 */
export const defaultContent: PortfolioContent = {
  version: 2,
  identity: {
    name: "BrainEno",
    siteName: { zh: "BrainEno", en: "BrainEno" },
    pageTitle: { zh: "BrainEno", en: "BrainEno" },
    description: {
      zh: "BrainEno — 独立开发者与界面设计师，以工程与审美打磨数字产品。",
      en: "BrainEno — independent developer and interface designer crafting digital products with engineering precision and taste.",
    },
    defaultLanguage: "zh",
  },
  navigation: {
    intro: { zh: "简介", en: "Intro" },
    works: { zh: "作品", en: "Works" },
    contact: { zh: "联系", en: "Contact" },
  },
  hero: {
    headlines: [
      { zh: "前端工程", en: "Web Performance" },
      { zh: "原生应用", en: "Flutter" },
      { zh: "全栈开发", en: "Full Stack" },
    ],
    image: {
      src: "/images/headline.png",
      alt: { zh: "人物主视觉", en: "Portrait artwork" },
    },
  },
  intro: {
    heading: { zh: "简介", en: "Intro" },
    portrait: {
      src: "/images/profilephoto.jpg",
      alt: { zh: "BrainEno 肖像", en: "BrainEno portrait" },
    },
    portraitCredit: { zh: "BrainEno", en: "BrainEno" },
    primaryText: {
      zh: "BrainEno，独立开发者与界面设计师。曾深耕软件工程一线，如今以自由职业 Vibe Coder 的身份独立构建数字产品。他擅长将前沿 AI 能力转化为真正可交付的作品——从视觉语言、动态交互，到前端架构与底层数据，均由一人贯通完成。创作横跨品牌体验站、内容型产品与跨端效率工具，并在开源社区持续维护与公开自己的代码。",
      en: "BrainEno is an independent developer and interface designer. Grounded in software engineering and now working solo as a freelance vibe coder, he turns frontier AI capabilities into shipped digital products — carrying each piece end to end from visual language and motion choreography to frontend architecture and the data layer. His work spans brand experiences, editorial products, and cross-platform tools, alongside open-source repositories maintained in public.",
    },
    gallery: [
      { src: "/images/red2.webp", alt: { zh: "视觉摄影 01", en: "Editorial frame 01" } },
      { src: "/images/work3.jpg", alt: { zh: "视觉摄影 02", en: "Editorial frame 02" } },
      { src: "/images/work4.jpg", alt: { zh: "视觉摄影 03", en: "Editorial frame 03" } },
      { src: "/images/red1.webp", alt: { zh: "视觉摄影 04", en: "Editorial frame 04" } },
      { src: "/images/work5.jpg", alt: { zh: "视觉摄影 05", en: "Editorial frame 05" } },
    ],
    accentImages: [
      { src: "/images/screenshot1.jpg", alt: { zh: "精选画面 01", en: "Featured still 01" } },
      { src: "/images/screenshot2.jpg", alt: { zh: "精选画面 02", en: "Featured still 02" } },
    ],
    secondaryText: {
      zh: "当编码的门槛被 AI 消解，决定作品上限的便不再是实现手段，而是审美与判断。机器能够迅速穷尽功能的解法，却无法替人感知分寸，更无法代人做出取舍——克制什么、放大什么，恰恰构成了作品真正的性格。",
      en: "Once AI dissolves the friction of implementation, the ceiling of a work is no longer set by code, but by taste and judgement. Machines can exhaust every technical path, yet they cannot sense proportion or make the decisive trade-offs — what to hold back and what to amplify is ultimately what gives a piece its character.",
    },
  },
  works: {
    heading: { zh: "开源作品", en: "Open Source" },
    period: "2026",
    tv: {
      src: "/images/tv2.webp",
      alphaSrc: "/images/tv2-alpha.webp",
      width: 1536,
      height: 1024,
      // Exact opening of the alpha cutout in `tv2-alpha.webp`
      // (x 655–821 / 1536, y 670–791 / 1024). When idle or past the works list,
      // `tv2.webp` renders untouched with zero overlay; only while a work is
      // active does `.tv-screen` sit *underneath* `tv2-alpha.webp` (bleeding
      // slightly under the opaque recessed bezel so no seam can ever appear).
      screen: { top: 65.4, left: 42.62, width: 10.92, height: 11.98 },
    },
    items: [
      // Every repository on github.com/BrainEno with more than 100 commits since
      // 2026-01-01: lyric-forge-ktv 929 · no-wave 764 · ScribeForge 416 ·
      // flutter-blog 338 · remix-partfolio 282 · win7-book-management 252.
      // `year` holds the repository start date, `credit` holds the stack shown
      // after the separator.
      {
        id: "lyric-forge-ktv",
        title: { zh: "lyric-forge-ktv", en: "lyric-forge-ktv" },
        year: "2026.04.22",
        credit: { zh: "Flutter · Dart · 本地优先", en: "Flutter · Dart · Local-first" },
        image: {
          src: "/images/works/lyric-forge-ktv.jpg",
          alt: { zh: "lyric-forge-ktv 仓库预览", en: "lyric-forge-ktv repository" },
        },
        // Video example: uncomment and replace with your own video to show a clip on the TV.
        // The TV displays the poster (or `image` as fallback) until the user clicks to play.
        // `preload="metadata"` — never auto-plays, never burns bandwidth on a clip nobody watches.
        // video: {
        //   src: "/videos/lyric-forge-ktv.mp4",
        //   poster: "/images/works/lyric-forge-ktv-poster.jpg",
        // },
        url: "https://github.com/BrainEno/lyric-forge-ktv",
        description: {
          zh: "本地优先的 KTV 编排与伴唱工具：集逐字时间轴打轴、伴奏音轨对齐与离线曲库管理于一体，单机即可流畅开唱，零服务端依赖。",
          en: "A local-first KTV authoring and playback studio: syllable-level lyric timing, backing-track sync, and an offline songbook running entirely on a single device with zero server dependency.",
        },
        detailImages: [
          {
            src: "/images/works/lyric-forge-ktv.jpg",
            alt: { zh: "lyric-forge-ktv 界面预览", en: "lyric-forge-ktv interface" },
          },
        ],
      },
      {
        id: "no-wave",
        title: { zh: "no-wave", en: "no-wave" },
        year: "2026.10.24",
        credit: { zh: "TypeScript · pnpm · 全栈架构", en: "TypeScript · pnpm · Full-Stack" },
        image: {
          src: "/images/no-wave1.webp",
          alt: { zh: "no-wave 视觉预览", en: "no-wave repository" },
        },
        url: "https://github.com/BrainEno/no-wave",
        description: {
          zh: "基于 pnpm Workspace 构建的全栈 TypeScript 应用：前后端共享领域模型与端到端类型契约，内建严格的静态检查、自动化测试与增量构建流水线。",
          en: "A full-stack TypeScript application structured as a pnpm monorepo: shared domain models and end-to-end type contracts across client and API, backed by strict verification and incremental builds.",
        },
        detailImages: [
          {
            src: "/images/no-wave1.webp",
            alt: { zh: "no-wave 项目画面", en: "no-wave project visual" },
          },
        ],
      },
      {
        id: "remix-partfolio",
        title: { zh: "remix-partfolio", en: "remix-partfolio" },
        year: "2022.11.11",
        credit: { zh: "React Router · GSAP · 滚动叙事", en: "React Router · GSAP · Scroll Craft" },
        image: {
          src: "/images/works/remix-partfolio.jpg",
          alt: { zh: "remix-partfolio 仓库预览", en: "remix-partfolio repository" },
        },
        url: "https://github.com/BrainEno/remix-partfolio",
        description: {
          zh: "本站的前身与动效原型：以 GSAP ScrollSmoother 编排长卷式滚动叙事与复古电视机作品索引，探索内容数据与复杂视差动效的彻底解耦。",
          en: "The motion prototype behind this site: scroll-driven storytelling orchestrated with GSAP ScrollSmoother, a vintage CRT index, and static-first delivery with content cleanly decoupled from choreography.",
        },
        detailImages: [
          {
            src: "/images/works/remix-partfolio.jpg",
            alt: { zh: "remix-partfolio 首页预览", en: "remix-partfolio landing page" },
          },
        ],
      },
      {
        id: "scribeforge",
        title: { zh: "ScribeForge", en: "ScribeForge" },
        year: "2026.10.02",
        credit: { zh: "Python · Flutter · AI 写作", en: "Python · Flutter · AI Editorial" },
        image: {
          src: "/images/works/scribeforge.jpg",
          alt: { zh: "ScribeForge 仓库预览", en: "ScribeForge repository" },
        },
        url: "https://github.com/BrainEno/ScribeForge",
        description: {
          zh: "面向深度长文创作的 AI 写作台：Python 后端统筹知识检索与上下文生成编排，Flutter 桌面端提供沉浸式离线草稿与实时排版预览。",
          en: "An AI workbench built for long-form writing: a Python backend orchestrates retrieval and context-aware generation while a native Flutter client delivers offline drafting and live typographic preview.",
        },
        detailImages: [
          {
            src: "/images/works/scribeforge.jpg",
            alt: { zh: "ScribeForge 写作界面", en: "ScribeForge writing view" },
          },
        ],
      },
      {
        id: "flutter-blog",
        title: { zh: "flutter-blog", en: "flutter-blog" },
        year: "2025.01.17",
        credit: { zh: "Flutter · Dart · 编辑式阅读", en: "Flutter · Dart · Editorial reading" },
        image: {
          src: "/images/works/flutter-blog.jpg",
          // An illustrated ident rather than a screenshot: the repository has no
          // public capture, and the site's own palette stands in until one exists.
          alt: {
            zh: "flutter-blog（No Wave 移动端）示意图",
            en: "flutter-blog (No Wave mobile) — illustrated card",
          },
        },
        url: "https://github.com/BrainEno/flutter-blog",
        description: {
          zh: "No Wave 的 Flutter 移动客户端：离线缓存阅读、本地草稿、点赞收藏、标签浏览与全文搜索，正文以 Markdown 呈现，数据来自自托管的 no-wave API；界面沿用纸色与墨色的编辑式排版，并跟随系统的深浅色与字号设置。",
          en: "The Flutter client for No Wave: offline reading with a local cache, on-device drafts, likes and bookmarks, tag browsing and full-text search, Markdown bodies served by the self-hosted no-wave API — set in the same paper-and-ink editorial layout, and following the system theme and type scale.",
        },
        detailImages: [
          {
            src: "/images/works/flutter-blog.jpg",
            alt: { zh: "flutter-blog 移动端示意图", en: "flutter-blog mobile card" },
          },
        ],
      },
      {
        id: "win7-book-management",
        title: { zh: "win7-book-management", en: "win7-book-management" },
        year: "2026.09.29",
        credit: { zh: "C# · .NET · 桌面软件", en: "C# · .NET · Desktop Suite" },
        image: {
          src: "/images/works/win7-book-management.jpg",
          alt: { zh: "win7-book-management 仓库预览", en: "win7-book-management repository" },
        },
        url: "https://github.com/BrainEno/win7-book-management",
        description: {
          zh: "专为老旧 Windows 7 环境打造的轻量级图书管理软件：单包免依赖部署，内置本地数据库检索、借阅台账与批量导入导出，在低配硬件上依然迅捷稳定。",
          en: "A lightweight desktop library manager engineered for legacy Windows 7 hardware: dependency-free installation, instant local cataloguing, and bulk import/export that stays snappy on ageing machines.",
        },
        detailImages: [
          {
            src: "/images/works/win7-book-management.jpg",
            alt: { zh: "win7-book-management 主界面", en: "win7-book-management main view" },
          },
        ],
      },
    ],
  },
  contact: {
    phone: "@BrainEno",
    email: "nodeman24@outlook.com",
    headlines: ["CALL ME", "FOR THE", "MARQUEE MOON"],
    marquee: { zh: "随时联系 —", en: "Get in touch —" },
    image: {
      src: "/images/telephone-booth.webp",
      alt: { zh: "电话亭", en: "Telephone booth" },
    },
    copyright: "© 2026 BrainEno. All rights reserved.",
    credit: {
      prefix: { zh: "设计与工程实现", en: "Design & Engineering by" },
      name: "BrainEno",
      url: "https://github.com/BrainEno",
    },
  },
  theme: {
    accent: "#e55139",
    stage: "#000000",
  },
};
