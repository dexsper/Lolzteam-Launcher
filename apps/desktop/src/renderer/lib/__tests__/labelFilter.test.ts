import { describe, expect, it } from 'vitest';
import { matchesLabelFilters } from '../labelFilter';

describe('matchesLabelFilters', () => {
  it('passes everything when no filters are set', () => {
    expect(matchesLabelFilters([1, 2], [], [])).toBe(true);
    expect(matchesLabelFilters([], [], [])).toBe(true);
  });

  it('include: keeps accounts that have ANY included label', () => {
    expect(matchesLabelFilters([1, 5], [5], [])).toBe(true);
    expect(matchesLabelFilters([1, 2], [5, 2], [])).toBe(true); // has 2
  });

  it('include: hides accounts that have none of the included labels', () => {
    expect(matchesLabelFilters([1, 2], [5], [])).toBe(false);
    expect(matchesLabelFilters([], [5], [])).toBe(false); // untagged
  });

  it('exclude: hides accounts that have ANY excluded label', () => {
    expect(matchesLabelFilters([1, 9], [], [9])).toBe(false);
    expect(matchesLabelFilters([1, 2], [], [9])).toBe(true);
  });

  it('combines include and exclude', () => {
    // must have 5, must not have 9
    expect(matchesLabelFilters([5, 1], [5], [9])).toBe(true);
    expect(matchesLabelFilters([5, 9], [5], [9])).toBe(false); // excluded wins
    expect(matchesLabelFilters([1], [5], [9])).toBe(false); // missing include
  });

  it('accepts a Set as well as an array', () => {
    expect(matchesLabelFilters(new Set([3]), [3], [])).toBe(true);
  });
});
