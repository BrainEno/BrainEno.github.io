#!/usr/bin/env node
/**
 * Unit tests for the build-time content contract (#51 + #68):
 *
 *   - `unwrapSnapshot` accepts the documented `{ exportedAt, content }` wrapper
 *     and a bare content object, and names what is wrong otherwise (#51).
 *   - `getSiteContent()` uses a wrapped snapshot instead of dropping it, still
 *     falls back loudly on junk, and `getContentUpdatedAt()` reads the wrapper
 *     timestamp.
 *   - `validateContent` flags truncated strings/oversized lists, missing
 *     image files, duplicate work ids, the cover-repeated-as-detail-image
 *     slip (#74) and a bad defaultLanguage — each with its content path.
 *   - `normalizeContent` keeps renaming duplicate ids, now alongside a warning.
 *
 * The content modules are TypeScript. Node ≥ 22.18 strips erasable types on
 * its own; the only gap is their extensionless relative imports (`./defaults`),
 * which a tiny synchronous resolve hook below maps to the real files. No build
 * step, no tsx, no fixture compile dance: the tests exercise the same source
 * the bundler sees.
 *
 * Run:  npm run test:content
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = path.join(ROOT, "src", "portfolio", "content");

// Extensionless relative imports inside src/portfolio/content/*.ts resolve to
// `<specifier>.ts`; everything else (node:, JSON, files with extensions) is
// untouched. Sync hooks keep the loader on the main thread.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      const parent = context.parentURL ? fileURLToPath(context.parentURL) : null;
      if (parent && parent.startsWith(path.join(ROOT, "src", "portfolio") + path.sep)) {
        const candidate = path.resolve(path.dirname(parent), `${specifier}.ts`);
        if (existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { unwrapSnapshot, validateContent, scanOversized, MAX_LIST, MAX_STRING } = await import(
  pathToFileURL(path.join(CONTENT_DIR, "validate.ts")).href
);
const { normalizeContent } = await import(pathToFileURL(path.join(CONTENT_DIR, "normalize.ts")).href);
const { defaultContent } = await import(pathToFileURL(path.join(CONTENT_DIR, "defaults.ts")).href);
const { getSiteContent, getContentUpdatedAt } = await import(pathToFileURL(path.join(CONTENT_DIR, "source.ts")).href);

const ORIGINAL_CWD = process.cwd();

/** Point the content pipeline at a throwaway project directory. */
async function withFixture(files, fn) {
  const dir = mkdtempSync(path.join(process.env.TEST_TMPDIR || tmpdir(), "pf-content-"));
  try {
    for (const [relative, body] of Object.entries(files)) {
      const target = path.join(dir, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
    process.chdir(dir);
    return await fn(dir);
  } finally {
    process.chdir(ORIGINAL_CWD);
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Capture console output produced while `fn` (sync or async) runs. */
async function captureConsole(fn) {
  const lines = { warn: [], error: [] };
  const warn = console.warn;
  const error = console.error;
  console.warn = (...args) => lines.warn.push(args.map(String).join(" "));
  console.error = (...args) => lines.error.push(args.map(String).join(" "));
  try {
    return { result: await fn(), lines };
  } finally {
    console.warn = warn;
    console.error = error;
  }
}

const snapshotFixture = (snapshot) => ({
  "src/portfolio/content/published.json": typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot),
  "public/.keep": "",
});

test("#51 unwrapSnapshot accepts the documented { exportedAt, content } wrapper", () => {
  const { content, exportedAt, issues } = unwrapSnapshot({
    exportedAt: "2026-11-03T00:00:00.000Z",
    content: { version: 2, identity: { name: "Custom Studio" } },
  });
  assert.equal(exportedAt, "2026-11-03T00:00:00.000Z");
  assert.equal(content.identity.name, "Custom Studio");
  assert.deepEqual(issues, []);
});

test("#51 unwrapSnapshot accepts a bare content object (backward compatible)", () => {
  const { content, exportedAt, issues } = unwrapSnapshot({ version: 2, identity: { name: "Bare" } });
  assert.equal(exportedAt, null);
  assert.equal(content.identity.name, "Bare");
  assert.deepEqual(issues, []);
});

test("#51 unwrapSnapshot names unusable structures instead of silently passing them on", () => {
  const cases = [
    [["not", "an", "object"], "an array"],
    ["a string", "string"],
    [{ content: "wrapped-but-wrong" }, "`content` must be an object"],
    [{ exportedAt: "2026-01-01", someSnapshotMeta: true }, "no known top-level keys"],
  ];
  for (const [raw, fragment] of cases) {
    const { content, issues } = unwrapSnapshot(raw);
    assert.equal(content, null, JSON.stringify(raw));
    assert.ok(issues.some((issue) => issue.severity === "error"), JSON.stringify(raw));
    assert.ok(issues[0].message.includes(fragment), `${issues[0]?.message} should mention ${fragment}`);
  }
});

test("#51 getSiteContent honours a wrapped snapshot, getContentUpdatedAt its timestamp", async () => {
  const exportedAt = "2026-11-16T00:00:00.000Z";
  const { result, lines } = await captureConsole(() =>
    withFixture(
      snapshotFixture({ exportedAt, content: { version: 2, identity: { name: "Custom Studio", defaultLanguage: "en" }, works: { items: [] } } }),
      async () => {
        const content = await getSiteContent();
        const updatedAt = await getContentUpdatedAt();
        return { content, updatedAt };
      }
    )
  );
  const { content, updatedAt } = result;
  assert.equal(content.identity.name, "Custom Studio");
  assert.equal(content.identity.defaultLanguage, "en");
  assert.equal(updatedAt, exportedAt);
  assert.deepEqual(lines.error, []);
});

test("#51 getSiteContent still reads a bare snapshot", async () => {
  const { result: content, lines } = await captureConsole(() =>
    withFixture(snapshotFixture({ identity: { name: "Bare Bones" } }), () => getSiteContent())
  );
  assert.equal(content.identity.name, "Bare Bones");
  assert.deepEqual(lines.error, []);
});

test("#51 an unreadable published.json is an error in the log, defaults take over", async () => {
  const { result: content, lines } = await captureConsole(() =>
    withFixture(snapshotFixture("{ not json …"), () => getSiteContent())
  );
  assert.equal(content.identity.name, defaultContent.identity.name);
  assert.ok(lines.error.some((line) => line.includes("published.json is not readable")));
});

test("#51 an unknown snapshot shape is an error in the log, defaults take over", async () => {
  const { result: content, lines } = await captureConsole(() =>
    withFixture(snapshotFixture({ totally: "unknown" }), () => getSiteContent())
  );
  assert.equal(content.identity.name, defaultContent.identity.name);
  assert.ok(lines.error.some((line) => line.includes("no known top-level keys")));
});

test("#68 truncated strings and oversized lists are reported with their paths", () => {
  const raw = {
    identity: { description: { zh: "长".repeat(MAX_STRING + 10) } },
    intro: { gallery: Array.from({ length: MAX_LIST + 3 }, () => ({ src: "/x.jpg" })) },
  };
  const paths = scanOversized(raw).map((issue) => issue.path);
  assert.ok(paths.includes("identity.description.zh"), paths.join(", "));
  assert.ok(paths.includes("intro.gallery"), paths.join(", "));
});

test("#68 truncation warnings survive the full pipeline and the value is still clamped", async () => {
  const long = "啊".repeat(MAX_STRING + 50);
  const { result: content, lines } = await captureConsole(() =>
    withFixture(snapshotFixture({ identity: { description: { zh: long } } }), () => getSiteContent())
  );
  assert.equal(content.identity.description.zh.length, MAX_STRING);
  assert.ok(lines.warn.some((line) => line.includes("identity.description.zh") && line.includes(String(MAX_STRING))));
});

test("#68 normalized duplicate work ids keep working AND produce a warning", async () => {
  const dup = (title) => ({ id: "same-id", title: { zh: title, en: title }, image: { src: "", alt: { zh: "", en: "" } } });
  const { result: content, lines } = await captureConsole(() =>
    withFixture(snapshotFixture({ works: { items: [dup("One"), dup("Two")] } }), () => getSiteContent())
  );
  const ids = content.works.items.map((work) => work.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(lines.warn.some((line) => line.includes("same-id") && line.includes("works.items[1].id")));
});

test("#68 missing media files are named with their content path", () => {
  const issues = validateContent(
    {
      works: { tv: { src: "/images/nope.webp", screen: {} }, items: [{ id: "a", image: { src: "/images/also-nope.jpg" } }] },
      contact: { image: { src: "/images/fine.jpg" } },
    },
    { exists: (p) => p === "/images/fine.jpg" }
  );
  const paths = issues.map((issue) => issue.path).sort();
  assert.deepEqual(paths, ["works.items[0].image.src", "works.tv.src"]);
});

test("#68 a detail image repeating the cover is flagged (#74 build hint)", () => {
  const issues = validateContent(
    { works: { items: [{ id: "a", image: { src: "/images/a.jpg" }, detailImages: [{ src: "/images/a.jpg" }] }] } },
    { exists: () => true }
  );
  assert.ok(issues.some((issue) => issue.path === "works.items[0].detailImages[0]"));
});

test("#68 a bad defaultLanguage is flagged", () => {
  const issues = validateContent({ identity: { defaultLanguage: "fr" }, works: { items: [] } }, { exists: () => true });
  assert.ok(issues.some((issue) => issue.path === "identity.defaultLanguage"));
});

test("the committed defaults themselves are warning-free and keep their identity", async () => {
  // The repo baseline: `defaults.ts` is served as-is, no snapshot in the tree,
  // and the structural checks must find nothing to complain about.
  const snapshotFile = path.join(ORIGINAL_CWD, "src", "portfolio", "content", "published.json");
  process.chdir(ORIGINAL_CWD);
  try {
    const { result: content, lines } = await captureConsole(() => getSiteContent());
    if (existsSync(snapshotFile)) {
      // A maintainer's local snapshot is legitimate content; equality with
      // defaults is not what this test is about then — absence of noise is.
      assert.ok(content.identity.name.length > 0);
    } else {
      assert.equal(content, defaultContent, "without a snapshot the defaults object is returned unchanged");
    }
    assert.deepEqual(lines.error, []);
    assert.deepEqual(lines.warn, [], `defaults should be warning-free, got:\n${lines.warn.join("\n")}`);
  } finally {
    process.chdir(ORIGINAL_CWD);
  }
});

console.log("\n[content tests] done");


test("undated or unusable content never advertises a sitemap modification time", async () => {
  for (const snapshot of [null, { version: 2 }, { exportedAt: "yesterday", content: { version: 2 } }, '{"exportedAt":"2026-10-01",']) {
    await withFixture(snapshot ? snapshotFixture(snapshot) : {}, async () => {
      assert.equal(await getContentUpdatedAt(), null);
    });
  }
});


test("#26 updating one work does not re-date other work URLs on a new export", async () => {
  const { sitemapEntries } = await import("../src/portfolio/seo/sitemap-entries.ts");
  const works = [
    { id: "changed", updatedAt: "2024-02-29" },
    { id: "stable", updatedAt: "2025-03-01T10:00:00+08:00" },
    { id: "undated" },
    { id: "invalid", updatedAt: "2026-02-30" },
  ];
  const entries = (exportedAt) => sitemapEntries("https://example.org/sub", normalizeContent({ works: { items: works } }).works.items, exportedAt);
  const before = entries("2026-10-20");
  works[0].updatedAt = "2026-11-20";
  const after = entries("2026-11-21");
  assert.equal(after[0].lastModified, "2026-11-21");
  assert.equal(after[1].url, "https://example.org/sub/works/changed/");
  assert.equal(before[1].lastModified, "2024-02-29");
  assert.equal(after[1].lastModified, "2026-11-20");
  assert.deepEqual(after.slice(2), before.slice(2));
  assert.equal(after[2].lastModified, works[1].updatedAt);
  assert.equal(after[3].lastModified, undefined);
  assert.equal(after[4].lastModified, undefined);
  assert.ok(validateContent({ works: { items: works } }).some(issue => issue.path === "works.items[3].updatedAt"));
});
