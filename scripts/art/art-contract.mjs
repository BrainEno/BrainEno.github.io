import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Public image fields that the authored content is allowed to point at. The
 * defaults are TypeScript, so this intentionally reads their literal paths
 * instead of importing the module (which would require a TS runtime).
 */
const IMAGE_FIELD = /\b(?:src|alphaSrc|poster)\s*:\s*["'](\/images\/[^"']+)["']/g;

/**
 * Remove TypeScript line and block comments without mistaking URL slashes or
 * comment markers inside quoted content for syntax. The defaults file is a
 * data literal, so strings and template strings can be preserved verbatim.
 */
export function stripTypeScriptComments(source) {
  let output = "";
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    const code = character.charCodeAt(0);

    if (lineComment) {
      if (code === 10 || code === 13) {
        output += character;
        lineComment = false;
      } else output += " ";
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        blockComment = false;
      } else output += code === 10 || code === 13 ? character : " ";
      continue;
    }
    if (quote) {
      output += character;
      if (escaped) escaped = false;
      else if (code === 92) escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "'" || character === '\"' || character === "`") {
      quote = character;
      output += character;
      continue;
    }
    if (character === "/" && next === "/") {
      output += "  ";
      index += 1;
      lineComment = true;
      continue;
    }
    if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      blockComment = true;
      continue;
    }
    output += character;
  }
  return output;
}

/** Extract unique local image URLs from the current default content source. */
export function extractPortfolioImagePaths(source) {
  const paths = new Set();
  const uncommented = stripTypeScriptComments(source);
  for (const match of uncommented.matchAll(IMAGE_FIELD)) {
    const value = match[1].split(/[?#]/, 1)[0];
    if (value.startsWith("/images/") && !value.includes("\\")) paths.add(value);
  }
  return [...paths].sort((a, b) => a.localeCompare(b));
}

/** Resolve a `/images/…` URL into `public/images/…`, rejecting traversal. */
export function resolvePortfolioImage(root, imageUrl) {
  if (typeof imageUrl !== "string") {
    throw new TypeError(`Expected a local /images/ URL, received ${String(imageUrl)}`);
  }
  if (imageUrl.includes("\\") || /%2f|%5c/i.test(imageUrl)) {
    throw new Error(`Encoded path separators are not allowed: ${imageUrl}`);
  }
  if (!imageUrl.startsWith("/images/")) {
    throw new TypeError(`Expected a local /images/ URL, received ${String(imageUrl)}`);
  }

  const decoded = decodeURIComponent(imageUrl);
  const parts = decoded.split("/").filter(Boolean);
  if (parts[0] !== "images" || parts.some((part) => part === "." || part === "..")) {
    throw new Error(`Image path escapes the public directory: ${imageUrl}`);
  }

  const publicRoot = path.resolve(root, "public");
  const target = path.resolve(publicRoot, ...parts);
  if (target !== publicRoot && !target.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error(`Image path escapes the public directory: ${imageUrl}`);
  }
  return target;
}

/**
 * Read-only artwork audit. It catches stale or missing paths without creating
 * placeholder files or mutating authored media.
 */
export function auditPortfolioArtwork(root, source) {
  const images = extractPortfolioImagePaths(source);
  const missing = [];
  const unsafe = [];

  for (const imageUrl of images) {
    try {
      const filename = resolvePortfolioImage(root, imageUrl);
      if (!existsSync(filename)) missing.push({ imageUrl, filename });
    } catch (error) {
      unsafe.push({ imageUrl, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { images, missing, unsafe };
}

/** Read the authored content source and audit it against the public tree. */
export function auditProjectArtwork(root) {
  const sourceFile = path.join(root, "src", "portfolio", "content", "defaults.ts");
  return auditPortfolioArtwork(root, readFileSync(sourceFile, "utf8"));
}
