"use client";

import { Fragment, startTransition, useEffect, useMemo, useOptimistic, useRef, useState } from "react";
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useFollow } from "../use-follow";
import { useLanguage } from "@/components/language-provider";
import { Modal } from "@/components/modal";
import { DialogForm } from "@/components/form-dialog";
import { CreateFab } from "@/components/create-button";
import { useCatchUp, useKeepWarm } from "@/components/use-keep-warm";
import { ItemMenu } from "@/components/item-menu";
import { Input, Label } from "@/components/ui";
import { sayIn, type Phrase } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { babyColor, type BabyColorKind } from "@/lib/baby-colors";
import { BABY_TILE_FIELD, moveBabyTile, type BabyTile } from "@/lib/baby-tiles";
import { readDayInZone, shiftDay } from "@/lib/time";
import {
  MAX_BABY_NAME_LENGTH,
  clipToDay,
  endOf,
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
  setBabyTiles,
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

/** What the list can be narrowed to: one tile's entries, or every feed at once. */
export type BabyShow = BabyTile | "feed";

const METHOD_OF_TILE: Partial<Record<BabyTile, FeedMethod>> = { breast: "BREAST", bottle: "BOTTLE", solid: "SOLID" };

const colorOfShow = (show: BabyShow): BabyColorKind => (show === "sleep" ? "sleep" : show === "diaper" ? "diaper" : "feed");

/** Whether an entry belongs under what the list is narrowed to. */
function showsEntry(show: BabyShow, entry: BabyEntry): boolean {
  const method = METHOD_OF_TILE[show as BabyTile];
  if (method) return entry.kind === "FEED" && feedMethodOf(entry) === method;
  return kindColor(entry) === colorOfShow(show);
}

/**
 * The clock the page reads, ticking every second while a timer runs and every half
 * minute otherwise — every "how long since" is worked out from it and the stored
 * instants, never counted up, so a phone that slept with the app closed is right the
 * moment it wakes.
 */
function useNow(fast: boolean, entries: unknown): Date {
  const [now, setNow] = useState(() => new Date());
  // Read afresh whenever the entries change too: one written a moment ago is stamped after
  // the last tick, and would otherwise read as still to come until the next one.
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), fast ? 1000 : 30_000);
    return () => clearInterval(timer);
  }, [fast, entries]);
  return now;
}

/** The sheets behind the "+" and the tiles' own "+" — the ones the charts' page opens too. */
type AddSheet = "choose" | "sleep" | "diaper" | "feed";
type Sheet = null | AddSheet | "settings" | "wakeful";
const isAddSheet = (sheet: Sheet): sheet is AddSheet =>
  sheet === "choose" || sheet === "sleep" || sheet === "diaper" || sheet === "feed";

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
  show: initialShow = null,
  order: initialOrder,
  renderedAt,
}: {
  baby: BabySettings;
  /** When the server drew this (epoch ms), so a copy kept warm catches up on arrival. */
  renderedAt: number;
  entries: WireEntry[];
  day: string;
  today: string;
  solids: string[];
  /** What the list is narrowed to, from `?show=` — a tile pressed. */
  show?: BabyShow | null;
  /** The tiles in this person's order (`User.babyTiles`). */
  order: BabyTile[];
}) {
  const language = useLanguage();
  const say = sayIn(language);
  const entries = useMemo(() => wire.map(fromWire), [wire]);
  const [asleep, showAsleep] = useOptimistic(entries.some((entry) => entry.kind === "SLEEP" && !entry.endedAt));
  const running = entries.some(isRunning);
  const now = useNow(running || asleep, wire);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [feedMethod, setFeedMethod] = useState<FeedMethod | null>(null);
  const [show, setShow] = useState<BabyShow | null>(initialShow);
  useFollow();
  useKeepWarm("/baby/charts", wire);
  useCatchUp(renderedAt);

  // A tile pressed narrows the day's list to its kind, and pressed again shows everything.
  // Kept in the address too, so paging the day keeps it and a reload comes back to it.
  const toggleShow = (kind: BabyShow) => {
    const next = show === kind ? null : kind;
    setShow(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("show", next);
    else url.searchParams.delete("show");
    window.history.replaceState(window.history.state, "", url);
  };

  const runningBreast = runningBreastOf(entries);

  const sleep = sleepState(entries, now);
  const lastDiaper = entries
    .filter((entry) => entry.kind === "DIAPER")
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const shown = entriesOn(entries, day, now).filter((entry) => !show || showsEntry(show, entry));
  // A way of feeding as a tile: how long since it last ended, or "now" while it runs.
  const feedTile = (method: FeedMethod, label: string): TileView => {
    const fed = lastFeed(entries.filter((entry) => entry.kind === "FEED" && feedMethodOf(entry) === method), now);
    return {
      kind: "feed",
      label,
      strong: fed?.running === true,
      value: fed?.running ? say(BABY.feedingNowShort) : fed ? durationWords(now.getTime() - fed.at.getTime(), language) : say(BABY.notYet),
      // A breast feed has an end; a bottle or a meal is a moment.
      detail: fed
        ? say(fed.running ? BABY.since : method === "BREAST" ? BABY.endedAt : BABY.lastAt, { time: timeWords(fed.at, language) })
        : "",
      add: label,
      onAdd: () => openFeed(method),
    };
  };
  const openFeed = (method: FeedMethod | null) => {
    setFeedMethod(method);
    setSheet("feed");
  };

  const pressSleep = () =>
    startTransition(async () => {
      showAsleep(!asleep);
      const form = new FormData();
      form.set("to", asleep ? "awake" : "asleep");
      await toggleSleep(form);
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
    <div>
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

      {/* How long since the last of everything: the first thing anybody opens this for —
          and beside each, its "+" to write the next one down. A row that scrolls sideways,
          held and dragged into the person's own order. */}
      <TileRow
        order={initialOrder}
        tiles={{
          sleep: baby.trackSleep
            ? {
                kind: "sleep",
                strong: sleep?.asleep === true,
                label: say(sleep?.asleep ? BABY.asleep : sleep ? BABY.awake : BABY.sleep),
                value: sleep
                  ? durationWords(sleep.asleep ? sleep.sleptMs : now.getTime() - sleep.since.getTime(), language)
                  : say(BABY.notYet),
                detail: sleep ? say(BABY.since, { time: timeWords(sleep.since, language) }) : "",
                add: say(asleep ? BABY.stopSleep : BABY.startSleep),
                stop: asleep,
                onAdd: wakeful ? () => setSheet("wakeful") : pressSleep,
              }
            : null,
          breast:
            baby.trackBreast || runningBreast
              ? feedTile("BREAST", say(BABY.breast))
              : null,
          bottle: baby.trackBottle ? feedTile("BOTTLE", say(BABY.bottle)) : null,
          solid: baby.trackSolid ? feedTile("SOLID", say(BABY.solid)) : null,
          diaper: baby.trackDiaper
            ? {
                kind: "diaper",
                label: say(BABY.diapers),
                value: say(BABY.countToday, { n: diapersOn(entries, today) }),
                detail: lastDiaper ? say(BABY.lastAt, { time: timeWords(lastDiaper.startedAt, language) }) : "",
                add: say(BABY.diaper),
                onAdd: () => setSheet("diaper"),
              }
            : null,
        }}
        show={show}
        onPress={toggleShow}
      />

      <DayPager day={day} today={today} show={show} />
      <DayStrip entries={entries} day={day} now={now} />

      {show && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-bold tracking-wide uppercase" style={{ color: babyColor(colorOfShow(show), "-text") }}>
            {say(SHOW_LABELS[show])}
          </span>
          <button
            type="button"
            onClick={() => toggleShow(show)}
            className="press-text tap-inline text-sm font-semibold text-[var(--accent-text)]"
          >
            {say(BABY.showAll)}
          </button>
        </div>
      )}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          {say(BABY.nothingOnDay)}
        </p>
      ) : show ? (
        // One kind at a time reads as a run: each entry, and between two of them the time
        // that passed — for sleep, the time awake.
        <ul className="flex flex-col" data-baby-focus={show}>
          {shown.map((entry, index) => {
            const older = shown[index + 1];
            const gap = older ? entry.startedAt.getTime() - endOf(older, now).getTime() : 0;
            return (
              <Fragment key={entry.id}>
                <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <EntryRow entry={entry} now={now} solids={solids} as="div" />
                </li>
                {older && gap >= 60_000 && (
                  <li className="flex items-center gap-3 py-1.5 pl-9 text-sm text-slate-500" data-baby-gap>
                    <span aria-hidden="true" className="h-7 border-l-2 border-dashed border-slate-300" />
                    {say(show === "sleep" ? BABY.awakeGap : BABY.betweenGap, { time: durationWords(gap, language) })}
                  </li>
                )}
                {older && gap < 60_000 && <li aria-hidden="true" className="h-2" />}
              </Fragment>
            );
          })}
        </ul>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {shown.map((entry) => (
            <EntryRow key={entry.id} entry={entry} now={now} solids={solids} />
          ))}
        </ul>
      )}

      <AddSheets
        baby={baby}
        entries={entries}
        solids={solids}
        now={now}
        sheet={isAddSheet(sheet) ? sheet : null}
        feedMethod={feedMethod}
        onSheet={(next, method) => {
          if (method !== undefined) setFeedMethod(method);
          setSheet(next);
        }}
      />

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

      <Modal open={sheet === "settings"} onClose={() => setSheet(null)} title={say(BABY.settings)}>
        <DialogForm action={updateBaby} submitLabel={say(BABY.saveSettings)} onDone={() => setSheet(null)} onCancel={() => setSheet(null)}>
          <SettingsFields baby={baby} />
        </DialogForm>
      </Modal>
    </div>
  );
}

/**
 * The page's "+" and the sheets it and the tiles open: a sleep written down afterwards, a
 * nappy, a feed. Drawn by the log and the charts alike, so the "+" does the same thing on
 * both tabs; which sheet is open is the caller's, because the log's tiles open them too.
 */
function AddSheets({
  baby,
  entries,
  solids,
  now,
  sheet,
  feedMethod,
  onSheet,
}: {
  baby: BabySettings;
  entries: BabyEntry[];
  solids: string[];
  now: Date;
  sheet: AddSheet | null;
  feedMethod: FeedMethod | null;
  onSheet: (sheet: AddSheet | null, method?: FeedMethod | null) => void;
}) {
  const say = sayIn(useLanguage());
  const methods = feedMethodsOf(baby);
  const runningBreast = runningBreastOf(entries);
  const feeds = methods.length > 0 || runningBreast !== null;
  const close = () => onSheet(null);

  return (
    <>
      <CreateFab label={say(BABY.newEntry)} onClick={() => onSheet("choose")} expanded={sheet === "choose"} />

      <Modal open={sheet === "choose"} onClose={close} title={say(BABY.newEntry)} size="drawer">
        <div className="flex flex-col gap-2 px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {baby.trackSleep && (
            <ChooseRow kind="sleep" onClick={() => onSheet("sleep")}>
              <SleepIcon />
              {say(BABY.logSleep)}
            </ChooseRow>
          )}
          {feeds && (
            <ChooseRow kind="feed" onClick={() => onSheet("feed", null)}>
              <BottleIcon />
              {say(BABY.feed)}
            </ChooseRow>
          )}
          {baby.trackDiaper && (
            <ChooseRow kind="diaper" onClick={() => onSheet("diaper")}>
              <DiaperIcon />
              {say(BABY.diaper)}
            </ChooseRow>
          )}
        </div>
      </Modal>

      <Modal open={sheet === "sleep"} onClose={close} title={say(BABY.logSleep)}>
        <DialogForm action={saveSleep} submitLabel={say(BABY.save)} onDone={close} onCancel={close}>
          <SleepFields now={now} />
        </DialogForm>
      </Modal>

      <Modal open={sheet === "diaper"} onClose={close} title={say(BABY.diaper)}>
        <DialogForm action={saveDiaper} submitLabel={say(BABY.save)} onDone={close} onCancel={close}>
          <DiaperFields now={now} />
        </DialogForm>
      </Modal>

      <Modal open={sheet === "feed"} onClose={close} title={say(BABY.feed)}>
        <FeedSheet
          key={feedMethod ?? "any"}
          initial={feedMethod}
          methods={methods}
          running={runningBreast}
          resumable={resumableFeed(entries, now)}
          lastSide={lastBreastSide(entries.filter((entry) => entry !== runningBreast))}
          solids={solids}
          now={now}
          onDone={close}
        />
      </Modal>
    </>
  );
}

const feedMethodsOf = (baby: BabySettings): FeedMethod[] => [
  ...(baby.trackBreast ? (["BREAST"] as const) : []),
  ...(baby.trackBottle ? (["BOTTLE"] as const) : []),
  ...(baby.trackSolid ? (["SOLID"] as const) : []),
];

const runningBreastOf = (entries: BabyEntry[]) =>
  entries.find((entry) => !entry.endedAt && feedMethodOf(entry) === "BREAST") ?? null;

/**
 * The charts' own "+": the same sheets as the log's, over the same entries, so a feed or
 * a nappy is written down from either tab without going back to the other first.
 */
export function BabyAddButton({
  baby,
  entries: wire,
  solids,
  renderedAt,
}: {
  baby: BabySettings;
  entries: WireEntry[];
  solids: string[];
  renderedAt: number;
}) {
  // The log is a sideways swipe away: kept fetched, so it is there the moment it is asked for.
  useKeepWarm("/baby", wire);
  useCatchUp(renderedAt);
  const entries = useMemo(() => wire.map(fromWire), [wire]);
  const now = useNow(entries.some(isRunning), wire);
  const [sheet, setSheet] = useState<AddSheet | null>(null);
  const [feedMethod, setFeedMethod] = useState<FeedMethod | null>(null);
  return (
    <AddSheets
      baby={baby}
      entries={entries}
      solids={solids}
      now={now}
      sheet={sheet}
      feedMethod={feedMethod}
      onSheet={(next, method) => {
        if (method !== undefined) setFeedMethod(method);
        setSheet(next);
      }}
    />
  );
}

const SHOW_LABELS: Record<BabyShow, Phrase> = {
  sleep: BABY.sleep,
  breast: BABY.breast,
  bottle: BABY.bottle,
  solid: BABY.solid,
  diaper: BABY.diapers,
  feed: BABY.feed,
};

type TileView = {
  kind: BabyColorKind;
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
  /** What the "+" does, said out loud. */
  add: string;
  /** The "+" stops what is running rather than adding to it. */
  stop?: boolean;
  onAdd: () => void;
};

/**
 * The row of tiles. Scrolls sideways with a finger; held still for a moment, a tile lifts
 * and is dragged to a new place, and the order is saved as this person's. A tap is still a
 * tap: the hold has to come before any movement, so a swipe scrolls as it always did.
 */
function TileRow({
  order: initialOrder,
  tiles,
  show,
  onPress,
}: {
  order: BabyTile[];
  tiles: Record<BabyTile, TileView | null>;
  show: BabyShow | null;
  onPress: (tile: BabyShow) => void;
}) {
  const [order, setOrder] = useState(initialOrder);
  const dragged = useRef(false);
  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );
  const drawn = order.filter((tile) => tiles[tile]);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // The press that ended the drag is not also a tap on the tile it let go of.
    dragged.current = true;
    setTimeout(() => (dragged.current = false), 0);
    if (!over || active.id === over.id) return;
    const next = moveBabyTile(order, active.id as BabyTile, over.id as BabyTile);
    setOrder(next);
    const form = new FormData();
    for (const tile of next) form.append(BABY_TILE_FIELD, tile);
    startTransition(() => setBabyTiles(form));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragStart={() => navigator.vibrate?.(10)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={drawn} strategy={horizontalListSortingStrategy}>
        <div className="scrollbar-hidden -mx-4 mb-5 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-1" data-baby-tiles>
          {drawn.map((tile) => (
            <SortableTile
              key={tile}
              tile={tile}
              view={tiles[tile]!}
              pressed={show === tile || (show === "feed" && tiles[tile]!.kind === "feed")}
              onPress={() => {
                if (!dragged.current) onPress(tile);
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({ tile, view, pressed, onPress }: { tile: BabyTile; view: TileView; pressed: boolean; onPress: () => void }) {
  const { setNodeRef, listeners, transform, transition, isDragging } = useSortable({ id: tile });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onContextMenu={(event) => event.preventDefault()}
      className="relative w-[8.75rem] shrink-0 snap-start select-none [-webkit-touch-callout:none]"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      data-baby-tile={tile}
      data-dragging={isDragging || undefined}
    >
      <Tile
        kind={view.kind}
        pressed={pressed}
        onPress={onPress}
        strong={view.strong}
        lifted={isDragging}
        label={view.label}
        value={view.value}
        detail={view.detail}
      />
      <button
        type="button"
        onClick={view.onAdd}
        aria-label={view.add}
        title={view.add}
        className="press-icon absolute top-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full"
        style={{
          background: view.stop ? babyColor(view.kind) : babyColor(view.kind, "-soft"),
          color: view.stop ? "white" : babyColor(view.kind, "-text"),
        }}
        data-baby-add={tile}
      >
        {view.stop ? (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
      </button>
    </div>
  );
}

function Tile({
  lifted = false,
  kind,
  label,
  value,
  detail,
  strong = false,
  pressed,
  onPress,
}: {
  lifted?: boolean;
  kind: BabyColorKind;
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
  pressed: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-pressed={pressed}
      className="press-card flex w-full min-w-0 flex-col gap-0.5 rounded-2xl border border-slate-200 px-3 py-2.5 text-left shadow-sm transition-[scale,box-shadow] duration-(--dur-quick)"
      style={{
        background: strong ? babyColor(kind, "-soft") : "var(--color-white)",
        borderColor: pressed ? babyColor(kind) : undefined,
        boxShadow: lifted
          ? "0 10px 24px -8px rgb(0 0 0 / 0.35)"
          : pressed
            ? `0 0 0 1px ${babyColor(kind)}`
            : undefined,
        scale: lifted ? "1.05" : undefined,
      }}
    >
      <span className="truncate pr-8 text-[11px] font-bold tracking-wide uppercase" style={{ color: babyColor(kind, "-text") }}>
        {label}
      </span>
      <span className="truncate text-lg leading-tight font-bold text-slate-900">{value}</span>
      <span className="truncate text-xs text-slate-500">{detail || " "}</span>
    </button>
  );
}

function DayPager({ day, today, show }: { day: string; today: string; show: BabyShow | null }) {
  const language = useLanguage();
  const say = sayIn(language);
  const yesterday = shiftDay(today, -1);
  const name = day === today ? say(BABY.today) : day === yesterday ? say(BABY.yesterday) : null;
  const arrow = "press-icon flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600";
  const to = (target: string | null) => {
    const params = new URLSearchParams();
    if (target) params.set("day", target);
    if (show) params.set("show", show);
    const query = params.toString();
    return query ? `/baby?${query}` : "/baby";
  };
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <Link href={to(shiftDay(day, -1))} replace scroll={false} aria-label={say(BABY.previousDay)} className={arrow}>
        <Chevron flip />
      </Link>
      <Link href={to(null)} replace scroll={false} className="press-text min-w-0 text-center">
        <span className="block font-semibold text-slate-800">{name ?? readDayInZone(day, BABY.dayPattern, language)}</span>
        {name && <span className="block text-xs text-slate-500">{readDayInZone(day, BABY.dayPattern, language)}</span>}
      </Link>
      {day < today ? (
        <Link href={to(day === yesterday ? null : shiftDay(day, 1))} replace scroll={false} aria-label={say(BABY.nextDay)} className={arrow}>
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

function EntryRow({
  entry,
  now,
  solids,
  as: Tag = "li",
}: {
  entry: BabyEntry;
  now: Date;
  solids: string[];
  as?: "li" | "div";
}) {
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
    <Tag className="flex items-center gap-3 py-2.5 pr-1.5 pl-4" data-baby-entry={entry.kind}>
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
    </Tag>
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
  initial,
  methods,
  running,
  resumable,
  lastSide,
  solids,
  now,
  onDone,
}: {
  /** The way of feeding the sheet opens on — the tile whose "+" opened it. */
  initial: FeedMethod | null;
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
  const [method, setMethod] = useState<FeedMethod>(running ? "BREAST" : (initial ?? methods[0] ?? "BOTTLE"));
  const [typed, setTyped] = useState(false);
  const stored = running ? (readBabyDetails("FEED", running.details).details as BreastDetails) : null;
  const [timer, showTimer] = useOptimistic(stored);
  const [opened] = useState(() => new Date());

  const press = (side: BreastSide) =>
    startTransition(async () => {
      const base = timer ?? EMPTY_BREAST;
      const pausing = base.running === side;
      showTimer(switchBreastSide(base, pausing ? null : side, new Date()));
      const form = new FormData();
      form.set("side", side);
      form.set("to", pausing ? "pause" : "run");
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
