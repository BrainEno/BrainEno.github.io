import { createHash } from "node:crypto";

const VERSION_ASSIGNMENT = /^const VERSION = ["'][^"'\r\n]+["'];$/m;
const HASH_VERSION_PLACEHOLDER = 'const VERSION = "__STATIC_BUILD_REVISION__";';
const NON_CONTENT_EXPORTS = new Set(["build-meta.json", "sitemap.xml"]);

/** Replace only the version literal so the worker can be included in its own digest. */
export function normalizeWorkerVersion(source) {
  if (!VERSION_ASSIGNMENT.test(source)) {
    throw new Error("public/sw.js must contain one literal `const VERSION = \"...\";` assignment");
  }
  return source.replace(VERSION_ASSIGNMENT, HASH_VERSION_PLACEHOLDER);
}

/**
 * Derive a deterministic cache revision from the exported site, not a manually
 * maintained version string. `sw.js` is hashed with its version normalized so
 * its own injected revision does not make the digest recursive. Build metadata
 * and sitemap.xml are excluded because they describe the export, not
 * offline application content.
 */
export function computeStaticRevision(files) {
  const hash = createHash("sha256");
  const ordered = files
    .filter((file) => !NON_CONTENT_EXPORTS.has(file.path))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const file of ordered) {
    hash.update(file.path).update("\0");
    const content = file.path === "sw.js" ? normalizeWorkerVersion(String(file.content)) : file.content;
    hash.update(content).update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

/** Inject the completed export digest into the worker's cache namespace. */
export function injectWorkerVersion(source, revision) {
  if (!/^[a-f0-9]{16}$/.test(revision)) {
    throw new TypeError(`Expected a 16-character lowercase hexadecimal revision, received ${String(revision)}`);
  }
  if (!VERSION_ASSIGNMENT.test(source)) {
    throw new Error("public/sw.js must contain one literal `const VERSION = \"...\";` assignment");
  }
  return source.replace(VERSION_ASSIGNMENT, `const VERSION = "build-${revision}";`);
}
