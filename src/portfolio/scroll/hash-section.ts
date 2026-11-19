import type { SectionId } from "../content/types";

/** Resolve only the portfolio's three public section hashes. */
export function sectionFromHash(hash: string): SectionId | null {
  switch (hash) {
    case "#intro":
      return "intro";
    case "#works":
      return "works";
    case "#contact":
      return "contact";
    default:
      return null;
  }
}
