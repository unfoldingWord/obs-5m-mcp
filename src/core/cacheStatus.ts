/**
 * Overall cache status of several lookups, as reported in `_meta`: "hit"
 * when none missed the cache, "miss" when all did, "partial" otherwise.
 * No lookups at all counts as "hit".
 */
export function combineCacheStatus(
  statuses: ReadonlyArray<"hit" | "miss">,
): "hit" | "miss" | "partial" {
  const misses = statuses.filter((s) => s === "miss").length;
  if (misses === 0) return "hit";
  return misses === statuses.length ? "miss" : "partial";
}
