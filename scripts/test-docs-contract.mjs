#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { checkDocumentation, collectConcretePathReferences } from "./check-docs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("current architecture facts and static export documentation match the repository", () => {
  const report = checkDocumentation(ROOT);
  assert.deepEqual(report.errors, []);
  assert.ok(report.referenceCount >= 8, `expected concrete paths to be checked, got ${report.referenceCount}`);
});

test("path scanner validates concrete source files and optional line references", () => {
  const references = collectConcretePathReferences(
    "Current: `src/app/layout.tsx:12`, `public/sw.js`, `src/portfolio/*`, `docs/{A,B}.md`, `assets/models/`."
  );
  assert.deepEqual(references, [
    { path: "src/app/layout.tsx", line: 12 },
    { path: "public/sw.js", line: null },
  ]);
});
