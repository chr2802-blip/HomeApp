import type { HomeLanguage } from "@prisma/client";

/** The fewest and most hearts a rating can give. */
export const MIN_HEARTS = 1;
export const MAX_HEARTS = 5;

/** A value from a form is a rating only if it is a whole number of hearts in range. */
export function readHearts(value: unknown): number | null {
  const hearts = Number(value);
  return Number.isInteger(hearts) && hearts >= MIN_HEARTS && hearts <= MAX_HEARTS ? hearts : null;
}

/**
 * What a recipe's ratings add up to: the mean of every one ever given, and how many.
 *
 * Every row counts, including several from the same person — rating a recipe again after
 * cooking it again is the point, and that is how the score moves over time. Asked of the
 * rows each time rather than stored beside them, so it can never disagree with them.
 * Null where nobody has rated it: an unrated recipe has no score, which is not a score
 * of zero.
 */
export function ratingSummary(
  ratings: readonly { hearts: number }[],
): { average: number; count: number } | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, rating) => sum + rating.hearts, 0);
  return { average: total / ratings.length, count: ratings.length };
}

/**
 * An average as a person reads it: one decimal, in the household's own separator — "4,3"
 * in Danish, "4.3" in English — and a whole number without a trailing ",0".
 */
export function formatAverage(average: number, language: HomeLanguage): string {
  const rounded = Math.round(average * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return language === "DA" ? text.replace(".", ",") : text;
}
