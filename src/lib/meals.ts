import { formatDayInZone } from "./time";

/**
 * The field a day's plan is submitted in, and the one value in it that is not a recipe.
 *
 * Three states arrive through one control, because the row behind them has three states
 * and no more: a recipe id is what is being cooked, `PLAN_OUT` is a night out, and an
 * empty value is the day going back to nothing planned. A separate "eating out" checkbox
 * beside a recipe picker would let a form say both at once, which is a question the
 * table cannot store the answer to.
 */
export const PLAN_FIELD = "plan";
export const PLAN_OUT = "out";
export const PLAN_NOTHING = "";

/** What a planned day says on its row, and in the picker. */
export const OUT_LABEL = "Eating out";
export const NOTHING_LABEL = "Nothing planned";

/** Monday, Tuesday — the heading a day's row is read by. */
export function weekdayName(day: string) {
  return formatDayInZone(day, "EEEE");
}

/** The date beside it, without the year: the week on screen says which year it is. */
export function dayAndMonth(day: string) {
  return formatDayInZone(day, "d MMM");
}

/**
 * The week in words, as short as it can be said: "21–27 Sep", or both months where the
 * week straddles them, or both years where it straddles those.
 *
 * The year is only ever said when it changes inside the week, because the household is
 * looking at a week it navigated to and the year is not what it stepped through.
 */
export function weekLabel(days: string[]) {
  const first = days[0]!;
  const last = days[days.length - 1]!;

  if (formatDayInZone(first, "yyyy") !== formatDayInZone(last, "yyyy")) {
    return `${formatDayInZone(first, "d MMM yyyy")} – ${formatDayInZone(last, "d MMM yyyy")}`;
  }
  if (formatDayInZone(first, "MMM") !== formatDayInZone(last, "MMM")) {
    return `${formatDayInZone(first, "d MMM")} – ${dayAndMonth(last)}`;
  }
  return `${formatDayInZone(first, "d")}–${dayAndMonth(last)}`;
}
