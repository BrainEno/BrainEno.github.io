/** Sitemap dates must be real calendar dates; Date.parse alone rolls Feb 30 into March. */
export function modifiedDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) return undefined;
  const day = value.slice(0, 10);
  return Number.isFinite(Date.parse(value)) && new Date(day).toISOString().startsWith(day + "T") ? value : undefined;
}
