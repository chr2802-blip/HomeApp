/**
 * The season a household's day falls in, for the touches a home can switch on in
 * Settings (`Home.seasonal`): a mark beside the name in the header, and a line on the
 * dashboard on a quiet day.
 *
 * It takes the day as the "yyyy-MM-dd" the household's own clock writes (`todayInZone`),
 * never an instant, so a test can say the twenty-fourth of December and mean it and a
 * server in UTC never hangs the lights up an hour early.
 *
 * The festive stretches win over the season they sit in — Halloween week is autumn,
 * and Christmas is winter — because they are the reason the feature is fun at all.
 * Easter is left out on purpose: it moves every year, and a date table that needs
 * updating is one that is quietly wrong the year nobody did.
 */

/** The field Settings submits under, read by `updateHome`. */
export const SEASONAL_FIELD = "seasonal";

export type Season = "christmas" | "newYear" | "halloween" | "winter" | "spring" | "summer" | "autumn";

export const SEASON_MARK: Record<Season, string> = {
  christmas: "🎄",
  newYear: "🎆",
  halloween: "🎃",
  winter: "❄️",
  spring: "🌷",
  summer: "☀️",
  autumn: "🍂",
};

export function seasonOn(day: string): Season {
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));

  if (month === 12 && date <= 26) return "christmas";
  if ((month === 12 && date >= 27) || (month === 1 && date === 1)) return "newYear";
  if (month === 10 && date >= 25) return "halloween";
  if (month <= 2 || month === 12) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}
