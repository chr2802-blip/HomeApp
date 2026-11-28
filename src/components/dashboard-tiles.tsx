"use client";

import { startTransition, useEffect, useOptimistic, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "./language-provider";
import { Card } from "./ui";
import { Modal, ModalBody } from "./modal";
import { useLongPress } from "./use-long-press";
import { sayIn, type Phrase, type Say } from "@/lib/copy/say";
import { TILES } from "@/lib/copy/tiles";
import { clockWords } from "@/lib/baby-words";
import { setDashboardTiles } from "@/app/actions/nav";
import { finishBreastFeed, pressBreastSide, toggleSleep } from "@/app/actions/baby";
import { useFollow } from "./use-follow";
import { CREATE_PARAM } from "./create-button";
import { BABY } from "@/lib/copy/baby";
import {
  listTile,
  setTile,
  TILE_FIELD,
  tileListId,
  type TileChoice,
  type TileKind,
  type TileSlot,
} from "@/lib/dashboard-tiles";

/** What the page knows about one tile, worked out on the server. */
export type TileView =
  | { kind: "sleep"; baby: boolean; since: string | null }
  | { kind: "feed"; baby: boolean; id: string | null; since: string | null; side: "LEFT" | "RIGHT" | null }
  | { kind: "recipe" }
  | { kind: "list"; id: string; title: string; face: string | null; open: number; total: number };

/** A list the chooser can offer. */
export type TileList = { id: string; title: string; face: string | null };

/** The clock a running timer reads — once a second, only while one runs. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

/** The tile's frame: the same card for every kind, so the row lines up. */
function Frame({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "live" }) {
  return (
    <Card
      padded={false}
      className={`h-full px-3 py-2 transition hover:border-slate-400 ${tone === "live" ? "border-[var(--accent)]" : ""}`}
    >
      {children}
    </Card>
  );
}

function Lines({ value, label, detail, warn = false }: { value: ReactNode; label: string; detail: string; warn?: boolean }) {
  return (
    <>
      <p className="truncate text-xl leading-tight font-semibold tabular-nums">{value}</p>
      <p className="truncate text-xs text-slate-700">{label}</p>
      <p className={`truncate text-[11px] ${warn ? "text-red-600" : "text-slate-400"}`}>{detail}</p>
    </>
  );
}

function LinkTile({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press-card relative block h-full rounded-2xl">
      {children}
    </Link>
  );
}

function SleepTile({ view, say }: { view: Extract<TileView, { kind: "sleep" }>; say: Say }) {
  const [since, show] = useOptimistic(view.since);
  const now = useNow(since !== null);
  if (!view.baby) {
    return (
      <LinkTile href="/baby">
        <Frame>
          <Lines value="💤" label={say(TILES.sleepIdle)} detail={say(TILES.noBaby)} />
        </Frame>
      </LinkTile>
    );
  }
  const press = () =>
    startTransition(async () => {
      show(since ? null : new Date().toISOString());
      const form = new FormData();
      form.set("to", since ? "awake" : "asleep");
      await toggleSleep(form);
    });
  return (
    <button type="button" onClick={press} className="press-card relative block h-full w-full rounded-2xl text-left" data-tile-sleep={since ? "running" : "idle"}>
      <Frame tone={since ? "live" : "plain"}>
        {since ? (
          <Lines value={clockWords(now - Date.parse(since))} label={say(TILES.sleeping)} detail={say(TILES.sleepingHint)} />
        ) : (
          <Lines value="💤" label={say(TILES.sleepIdle)} detail={say(TILES.sleepIdleHint)} />
        )}
      </Frame>
    </button>
  );
}

function FeedTile({ view, say }: { view: Extract<TileView, { kind: "feed" }>; say: Say }) {
  const [state, show] = useOptimistic({ since: view.since, side: view.side, id: view.id });
  // The total since the feed began, pauses included: what a parent watching the clock
  // wants to know is how long the baby has been at it, and the page says the sides.
  const now = useNow(state.since !== null);
  if (!view.baby) {
    return (
      <LinkTile href="/baby">
        <Frame>
          <Lines value="🍼" label={say(TILES.feedIdle)} detail={say(TILES.noBaby)} />
        </Frame>
      </LinkTile>
    );
  }
  const press = (side: "LEFT" | "RIGHT") =>
    startTransition(async () => {
      const pausing = state.side === side;
      show({ since: state.since ?? new Date().toISOString(), side: pausing ? null : side, id: state.id });
      const form = new FormData();
      form.set("side", side);
      form.set("to", pausing ? "pause" : "run");
      await pressBreastSide(form);
    });
  // Finishing is the tile's own press, not a trip to /baby: a feed paused on the tile was
  // otherwise a feed nobody could end from where it was started.
  const finish = () =>
    startTransition(async () => {
      if (!state.id) return;
      show({ since: null, side: null, id: null });
      const form = new FormData();
      form.set("id", state.id);
      await finishBreastFeed(form);
    });
  const pill = "press-button h-8 min-w-0 flex-1 truncate rounded-full border px-1 text-xs font-semibold";
  const plain = "border-slate-200 bg-white text-slate-700";
  // Running, the two buttons are what can be done to a feed under way: pause it or end it.
  // Paused (or not begun), they are the sides, because carrying on means choosing one.
  return (
    <Frame tone={state.since ? "live" : "plain"}>
      <Link href="/baby" className="press-text block">
        <p className="truncate text-xl leading-tight font-semibold tabular-nums">
          {state.since ? clockWords(now - Date.parse(state.since)) : "🍼"}
        </p>
        {(!state.since || state.side) && (
          <p className="truncate text-xs text-slate-700">
            {state.side
              ? say(TILES.feedingOn, { side: say(state.side === "LEFT" ? TILES.leftShort : TILES.rightShort) })
              : say(TILES.feedIdle)}
          </p>
        )}
      </Link>
      {/* Paused, the line under the clock is how to end it: the buttons are the sides. */}
      {state.since && !state.side && (
        <button
          type="button"
          onClick={finish}
          disabled={!state.id}
          data-tile-feed-finish
          className="press-text tap-inline block max-w-full truncate text-xs font-semibold text-[var(--accent-text)]"
        >
          {say(TILES.pausedFinish)}
        </button>
      )}
      <div className="mt-1 flex gap-1">
        {state.side ? (
          <>
            <button
              type="button"
              onClick={() => press(state.side!)}
              data-tile-feed-pause
              aria-label={say(TILES.pause)}
              className={`${pill} ${plain} grid place-items-center`}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <rect x="3" y="2" width="3.5" height="12" rx="1" />
                <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={!state.id}
              data-tile-feed-finish
              aria-label={say(TILES.finish)}
              className={`${pill} grid place-items-center border-[var(--accent)] bg-[var(--accent)] text-white disabled:opacity-60`}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                <rect x="3" y="3" width="10" height="10" rx="1.5" />
              </svg>
            </button>
          </>
        ) : (
          (["LEFT", "RIGHT"] as const).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => press(side)}
              aria-label={say(side === "LEFT" ? BABY.left : BABY.right)}
              data-tile-feed-side={side}
              className={`${pill} ${plain}`}
            >
              {say(side === "LEFT" ? TILES.leftShort : TILES.rightShort)}
            </button>
          ))
        )}
      </div>
    </Frame>
  );
}

function Tile({ view, say }: { view: TileView; say: Say }) {
  switch (view.kind) {
    case "recipe":
      return (
        <LinkTile href={`/recipes?${CREATE_PARAM}`}>
          <Frame>
            <Lines value="🍲" label={say(TILES.newRecipe)} detail={say(TILES.newRecipeHint)} />
          </Frame>
        </LinkTile>
      );
    case "list":
      return (
        <LinkTile href={`/lists/${view.id}`}>
          <Frame>
            <Lines
              value={view.open}
              label={`${view.face ? `${view.face} ` : ""}${view.title}`}
              detail={view.total > 0 && view.open === 0 ? say(TILES.listDone) : say(TILES.listOpen, { count: view.open })}
            />
          </Frame>
        </LinkTile>
      );
    case "sleep":
      return <SleepTile view={view} say={say} />;
    case "feed":
      return <FeedTile view={view} say={say} />;
  }
}

const KIND_NAMES: Record<TileKind, Phrase> = {
  sleep: TILES.kindSleep,
  feed: TILES.kindFeed,
  recipe: TILES.kindRecipe,
};
const KIND_GLYPHS: Record<TileKind, string> = { sleep: "💤", feed: "🍼", recipe: "🍲" };
const SHORTCUTS: readonly TileKind[] = ["sleep", "feed", "recipe"];

/**
 * A place nobody has filled, and the only place the dashboard explains how to fill one —
 * so the explanation is where the thumb has to go, and gone the moment it is not needed.
 */
function EmptyTile({ say, onOpen }: { say: Say; onOpen: () => void }) {
  // A tap opens the chooser too: an empty place has nothing else a press could mean.
  return (
    <button
      type="button"
      onClick={onOpen}
      data-tile-empty
      className="press-card relative flex h-full min-h-[76px] w-full flex-col justify-center rounded-2xl border border-dashed border-slate-300 px-3 py-2 text-left text-slate-500"
    >
      <span className="block text-xs font-semibold text-slate-600">{say(TILES.emptyTitle)}</span>
      <span className="block text-[11px] leading-snug">{say(TILES.emptyHint)}</span>
    </button>
  );
}

/** What a choice is called, for the chooser and `/profile`. */
export function choiceName(choice: TileChoice, lists: readonly TileList[], say: Say): { glyph: string; name: string } {
  const listId = tileListId(choice);
  if (listId) {
    const list = lists.find((l) => l.id === listId);
    return { glyph: list?.face ?? "📝", name: list?.title ?? "…" };
  }
  const kind = choice as TileKind;
  return { glyph: KIND_GLYPHS[kind], name: say(KIND_NAMES[kind]) };
}

/**
 * The tiles as chosen, with the press just made shown at once — the dashboard behind the
 * drawer changes under the thumb, not a round trip later.
 */
export function useTiles(stored: TileSlot[]) {
  const [tiles, show] = useOptimistic(stored);
  const change = (next: TileSlot[]) =>
    startTransition(async () => {
      show(next);
      const form = new FormData();
      for (const tile of next) form.append(TILE_FIELD, tile ?? "");
      await setDashboardTiles(form);
    });
  return [tiles, change] as const;
}

/** The drawer that chooses what one place holds: the shortcuts, the numbers, the lists. */
export function TileChooser({
  slot,
  tiles,
  lists,
  onChange,
  onClose,
}: {
  slot: number | null;
  tiles: TileSlot[];
  lists: readonly TileList[];
  onChange: (tiles: TileSlot[]) => void;
  onClose: () => void;
}) {
  const say = sayIn(useLanguage());
  const current = slot === null ? null : tiles[slot];
  const option = (choice: TileChoice) => {
    const { glyph, name } = choiceName(choice, lists, say);
    const chosen = choice === current;
    const elsewhere = !chosen && tiles.includes(choice);
    return (
      <li key={choice}>
        <button
          type="button"
          aria-pressed={chosen}
          onClick={() => {
            if (slot !== null) onChange(setTile(tiles, slot, choice));
            onClose();
          }}
          className={`press-button flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
            chosen ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          <span aria-hidden="true" className="text-lg">{glyph}</span>
          <span className="min-w-0 flex-1 truncate font-semibold">{name}</span>
          {elsewhere && (
            <span className="shrink-0 text-xs text-slate-500">{say(TILES.inPlace, { n: tiles.indexOf(choice) + 1 })}</span>
          )}
        </button>
      </li>
    );
  };
  const heading = (text: string) => (
    <h3 className="mt-4 mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase first:mt-0">{text}</h3>
  );
  return (
    <Modal open={slot !== null} onClose={onClose} size="drawer" title={say(TILES.chooseTitle, { n: (slot ?? 0) + 1 })}>
      <ModalBody>
        {heading(say(TILES.shortcuts))}
        <ul className="flex flex-col gap-2">{SHORTCUTS.map(option)}</ul>
        {heading(say(TILES.lists))}
        {lists.length === 0 ? (
          <p className="text-sm text-slate-500">{say(TILES.noLists)}</p>
        ) : (
          <ul className="flex flex-col gap-2">{lists.map((list) => option(listTile(list.id)))}</ul>
        )}
        {current && (
          <button
            type="button"
            onClick={() => {
              if (slot !== null) onChange(setTile(tiles, slot, null));
              onClose();
            }}
            className="press-button mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-600"
          >
            {say(TILES.clear)}
          </button>
        )}
      </ModalBody>
    </Modal>
  );
}

function HeldTile({ onHold, children }: { onHold: () => void; children: ReactNode }) {
  const hold = useLongPress(onHold);
  return (
    <div {...hold} className="h-full min-w-0 select-none [-webkit-touch-callout:none]">
      {children}
    </div>
  );
}

/**
 * The row of three under the greeting, each of the person's own choosing. Holding one
 * opens the chooser for that place; `/profile` has the same choice spelled out.
 */
export function DashboardTiles({
  tiles: stored,
  views,
  lists,
}: {
  tiles: TileSlot[];
  /** One per choice in `tiles`, keyed by the choice. */
  views: Record<string, TileView>;
  lists: TileList[];
}) {
  const say = sayIn(useLanguage());
  const [tiles, change] = useTiles(stored);
  const [slot, setSlot] = useState<number | null>(null);
  // A timer on a tile follows the other parent's phone, as `/baby` does.
  useFollow(Object.values(views).some((view) => (view.kind === "sleep" || view.kind === "feed") && view.baby));
  return (
    <>
      <div className="grid grid-cols-3 gap-2" data-tiles={tiles.map((tile) => tile ?? "-").join(" ")}>
        {tiles.map((choice, index) => {
          const view = choice ? views[choice] : undefined;
          return (
            <HeldTile key={choice ?? `empty-${index}`} onHold={() => setSlot(index)}>
              {!choice ? (
                <EmptyTile say={say} onOpen={() => setSlot(index)} />
              ) : view ? (
                <Tile view={view} say={say} />
              ) : (
                // Chosen a moment ago; the page brings its numbers on the refresh.
                <Frame><Lines value={choiceName(choice, lists, say).glyph} label={choiceName(choice, lists, say).name} detail="" /></Frame>
              )}
            </HeldTile>
          );
        })}
      </div>
      <TileChooser slot={slot} tiles={tiles} lists={lists} onChange={change} onClose={() => setSlot(null)} />
    </>
  );
}

/** The same choice on `/profile`: the three places spelled out, each with its own "Change". */
export function DashboardTilesSetting({ tiles: stored, lists }: { tiles: TileSlot[]; lists: TileList[] }) {
  const say = sayIn(useLanguage());
  const [tiles, change] = useTiles(stored);
  const [slot, setSlot] = useState<number | null>(null);
  return (
    <>
      <ul className="flex flex-col divide-y divide-slate-100">
        {tiles.map((choice, index) => {
          const { glyph, name } = choice ? choiceName(choice, lists, say) : { glyph: "", name: say(TILES.emptyRow) };
          return (
            <li key={choice ?? `empty-${index}`} className="flex min-h-14 items-center gap-3 py-1.5" data-tile-slot={index + 1}>
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                  choice ? "accent-tint-bg" : "border border-dashed border-slate-300"
                }`}
              >
                {glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${choice ? "text-slate-800" : "text-slate-400"}`}>{name}</span>
                <span className="block text-xs text-slate-500">{say(TILES.inPlace, { n: index + 1 })}</span>
              </span>
              <button
                type="button"
                onClick={() => setSlot(index)}
                aria-label={say(TILES.changeNamed, { n: index + 1 })}
                className="press-button flex h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600"
              >
                {choice ? say(TILES.change) : say(TILES.add)}
              </button>
            </li>
          );
        })}
      </ul>
      <TileChooser slot={slot} tiles={tiles} lists={lists} onChange={change} onClose={() => setSlot(null)} />
    </>
  );
}
