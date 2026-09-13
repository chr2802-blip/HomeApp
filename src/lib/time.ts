import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

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
