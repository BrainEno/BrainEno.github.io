#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPreviewResolver, isPathInside } from "./preview-resolver.mjs";

const tempRoots = [];

function fixture(t) {
  const temp = mkdtempSync(path.join(os.tmpdir(), "preview-resolver-"));
  tempRoots.push(temp);
  t.after(() => {
    rmSync(temp, { recursive: true, force: true });
    tempRoots.splice(tempRoots.indexOf(temp), 1);
  });

  const root = path.join(temp, "out");
  mkdirSync(path.join(root, "works", "demo"), { recursive: true });
  writeFileSync(path.join(root, "index.html"), "<h1>home</h1>");
  writeFileSync(path.join(root, "works", "demo", "index.html"), "<h1>work</h1>");
  writeFileSync(path.join(root, "robots.txt"), "User-agent: *");
  const sibling = path.join(temp, "out-evil");
  mkdirSync(sibling);
  writeFileSync(path.join(sibling, "secret.txt"), "not part of the export");
  return { root, sibling, temp };
}

test("path containment is segment-aware, not string-prefix based", () => {
  const root = path.resolve("/tmp/site/out");
  assert.equal(isPathInside(root, root), true);
  assert.equal(isPathInside(root, path.join(root, "works", "demo")), true);
  assert.equal(isPathInside(root, path.resolve("/tmp/site/out-evil/secret")), false);
  assert.equal(isPathInside(root, path.resolve("/tmp/site/other")), false);
});

test("root and exported files resolve to canonical files", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("/"), path.join(root, "index.html"));
  assert.equal(resolve("/robots.txt"), path.join(root, "robots.txt"));
  assert.equal(resolve("/robots.txt?cache=off"), path.join(root, "robots.txt"));
});

test("directory URLs use their exported index without SPA fallbacks", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("/works/demo"), path.join(root, "works", "demo", "index.html"));
  assert.equal(resolve("/works/demo/"), path.join(root, "works", "demo", "index.html"));
  assert.equal(resolve("/missing"), null);
  assert.equal(resolve("/missing/route"), null);
});

test("malformed percent escapes become ordinary misses", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  for (const request of ["/%zz", "/%", "/works/%E0%A4%A", "/%F0%28%8C%28"]) {
    assert.equal(resolve(request), null, `${request} should not resolve`);
  }
  // A malformed-looking query is not a path and is ignored after the `?`.
  assert.equal(resolve("/robots.txt?query=%zz"), path.join(root, "robots.txt"));
});

test("NUL and platform path separators are rejected", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("/%00"), null);
  assert.equal(resolve("/works%5Cdemo%5Cindex.html"), null);
});

test("raw parent segments cannot escape the export", (t) => {
  const { root, sibling } = fixture(t);
  const resolve = createPreviewResolver(root);
  const request = "/../out-evil/secret.txt";
  assert.equal(resolve(request), null);
  assert.equal(readFileSync(path.join(sibling, "secret.txt"), "utf8"), "not part of the export");
});

test("encoded traversal and encoded separators cannot escape the export", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("/%2e%2e/out-evil/secret.txt"), null);
  assert.equal(resolve("/%2e%2e%2fout-evil%2fsecret.txt"), null);
  assert.equal(resolve("/works/%2e%2e/%2e%2e/out-evil/secret.txt"), null);
});

test("same-prefix siblings do not pass the containment check", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("/../out-evil/secret.txt"), null);
  assert.equal(resolve("/../out-evil/"), null);
});

test("mount prefixes are exact path segments", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root, "/repo/");
  assert.equal(resolve("/repo"), path.join(root, "index.html"));
  assert.equal(resolve("/repo/"), path.join(root, "index.html"));
  assert.equal(resolve("/repo/works/demo/"), path.join(root, "works", "demo", "index.html"));
  assert.equal(resolve("/repoish/works/demo/"), null);
  assert.equal(resolve("/other/works/demo/"), null);
});

test("mounted requests are decoded before mount and path checks", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root, "/repo");
  assert.equal(resolve("/repo/%77orks/demo/"), path.join(root, "works", "demo", "index.html"));
  assert.equal(resolve("/repo/%2e%2e/out-evil/secret.txt"), null);
  assert.equal(resolve("/repo/%zz"), null);
});

test("symlinks that point outside the export are rejected", (t) => {
  const { root, sibling } = fixture(t);
  const link = path.join(root, "outside.txt");
  try {
    symlinkSync(path.join(sibling, "secret.txt"), link);
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip("the current platform does not permit symlink creation");
      return;
    }
    throw error;
  }
  assert.equal(createPreviewResolver(root)("/outside.txt"), null);
});

test("symlinks that remain inside the export are allowed", (t) => {
  const { root } = fixture(t);
  const link = path.join(root, "home-alias.html");
  try {
    symlinkSync(path.join(root, "index.html"), link);
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      t.skip("the current platform does not permit symlink creation");
      return;
    }
    throw error;
  }
  assert.equal(createPreviewResolver(root)("/home-alias.html"), path.join(root, "index.html"));
});

test("non-origin-form request targets are not filesystem paths", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve("https://example.test/index.html"), null);
  assert.equal(resolve("index.html"), null);
});

test("empty and repeated slash request paths normalize inside the mount", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root);
  assert.equal(resolve(""), path.join(root, "index.html"));
  assert.equal(resolve("///works//demo///"), path.join(root, "works", "demo", "index.html"));
});

test("mount normalization does not broaden access to similarly named paths", (t) => {
  const { root } = fixture(t);
  const resolve = createPreviewResolver(root, "//repo///");
  assert.equal(resolve("/repo/"), path.join(root, "index.html"));
  assert.equal(resolve("/repo-archive/"), null);
  assert.equal(resolve("/repos/"), null);
});

test("a missing export and non-file special paths fail closed", () => {
  const missing = path.join(os.tmpdir(), `no-preview-${process.pid}-${Date.now()}`);
  assert.equal(createPreviewResolver(missing)("/"), null);
});

test.after(() => {
  for (const temp of tempRoots.splice(0)) rmSync(temp, { recursive: true, force: true });
});
