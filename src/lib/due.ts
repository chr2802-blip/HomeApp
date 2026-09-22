import type { HomeLanguage } from "@prisma/client";
import { calendarDaysBetween, readInZone } from "./time";
import { sayIn } from "./copy/say";
import { DATE, DUE } from "./copy/dates";

export function dueLabel(dueAt: Date, language: HomeLanguage, now: Date = new Date()) {
  const say = sayIn(language);
  const days = calendarDaysBetween(dueAt, now);
  if (days < 0) return say(DUE.overdue, { count: Math.abs(days) });
  if (days === 0) return say(DUE.today);
  if (days === 1) return say(DUE.tomorrow);
  return say(DUE.onDay, { day: readInZone(dueAt, DATE.dayMonth, language) });
}

export function dueTone(dueAt: Date, now: Date = new Date()) {
  const days = calendarDaysBetween(dueAt, now);
  if (days < 0) return "red" as const;
  if (days === 0) return "amber" as const;
  return "neutral" as const;
}
