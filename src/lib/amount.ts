/**
 * How many of a thing a list item stands for.
 *
 * Lists opt into amounts when they are made: a shopping list wants "2 milk", a list of
 * jobs to do just wants the job. Items on a list that does not track them still carry
 * an amount of 1, so turning the setting on later shows something sensible rather than
 * nothing.
 */

/** Nothing a household buys needs three digits, and a typo should not become one. */
export const MAX_AMOUNT = 99;

export const MIN_AMOUNT = 1;

/**
 * Brings any value into range.
 *
 * Out-of-range input is clamped rather than rejected: the picker cannot produce one, so
 * anything else arrived by hand, and somebody who cleared the box meant the smallest
 * amount rather than a form they have to go back and correct.
 */
export function clampAmount(value: unknown): number {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) return MIN_AMOUNT;
  return Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, rounded));
}
