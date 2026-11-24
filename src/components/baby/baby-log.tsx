"use client";

import { startTransition, useEffect, useMemo, useOptimistic, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { CreateFab } from "@/components/create-button";
import { ItemMenu } from "@/components/item-menu";
import { Input, Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { babyColor, type BabyColorKind } from "@/lib/baby-colors";
import { readDayInZone, shiftDay } from "@/lib/time";
import {
  MAX_BABY_NAME_LENGTH,
  clipToDay,
  diapersOn,
  entriesOn,
  feedMethodOf,
  isNightSleep,
  isRunning,
  lastBreastSide,
  lastFeed,
  otherSide,
  readBabyDetails,
  resumableFeed,
  resumableSleep,
  sideSeconds,
  sleptMs,
  sleepState,
  switchBreastSide,
  type BabyEntry,
  type BreastDetails,
  type BreastSide,
  type FeedMethod,
} from "@/lib/baby";
import { clockWords, describeEntry, durationWords, timeWords } from "@/lib/baby-words";
import {
  deleteBabyEvent,
  pressBreastSide,
  resumeFeed,
  resumeSleep,
  saveDiaper,
  saveFeed,
  saveSleep,
  toggleSleep,
  updateBaby,
} from "@/app/actions/baby";
import { DiaperFields, FeedMethodFields, NoteField, SleepFields, TimeField, Chips, feedMethodOptions } from "./baby-fields";

/** An entry as the server page hands it over: instants as ISO strings. */
export type WireEntry = {
  id: string;
  kind: BabyEntry["kind"];
  startedAt: string;
  endedAt: string | null;
  details: unknown;
  note: string | null;
};

export type BabySettings = {
  name: string;
  trackSleep: boolean;
  trackBreast: boolean;
  trackBottle: boolean;
  trackSolid: boolean;
  trackDiaper: boolean;
};

const fromWire = (entry: WireEntry): BabyEntry => ({
  ...entry,
  startedAt: new Date(entry.startedAt),
  endedAt: entry.endedAt ? new Date(entry.endedAt) : null,
});

const kindColor = (entry: BabyEntry): BabyColorKind =>
  entry.kind === "SLEEP" ? "sleep" : entry.kind === "FEED" ? "feed" : "diaper";

/**
 * The clock the page reads, ticking every second while a timer runs and every half
 * minute otherwise — every "how long since" is worked out from it and the stored
 * instants, never counted up, so a phone that slept with the app closed is right the
 * moment it wakes.
 */
function useNow(fast: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [fast]);
  return now;
}

/**
 * Asks the server again every half minute while the page is in view, and the moment it
 * comes back into view: the other parent may have fed the baby meanwhile.
 */
function useFollow() {
  const router = useRouter();
  useEffect(() => {
    const ask = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(ask, 30_000);
    document.addEventListener("visibilitychange", ask);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [router]);
}

type Sheet = null | "feed" | "diaper" | "sleep" | "settings" | "choose" | "wakeful";

/**
 * The baby log: how long since the last of everything at the top, the day being read
 * with its strip and its entries in the middle, and the three big buttons at the
 * bottom, where a thumb reaches them with a baby in the other arm.
 */
export function BabyLog({
  baby,
  entries: wire,
  day,
  today,
  solids,
}: {
  baby: BabySettings;
  entries: WireEntry[];
  day: string;
  today: string;
  solids: string[];
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const entries = useMemo(() => wire.map(fromWire), [wire]);
  const [asleep, showAsleep] = useOptimistic(entries.some((entry) => entry.kind === "SLEEP" && !entry.endedAt));
  const running = entries.some(isRunning);
  const now = useNow(running || asleep);
  const [sheet, setSheet] = useState<Sheet>(null);
  useFollow();

  const methods: FeedMethod[] = [
    ...(baby.trackBreast ? (["BREAST"] as const) : []),
    ...(baby.trackBottle ? (["BOTTLE"] as const) : []),
    ...(baby.trackSolid ? (["SOLID"] as const) : []),
  ];
  const runningBreast = entries.find((entry) => !entry.endedAt && feedMethodOf(entry) === "BREAST") ?? null;
  const feeds = methods.length > 0 || runningBreast !== null;

  const sleep = sleepState(entries, now);
  const fed = lastFeed(entries, now);
  const lastDiaper = entries
    .filter((entry) => entry.kind === "DIAPER")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const shown = entriesOn(entries, day, now);

  const pressSleep = () =>
    startTransition(async () => {
      showAsleep(!asleep);
      await toggleSleep();
    });

  // A sleep stopped a moment ago can be carried on rather than a new one started, so
  // the button asks which — only inside that window, and never to stop a sleep.
  const wakeful = asleep ? null : resumableSleep(entries, now);
  const carryOnSleep = (entry: BabyEntry) =>
    startTransition(async () => {
      showAsleep(true);
      setSheet(null);
      const form = new FormData();
      form.set("id", entry.id);
      await resumeSleep(form);
    });

  return (
    <div className="pb-24 md:pb-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{baby.name}</h1>
        <button
          type="button"
          onClick={() => setSheet("settings")}
          aria-label={say(BABY.settings)}
          title={say(BABY.settings)}
          className="press-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
        </button>
      </div>

      {/* How long since the last of everything: the first thing anybody opens this for. */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {baby.trackSleep && (
          <Tile
            kind="sleep"
            strong={sleep?.asleep === true}
            label={say(sleep?.asleep ? BABY.asleep : sleep ? BABY.awake : BABY.sleep)}
            value={
              sleep ? durationWords(sleep.asleep ? sleep.sleptMs : now.getTime() - sleep.since.getTime(), language) : say(BABY.notYet)
            }
            detail={sleep ? say(BABY.since, { time: timeWords(sleep.since, language) }) : ""}
          />
        )}
        {feeds && (
          <Tile
            kind="feed"
            strong={fed?.running === true}
            label={say(fed?.method === "BREAST" ? BABY.breast : BABY.feed)}
            value={
              fed?.running
                ? say(BABY.feedingNowShort)
                : fed
                  ? durationWords(now.getTime() - fed.at.getTime(), language)
                  : say(BABY.notYet)
            }
            detail={fed ? say(fed.running ? BABY.since : BABY.endedAt, { time: timeWords(fed.at, language) }) : ""}
          />
        )}
        {baby.trackDiaper && (
          <Tile
            kind="diaper"
            label={say(BABY.diapers)}
            value={say(BABY.countToday, { n: diapersOn(entries, today) })}
            detail={lastDiaper ? say(BABY.lastAt, { time: timeWords(lastDiaper.startedAt, language) }) : ""}
          />
        )}
      </div>

      <DayPager day={day} today={today} />
      <DayStrip entries={entries} day={day} now={now} />

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          {say(BABY.nothingOnDay)}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {shown.map((entry) => (
            <EntryRow key={entry.id} entry={entry} now={now} solids={solids} />
          ))}
        </ul>
      )}

      {/* The three buttons, in the thumb's reach, above the tab bar. They follow the bar
          down as the page scrolls, and leave room on the right for the "+" that takes
          its place in the corner. */}
      <div
        className="app-above-bar fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex gap-2 bg-gradient-to-t from-[var(--page)] from-75% to-transparent px-3 pt-5 pb-5 md:static md:mt-6 md:bg-none md:p-0"
        style={{ paddingRight: "calc(0.75rem + var(--bars, 0) * 4.5rem)" }}
      >
        {baby.trackSleep && (
          <DockButton kind="sleep" strong={asleep} onClick={wakeful ? () => setSheet("wakeful") : pressSleep}>
            <SleepIcon />
            {asleep ? (
              <span>
                {say(BABY.stopSleep)}
                {sleep?.asleep && <span className="font-normal tabular-nums"> · {clockWords(sleep.sleptMs)}</span>}
              </span>
            ) : (
              <span>{say(BABY.startSleep)}</span>
            )}
          </DockButton>
        )}
        {feeds && (
          <DockButton kind="feed" strong={runningBreast !== null} onClick={() => setSheet("feed")}>
            <BottleIcon />
            <span>{say(BABY.feed)}</span>
          </DockButton>
        )}
        {baby.trackDiaper && (
          <DockButton kind="diaper" onClick={() => setSheet("diaper")}>
            <DiaperIcon />
            <span>{say(BABY.diaper)}</span>
          </DockButton>
        )}
      </div>

      <CreateFab label={say(BABY.newEntry)} onClick={() => setSheet("choose")} expanded={sheet === "choose"} />

      <Modal open={sheet === "choose"} onClose={() => setSheet(null)} title={say(BABY.newEntry)} size="drawer">
        <div className="flex flex-col gap-2 px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {baby.trackSleep && (
            <ChooseRow kind="sleep" onClick={() => setSheet("sleep")}>
              <SleepIcon />
              {say(BABY.logSleep)}
            </ChooseRow>
          )}
          {feeds && (
            <ChooseRow kind="feed" onClick={() => setSheet("feed")}>
              <BottleIcon />
              {say(BABY.feed)}
            </ChooseRow>
          )}
          {baby.trackDiaper && (
            <ChooseRow kind="diaper" onClick={() => setSheet("diaper")}>
              <DiaperIcon />
              {say(BABY.diaper)}
            </ChooseRow>
          )}
        </div>
      </Modal>

      <Modal open={sheet === "wakeful"} onClose={() => setSheet(null)} title={say(BABY.sleep)} size="drawer">
        {wakeful && (
          <div className="flex flex-col gap-2 px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <p className="text-center text-sm text-slate-600">
              {say(BABY.sleepFrom, { time: timeWords(wakeful.startedAt, language) })} · {durationWords(sleptMs(wakeful, now), language)}
              {" · "}
              {say(BABY.awakeFor, {
                time: durationWords(
                  now.getTime() - wakeful.endedAt!.getTime() + (readBabyDetails("SLEEP", wakeful.details).details.awake * 1000),
                  language,
                ),
              })}
            </p>
            <ChooseRow kind="sleep" strong onClick={() => carryOnSleep(wakeful)}>
              <SleepIcon />
              {say(BABY.continueSleep)}
            </ChooseRow>
            <ChooseRow
              kind="sleep"
              onClick={() => {
                setSheet(null);
                pressSleep();
              }}
            >
              <SleepIcon />
              {say(BABY.newSleep)}
            </ChooseRow>
          </div>
        )}
      </Modal>

      <Modal open={sheet === "sleep"} onClose={() => setSheet(null)} title={say(BABY.logSleep)}>
        <DialogForm action={saveSleep} submitLabel={say(BABY.save)} onDone={() => setSheet(null)} onCancel={() => setSheet(null)}>
          <SleepFields now={now} />
        </DialogForm>
      </Modal>

      <Modal open={sheet === "diaper"} onClose={() => setSheet(null)} title={say(BABY.diaper)}>
        <DialogForm action={saveDiaper} submitLabel={say(BABY.save)} onDone={() => setSheet(null)} onCancel={() => setSheet(null)}>
          <DiaperFields now={now} />
        </DialogForm>
      </Modal>

      <Modal open={sheet === "feed"} onClose={() => setSheet(null)} title={say(BABY.feed)}>
        <FeedSheet
          methods={methods}
          running={runningBreast}
          resumable={resumableFeed(entries, now)}
          lastSide={lastBreastSide(entries.filter((entry) => entry !== runningBreast))}
          solids={solids}
          now={now}
          onDone={() => setSheet(null)}
        />
      </Modal>

      <Modal open={sheet === "settings"} onClose={() => setSheet(null)} title={say(BABY.settings)}>
        <DialogForm action={updateBaby} submitLabel={say(BABY.saveSettings)} onDone={() => setSheet(null)} onCancel={() => setSheet(null)}>
          <SettingsFields baby={baby} />
        </DialogForm>
      </Modal>
    </div>
  );
}

function Tile({
  kind,
  label,
  value,
  detail,
  strong = false,
}: {
  kind: BabyColorKind;
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-2xl border border-slate-200 px-3 py-2.5 shadow-sm"
      style={{ background: strong ? babyColor(kind, "-soft") : "var(--color-white)" }}
      data-baby-tile={kind}
    >
      <span className="truncate text-[11px] font-bold tracking-wide uppercase" style={{ color: babyColor(kind, "-text") }}>
        {label}
      </span>
      <span className="truncate text-lg leading-tight font-bold text-slate-900">{value}</span>
      <span className="truncate text-xs text-slate-500">{detail || " "}</span>
    </div>
  );
}

function DayPager({ day, today }: { day: string; today: string }) {
  const language = useLanguage();
  const say = sayIn(language);
  const yesterday = shiftDay(today, -1);
  const name = day === today ? say(BABY.today) : day === yesterday ? say(BABY.yesterday) : null;
  const arrow = "press-icon flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600";
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Link href={`/baby?day=${shiftDay(day, -1)}`} replace scroll={false} aria-label={say(BABY.previousDay)} className={arrow}>
        <Chevron flip />
      </Link>
      <Link href="/baby" replace scroll={false} className="press-text min-w-0 text-center">
        <span className="block font-semibold text-slate-800">{name ?? readDayInZone(day, BABY.dayPattern, language)}</span>
        {name && <span className="block text-xs text-slate-500">{readDayInZone(day, BABY.dayPattern, language)}</span>}
      </Link>
      {day < today ? (
        <Link href={day === yesterday ? "/baby" : `/baby?day=${shiftDay(day, 1)}`} replace scroll={false} aria-label={say(BABY.nextDay)} className={arrow}>
          <Chevron />
        </Link>
      ) : (
        <span aria-hidden="true" className="h-10 w-10" />
      )}
    </div>
  );
}

/** The whole day on one line: sleep as blocks, feeds and nappies as dots, midnight to midnight. */
function DayStrip({ entries, day, now }: { entries: BabyEntry[]; day: string; now: Date }) {
  const say = sayIn(useLanguage());
  const marks = entries.flatMap((entry) => {
    const clip = clipToDay(entry, day, now);
    if (!clip) return [];
    if (entry.kind === "SLEEP") {
      const night = isNightSleep(entry.startedAt, readBabyDetails("SLEEP", entry.details).details.night);
      return [{ id: entry.id, block: true, clip, color: night ? "var(--baby-sleep)" : "var(--baby-nap)" }];
    }
    return [{ id: entry.id, block: false, clip, color: babyColor(kindColor(entry)) }];
  });
  return (
    <figure className="mb-4" aria-label={say(BABY.dayStrip)}>
      <div aria-hidden="true" className="relative h-5 overflow-hidden rounded-md bg-slate-100">
        {marks.map((mark) =>
          mark.block ? (
            <span
              key={mark.id}
              className="absolute inset-y-0 rounded-[4px]"
              style={{
                left: `${(mark.clip.from / 24) * 100}%`,
                width: `max(3px, ${((mark.clip.to - mark.clip.from) / 24) * 100}%)`,
                background: mark.color,
              }}
            />
          ) : (
            <span
              key={mark.id}
              className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white"
              style={{ left: `${(mark.clip.from / 24) * 100}%`, background: mark.color }}
            />
          ),
        )}
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </figure>
  );
}

function EntryRow({ entry, now, solids }: { entry: BabyEntry; now: Date; solids: string[] }) {
  const language = useLanguage();
  const say = sayIn(language);
  const { title, detail } = describeEntry(entry, language, now);
  const running = isRunning(entry);
  const color = kindColor(entry);
  const method = feedMethodOf(entry);
  const time = timeWords(entry.startedAt, language);

  const edit =
    entry.kind === "SLEEP"
      ? { title: say(BABY.editSleep), action: saveSleep, fields: <SleepFields entry={entry} now={now} /> }
      : entry.kind === "DIAPER"
        ? { title: say(BABY.editDiaper), action: saveDiaper, fields: <DiaperFields entry={entry} now={now} /> }
        : method && !running
          ? {
              title: say(BABY.editFeed),
              action: saveFeed,
              fields: (
                <>
                  <input type="hidden" name="method" value={method} />
                  <FeedMethodFields method={method} entry={entry} solids={solids} />
                  <TimeField name="at" label={say(method === "BREAST" ? BABY.started : BABY.time)} value={entry.startedAt} />
                  <NoteField value={entry.note} />
                </>
              ),
            }
          : null;

  return (
    <li className="flex items-center gap-3 py-2.5 pr-1.5 pl-4" data-baby-entry={entry.kind}>
      <span className="w-11 shrink-0 text-sm font-bold text-slate-600 tabular-nums">{time}</span>
      <span
        aria-hidden="true"
        className="h-3 w-3 shrink-0 rounded-full"
        style={running ? { border: `3px solid ${babyColor(color)}` } : { background: babyColor(color) }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
        <p className="truncate text-xs text-slate-500">
          {detail}
          {entry.note ? ` · ${entry.note}` : ""}
        </p>
      </div>
      <ItemMenu
        name="id"
        id={entry.id}
        label={`${title} ${time}`}
        editTitle={edit?.title}
        editAction={edit?.action}
        deleteTitle={say(BABY.deleteTitle)}
        deleteMessage={say(BABY.deleteMessage)}
        deleteAction={deleteBabyEvent}
      >
        {edit?.fields}
      </ItemMenu>
    </li>
  );
}

const EMPTY_BREAST: BreastDetails = { method: "BREAST", left: 0, right: 0, running: null, runningSince: null, lastSide: null };

/**
 * A feed. Breastfeeding opens on its timer — a big button per side, the one to start on
 * said above them — and the timer lives on the server from the first press, so the
 * sheet can be closed and the phone put down. Typing the minutes is one press away for
 * the feed nobody timed.
 */
function FeedSheet({
  methods,
  running,
  resumable,
  lastSide,
  solids,
  now,
  onDone,
}: {
  methods: FeedMethod[];
  running: BabyEntry | null;
  /** A feed finished a moment ago, which "Carry on" picks up again. */
  resumable: BabyEntry | null;
  lastSide: BreastSide | null;
  solids: string[];
  now: Date;
  onDone: () => void;
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const [method, setMethod] = useState<FeedMethod>(running ? "BREAST" : (methods[0] ?? "BOTTLE"));
  const [typed, setTyped] = useState(false);
  const stored = running ? (readBabyDetails("FEED", running.details).details as BreastDetails) : null;
  const [timer, showTimer] = useOptimistic(stored);
  const [opened] = useState(() => new Date());

  const press = (side: BreastSide) =>
    startTransition(async () => {
      const base = timer ?? EMPTY_BREAST;
      showTimer(switchBreastSide(base, base.running === side ? null : side, new Date()));
      const form = new FormData();
      form.set("side", side);
      await pressBreastSide(form);
    });

  const carryOn = (feed: BabyEntry) =>
    startTransition(async () => {
      const details = readBabyDetails("FEED", feed.details).details as BreastDetails;
      showTimer({ ...details, running: null, runningSince: null });
      const form = new FormData();
      form.set("id", feed.id);
      await resumeFeed(form);
    });

  const onTimer = method === "BREAST" && !typed;
  const resumed = resumable && !running && !timer ? (readBabyDetails("FEED", resumable.details).details as BreastDetails) : null;
  const choices = methods.includes(method) ? methods : [method, ...methods];

  return (
    <DialogForm
      action={saveFeed}
      submitLabel={onTimer && running ? say(BABY.finishFeed) : say(BABY.save)}
      onDone={onDone}
      onCancel={onDone}
    >
      {choices.length > 1 && (
        <Chips
          name="method"
          label={say(BABY.whatKind)}
          defaultValue={method}
          onChange={(value) => setMethod(value as FeedMethod)}
          options={feedMethodOptions(choices, language)}
        />
      )}
      {choices.length === 1 && <input type="hidden" name="method" value={method} />}

      {onTimer ? (
        <>
          {running ? (
            <>
              <input type="hidden" name="id" value={running.id} />
              <input type="hidden" name="finish" value="1" />
            </>
          ) : (
            <input type="hidden" name="timer" value="1" />
          )}
          {resumable && resumed && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3"
              style={{ background: "var(--baby-feed-soft)", color: "var(--baby-feed-text)" }}
              data-baby-resume
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {say(BABY.lastFeedEnded, { time: timeWords(resumable.startedAt, language) })}
                </p>
                <p className="truncate text-xs">
                  {say(BABY.sides, {
                    left: durationWords(resumed.left * 1000, language),
                    right: durationWords(resumed.right * 1000, language),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => carryOn(resumable)}
                className="press-button h-10 shrink-0 rounded-full px-4 text-sm font-bold text-white"
                style={{ background: "var(--baby-feed)" }}
              >
                {say(BABY.continueFeed)}
              </button>
            </div>
          )}
          {resumable && resumed && <p className="text-center text-sm text-slate-600">{say(BABY.orNewFeed)}</p>}
          {lastSide && !running && !timer && !resumed && (
            <p className="text-center text-sm text-slate-600">
              {say(otherSide(lastSide) === "LEFT" ? BABY.startOnLeft : BABY.startOnRight)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(["LEFT", "RIGHT"] as const).map((side) => {
              const on = timer?.running === side;
              const seconds = timer ? sideSeconds(timer, side, now) : 0;
              const suggested = !timer && lastSide !== null && otherSide(lastSide) === side;
              return (
                <button
                  key={side}
                  type="button"
                  onClick={() => press(side)}
                  aria-pressed={on}
                  className="press-button flex flex-col items-center gap-1 rounded-3xl px-2 py-5"
                  style={{
                    background: on ? "var(--baby-feed)" : "var(--baby-feed-soft)",
                    color: on ? "white" : "var(--baby-feed-text)",
                    outline: suggested ? "2px solid var(--baby-feed)" : undefined,
                  }}
                >
                  <span className="text-xs font-bold tracking-wide uppercase">{say(side === "LEFT" ? BABY.left : BABY.right)}</span>
                  <span className="text-4xl font-bold tabular-nums">{clockWords(seconds * 1000)}</span>
                  <span className="text-xs font-semibold">{say(on ? BABY.runningTapToPause : BABY.tapToStart)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-slate-500">{say(BABY.keepsRunning)}</p>
          {!running && (
            <button type="button" onClick={() => setTyped(true)} className="press-text tap-inline mx-auto block text-sm font-semibold text-[var(--accent-text)]">
              {say(BABY.typeMinutes)}
            </button>
          )}
          <NoteField value={running?.note} />
        </>
      ) : (
        <>
          <FeedMethodFields key={method} method={method} solids={solids} />
          <TimeField name="at" label={say(method === "BREAST" ? BABY.started : BABY.time)} value={opened} />
          <NoteField />
          {method === "BREAST" && (
            <button type="button" onClick={() => setTyped(false)} className="press-text tap-inline mx-auto block text-sm font-semibold text-[var(--accent-text)]">
              {say(BABY.useTimer)}
            </button>
          )}
        </>
      )}
    </DialogForm>
  );
}

function SettingsFields({ baby }: { baby: BabySettings }) {
  const say = sayIn(useLanguage());
  const tracks: { name: keyof BabySettings; label: string }[] = [
    { name: "trackSleep", label: say(BABY.sleep) },
    { name: "trackBreast", label: say(BABY.breast) },
    { name: "trackBottle", label: say(BABY.bottle) },
    { name: "trackSolid", label: say(BABY.solid) },
    { name: "trackDiaper", label: say(BABY.diapers) },
  ];
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="baby-name">{say(BABY.name)}</Label>
        <Input id="baby-name" name="name" required maxLength={MAX_BABY_NAME_LENGTH} defaultValue={baby.name} className="h-12 text-base" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-700">{say(BABY.tracking)}</legend>
        <p className="text-xs text-slate-500">{say(BABY.trackingHint)}</p>
        {tracks.map((track) => (
          <label
            key={track.name}
            className="press-button flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4"
          >
            <span className="font-medium text-slate-800">{track.label}</span>
            {/* An unticked box says nothing, so "off" goes first under the same name. */}
            <input type="hidden" name={track.name} value="off" />
            <input
              type="checkbox"
              name={track.name}
              value="on"
              defaultChecked={Boolean(baby[track.name])}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>
        ))}
      </fieldset>
    </>
  );
}

function DockButton({
  kind,
  strong = false,
  onClick,
  children,
}: {
  kind: BabyColorKind;
  strong?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-baby-dock={kind}
      className="press-button flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-sm font-bold shadow-sm"
      style={{
        background: strong ? babyColor(kind) : babyColor(kind, "-soft"),
        color: strong ? "white" : babyColor(kind, "-text"),
      }}
    >
      {children}
    </button>
  );
}

function ChooseRow({
  kind,
  strong = false,
  onClick,
  children,
}: {
  kind: BabyColorKind;
  strong?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press-button flex h-14 items-center gap-3 rounded-2xl px-4 text-base font-semibold"
      style={{ background: babyColor(kind, strong ? "" : "-soft"), color: strong ? "white" : babyColor(kind, "-text") }}
    >
      {children}
    </button>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5 shrink-0",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function SleepIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  );
}

function BottleIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 2h4M9 5h6l1 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" />
      <path d="M8 12h8" />
    </svg>
  );
}

function DiaperIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7h18v3a9 9 0 0 1-18 0z" />
      <path d="M8 7v3M16 7v3" />
    </svg>
  );
}

function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${flip ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
