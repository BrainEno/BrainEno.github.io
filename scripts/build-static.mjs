#!/usr/bin/env node
/**
 * Build the pure static site.
 *
 *   npm run build:static
 *
 * The build refreshes responsive image derivatives, produces the export, then
 * injects a deterministic cache revision derived from the exported files into
 * `out/sw.js` before recording build metadata.
 *
 * Next is configured as `output: "export"` (see next.config.ts), so this is
 * `next build` with the deployment variables filled in: the origin is baked into
 * canonical URLs / sitemap.xml / robots.txt, and the optional base path makes
 * the export work under `/repo/` on GitHub Pages. The result has no server, no
 * API routes and no database — serve it with `npm run preview` or any static
 * host.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { computeStaticRevision, injectWorkerVersion } from "./service-worker-build.mjs";

const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

if (!origin) {
  console.warn(
    "[build:static] NEXT_PUBLIC_SITE_URL is not set — sitemap.xml, robots.txt and\n" +
      "              canonical/og URLs will point at http://localhost:3000.\n" +
      "              Set it to the site's public address before deploying."
  );
}

const env = {
  ...process.env,
  // A static host cannot read a request-time env var, so the public origin is
  // baked into sitemap.xml / robots.txt / Open Graph tags at build time.
  SITE_URL: origin || "http://localhost:3000",
  ...(basePath ? { NEXT_PUBLIC_BASE_PATH: basePath } : {}),
};

/** `npm run build` gets this from the `prebuild` hook; this script bypasses npm. */
function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const images = await run(process.execPath, ["scripts/build-images.mjs"]);
if (images !== 0) process.exit(images);

const build = await run(process.platform === "win32" ? "next.cmd" : "next", ["build"]);

function collectExportFiles(directory, root = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectExportFiles(filename, root);
    if (!entry.isFile()) return [];
    return [{
      path: path.relative(root, filename).split(path.sep).join("/"),
      filename,
    }];
  });
}

/**
 * Tie cache names to the bytes that will be deployed. Content changes therefore
 * roll the cache namespace without a hand-edited worker version. The generated
 * build metadata is written afterwards and is intentionally excluded.
 */
function finalizeServiceWorker(outputDirectory) {
  const workerPath = path.join(outputDirectory, "sw.js");
  if (!existsSync(workerPath)) throw new Error("static export did not include public/sw.js");
  const files = collectExportFiles(outputDirectory)
    .filter(({ path: filename }) => filename !== "build-meta.json")
    .map(({ path: filename, filename: fullPath }) => ({
      path: filename,
      content: readFileSync(fullPath),
    }));
  const revision = computeStaticRevision(files);
  const source = readFileSync(workerPath, "utf8");
  writeFileSync(workerPath, injectWorkerVersion(source, revision));
  console.log(`[build:static] service worker cache revision: build-${revision}`);
  return revision;
}

// How this folder was built, in the folder itself. `preview` mounts the export
// at the right sub-path and `smoke` checks the right URLs without being told —
// testing a prefixed build against an unprefixed server is a mistake that looks
// exactly like a broken site, so the deployment shape travels with the bytes.
if (build === 0) {
  const outputDirectory = path.join(process.cwd(), "out");
  const serviceWorkerRevision = finalizeServiceWorker(outputDirectory);
  writeFileSync(
    path.join(outputDirectory, "build-meta.json"),
    `${JSON.stringify({
      basePath: basePath.replace(/\/+$/, ""),
      siteUrl: env.SITE_URL,
      builtAt: new Date().toISOString(),
      serviceWorkerRevision,
    }, null, 2)}\n`
  );
}
process.exit(build);
