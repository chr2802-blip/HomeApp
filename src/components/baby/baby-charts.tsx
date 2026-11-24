import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { babyColor } from "@/lib/baby-colors";
import { readDayInZone } from "@/lib/time";
import { durationWords } from "@/lib/baby-words";
import type { DayChart, PeriodSummary } from "@/lib/baby-charts";

/**
 * The baby log's charts, drawn as plain positioned blocks rather than with a chart
 * library: every one of them is marks on a 24-hour line or a bar of a height, which is a
 * few lines of CSS, where a library would be tens of kilobytes and a second idea of the
 * app's colours. The marks are `aria-hidden`; the numbers at the top of the page and each
 * figure's label say the same in words.
 *
 * No `"use client"`: drawn from the server page only, so it is handed the language.
 */

const pct = (hours: number) => `${(hours / 24) * 100}%`;

function Axis({ dense }: { dense: boolean }) {
  return (
    <div aria-hidden="true" className={`mt-1 flex ${dense ? "ml-15" : "ml-11"} justify-between text-[10px] text-slate-500`}>
      <span>00</span>
      <span>06</span>
      <span>12</span>
      <span>18</span>
      <span>24</span>
    </div>
  );
}

function DayLabel({ day, language, dense }: { day: string; language: HomeLanguage; dense: boolean }) {
  const median = day === "median";
  return (
    <span
      className={`shrink-0 text-[11px] leading-none whitespace-nowrap ${dense ? "w-13" : "w-9"} ${
        median ? "font-bold text-[var(--accent-text)]" : "font-semibold text-slate-600"
      }`}
    >
      {median ? sayIn(language)(BABY.median) : readDayInZone(day, dense ? BABY.shortDay : BABY.weekday, language)}
    </span>
  );
}

function Card({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return (
    <figure className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label={label}>
      <figcaption className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</figcaption>
      {children}
    </figure>
  );
}

function Key({ color, shape = "bar", label }: { color: string; shape?: "bar" | "dot" | "ring"; label: string }) {
  const mark =
    shape === "bar" ? "h-2.5 w-3.5 rounded-sm" : shape === "dot" ? "h-2 w-2 rounded-full" : "h-2.5 w-2.5 rounded-full border-2 bg-white";
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600">
      <span aria-hidden="true" className={mark} style={shape === "ring" ? { borderColor: color } : { background: color }} />
      {label}
    </span>
  );
}

/** The period's days, then the median day apart from them under a rule. */
function withMedian(summary: PeriodSummary): { row: DayChart; median: boolean }[] {
  const rows = summary.days.map((row) => ({ row, median: false }));
  return summary.median ? [...rows, { row: summary.median, median: true }] : rows;
}

const medianRule = "mt-1 border-t border-dashed border-slate-300 pt-2";

/** One row per day on a 24-hour line: sleep as blocks, feeds and nappies as dots above and below. */
export function SleepChart({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const say = sayIn(language);
  const dense = summary.days.length > 7;
  return (
    <Card title={say(BABY.sleepChart)} label={say(BABY.sleepChart)}>
      <div aria-hidden="true" className={`flex flex-col ${dense ? "gap-1" : "gap-2"}`}>
        {withMedian(summary).map(({ row, median }) => (
          <div key={row.day} className={`flex items-center gap-2 ${median ? medianRule : ""}`} data-chart-row={row.day}>
            <DayLabel day={row.day} language={language} dense={dense} />
            <div className={`relative flex-1 rounded bg-slate-100 ${dense ? "h-2.5" : "h-5"}`}>
              {row.sleep.map((block, index) => (
                <span
                  key={index}
                  className="absolute inset-y-0 rounded-[3px]"
                  style={{
                    left: pct(block.from),
                    width: `max(2px, ${pct(block.to - block.from)})`,
                    background: block.night ? "var(--baby-sleep)" : "var(--baby-nap)",
                  }}
                />
              ))}
              {!dense &&
                row.feeds.map((mark, index) => (
                  <span
                    key={`f${index}`}
                    className="absolute top-0.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full ring-1 ring-white"
                    style={{ left: pct(mark.at), background: babyColor("feed") }}
                  />
                ))}
              {!dense &&
                row.diapers.map((mark, index) => (
                  <span
                    key={`d${index}`}
                    className="absolute bottom-0.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full ring-1 ring-white"
                    style={{ left: pct(mark.at), background: babyColor("diaper") }}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
      <Axis dense={dense} />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--baby-sleep)" label={say(BABY.night)} />
        <Key color="var(--baby-nap)" label={say(BABY.nap)} />
        {!dense && <Key color={babyColor("feed")} shape="dot" label={say(BABY.feed)} />}
        {!dense && <Key color={babyColor("diaper")} shape="dot" label={say(BABY.diaper)} />}
      </div>
    </Card>
  );
}

/** When each feed happened, day by day, with the day's count at the end of its row. */
export function FeedChart({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const say = sayIn(language);
  const dense = summary.days.length > 7;
  const mark = (method: DayChart["feeds"][number]["method"]) =>
    method === "BOTTLE"
      ? { background: "var(--color-white)", border: `2.5px solid ${babyColor("feed")}`, borderRadius: "999px" }
      : method === "SOLID"
        ? { background: "var(--baby-feed-soft)", border: `1.5px solid ${babyColor("feed")}`, borderRadius: "2px" }
        : { background: babyColor("feed"), borderRadius: "999px" };
  return (
    <Card title={say(BABY.feedChart)} label={say(BABY.feedChart)}>
      <div aria-hidden="true" className={`flex flex-col ${dense ? "gap-1" : "gap-2"}`}>
        {withMedian(summary).map(({ row, median }) => (
          <div key={row.day} className={`flex items-center gap-2 ${median ? medianRule : ""}`}>
            <DayLabel day={row.day} language={language} dense={dense} />
            <div className={`relative flex-1 border-b border-slate-100 ${dense ? "h-2.5" : "h-4"}`}>
              {row.feeds.map((feed, index) => (
                <span
                  key={index}
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 box-border ${dense ? "h-2 w-2" : "h-3 w-3"}`}
                  style={{ left: pct(feed.at), ...mark(feed.method) }}
                />
              ))}
            </div>
            <span className="w-5 shrink-0 text-right text-xs font-bold" style={{ color: babyColor("feed", "-text") }}>
              {row.feedCount || ""}
            </span>
          </div>
        ))}
      </div>
      <div className="mr-7">
        <Axis dense={dense} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Key color={babyColor("feed")} shape="dot" label={say(BABY.breast)} />
        <Key color={babyColor("feed")} shape="ring" label={say(BABY.bottle)} />
        <Key color="var(--baby-feed-soft)" label={say(BABY.solid)} />
      </div>
    </Card>
  );
}

/** Bars per day: the whole day, night under nap under awake, then nappies — the median day last. */
export function TotalsChart({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const say = sayIn(language);
  const dense = summary.days.length > 7;
  const rows = withMedian(summary);
  // A whole day is the scale, so a bar is the day and the parts are its shares of it.
  const dayScale = Math.max(24, ...rows.map(({ row }) => row.nightHours + row.napHours + row.awakeHours));
  const diaperScale = Math.max(8, summary.maxDiapers);
  const locale = language === "DA" ? "da-DK" : "en-GB";
  const one = (value: number) => (Math.round(value * 10) / 10).toLocaleString(locale);
  const label = (row: DayChart) =>
    row.day === "median" ? say(BABY.median) : readDayInZone(row.day, dense ? BABY.shortDay : BABY.weekday, language);
  const column = (median: boolean) =>
    `flex min-w-0 flex-col items-stretch justify-end ${median ? (dense ? "ml-2 w-6 shrink-0" : "ml-2 flex-1") : "flex-1"}`;
  const labels = (
    <div aria-hidden="true" className={`mt-1 flex text-center text-[10px] font-semibold text-slate-600 ${dense ? "gap-0.5" : "gap-2"}`}>
      {rows.map(({ row, median }) => (
        <span key={row.day} className={`${column(median)} ${median ? "overflow-visible whitespace-nowrap text-[var(--accent-text)]" : "truncate"} ${dense && !median ? "invisible" : ""}`}>
          {dense && median ? "Md" : label(row)}
        </span>
      ))}
    </div>
  );
  return (
    <Card title={say(BABY.sleepTotals)} label={say(BABY.sleepTotals)}>
      <div aria-hidden="true" className={`flex h-40 items-end border-b border-slate-200 ${dense ? "gap-0.5" : "gap-2"}`}>
        {rows.map(({ row, median }) => {
          const sleep = row.nightHours + row.napHours;
          const height = (hours: number) => `${(hours / dayScale) * 136}px`;
          return (
            <div key={row.day} className={column(median)}>
              {!dense && sleep > 0 && <span className="mb-0.5 text-center text-[10px] text-slate-600">{one(sleep)}</span>}
              <span className="rounded-t-[3px] bg-slate-200" style={{ height: height(row.awakeHours) }} />
              <span style={{ height: height(row.napHours), background: "var(--baby-nap)" }} />
              <span style={{ height: height(row.nightHours), background: "var(--baby-sleep)" }} />
            </div>
          );
        })}
      </div>
      {labels}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Key color="var(--baby-sleep)" label={say(BABY.night)} />
        <Key color="var(--baby-nap)" label={say(BABY.nap)} />
        <Key color="var(--color-slate-200)" label={say(BABY.awake)} />
      </div>

      <p className="mt-5 mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(BABY.diaperTotals)}</p>
      <div aria-hidden="true" className={`flex h-20 items-end border-b border-slate-200 ${dense ? "gap-0.5" : "gap-2"}`}>
        {rows.map(({ row, median }) => (
          <div key={row.day} className={column(median)}>
            {!dense && row.diaperCount > 0 && <span className="mb-0.5 text-center text-[10px] text-slate-600">{row.diaperCount}</span>}
            <span className="rounded-t-[3px]" style={{ height: `${(row.diaperCount / diaperScale) * 64}px`, background: babyColor("diaper") }} />
          </div>
        ))}
      </div>
      {labels}
    </Card>
  );
}

/** The period's medians, in words — the charts' text equivalent. */
export function PeriodAverages({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const say = sayIn(language);
  const { typical } = summary;
  const hours = (h: number) => durationWords(h * 3_600_000, language);
  const one = (value: number) => (Math.round(value * 10) / 10).toLocaleString(language === "DA" ? "da-DK" : "en-GB");
  const tile = "flex min-w-0 flex-col gap-0.5 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm";
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={say(BABY.chartSummary, { sleep: hours(typical.sleepHours), feeds: one(typical.feedCount), diapers: one(typical.diaperCount) })}>
      <div className={tile}>
        <span className="text-[11px] leading-tight font-bold tracking-wide uppercase" style={{ color: babyColor("sleep", "-text") }}>{say(BABY.sleepPerDay)}</span>
        <span className="truncate text-lg font-bold text-slate-900">{hours(typical.sleepHours)}</span>
        <span className="text-xs text-slate-500">{say(BABY.nightAndNap, { night: hours(typical.nightHours), nap: hours(typical.napHours) })}</span>
      </div>
      <div className={tile}>
        <span className="text-[11px] leading-tight font-bold tracking-wide uppercase" style={{ color: babyColor("feed", "-text") }}>{say(BABY.feedsPerDay)}</span>
        <span className="truncate text-lg font-bold text-slate-900">{one(typical.feedCount)}</span>
        <span className="text-xs text-slate-500">{say(BABY.mlFromBottles, { ml: Math.round(typical.ml) })}</span>
      </div>
      <div className={tile}>
        <span className="text-[11px] leading-tight font-bold tracking-wide uppercase" style={{ color: babyColor("diaper", "-text") }}>{say(BABY.diapersPerDay)}</span>
        <span className="truncate text-lg font-bold text-slate-900">{one(typical.diaperCount)}</span>
      </div>
    </div>
  );
}
