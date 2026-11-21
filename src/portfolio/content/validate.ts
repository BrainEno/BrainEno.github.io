/**
 * Build-time content validation (#68) and the snapshot-format contract (#51).
 *
 * `getSiteContent()` is the single entry point for the site's content, and for
 * a long time it was *silent*: a `published.json` written in the documented
 * `{ exportedAt, content }` wrapper was dropped without a word (#51), a string
 * over the 6000-character limit was truncated quietly, and a reference to an
 * image that does not exist surfaced only as an empty box in production.
 *
 * This module is where that silence ends. Everything here is a pure function
 * over already-parsed data (plus one injected `fileExists` probe), so the same
 * rules run in the Next build and in `scripts/test-content.mjs` (node:test)
 * without a framework.
 *
 * Severities:
 *   - `"error"` — the content itself could not be used at all (unknown or
 *     wrapped-in-the-wrong-place structure); the build falls back to defaults.
 *   - `"warn"`  — usable, but something was clamped, renamed or references a
 *     file that is not there. The build continues; the maintainer is told.
 */

import { modifiedDate } from "./modified-date";

export const MAX_STRING = 6000;
export const MAX_LIST = 40;

/** Top-level keys of a bare `PortfolioContent` object. */
export const KNOWN_TOP_LEVEL_KEYS = [
  "version",
  "identity",
  "navigation",
  "hero",
  "intro",
  "works",
  "contact",
  "theme",
] as const;

/** Keys the documented snapshot wrapper carries next to the content itself. */
export const WRAPPER_META_KEYS = ["exportedAt", "exportedAtIso", "exportedBy"] as const;

export type ContentIssue = {
  severity: "warn" | "error";
  /** Dotted path into the content object, e.g. `works.items[3].image.src`. */
  path: string;
  message: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type UnwrappedSnapshot = {
  /** The bare content object, or `null` when nothing usable was found. */
  content: Record<string, unknown> | null;
  /** When the wrapper declared its export time (any accepted key). */
  exportedAt: string | null;
  issues: ContentIssue[];
};

/**
 * Accept both snapshot shapes and say which one arrived.
 *
 * The documented export format wraps content as `{ exportedAt, content }`,
 * while an older hand-edited `published.json` may be the bare content object.
 * Before this existed, the wrapper was fed straight into `normalizeContent`,
 * where every top-level business key read as `undefined` and the site silently
 * rendered the template (#51).
 */
export function unwrapSnapshot(raw: unknown): UnwrappedSnapshot {
  const issues: ContentIssue[] = [];
  if (raw === null || raw === undefined) return { content: null, exportedAt: null, issues };
  if (!isRecord(raw)) {
    issues.push({
      severity: "error",
      path: "(root)",
      message: `published.json must contain an object, got ${Array.isArray(raw) ? "an array" : typeof raw}; falling back to defaults`,
    });
    return { content: null, exportedAt: null, issues };
  }

  // Documented wrapper: a `content` key holding an object. Any sibling keys
  // are metadata; the timestamps are worth returning for sitemap lastmod.
  if (isRecord(raw.content)) {
    const exportedAt = isNonEmptyString(raw.exportedAt)
      ? raw.exportedAt
      : isNonEmptyString(raw.exportedAtIso)
        ? raw.exportedAtIso
        : null;
    return { content: raw.content, exportedAt, issues };
  }

  // A `content` key that is present but not an object is almost certainly a
  // misunderstood wrapper — fail loudly rather than reading it as content.
  if ("content" in raw) {
    issues.push({
      severity: "error",
      path: "content",
      message: `the wrapper's \`content\` must be an object, got ${Array.isArray(raw.content) ? "an array" : typeof raw.content}; falling back to defaults`,
    });
    return { content: null, exportedAt: null, issues };
  }

  // Bare content object — accepted as long as it carries at least one known
  // business key. Zero known keys means a shape we do not understand (for
  // example a wrapper using a key other than `content`): say so by name.
  const known = KNOWN_TOP_LEVEL_KEYS.filter((key) => key in raw);
  if (known.length === 0) {
    const keys = Object.keys(raw).slice(0, 8).join(", ");
    issues.push({
      severity: "error",
      path: "(root)",
      message: `no known top-level keys (found: ${keys || "none"}). Bare content needs one of ${KNOWN_TOP_LEVEL_KEYS.join(", ")}, or wrap it as { "exportedAt": "...", "content": { ... } }; falling back to defaults`,
    });
    return { content: null, exportedAt: null, issues };
  }
  return { content: raw, exportedAt: null, issues };
}

/**
 * Pre-normalization scan: the fields `normalize.ts` will clamp, with the paths
 * a maintainer needs to find them. Runs on the *raw* input so the report names
 * the authored value, not the already-coerced one.
 */
export function scanOversized(root: unknown, issues: ContentIssue[] = []): ContentIssue[] {
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      if (value.length > MAX_STRING) {
        issues.push({
          severity: "warn",
          path: path || "(root)",
          message: `string is ${value.length} characters and will be truncated to ${MAX_STRING}`,
        });
      }
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > MAX_LIST) {
        issues.push({
          severity: "warn",
          path: path || "(root)",
          message: `list has ${value.length} items and will be trimmed to ${MAX_LIST}`,
        });
      }
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(root, "");
  return issues;
}

type ImageRef = { path: string; src: unknown };

/** Every content-owned image or video path, with where it was referenced. */
export function collectMediaRefs(content: Record<string, unknown>): ImageRef[] {
  const refs: ImageRef[] = [];
  const push = (path: string, src: unknown) => {
    // External URLs are not files in public/; empty strings are "no image".
    if (isNonEmptyString(src) && src.startsWith("/") && !src.startsWith("//")) refs.push({ path, src });
  };
  const localizedImage = (path: string, image: unknown) => {
    if (isRecord(image)) push(`${path}.src`, image.src);
    return undefined;
  };

  const hero = isRecord(content.hero) ? content.hero : {};
  localizedImage("hero.image", hero.image);

  const intro = isRecord(content.intro) ? content.intro : {};
  localizedImage("intro.portrait", intro.portrait);
  if (Array.isArray(intro.gallery)) intro.gallery.forEach((img, i) => localizedImage(`intro.gallery[${i}]`, img));
  if (Array.isArray(intro.accentImages)) intro.accentImages.forEach((img, i) => localizedImage(`intro.accentImages[${i}]`, img));

  const works = isRecord(content.works) ? content.works : {};
  const tv = isRecord(works.tv) ? works.tv : {};
  push("works.tv.src", tv.src);
  push("works.tv.alphaSrc", tv.alphaSrc);
  if (Array.isArray(works.items)) {
    works.items.forEach((item, i) => {
      if (!isRecord(item)) return;
      localizedImage(`works.items[${i}].image`, item.image);
      if (Array.isArray(item.detailImages)) {
        item.detailImages.forEach((img, j) => localizedImage(`works.items[${i}].detailImages[${j}]`, img));
      }
      const video = isRecord(item.video) ? item.video : null;
      if (video) {
        push(`works.items[${i}].video.src`, video.src);
        push(`works.items[${i}].video.previewSrc`, video.previewSrc);
        push(`works.items[${i}].video.poster`, video.poster);
      }
    });
  }

  const contact = isRecord(content.contact) ? content.contact : {};
  localizedImage("contact.image", contact.image);
  return refs;
}

/**
 * The structural checks, on the (already unwrapped) raw content. `exists` is
 * injected so this module stays I/O-free: build code passes a lookup against
 * `public/`, tests pass an in-memory set.
 */
export function validateContent(
  content: Record<string, unknown>,
  opts: { exists?: (publicPath: string) => boolean } = {},
): ContentIssue[] {
  const issues = scanOversized(content);
  const exists = opts.exists ?? (() => true);

  for (const ref of collectMediaRefs(content)) {
    if (!exists(ref.src as string)) {
      issues.push({
        severity: "warn",
        path: ref.path,
        message: `references ${ref.src}, which does not exist in public/`,
      });
    }
  }

  const works = isRecord(content.works) ? content.works : {};
  if (Array.isArray(works.items)) {
    // Duplicate ids are silently renamed by normalizeContent (…-2, …-3);
    // predictable URLs are the author's job, so say when they were not unique.
    const seen = new Map<string, number>();
    works.items.forEach((item, i) => {
      if (!isRecord(item)) return;
      if (item.updatedAt !== undefined && !modifiedDate(item.updatedAt)) {
        issues.push({ severity: "warn", path: `works.items[${i}].updatedAt`, message: "invalid modification date; sitemap lastmod omitted" });
      }
      const id = isNonEmptyString(item.id) ? item.id.trim() : "";
      const titleEn = isRecord(item.title) && isNonEmptyString(item.title.en) ? item.title.en : `items[${i}]`;
      if (id) {
        const first = seen.get(id);
        if (first !== undefined) {
          issues.push({
            severity: "warn",
            path: `works.items[${i}].id`,
            message: `id "${id}" duplicates works.items[${first}] (${titleEn}); the second one is renamed on export`,
          });
        } else {
          seen.set(id, i);
        }
      }
      // The cover is rendered by the detail page on its own; repeating it as
      // the first detail image used to put the same picture on the page twice
      // (#74). Keep warning so the mistake stays visible even though the
      // renderer now skips the duplicate.
      const cover = isRecord(item.image) ? item.image.src : null;
      const firstDetail = Array.isArray(item.detailImages) && isRecord(item.detailImages[0]) ? (item.detailImages[0] as Record<string, unknown>).src : null;
      if (isNonEmptyString(cover) && cover === firstDetail) {
        issues.push({
          severity: "warn",
          path: `works.items[${i}].detailImages[0]`,
          message: "duplicates the cover image; detailImages are *additional* stills, the cover renders on its own",
        });
      }
    });
  }

  const identity = isRecord(content.identity) ? content.identity : {};
  if ("defaultLanguage" in identity && identity.defaultLanguage !== "zh" && identity.defaultLanguage !== "en") {
    issues.push({
      severity: "warn",
      path: "identity.defaultLanguage",
      message: `expected "zh" or "en", got ${JSON.stringify(identity.defaultLanguage)}; "zh" is used`,
    });
  }
  return issues;
}

/** One log line per issue, grouped by severity for the build log. */
export function formatIssues(issues: ContentIssue[]): string[] {
  return issues.map((issue) => `[content:${issue.severity}] ${issue.path} — ${issue.message}`);
}
