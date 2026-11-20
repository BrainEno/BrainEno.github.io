import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defaultContent } from "./defaults";
import { normalizeContent } from "./normalize";
import type { PortfolioContent } from "./types";
import { formatIssues, unwrapSnapshot, validateContent } from "./validate";

/**
 * The one place a page asks for the site's content.
 *
 * Content is resolved at build time, from a file in the repository — either the
 * committed snapshot `content/published.json` or the authored defaults in
 * `content/defaults.ts`.
 * There is no database and no request-time lookup, which is what lets the whole
 * site be `output: "export"`-ed into a folder any static host can serve.
 *
 * To change the site, edit `published.json` (or `defaults.ts`) and rebuild —
 * the deploy is the editor. `/admin` deliberately does not exist: a static site
 * has no session to protect and nowhere to save a request, so a browser-only
 * "studio" would only ever be a mock-up of one.
 *
 * The snapshot may be the documented `{ "exportedAt": …, "content": { … } }`
 * wrapper or a bare content object; both are accepted (#51). Unreadable or
 * structurally unknown snapshots are now loud build errors in the log instead
 * of a silent fallback, and structural problems list their content path (#68).
 */

/** Resolved per call, so tests can point the build at a fixture directory. */
function publishedFilePath(): string {
  return path.join(process.cwd(), "src", "portfolio", "content", "published.json");
}

/**
 * An optional content snapshot. Without one, a fresh clone builds from the
 * authored defaults and needs nothing else.
 */
function readPublishedSnapshot(): { raw: unknown; error: unknown } | null {
  const file = publishedFilePath();
  try {
    if (!existsSync(file)) return null;
    return { raw: JSON.parse(readFileSync(file, "utf8")), error: null };
  } catch (error) {
    return { raw: null, error };
  }
}

/** True when a content-owned path exists under `public/`. */
function publicFileExists(publicPath: string): boolean {
  return existsSync(path.join(process.cwd(), "public", publicPath.replace(/^\//, "")));
}

export async function getSiteContent(): Promise<PortfolioContent> {
  const snapshot = readPublishedSnapshot();

  let raw: unknown = defaultContent;
  let published = false;
  if (snapshot) {
    if (snapshot.error) {
      console.error("[content:error] (root) — published.json is not readable; falling back to defaults\n", snapshot.error);
    } else {
      const { content, issues } = unwrapSnapshot(snapshot.raw);
      for (const line of formatIssues(issues)) console.error(line);
      if (content) {
        raw = content;
        published = true;
      } // else: unwrap already said what was wrong; defaults take over
    }
  }

  // Structural checks run on the raw input so paths name the authored file —
  // defaults included: a broken template should be just as loud as a broken
  // snapshot. The build keeps going (these are maintainer-facing warnings, not
  // gates), but nothing is silent anymore. Note the default path keeps its
  // original object identity on export, so `defaultContent` is returned as-is
  // when nothing was published.
  const structure = validateContent(raw as Record<string, unknown>, { exists: publicFileExists });
  for (const line of formatIssues(structure)) console.warn(line);

  return published ? normalizeContent(raw) : (raw as PortfolioContent);
}

/** When the committed snapshot was exported, for `sitemap.xml`'s lastmod. */
export async function getContentUpdatedAt(): Promise<string | null> {
  const snapshot = readPublishedSnapshot();
  if (!snapshot || snapshot.error) return null;
  const { content, exportedAt } = unwrapSnapshot(snapshot.raw);
  if (!content || !exportedAt || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(exportedAt)) return null;
  return Number.isFinite(Date.parse(exportedAt)) ? exportedAt : null;
}
