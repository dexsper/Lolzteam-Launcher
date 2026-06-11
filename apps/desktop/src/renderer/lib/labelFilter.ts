// Label (метка) filtering: an account passes when it carries AT LEAST ONE of the
// included labels (or no include filter is set) and NONE of the excluded labels.
export const matchesLabelFilters = (
  tagIds: Iterable<number>,
  include: readonly number[],
  exclude: readonly number[],
): boolean => {
  const ids = tagIds instanceof Set ? (tagIds as Set<number>) : new Set(tagIds);
  if (include.length > 0 && !include.some((id) => ids.has(id))) return false;
  if (exclude.some((id) => ids.has(id))) return false;
  return true;
};
