import { calendarDaysBetween, formatInZone } from "./time";

export function dueLabel(dueAt: Date, now: Date = new Date()) {
  const days = calendarDaysBetween(dueAt, now);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${formatInZone(dueAt, "d MMM")}`;
}

export function dueTone(dueAt: Date, now: Date = new Date()) {
  const days = calendarDaysBetween(dueAt, now);
  if (days < 0) return "red" as const;
  if (days === 0) return "amber" as const;
  return "neutral" as const;
}
