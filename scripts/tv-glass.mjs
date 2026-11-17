/**
 * Draws the current `works.tv.screen` rectangle over the television artwork so
 * the glass position can be eyeballed, and prints the rectangle in pixels.
 *
 * The overlay is the *content's* percentage rect, not a guess: whatever
 * `src/portfolio/content/defaults.ts` says is exactly what the site will use,
 * so a red edge that sits on the photo's bezel is a bug you can see.
 *
 * Run:  node scripts/tv-glass.mjs [out.png]
 *   → default output /tmp/tv-glass-check.png
 *
 * Why not auto-detect: the tube is a dark, vignetted, grain-heavy region inside
 * a dark bezel — a threshold finds the bezel, and a "brightest rectangle"
 * search finds the asphalt. Measuring the four edges by hand on the native file
 * (row-wise luminance gradient, the tube's edge is the strongest |dL/dx| in that
 * band) takes a minute and cannot silently wander. This script is the check,
 * not the measurement.
 */
import sharp from "sharp";
import path from "node:path";
import { readTvFromContent, rootRelative } from "./content-source.mjs";

const { tv, source } = readTvFromContent();
console.log(`[tv-glass] content source: ${source}`);
const { src, screen } = tv;

// `works.tv` holds the artwork's intrinsic `width`/`height` *and* the
// `screen` rect: the build (and therefore the site) takes its glass position
// from the same values this script reads, so a red edge that sits on the
// photo's bezel is a bug you can see.
const file = rootRelative("public", src.replace(/^\//, ""));
const meta = await sharp(file).metadata();
const box = {
  x: Math.round((screen.left / 100) * meta.width),
  y: Math.round((screen.top / 100) * meta.height),
  w: Math.round((screen.width / 100) * meta.width),
  h: Math.round((screen.height / 100) * meta.height),
};

const overlay = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
     <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"
           fill="none" stroke="#ff0044" stroke-width="6"/>
     <rect x="${box.x + 3}" y="${box.y + 3}" width="${box.w - 6}" height="${box.h - 6}"
           fill="none" stroke="#00ffcc" stroke-width="2"/>
   </svg>`,
);

const out = process.argv[2] ?? "/tmp/tv-glass-check.png";
await sharp(file).composite([{ input: overlay, top: 0, left: 0 }]).png().toFile(out);

console.log(
  `[tv-glass] ${src} ${meta.width}x${meta.height}\n` +
    `[tv-glass] screen rect → x ${box.x}–${box.x + box.w}, y ${box.y}–${box.y + box.h} ` +
    `(${box.w}x${box.h}px)\n` +
    `[tv-glass] overlay written to ${out}`,
);
