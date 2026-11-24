import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "./copy/say";
import { BABY } from "./copy/baby";
import { readInZone } from "./time";
import {
  endOf,
  isNightSleep,
  isRunning,
  readBabyDetails,
  sideSeconds,
  sleptMs,
  type BabyEntry,
  type BreastDetails,
} from "./baby";

/**
 * A baby log entry as a person reads it — its title and the line under it — and the
 * lengths of time the page is full of. Takes the language as an argument, like every
 * `src/lib` module, so the server page and the client timeline say the same.
 */

/** A length of time in whole minutes: "42 m", "1 h 10 m". */
export function durationWords(ms: number, language: HomeLanguage): string {
  const say = sayIn(language);
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return say(BABY.minutes, { m });
  return m === 0 ? say(BABY.hours, { h }) : say(BABY.hoursMinutes, { h, m });
}

/** A running timer to the second: "4:07", "1:02:09". */
export function clockWords(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** The time of day an instant falls at, on the household's clock. */
export function timeWords(date: Date, language: HomeLanguage): string {
  return readInZone(date, BABY.timePattern, language);
}

/** An entry's title and the line under it, in the timeline. */
export function describeEntry(entry: BabyEntry, language: HomeLanguage, now: Date): { title: string; detail: string } {
  const say = sayIn(language);
  const read = readBabyDetails(entry.kind, entry.details);
  const running = isRunning(entry);

  switch (read.kind) {
    case "SLEEP": {
      const night = isNightSleep(entry.startedAt, read.details.night);
      const kind = say(night ? BABY.nightSleep : BABY.nap);
      const slept = durationWords(sleptMs(entry, now), language);
      const awake = read.details.awake > 0 ? ` · ${say(BABY.awakeFor, { time: durationWords(read.details.awake * 1000, language) })}` : "";
      // "and counting" gives way to the time awake: the line has room for one of them.
      if (running) return { title: say(BABY.asleepNow), detail: `${kind} · ${awake ? slept : say(BABY.counting, { time: slept })}${awake}` };
      const span = `${timeWords(entry.startedAt, language)}–${timeWords(endOf(entry, now), language)}`;
      return { title: kind, detail: `${span} · ${slept}${awake}` };
    }
    case "DIAPER": {
      const { wet, dirty } = read.details;
      return { title: say(BABY.diaper), detail: say(wet && dirty ? BABY.both : dirty ? BABY.dirty : BABY.wet) };
    }
    case "FEED": {
      const details = read.details;
      if (details.method === "BREAST") {
        const breast = details as BreastDetails;
        const sides = say(BABY.sides, {
          left: durationWords(sideSeconds(breast, "LEFT", now) * 1000, language),
          right: durationWords(sideSeconds(breast, "RIGHT", now) * 1000, language),
        });
        return { title: say(running ? BABY.feedingNow : BABY.breast), detail: sides };
      }
      if (details.method === "BOTTLE") {
        const milk = say(details.milk === "BREAST_MILK" ? BABY.breastMilk : BABY.formula);
        return { title: say(BABY.bottle), detail: details.ml ? `${say(BABY.ml, { ml: details.ml })} · ${milk}` : milk };
      }
      return { title: say(BABY.solid), detail: details.food };
    }
  }
}
