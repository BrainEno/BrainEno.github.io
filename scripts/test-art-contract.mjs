#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  auditPortfolioArtwork,
  auditProjectArtwork,
  extractPortfolioImagePaths,
  resolvePortfolioImage,
  stripTypeScriptComments,
} from "./art/art-contract.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GENERATOR = path.join(ROOT, "scripts", "art", "generate-art.mjs");

function snapshotTree(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...snapshotTree(filename));
    else {
      const { size, mtimeMs } = statSync(filename);
      result.push({ path: path.relative(ROOT, filename).split(path.sep).join("/"), size, mtimeMs });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

test("image extraction reads only local authored media fields and de-duplicates URLs", () => {
  const source = `
    hero: { src: "/images/hero.jpg" },
    television: { alphaSrc: "/images/tv/frame.webp" },
    work: { poster: "/images/hero.jpg" },
    remote: { src: "https://cdn.example/photo.jpg" },
    clip: { src: "/videos/demo.mp4" },
  `;
  assert.deepEqual(extractPortfolioImagePaths(source), ["/images/hero.jpg", "/images/tv/frame.webp"]);
});

test("commented legacy media paths are ignored while slashes inside strings are preserved", () => {
  const source = [
    `// src: "/images/retired-line-comment.jpg"`,
    `/* poster: "/images/retired-block-comment.jpg" */`,
    `const authored = { src: "/images/current.webp" };`,
    `const remote = "https://cdn.example/media//current.jpg";`,
  ].join(String.fromCharCode(10));

  assert.deepEqual(extractPortfolioImagePaths(source), ["/images/current.webp"]);
  const stripped = stripTypeScriptComments(source);
  assert.ok(stripped.includes("https://cdn.example/media//current.jpg"));
  assert.ok(!stripped.includes("retired-line-comment.jpg"));
  assert.ok(!stripped.includes("retired-block-comment.jpg"));
});

test("image path resolution keeps nested names under public and rejects traversal", () => {
  assert.equal(
    resolvePortfolioImage("/portfolio", "/images/works/demo.jpg"),
    path.resolve("/portfolio", "public", "images", "works", "demo.jpg")
  );
  assert.throws(() => resolvePortfolioImage("/portfolio", "/images/../secret.jpg"), /escapes/);
  assert.throws(() => resolvePortfolioImage("/portfolio", "/images/%2e%2e/secret.jpg"), /escapes/);
  assert.throws(() => resolvePortfolioImage("/portfolio", "/images%2fsecret.jpg"), /separators/);
  assert.throws(() => resolvePortfolioImage("/portfolio", "/videos/demo.mp4"), /Expected a local/);
});

test("art audit reports missing paths without creating placeholders", () => {
  const report = auditPortfolioArtwork("/portfolio", `hero: { src: "/images/real.jpg" }, work: { src: "/images/missing.jpg" }`);
  assert.deepEqual(report.unsafe, []);
  assert.deepEqual(report.missing.map(({ imageUrl }) => imageUrl), ["/images/missing.jpg", "/images/real.jpg"]);
});

test("art audit reports unsafe encoded references instead of touching them", () => {
  const report = auditPortfolioArtwork("/portfolio", `hero: { src: "/images/%2e%2e/secret.jpg" }`);
  assert.equal(report.missing.length, 0);
  assert.equal(report.unsafe.length, 1);
  assert.match(report.unsafe[0].message, /escapes/);
});

test("all current default-content image references resolve to authored public files", () => {
  const report = auditProjectArtwork(ROOT);
  assert.ok(report.images.length >= 20, `expected a full portfolio image inventory; got ${report.images.length}`);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.unsafe, []);
  assert.ok(report.images.some((url) => url === "/images/tv2.webp"));
  assert.ok(report.images.some((url) => url === "/images/tv2-alpha.webp"));
  assert.ok(report.images.some((url) => url === "/images/works/sureshot-archive-detail.jpg"));
});

test("npm run art is a read-only audit and leaves all current images untouched", () => {
  const images = path.join(ROOT, "public", "images");
  const before = snapshotTree(images);
  const result = spawnSync(process.execPath, [GENERATOR], { cwd: ROOT, encoding: "utf8" });
  const after = snapshotTree(images);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /read-only audit passed/);
  assert.match(result.stdout, /no files were written/);
  assert.deepEqual(after, before);
});

test("the retired generator refuses --force rather than reviving destructive outputs", () => {
  const images = path.join(ROOT, "public", "images");
  const before = snapshotTree(images);
  const result = spawnSync(process.execPath, [GENERATOR, "--force"], { cwd: ROOT, encoding: "utf8" });
  const after = snapshotTree(images);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--force is unsupported/);
  assert.deepEqual(after, before);
});
