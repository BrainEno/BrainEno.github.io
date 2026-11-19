#!/usr/bin/env node
/**
 * `npm run art` is deliberately read-only.
 *
 * The original generator predates the current portfolio media names. It wrote
 * generic TV / portrait / gallery files that the content no longer referenced,
 * and some outputs overwrote authored work covers. Keeping that renderer behind
 * an explicit `--force` switch would still leave a path for accidental damage,
 * so it has been retired in favour of an audit of the current content contract.
 *
 * Use `npm run images` to create cache-busted responsive WebP derivatives. That
 * command never changes source artwork. Add or replace authored media manually
 * under `public/images/`, then update `defaults.ts` and run the read-only audit.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditProjectArtwork } from "./art-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const unsupported = process.argv.slice(2).filter((arg) => arg !== "--check");

if (unsupported.includes("--force")) {
  console.error("[art] --force is unsupported: the legacy generator has been retired to protect authored media.");
  console.error("[art] Add current assets manually and run `npm run art` to validate them.");
  process.exitCode = 2;
} else if (unsupported.length > 0) {
  console.error(`[art] Unknown option(s): ${unsupported.join(", ")}`);
  console.error("[art] This command is read-only; accepted option: --check");
  process.exitCode = 2;
} else {
  const report = auditProjectArtwork(root);
  if (report.unsafe.length > 0 || report.missing.length > 0) {
    for (const entry of report.unsafe) console.error(`[art] unsafe ${entry.imageUrl}: ${entry.message}`);
    for (const entry of report.missing) console.error(`[art] missing ${entry.imageUrl} → ${entry.filename}`);
    console.error(`[art] ${report.images.length} referenced image(s), ${report.missing.length} missing, ${report.unsafe.length} unsafe`);
    process.exitCode = 1;
  } else {
    console.log(`[art] read-only audit passed: ${report.images.length} live image path(s) exist; no files were written.`);
    console.log("[art] Use `npm run images` to regenerate responsive derivatives after changing source media.");
  }
}
