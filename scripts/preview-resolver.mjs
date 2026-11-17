import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

/** Normalize a mount prefix without allowing its spelling to create a second
 *  path interpretation (`repo/`, `//repo`, and `/repo/` are one mount). */
function normalizeMount(value) {
  const segments = String(value || "")
    .split("/")
    .filter(Boolean);
  return segments.length ? `/${segments.join("/")}` : "";
}

/**
 * Return true when `candidate` is the root itself or a descendant of it.
 * `startsWith(root)` is not a path containment test: `/site-evil` starts with
 * `/site`. `path.relative` compares path segments and is safe for siblings.
 */
function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

/**
 * Build a resolver for the static preview server.
 *
 * The returned function accepts an HTTP request target (path plus optional
 * query) and returns a canonical file under `root`, or `null` for every
 * malformed, out-of-mount, missing, or unsafe request. Canonical real paths
 * make the guard apply to symlinks as well as ordinary `..` segments.
 *
 * This module deliberately does not choose a bind address or catch arbitrary
 * process errors. The caller owns the server lifecycle; this function narrows
 * the only expected input failure (invalid URL escapes) into a normal miss.
 */
export function createPreviewResolver(rootDirectory, mountPath = "") {
  const root = path.resolve(rootDirectory);
  const mount = normalizeMount(mountPath);
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    realRoot = root;
  }

  const canonicalExisting = (candidate) => {
    if (!isWithin(root, candidate) || !existsSync(candidate)) return null;
    try {
      const realCandidate = realpathSync(candidate);
      return isWithin(realRoot, realCandidate) ? realCandidate : null;
    } catch {
      return null;
    }
  };

  return function resolvePreviewRequest(requestTarget) {
    const target = String(requestTarget || "/");
    const rawPath = target.split("?", 1)[0] || "/";
    if (!rawPath.startsWith("/")) return null;

    let requested;
    try {
      requested = decodeURIComponent(rawPath);
    } catch {
      // A crawler or a mistyped URL can contain a lone percent sign or an
      // incomplete multibyte sequence. Treat it as a 404; never kill preview.
      return null;
    }

    // NUL is rejected by file APIs, while backslash is a path separator on
    // Windows. Reject both before platform-specific normalization.
    if (requested.includes("\0") || requested.includes("\\")) return null;

    if (mount) {
      if (requested !== mount && !requested.startsWith(`${mount}/`)) return null;
      requested = requested.slice(mount.length) || "/";
    }

    const clean = requested.replace(/\/+$/, "") || "/";
    const relative = clean.replace(/^\/+/, "");
    const targetFile = path.resolve(root, relative);
    if (!isWithin(root, targetFile)) return null;

    const existing = canonicalExisting(targetFile);
    if (existing) {
      try {
        if (statSync(existing).isDirectory()) {
          const index = canonicalExisting(path.join(existing, "index.html"));
          return index && statSync(index).isFile() ? index : null;
        }
        return statSync(existing).isFile() ? existing : null;
      } catch {
        return null;
      }
    }

    // Trailing-slash URLs and clean directory URLs both resolve to the
    // exported index, matching a static host without an SPA fallback.
    const index = canonicalExisting(path.join(targetFile, "index.html"));
    if (!index) return null;
    try {
      return statSync(index).isFile() ? index : null;
    } catch {
      return null;
    }
  };
}

export { isWithin as isPathInside };
