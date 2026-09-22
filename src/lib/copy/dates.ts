import type { Phrase, Plural } from "./say";

/**
 * The patterns dates are read through, and the handful of sentences built from a
 * `calendarDaysBetween`.
 *
 * A pattern is a `Phrase` and not a bare string, because a pattern can hold words —
 * the quoted `'at'` in "d MMM 'at' HH:mm" is English sitting inside what looks like a
 * format, invisible to anything looking for copy that is not here. Danish writes
 * "d. MMM 'kl.' HH:mm", which also moves the full stop after the day.
 */
export const DATE = {
  /** "3 Nov", "3. nov" for a line somebody reads. */
  dayMonth: { EN: "d MMM", DA: "d. MMM" },
  /** "3 Nov 2026", used where the year matters. */
  dayMonthYear: { EN: "d MMM yyyy", DA: "d. MMM yyyy" },
  /** The full weekday name, used once — the meal plan's day headings. */
  weekday: { EN: "EEEE", DA: "EEEE" },
  /** A bare month, for comparing two dates' months against each other. */
  month: { EN: "MMM", DA: "MMM" },
  /** An instant with the time of day, for admin and reminder timestamps. */
  dayAndTime: { EN: "d MMM 'at' HH:mm", DA: "d. MMM 'kl.' HH:mm" },
  dayTime: { EN: "d MMM HH:mm", DA: "d. MMM HH:mm" },
} as const satisfies Record<string, Phrase>;

export const DUE = {
  overdue: {
    EN: { one: "{count} day overdue", other: "{count} days overdue" },
    DA: { one: "{count} dag over tid", other: "{count} dage over tid" },
  },
  today: { EN: "Due today", DA: "Forfalder i dag" },
  tomorrow: { EN: "Due tomorrow", DA: "Forfalder i morgen" },
  onDay: { EN: "Due {day}", DA: "Forfalder {day}" },
} as const satisfies Record<string, Phrase | Plural>;
