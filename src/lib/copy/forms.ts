import type { Phrase } from "./say";

/**
 * What a form says when nothing more specific applies — `readForm`'s own fallback, and
 * the ceiling message every long field shares.
 */
export const FORMS = {
  checkAndTryAgain: { EN: "Check the form and try again.", DA: "Tjek formularen og prøv igen." },
  tooLong: {
    EN: "That is too long — keep it under {limit} characters.",
    DA: "Det er for langt — hold det under {limit} tegn.",
  },
} as const satisfies Record<string, Phrase>;
