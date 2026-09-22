import type { HomeLanguage } from "@prisma/client";
import { formatDayInZone, readDayInZone } from "./time";
import { sayIn } from "./copy/say";
import { DATE } from "./copy/dates";
import { MEALS } from "./copy/meals";

/**
 * The field a day's plan is submitted in, and the values in it that are not a recipe.
 *
 * Every state arrives through one control, because the row behind them holds one answer
 * and no more: a recipe id is what is being cooked, `PLAN_OUT` is a night out,
 * `PLAN_LEFTOVERS` followed by a day is that day's cooking again, and an empty value is
 * the day going back to nothing planned. A separate "eating out" checkbox beside a
 * recipe picker would let a form say both at once, which is a question the table cannot
 * store the answer to — and leftovers would be a second such checkbox, able to disagree
 * with the first.
 */
export const PLAN_FIELD = "plan";
export const PLAN_OUT = "out";
export const PLAN_NOTHING = "";

/**
 * What a leftovers choice looks like on the way in: the marker, then the day being eaten
 * again. It carries the day rather than standing alone because "leftovers" on its own
 * does not say what is for dinner, and the row it writes is a pointer.
 */
export const PLAN_LEFTOVERS = "leftovers:";

/** The choice a day submits to live off `day`'s cooking. */
export function leftoversChoice(day: string) {
  return `${PLAN_LEFTOVERS}${day}`;
}

/** The day a leftovers choice names, or null when the choice is not one. */
export function leftoversDay(choice: string): string | null {
  return choice.startsWith(PLAN_LEFTOVERS) ? choice.slice(PLAN_LEFTOVERS.length) : null;
}

/** What a planned day says on its row, and in the picker. */
export function outLabel(language: HomeLanguage) {
  return sayIn(language)(MEALS.eatingOut);
}
export function nothingPlannedLabel(language: HomeLanguage) {
  return sayIn(language)(MEALS.nothingPlanned);
}
export function leftoversHeading(language: HomeLanguage) {
  return sayIn(language)(MEALS.leftovers);
}

/**
 * What a leftovers day says it is eating: the meal and the day it was cooked, or the
 * bare word where the pointer no longer reaches anything.
 *
 * The bare word is not a failure to report. A day cleared, or cooked in a week that is
 * not on screen, leaves the household eating leftovers of something — which is the half
 * of it the row still knows, and the half that matters at six o'clock.
 */
export function leftoversLabel(source: { day: string; title: string } | null, language: HomeLanguage) {
  const say = sayIn(language);
  return source
    ? say(MEALS.leftoversOf, { day: weekdayName(source.day, language), title: source.title })
    : say(MEALS.leftovers);
}

/** Monday, Tuesday — the heading a day's row is read by. */
export function weekdayName(day: string, language: HomeLanguage) {
  return readDayInZone(day, DATE.weekday, language);
}

/** The date beside it, without the year: the week on screen says which year it is. */
export function dayAndMonth(day: string, language: HomeLanguage) {
  return readDayInZone(day, DATE.dayMonth, language);
}

/**
 * The week in words, as short as it can be said: "21–27 Sep", or both months where the
 * week straddles them, or both years where it straddles those.
 *
 * The year is only ever said when it changes inside the week, because the household is
 * looking at a week it navigated to and the year is not what it stepped through.
 */
export function weekLabel(days: string[], language: HomeLanguage) {
  const first = days[0]!;
  const last = days[days.length - 1]!;

  if (formatDayInZone(first, "yyyy") !== formatDayInZone(last, "yyyy")) {
    return `${readDayInZone(first, DATE.dayMonthYear, language)} – ${readDayInZone(last, DATE.dayMonthYear, language)}`;
  }
  if (formatDayInZone(first, "MMM") !== formatDayInZone(last, "MMM")) {
    return `${readDayInZone(first, DATE.dayMonth, language)} – ${dayAndMonth(last, language)}`;
  }
  return `${formatDayInZone(first, "d")}–${dayAndMonth(last, language)}`;
}
