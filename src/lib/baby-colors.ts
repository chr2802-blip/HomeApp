/**
 * The baby log's kinds as colours. What each colour *is* lives in `globals.css`; this
 * holds only the names, so a component reads `var(--baby-sleep)` rather than a hex, and
 * `tests/unit/baby-colors.test.ts` can hold the stylesheet to every name here.
 */
export const BABY_KINDS = ["sleep", "feed", "diaper"] as const;
export type BabyColorKind = (typeof BABY_KINDS)[number];

/** Every shade the stylesheet declares for each kind. */
export const BABY_SHADES = ["", "-soft", "-text"] as const;

export const babyColor = (kind: BabyColorKind, shade: (typeof BABY_SHADES)[number] = "") =>
  `var(--baby-${kind}${shade})`;
