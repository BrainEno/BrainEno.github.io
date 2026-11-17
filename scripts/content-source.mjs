/**
 * Read the site's content the way the build does: prefer the published
 * snapshot `src/portfolio/content/published.json` when it exists, fall back to
 * the authored defaults in `src/portfolio/content/defaults.ts` (#51).
 *
 * Both consumers of this helper (`test-tv-assets.mjs`, `tv-glass.mjs`) only
 * need the *structural* values — file paths and pixel rectangles — not the
 * normalised shape, so a light parse that mirrors `unwrapSnapshot` is enough:
 * accept the documented `{ exportedAt, content }` wrapper and a bare content
 * object, reject everything else with a named complaint.
 *
 * Run from the repo root (or with the returned absolute paths): the defaults
 * branch still regex-reads TypeScript source, which legacy scripts do today.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLISHED = path.join(ROOT, "src/portfolio/content/published.json");
const DEFAULTS = path.join(ROOT, "src/portfolio/content/defaults.ts");

/**
 * Read the snapshot without importing TypeScript. Mirrors the runtime's
 * unwrap: known wrapper keys are lifted, a bare content object passes, and
 * anything else is a hard error with the offending shape spelled out.
 */
function readSnapshot(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`[content-source] ${path.relative(ROOT, file)} is not readable: ${error.message}`);
  }

  const isObject = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  if (!isObject) throw new Error(`[content-source] published content must be an object, got ${Array.isArray(parsed) ? "an array" : typeof parsed}`);

  const record = parsed;
  if ("content" in record || "exportedAt" in record || "exportedAtIso" in record) {
    const content = record.content;
    const ok = content !== null && typeof content === "object" && !Array.isArray(content);
    if (!ok) throw new Error("[content-source] a wrapped snapshot's `content` must be an object");
    return { raw: content, source: "published.json (wrapped)" };
  }
  if ("identity" in record || "works" in record) return { raw: record, source: "published.json (bare)" };
  throw new Error("[content-source] unrecognised snapshot shape: no `content` wrapper and no `identity`/`works` keys");
}

/**
 * The script-facing half of the defaults contract. `defaults.ts` is TypeScript:
 * rather than compiling it, the two legacy scripts held regexes against its
 * layout. Kept here so both scripts share one definition of it.
 */
function readDefaultsTv(source) {
  const tvBlock = source.match(/tv:\s*\{([\s\S]*?)\n\s*\}/)?.[1];
  if (!tvBlock) throw new Error("[content-source] could not find the `tv` block in defaults.ts");
  const screenBlock = tvBlock.match(/screen:\s*\{([^}]*)\}/)?.[1];
  if (!screenBlock) throw new Error("[content-source] missing `screen` in works.tv");
  const src = tvBlock.match(/src:\s*"([^"]+)"/)?.[1];
  const alphaSrc = tvBlock.match(/alphaSrc:\s*"([^"]+)"/)?.[1] ?? null;
  if (!src) throw new Error("[content-source] missing `src` in works.tv");
  const num = (key) => {
    const m = screenBlock.match(new RegExp(`${key}:\\s*([0-9.]+)`));
    if (!m) throw new Error(`[content-source] missing \`${key}\` in works.tv.screen`);
    return Number(m[1]);
  };
  return {
    src,
    alphaSrc,
    screen: { top: num("top"), left: num("left"), width: num("width"), height: num("height") },
  };
}

/**
 * The one thing the TV tooling needs: the tube's artwork path and glass
 * rectangle, from whichever content file the build itself would serve.
 */
export function readTvFromContent() {
  if (existsSync(PUBLISHED)) {
    const { raw, source } = readSnapshot(PUBLISHED);
    const tv = raw?.works?.tv;
    if (!tv || typeof tv !== "object") throw new Error(`[content-source] ${source} has no works.tv`);
    const { src, alphaSrc = null, screen } = tv;
    if (typeof src !== "string" || !screen || typeof screen !== "object") {
      throw new Error(`[content-source] ${source} has an incomplete works.tv (need src + screen)`);
    }
    for (const key of ["top", "left", "width", "height"]) {
      if (typeof screen[key] !== "number") throw new Error(`[content-source] ${source} works.tv.screen.${key} must be a number`);
    }
    return { tv: { src, alphaSrc: typeof alphaSrc === "string" ? alphaSrc : null, screen }, source };
  }

  const source = readFileSync(DEFAULTS, "utf8");
  return { tv: readDefaultsTv(source), source: "defaults.ts" };
}

/** Resolve a content path ("/images/foo.webp") to a workspace file URL. */
export function publicPathToFileUrl(publicPath) {
  if (typeof publicPath !== "string" || !publicPath.startsWith("/")) {
    throw new Error(`[content-source] content media paths must be root-absolute, got ${JSON.stringify(publicPath)}`);
  }
  return new URL(`public/${publicPath.replace(/^\//, "")}`, `${pathToFileURL(ROOT)}/`);
}

/** Re-exported for scripts that want filenames, not URLs. */
export function rootRelative(...segments) {
  return path.join(ROOT, ...segments);
}
