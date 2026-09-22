import type { HomeLanguage } from "@prisma/client";
import { da, enGB } from "date-fns/locale";
import type { Locale } from "date-fns";

/**
 * Each language named in itself, not translated: a picker somebody uses to find their
 * own language is the one place that is not translated into a language they may not
 * read yet.
 *
 * `Record<HomeLanguage, string>` rather than a list, so adding a language to the schema
 * fails to compile until it has a name here — the same reason `THEME_LABELS` is a
 * `Record` and not an array.
 */
export const LANGUAGE_LABELS: Record<HomeLanguage, string> = {
  EN: "English",
  DA: "Dansk",
};

/** Derived from the labels; typed as a non-empty tuple because that is what z.enum wants. */
export const LANGUAGES = Object.keys(LANGUAGE_LABELS) as [HomeLanguage, ...HomeLanguage[]];

/** The language a home with no choice of its own reads, and the app's own voice. */
export const DEFAULT_LANGUAGE: HomeLanguage = "EN";

/** The field the picker submits under, read by `updateHome`. */
export const LANGUAGE_FIELD = "language";

/** What goes on `<html lang>`. */
export const HTML_LANG: Record<HomeLanguage, string> = {
  EN: "en",
  DA: "da",
};

/**
 * Which of date-fns' locales writes each language's weekdays and months.
 *
 * `enGB` and not `enUS`: this app already writes "21 Sep", not "Sep 21", and a locale
 * chosen only for its plural rules would quietly change every date's word order too.
 */
export const DATE_LOCALES: Record<HomeLanguage, Locale> = {
  EN: enGB,
  DA: da,
};
