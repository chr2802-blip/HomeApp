import Link from "next/link";
import { redirect } from "next/navigation";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { dueAtOn, readDayInZone, shiftDay, todayInZone } from "@/lib/time";
import { dayBounds, type BabyEntry } from "@/lib/baby";
import { PERIOD_DAYS, periodDays, readPeriod, summarise, type ChartPeriod } from "@/lib/baby-charts";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { DiaperTotalsChart, FeedChart, PeriodAverages, SleepChart, SleepTotalsChart } from "@/components/baby/baby-charts";

/**
 * The baby log over a day, a week or a month: the averages, sleep around the clock, when
 * the feeds fell and the totals per day. `?period=` chooses, `?to=` is the last day
 * drawn (today unless paged back).
 */
export default async function BabyChartsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; to?: string }>;
}) {
  const user = await requireHomeUser();
  const language = user.homeLanguage;
  const say = sayIn(language);
  const db = homeDb(user.homeId);
  const baby = await db.baby.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!baby) redirect("/baby");

  const now = new Date();
  const today = todayInZone(now);
  const params = await searchParams;
  const period = readPeriod(params.period);
  const to = params.to && dueAtOn(params.to) && params.to < today ? params.to : today;
  const days = periodDays(to, period);
  const from = dayBounds(shiftDay(days[0]!, -1)).start;
  const end = dayBounds(to).end;

  const rows = await db.babyEvent.findMany({
    where: { babyId: baby.id, OR: [{ startedAt: { gte: from, lt: end } }, { endedAt: null, startedAt: { lt: end } }] },
    orderBy: { startedAt: "asc" },
    select: { id: true, kind: true, startedAt: true, endedAt: true, details: true },
  });
  const summary = summarise(rows as BabyEntry[], days, now);
  const empty = summary.days.every((row) => row.sleep.length + row.feedCount + row.diaperCount === 0);

  const href = (next: { period?: ChartPeriod; to?: string }) => {
    const query = new URLSearchParams();
    const p = next.period ?? period;
    const t = next.to ?? to;
    if (p !== "week") query.set("period", p);
    if (t !== today) query.set("to", t);
    const text = query.toString();
    return text ? `/baby/charts?${text}` : "/baby/charts";
  };
  const step = PERIOD_DAYS[period];
  const later = shiftDay(to, step) >= today ? today : shiftDay(to, step);
  const range =
    days.length === 1
      ? readDayInZone(to, BABY.dayPattern, language)
      : `${readDayInZone(days[0]!, BABY.shortDay, language)} – ${readDayInZone(to, BABY.shortDay, language)}`;
  const periods: { value: ChartPeriod; label: string }[] = [
    { value: "day", label: say(BABY.periodDay) },
    { value: "week", label: say(BABY.periodWeek) },
    { value: "month", label: say(BABY.periodMonth) },
  ];
  const arrow = "press-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600";

  return (
    <div className="space-y-4">
      <nav aria-label={say(BABY.period)} className="flex gap-2">
        {periods.map((option) => (
          <Link
            key={option.value}
            href={href({ period: option.value, to: today })}
            replace
            scroll={false}
            aria-current={option.value === period ? "page" : undefined}
            className={`press-button flex h-10 flex-1 items-center justify-center rounded-full border text-sm font-semibold ${
              option.value === period
                ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between gap-2">
        <Link href={href({ to: shiftDay(to, -step) })} replace scroll={false} aria-label={say(BABY.earlier)} className={arrow}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
        <span className="min-w-0 truncate text-center font-semibold text-slate-800">{range}</span>
        {to < today ? (
          <Link href={href({ to: later })} replace scroll={false} aria-label={say(BABY.later)} className={arrow}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        ) : (
          <span aria-hidden="true" className="h-10 w-10" />
        )}
      </div>

      {empty ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          {say(BABY.nothingInPeriod)}
        </p>
      ) : (
        <>
          <PeriodAverages summary={summary} language={language} />
          <SleepChart summary={summary} language={language} />
          <FeedChart summary={summary} language={language} />
          <SleepTotalsChart summary={summary} language={language} />
          <DiaperTotalsChart summary={summary} language={language} />
        </>
      )}
    </div>
  );
}
