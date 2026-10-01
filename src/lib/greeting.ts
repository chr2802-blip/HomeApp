import type { HomeLanguage } from "@prisma/client";
import { formatInZone, todayInZone } from "@/lib/time";
import { seasonOn } from "@/lib/season";
import { sayIn } from "@/lib/copy/say";
import { DAY_LINE, GREETING } from "@/lib/copy/dashboard";

/**
 * The dashboard's greeting and the line under it — the app speaking like somebody who
 * lives here rather than like a status bar.
 *
 * Both take the clock as an argument, the way `weekWorkload` does, so a test can say
 * seven in the morning and mean it, and both read the household's clock rather than the
 * server's: a UTC server greeting a Copenhagen kitchen at 07:30 would say "Still up?".
 */

export type PartOfDay = keyof typeof GREETING;

/** Morning from five, afternoon from eleven, evening from five, night from ten. */
export function partOfDay(now: Date): PartOfDay {
  const hour = Number(formatInZone(now, "H"));
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function greeting(name: string, now: Date, language: HomeLanguage) {
  return sayIn(language)(GREETING[partOfDay(now)], { name });
}

/**
 * Which of a set of phrasings to use today: the same all day (a page that said
 * something different on every refresh would read as random rather than warm), and a
 * different one tomorrow. Counted from the household's own calendar day, so the whole
 * household reads the same line.
 */
function pickForToday<T>(set: Record<string, T>, now: Date): T {
  const choices = Object.values(set);
  const day = Math.floor(Date.parse(`${formatInZone(now, "yyyy-MM-dd")}T00:00:00Z`) / 86_400_000);
  return choices[day % choices.length]!;
}

/**
 * The line under the greeting. What it is *about* is decided first and plainly —
 * tonight's dinner if there is one, else whether anything is due for this person — and
 * only the wording varies, so the line is never cheerful about a day that has three
 * overdue jobs in it.
 */
export function dayLine(
  { dish, dueCount, seasonal = false }: { dish: string | null; dueCount: number; seasonal?: boolean },
  now: Date,
  language: HomeLanguage,
) {
  const say = sayIn(language);
  if (dish) return say(pickForToday(DAY_LINE.dinner, now), { dish });
  if (dueCount > 0) return say(pickForToday(DAY_LINE.busy, now));
  // Only a quiet day is dressed up: a festive word on a day with work waiting would be
  // the app celebrating instead of saying what is due.
  const season = seasonal ? seasonOn(todayInZone(now)) : null;
  if (season === "christmas" || season === "newYear" || season === "halloween") {
    return say(DAY_LINE.festive[season]);
  }
  return say(pickForToday(DAY_LINE.calm, now));
}
