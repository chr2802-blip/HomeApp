import type { HomeLanguage } from "@prisma/client";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { babyColor } from "@/lib/baby-colors";
import { readDayInZone } from "@/lib/time";
import { durationWords } from "@/lib/baby-words";
import { clockOf, TREND_NIGHTS, type DayChart, type PeriodSummary, type SleepTimesPoint } from "@/lib/baby-charts";

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

/** The bar columns' shared frame: the days, then the median apart; and their labels underneath. */
function columnsOf(summary: PeriodSummary, language: HomeLanguage) {
  const say = sayIn(language);
  const dense = summary.days.length > 7;
  const rows = withMedian(summary);
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
  return { say, dense, rows, column, labels };
}

/** A bar's height in px; the sleep bars are this tall whatever the day held. */
const DAY_BAR_PX = 192;
/** What a column's full height stands for: one whole day. */
const DAY_HOURS = 24;
/** A block shorter than this many hours has no room for its number. */
const NUMBER_FROM_HOURS = 1.5;

/**
 * Bars per day, night under nap under awake, the awake part being whatever the sleep
 * left, and each block says its hours. A bar is drawn against a whole day: a day that is
 * over fills the column, and today reaches only as far as the day has gone — 15:00 is
 * five eighths of the way up. The median is a whole day by definition, so it fills too.
 * A day with nothing logged has no bar.
 */
export function SleepTotalsChart({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const { say, dense, rows, column, labels } = columnsOf(summary, language);
  const locale = language === "DA" ? "da-DK" : "en-GB";
  const hoursText = (value: number) =>
    dense ? String(Math.round(value)) : (Math.round(value * 10) / 10).toLocaleString(locale);
  const block = (hours: number, total: number, style: React.CSSProperties, textColor: string, top = false) =>
    hours > 0 && (
      <span
        className={`flex items-center justify-center overflow-hidden whitespace-nowrap font-semibold leading-none ${dense ? "text-[7px] tracking-tighter" : "text-[10px]"} ${top ? "rounded-t-[3px]" : ""}`}
        style={{ height: `${(hours / total) * 100}%`, color: textColor, ...style }}
        data-hours={Math.round(hours * 10) / 10}
      >
        {hours >= NUMBER_FROM_HOURS ? hoursText(hours) : ""}
      </span>
    );
  return (
    <Card title={say(BABY.sleepTotals)} label={say(BABY.sleepTotals)}>
      <div aria-hidden="true" className={`flex items-end border-b border-slate-200 ${dense ? "gap-0.5" : "gap-2"}`} style={{ height: DAY_BAR_PX }}>
        {rows.map(({ row, median }) => {
          const hours = row.nightHours + row.napHours + row.awakeHours;
          const total = median ? hours : Math.max(hours, DAY_HOURS);
          return (
            <div key={row.day} className={`${column(median)} h-full`} data-chart-bar={row.day}>
              {hours > 0 && (
                <>
                  {block(row.awakeHours, total, { background: "var(--color-slate-200)" }, "var(--color-slate-600)", true)}
                  {block(row.napHours, total, { background: "var(--baby-nap)" }, "var(--baby-sleep-text)", row.awakeHours <= 0)}
                  {block(row.nightHours, total, { background: "var(--baby-sleep)" }, "#ffffff", row.awakeHours + row.napHours <= 0)}
                </>
              )}
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
    </Card>
  );
}

/** Nappies per day as bars, the count on each — the median day last. */
export function DiaperTotalsChart({ summary, language }: { summary: PeriodSummary; language: HomeLanguage }) {
  const { say, dense, rows, column, labels } = columnsOf(summary, language);
  const diaperScale = Math.max(8, summary.maxDiapers);
  return (
    <Card title={say(BABY.diaperTotals)} label={say(BABY.diaperTotals)}>
      <div aria-hidden="true" className={`flex h-28 items-end border-b border-slate-200 ${dense ? "gap-0.5" : "gap-2"}`}>
        {rows.map(({ row, median }) => (
          <div key={row.day} className={column(median)}>
            {row.diaperCount > 0 && (
              <span
                className={`flex min-h-3.5 items-start justify-center rounded-t-[3px] pt-0.5 whitespace-nowrap font-semibold leading-none text-white ${dense ? "text-[7px] tracking-tighter" : "text-[10px]"}`}
                style={{ height: `${(row.diaperCount / diaperScale) * 104}px`, background: babyColor("diaper") }}
              >
                {Math.round(row.diaperCount)}
              </span>
            )}
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

const TREND_W = 300;
const TREND_H = 96;
const TREND_PAD = { left: 34, right: 6, top: 6, bottom: 6 };

/**
 * One series of the bedtime-and-waking trend: each night as a faint dot, the running
 * median as a line through them. The vertical scale is the series' own, from the hour
 * before its earliest point to the hour after its latest — bedtimes and wakings sit
 * half a day apart, and one scale for both would leave each a sliver. Later is lower,
 * the way a day reads down the page.
 */
function TrendPanel({
  title,
  color,
  values,
  medians,
}: {
  title: string;
  color: string;
  values: (number | null)[];
  medians: (number | null)[];
}) {
  const all = [...values, ...medians].filter((value): value is number => value !== null);
  const latest = medians.findLast((value) => value !== null) ?? null;
  if (all.length === 0) return null;
  let low = Math.floor(Math.min(...all));
  let high = Math.ceil(Math.max(...all));
  if (high - low < 2) {
    low -= 1;
    high = low + 3;
  }
  const count = values.length;
  const innerW = TREND_W - TREND_PAD.left - TREND_PAD.right;
  const innerH = TREND_H - TREND_PAD.top - TREND_PAD.bottom;
  const x = (index: number) => TREND_PAD.left + (count === 1 ? innerW / 2 : (index / (count - 1)) * innerW);
  const y = (hours: number) => TREND_PAD.top + ((hours - low) / (high - low)) * innerH;
  const ticks = Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(
    (_, index, list) => list.length <= 5 || index % 2 === 0 || index === list.length - 1,
  );
  // The line breaks where no night in the window had anything logged.
  const runs: string[] = [];
  let run: string[] = [];
  medians.forEach((value, index) => {
    if (value === null) {
      if (run.length) runs.push(run.join(" "));
      run = [];
    } else run.push(`${x(index).toFixed(1)},${y(value).toFixed(1)}`);
  });
  if (run.length) runs.push(run.join(" "));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {latest !== null && (
          <span className="text-lg font-bold tabular-nums" style={{ color }} data-trend-latest={clockOf(latest)}>
            {clockOf(latest)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${TREND_W} ${TREND_H}`} className="block w-full" aria-hidden="true">
        {ticks.map((hour) => (
          <g key={hour}>
            <line x1={TREND_PAD.left} x2={TREND_W - TREND_PAD.right} y1={y(hour)} y2={y(hour)} stroke="var(--color-slate-100)" strokeWidth="1" />
            <text x={TREND_PAD.left - 6} y={y(hour)} dy="0.35em" textAnchor="end" fontSize="10" fill="var(--color-slate-500)">
              {clockOf(hour)}
            </text>
          </g>
        ))}
        {values.map((value, index) =>
          value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r="2.5" fill={color} opacity="0.3" />,
        )}
        {runs.map((points, index) => (
          <polyline key={index} points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

/** When the baby goes to sleep for the night and wakes in the morning, over the period. */
export function SleepTimesChart({ trend, language }: { trend: SleepTimesPoint[]; language: HomeLanguage }) {
  const say = sayIn(language);
  if (trend.every((point) => point.bedMedian === null && point.wakeMedian === null)) return null;
  const dense = trend.length > 7;
  const bed = trend.findLast((point) => point.bedMedian !== null)?.bedMedian;
  const wake = trend.findLast((point) => point.wakeMedian !== null)?.wakeMedian;
  const label =
    bed != null && wake != null
      ? say(BABY.sleepTimesSummary, { bed: clockOf(bed), wake: clockOf(wake) })
      : say(BABY.sleepTimes);
  const first = trend[0]!.day;
  const last = trend.at(-1)!.day;
  return (
    <Card title={say(BABY.sleepTimes)} label={label}>
      <div className="space-y-3">
        <TrendPanel
          title={say(BABY.bedtime)}
          color="var(--baby-sleep)"
          values={trend.map((point) => point.bed)}
          medians={trend.map((point) => point.bedMedian)}
        />
        <TrendPanel
          title={say(BABY.wakeTime)}
          color="var(--baby-sleep-text)"
          values={trend.map((point) => point.wake)}
          medians={trend.map((point) => point.wakeMedian)}
        />
      </div>
      <div aria-hidden="true" className="mt-1 ml-[11.3%] flex justify-between text-[10px] text-slate-500">
        <span>{readDayInZone(first, dense ? BABY.shortDay : BABY.weekday, language)}</span>
        <span>{readDayInZone(last, dense ? BABY.shortDay : BABY.weekday, language)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-slate-500" />
          {say(BABY.trendMedian, { n: TREND_NIGHTS })}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-500 opacity-30" />
          {say(BABY.oneNight)}
        </span>
      </div>
    </Card>
  );
}
