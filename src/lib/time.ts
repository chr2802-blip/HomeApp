import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format, startOfWeek, subDays } from "date-fns";

/**
 * The household's timezone. Every due date is decided and displayed here, never in the
 * server's own zone — that is UTC on Vercel and something else on a developer's laptop,
 * which previously meant the same input produced different instants in each place.
 *
 * Change this if the home moves; nothing else depends on the server's local time.
 */
export const TIME_ZONE = "Europe/Copenhagen";

/** Tasks come due at this hour, local to the home. */
export const DUE_HOUR = 9;

/** The same instant, read through the home's clock. */
export function inZone(date: Date) {
  return new TZDate(date, TIME_ZONE);
}

/** Today's date in the home's zone, as the "yyyy-MM-dd" a date input expects. */
export function todayInZone(now: Date = new Date()) {
  return format(inZone(now), "yyyy-MM-dd");
}

/** Formats an instant using the home's clock rather than the server's. */
export function formatInZone(date: Date, pattern: string) {
  return format(inZone(date), pattern);
}

/**
 * The instant of DUE_HOUR on the given calendar day in the home's zone.
 * Returns null when the input is not a usable "yyyy-MM-dd" date.
 */
export function dueAtOn(dateInput: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());
  if (!match) return null;

  const [, year, month, day] = match.map(Number) as [unknown, number, number, number];
  const due = new TZDate(year, month - 1, day, DUE_HOUR, 0, 0, 0, TIME_ZONE);

  // Rejects impossible dates such as 2026-02-31, which would otherwise roll over.
  if (due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== day) {
    return null;
  }
  return new Date(due.getTime());
}

/** DUE_HOUR, `days` after the given moment, in the home's zone. */
export function dueAtDaysFrom(days: number, from: Date = new Date()): Date {
  const start = inZone(from);
  const due = new TZDate(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + days,
    DUE_HOUR,
    0,
    0,
    0,
    TIME_ZONE,
  );
  return new Date(due.getTime());
}

/** The last instant of the given day in the home's zone. */
export function endOfDayInZone(now: Date = new Date()): Date {
  const start = inZone(now);
  const end = new TZDate(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
    23,
    59,
    59,
    999,
    TIME_ZONE,
  );
  return new Date(end.getTime());
}

/**
 * Whole days between two instants as the household counts them — by calendar date in
 * the home's zone, so an evening and the following morning are one day apart however
 * few hours separate them.
 */
export function calendarDaysBetween(target: Date, from: Date) {
  return differenceInCalendarDays(inZone(target), inZone(from));
}

/**
 * The Monday of the week an instant falls in, in the home's zone, as "yyyy-MM-dd".
 *
 * A household's week is the one it lives in, so this is Monday in Copenhagen and not
 * whatever the server thinks the week is. The Monday itself is the key rather than an
 * ISO week number: the week before a Monday is the Monday seven days earlier and
 * nothing else, while "2027-W01" follows "2026-W52" and is a subtraction nobody gets
 * right first time. See `ClearedWeek` in the schema.
 */
export function weekStartInZone(now: Date = new Date()): string {
  return format(startOfWeek(inZone(now), { weekStartsOn: 1 }), "yyyy-MM-dd");
}

/**
 * Midday on a "yyyy-MM-dd" day, in the home's zone — the footing every bit of day
 * arithmetic here stands on.
 *
 * Midday rather than midnight: a day that begins at 01:00 because the clocks went
 * forward is still the same day, and stepping whole days from noon lands on noon
 * whatever the offset did in between. From midnight, one of those steps lands on 23:00
 * the evening before and the date is then a day out, twice a year.
 */
function noonOn(day: string) {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return new TZDate(year, month - 1, date, 12, 0, 0, 0, TIME_ZONE);
}

/**
 * Formats a "yyyy-MM-dd" day for reading — the weekday's name, the date, whatever the
 * pattern asks for.
 *
 * `formatInZone` is for an instant the app stored; this is for a day the app already
 * holds as a day, and it must not become an instant on the way past. Read at noon in the
 * home's zone, so no pattern can print the day before.
 */
export function formatDayInZone(day: string, pattern: string): string {
  return format(noonOn(day), pattern);
}

/** The Monday before the given one, as "yyyy-MM-dd". */
export function previousWeekStart(week: string): string {
  return format(subDays(noonOn(week), 7), "yyyy-MM-dd");
}

/** The Monday after the given one, as "yyyy-MM-dd". */
export function nextWeekStart(week: string): string {
  return format(addDays(noonOn(week), 7), "yyyy-MM-dd");
}

/**
 * The seven days of a week, Monday first, each as "yyyy-MM-dd".
 *
 * Counted out from the Monday rather than derived from a range of instants, because a
 * week is seven calendar days in the home's zone and one of them is 23 hours long twice
 * a year.
 */
export function weekDays(week: string): string[] {
  const monday = noonOn(week);
  return Array.from({ length: 7 }, (_, offset) => format(addDays(monday, offset), "yyyy-MM-dd"));
}

/**
 * The Monday of the week a given day falls in, or null when that is not a real date.
 *
 * What a `?week=` in a URL is read through: anything a person or a stale bookmark can
 * put there comes back as the Monday of a real week or as nothing at all, so no page has
 * to decide what to draw for "2026-02-31". Validated through `dueAtOn`, which already
 * refuses the days that do not exist rather than rolling them over into the next month.
 */
export function weekStartOn(day: string): string | null {
  const instant = dueAtOn(day);
  return instant ? weekStartInZone(instant) : null;
}

/** The instant a week begins: midnight on its Monday, in the home's zone. */
export function weekStartInstant(week: string): Date {
  const [year, month, day] = week.split("-").map(Number) as [number, number, number];
  return new Date(new TZDate(year, month - 1, day, 0, 0, 0, 0, TIME_ZONE).getTime());
}
