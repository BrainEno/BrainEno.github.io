#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function read(root, filename) {
  return readFileSync(path.join(root, filename), "utf8");
}

function quotedStrings(value) {
  return [...value.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
}

function extractArray(source, property) {
  const match = source.match(new RegExp(`${property}\\s*:\\s*\\[([^\\]]*)\\]`));
  return match ? quotedStrings(match[1]) : null;
}

function extractSourceField(source, objectName, field) {
  const object = source.match(new RegExp(`${objectName}\\s*:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`));
  return object?.[1]?.match(new RegExp(`\\b${field}\\s*:\\s*["']([^"']+)["']`))?.[1] ?? null;
}

function extractImageOverride(source, filename) {
  const overrides = source.match(/const OVERRIDES\s*=\s*\{([\s\S]*?)\n\};/)?.[1];
  if (!overrides) return null;
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const entry = overrides.match(new RegExp(`^[\\t ]*["']${escaped}["']\\s*:\\s*\\{([^}]+)\\}`, "m"))?.[1];
  if (!entry) return null;
  const widths = entry.match(/widths\s*:\s*\[([^\]]+)\]/)?.[1];
  const quality = entry.match(/quality\s*:\s*(\d+)/)?.[1];
  return widths && quality ? { widths: widths.split(",").map((item) => Number(item.trim())), quality: Number(quality) } : null;
}

/**
 * Find concrete, repository-rooted code paths in current-state docs. Section 1
 * of ARCHITECTURE is an explicitly historical inventory, so callers pass only
 * sections that claim to describe today's code. Globs and directory labels are
 * documentation, not promises that one literal file exists, and are skipped.
 */
export function collectConcretePathReferences(text) {
  const references = [];
  for (const match of text.matchAll(/`((?:src|public|scripts|assets|docs)\/[^`]+)`/g)) {
    const token = match[1].trim();
    if (/[{}*…]/.test(token) || token.endsWith("/")) continue;
    const withLine = token.match(/^(.*?):(\d+)$/);
    const withoutFragment = (withLine?.[1] ?? token).split("#", 1)[0];
    if (!/\.[A-Za-z0-9]+$/.test(withoutFragment)) continue;
    references.push({ path: withoutFragment, line: withLine ? Number(withLine[2]) : null });
  }
  return references;
}

function checkReferences(root, references) {
  const errors = [];
  const seen = new Set();
  for (const reference of references) {
    const key = `${reference.path}:${reference.line ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const filename = path.resolve(root, reference.path);
    if (!filename.startsWith(`${path.resolve(root)}${path.sep}`) || !existsSync(filename)) {
      errors.push(`documented source path does not exist: ${reference.path}`);
      continue;
    }
    if (reference.line !== null) {
      const lines = readFileSync(filename, "utf8").split(/\r?\n/).length;
      if (lines < reference.line) errors.push(`${reference.path}:${reference.line} is past the end of the file (${lines} lines)`);
    }
  }
  return errors;
}

function findTvBlock(defaults) {
  return defaults.match(/tv\s*:\s*\{([\s\S]*?)\n\s*items\s*:/)?.[1] ?? "";
}

function findContactFallback(defaults) {
  // Navigation also has a `contact` text field; anchor to the top-level content
  // object rather than the first matching property anywhere in the file.
  const contact = defaults.match(/^  contact\s*:\s*\{([\s\S]*?)\n  \},/m)?.[1] ?? "";
  const image = contact.match(/^\s{4}image\s*:\s*\{([^}]+)\}/m)?.[1] ?? "";
  return image.match(/\bsrc\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
}

/** Return the doc/source mismatches without writing to the workspace. */
export function checkDocumentation(root) {
  const errors = [];
  const architecture = read(root, "docs/ARCHITECTURE.md");
  const staticGuide = read(root, "docs/STATIC_EXPORT.md");
  const readme = read(root, "README.md");
  const roadmap = read(root, "docs/ROADMAP.md");
  const nextConfig = read(root, "next.config.ts");
  const defaults = read(root, "src/portfolio/content/defaults.ts");
  const imageBuilder = read(root, "scripts/build-images.mjs");
  const sections = read(root, "src/portfolio/ui/sections.tsx");
  const serviceWorker = read(root, "public/sw.js");
  const serviceWorkerBuild = read(root, "scripts/service-worker-build.mjs");
  const manifest = read(root, "src/app/manifest.tsx");

  const currentArchitecture = architecture.slice(architecture.indexOf("## 2."));
  const references = [
    ...collectConcretePathReferences(currentArchitecture),
    ...collectConcretePathReferences(staticGuide),
  ];
  errors.push(...checkReferences(root, references));

  const actualExtensions = extractArray(nextConfig, "pageExtensions");
  const documentedExtensions = extractArray(staticGuide, "pageExtensions");
  if (!actualExtensions || !documentedExtensions || actualExtensions.join("\0") !== documentedExtensions.join("\0")) {
    errors.push(`pageExtensions drift: source=${JSON.stringify(actualExtensions)} docs=${JSON.stringify(documentedExtensions)}`);
  }

  const tv = findTvBlock(defaults);
  const tvSource = tv.match(/\bsrc\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
  const tvAlpha = tv.match(/\balphaSrc\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
  const boothFallback = findContactFallback(defaults);
  for (const [label, actual] of [["base television image", tvSource], ["television alpha image", tvAlpha], ["telephone booth fallback", boothFallback]]) {
    if (!actual || !architecture.includes(actual)) errors.push(`${label} drift: architecture must mention ${actual ?? "the default content source"}`);
  }

  const baseOverride = extractImageOverride(imageBuilder, path.posix.basename(tvSource ?? "tv2.webp"));
  const alphaOverride = extractImageOverride(imageBuilder, path.posix.basename(tvAlpha ?? "tv2-alpha.webp"));
  const expectedWidths = [1280, 1536];
  for (const [label, override] of [["television base", baseOverride], ["television alpha", alphaOverride]]) {
    if (!override || override.quality !== 80 || override.widths.join(",") !== expectedWidths.join(",")) {
      errors.push(`${label} image override changed; update architecture docs and checker (actual ${JSON.stringify(override)})`);
    }
  }
  if (!architecture.includes("1280 / 1536") || !architecture.includes("质量 80")) {
    errors.push("architecture does not describe the current 1280 / 1536, quality-80 television ladder");
  }

  const sizes = sections.match(/className="tv-frame"[\s\S]{0,500}?sizes="([^"]+)"/)?.[1] ?? null;
  if (!sizes || !architecture.includes(`\`${sizes}\``)) {
    errors.push(`TV sizes drift: architecture must quote the current component value ${JSON.stringify(sizes)}`);
  }

  if (!architecture.includes("`/offline/`") || !staticGuide.includes("/offline/")) {
    errors.push("offline documentation must use the canonical trailing-slash route");
  }
  if (!serviceWorker.includes("const MEDIA_MAX_ENTRIES = 60") || !serviceWorker.includes("const PAGES_MAX_ENTRIES = 20") || !serviceWorker.includes("const STATIC_MAX_ENTRIES = 128")) {
    errors.push("service-worker cache limits changed; update the architecture table and this contract");
  }
  if (!architecture.includes("图片最多 60 项、页面最多 20 项、其他静态资源最多 128 项")) {
    errors.push("architecture does not describe current service-worker cache entry caps");
  }
  if (serviceWorker.includes("self.skipWaiting()") || serviceWorker.includes("self.clients.claim()")) {
    errors.push("worker takeover policy changed; review old-client chunk safety and architecture notes");
  }
  if (!serviceWorkerBuild.includes("computeStaticRevision") || !architecture.includes("内容摘要自动命名缓存版本")) {
    errors.push("cache revision must be described as a build-generated content digest");
  }
  if (!/theme_color:\s*content\.theme\.stage,/.test(manifest) || !/background_color:\s*content\.theme\.stage,/.test(manifest)) {
    errors.push("manifest theme_color must follow the current content theme stage");
  }
  if (!architecture.includes("`exportedAt`") || !architecture.includes("省略 lastmod") || !staticGuide.includes("省略 lastmod")) {
    errors.push("sitemap lastmod documentation must describe exportedAt and the omission for undated content");
  }
  if (!readme.includes("只读检查") || !readme.includes("不会生成或覆盖素材")) {
    errors.push("README must describe `npm run art` as a read-only audit, not an artwork generator");
  }
  if (!roadmap.includes("未经复现的历史记录") || !roadmap.includes("原始 Lighthouse JSON")) {
    errors.push("ROADMAP must label Lighthouse numbers without retained artifacts as unverified history");
  }

  const obsoleteCurrentClaims = [
    "apple-icon.png",
    "phone-booth-cutout.png",
    "public/images/tv.webp",
    "public/images/tv-alpha.webp",
    "1280/1920/2560",
    "max(160vw, 230vh)",
  ];
  for (const stale of obsoleteCurrentClaims) {
    if (currentArchitecture.includes(stale)) errors.push(`obsolete current-state claim remains in ARCHITECTURE: ${stale}`);
  }

  return { errors, referenceCount: references.length };
}

export function runDocumentationCheck(root = path.resolve(path.dirname(SCRIPT_PATH), ".."), log = console) {
  const report = checkDocumentation(root);
  if (report.errors.length) {
    for (const error of report.errors) log.error(`[docs] FAIL ${error}`);
    log.error(`[docs] ${report.errors.length} documentation drift error(s), ${report.referenceCount} concrete paths checked.`);
    return false;
  }
  log.log(`[docs] passed: current-state facts match source; ${report.referenceCount} concrete paths checked.`);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  if (!runDocumentationCheck()) process.exitCode = 1;
}
