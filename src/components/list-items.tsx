"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  deleteListItem,
  renameListItem,
  reorderListItems,
  setListItemAmount,
  toggleListItem,
} from "@/app/actions/lists";
import { ConfirmButton } from "@/components/confirm-button";
import { AmountPicker } from "@/components/amount-picker";
import { Collapsible } from "@/components/collapsible";
import { Celebration } from "@/components/celebration";
import { PersonMark } from "@/components/person-mark";
import { ProgressBar } from "@/components/progress-bar";
import { QueueStatus } from "@/components/queue-status";
import { useOfflineList } from "@/components/use-offline-list";
import { useListFollow } from "@/components/use-list-follow";
import { applyPending, type ListRow, type Person } from "@/lib/offline-ops";
import { newId } from "@/lib/offline-queue";
import { cheer, tick } from "@/lib/haptics";
import { MIN_AMOUNT } from "@/lib/amount";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { LISTS } from "@/lib/copy/lists";

/**
 * One row, defined beside the overlay that has to be able to make one — an item added
 * with no connection is a row that exists on this phone before it exists anywhere else.
 */
type Item = ListRow;

type Change =
  | { type: "toggle"; id: string; by: Person }
  | { type: "remove"; id: string }
  | { type: "amount"; id: string; amount: number }
  | { type: "rename"; id: string; text: string }
  | { type: "reorder"; ids: string[] };

function applyTo(items: Item[], change: Change): Item[] {
  if (change.type === "toggle") {
    // Ticking something off drops the recipes that put it there and resets the amount to
    // one, which is what the server is about to do — see `setItemDone`. Putting it back
    // brings back the item and not the note, and leaves the amount as it was. The name
    // goes on and comes off with the tick for the same reason: it says who is getting
    // this, not who once did.
    return items.map((item) =>
      item.id === change.id
        ? {
            ...item,
            done: !item.done,
            amount: item.done ? item.amount : MIN_AMOUNT,
            sources: item.done ? item.sources : [],
            completedBy: item.done ? null : change.by,
          }
        : item,
    );
  }
  if (change.type === "remove") {
    return items.filter((item) => item.id !== change.id);
  }
  if (change.type === "amount") {
    return items.map((item) => (item.id === change.id ? { ...item, amount: change.amount } : item));
  }
  if (change.type === "rename") {
    return items.map((item) => (item.id === change.id ? { ...item, text: change.text } : item));
  }

  // Re-number to the dragged order so the row stays where it was dropped while the
  // server catches up.
  const rank = new Map(change.ids.map((id, index) => [id, index + 1]));
  return items.map((item) => ({ ...item, position: rank.get(item.id) ?? item.position }));
}

/** The running order inside a group. Which group a row is in is decided separately. */
function byPosition(a: Item, b: Item) {
  return a.position - b.position;
}

/**
 * How long a ticked row is held where it is before it folds into the completed section.
 *
 * The same 420ms `tick-off` runs for in `globals.css`, and the two have to agree: held
 * for less and the row is cut off mid-slide, held for longer and there is a gap where
 * a blank row sits waiting. It is a number here rather than an `animationend` listener
 * because the row has to move even when the animation never runs at all — a backgrounded
 * tab, or somebody who asked the system to reduce motion, where every duration in the
 * app collapses to nothing.
 */
const SETTLE_MS = 420;

function Row({
  item,
  draggable,
  showAmount,
  showWho,
  settling,
  onPress,
  onToggle,
  onAmount,
  onRename,
  onRemove,
}: {
  item: Item;
  draggable: boolean;
  showAmount: boolean;
  /** Whether to say who ticked it — see `ListItems`. */
  showWho: boolean;
  /** Just ticked, and still being seen leaving — see `ListItems`. */
  settling: boolean;
  onPress: (done: boolean) => void;
  onToggle: () => void;
  onAmount: (amount: number) => void;
  onRename: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !draggable,
  });
  const say = sayIn(useLanguage());

  /*
   * Pressing the text is what opens it, rather than a menu entry — a name is the one
   * thing on the row worth editing without a trip to a sheet. Editing is this row's own
   * state rather than something `ListItems` tracks, since nothing else on the page needs
   * to know one row is mid-edit.
   */
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  // The stored text can move under an editor that is not open — another phone's rename
  // landing, or this one's own optimistic copy settling — so it is adopted on every
  // render rather than only when the editor opens. Not while editing: that would
  // overwrite what is being typed the moment the optimistic change lands.
  if (!editing && draft !== item.text) setDraft(item.text);

  function commit() {
    setEditing(false);
    const text = draft.trim();
    // Blank is not a name; the row already has the only wording there is, so the
    // editor falls back to that rather than asking the press to be repeated.
    if (!text) {
      setDraft(item.text);
      return;
    }
    setDraft(text);
    if (text !== item.text) onRename(text);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-white px-2 py-2.5 sm:px-4 ${
        isDragging ? "relative z-10 opacity-80 shadow-md" : ""
      } ${settling ? "animate-tick-off" : ""}`}
    >
      {draggable ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={say(LISTS.reorder, { name: item.text })}
          // touch-none stops the browser scrolling the page instead of dragging. The
          // padding is generous on purpose: this is dragged with a thumb, in a kitchen.
          className="touch-none cursor-grab rounded px-2 py-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="5" r="1.5" />
            <circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" />
            <circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>
      ) : (
        <span className="w-8 shrink-0" aria-hidden="true" />
      )}

      <form action={onToggle} className="flex flex-1 items-center gap-3">
        <button
          type="submit"
          aria-label={item.done ? say(LISTS.markNotDone) : say(LISTS.markDone)}
          aria-pressed={item.done}
          onClick={() => onPress(!item.done)}
          className={`pressable flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs active:scale-90 ${
            item.done ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"
          } ${settling ? "animate-check-pop" : ""}`}
        >
          {item.done ? "✓" : ""}
        </button>
        <span className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                // Enter inside a text input in this form would otherwise submit it —
                // the checkbox is the form's submit button — which is a tick, not a
                // save. Escape reverts rather than committing whatever is half-typed.
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setDraft(item.text);
                  setEditing(false);
                }
              }}
              aria-label={say(LISTS.editItemAria, { name: item.text })}
              className="block w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-sm outline-none focus-visible:border-slate-500"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={say(LISTS.editItemAria, { name: item.text })}
              className={`block w-full rounded py-0.5 text-left text-sm transition-colors duration-150 hover:bg-slate-50 ${
                item.done ? "text-slate-400 line-through" : ""
              }`}
            >
              {item.text}
            </button>
          )}
          {/* Why this is on the list, when something other than a person put it there.
              A line that was typed into the add box says nothing, which is what makes
              this worth reading where it does appear. */}
          {item.sources.length > 0 && (
            <span className="mt-0.5 block text-xs text-slate-400">
              {say(LISTS.from)}{" "}
              {item.sources.map((source, index) => (
                <span key={source.id}>
                  {index > 0 && ", "}
                  <Link
                    href={`/recipes/${source.id}`}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {source.title}
                  </Link>
                </span>
              ))}
            </span>
          )}
        </span>
      </form>

      {/* Who picked it up, where somebody did. Only on a ticked row, and only where the
          household has more than one person in it: a mark saying "you" on every line of
          a list nobody else reads is decoration with nothing to tell you. */}
      {showWho && item.done && item.completedBy && (
        <PersonMark
          name={item.completedBy.name}
          photoId={item.completedBy.photoId}
          what={say(LISTS.tickedOffBy)}
          className="h-5 w-5"
        />
      )}

      {/* Ticking off resets the amount to one — see `setItemDone` — so this always reads
          ×1, shown with no picker: it is settled, and a stepper on every row of the
          completed section is only something to scroll past. */}
      {showAmount &&
        (item.done ? (
          <span className="shrink-0 text-sm tabular-nums text-slate-400">×{item.amount}</span>
        ) : (
          <AmountPicker
            value={item.amount}
            onChange={onAmount}
            label={say(LISTS.amountFor, { name: item.text })}
          />
        ))}

      <form action={onRemove}>
        <ConfirmButton
          title={say(LISTS.removeItem)}
          confirmLabel={say(LISTS.remove)}
          message={say(LISTS.removeItemMessage, { name: item.text })}
          triggerVariant="ghost"
          triggerClassName="px-2 py-1 text-sm text-slate-400 hover:text-red-600"
        >
          {/* On a phone the word costs about a fifth of the row, which the item's own
              name needs more. The cross replaces it there; the accessible name is
              "Remove" at either width. */}
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 sm:hidden"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
          </svg>
          <span className="sr-only sm:not-sr-only">{say(LISTS.remove)}</span>
        </ConfirmButton>
      </form>
    </div>
  );
}

export function ListItems({
  listId,
  items,
  trackAmounts,
  me,
  shared,
  version,
}: {
  listId: string;
  items: Item[];
  trackAmounts: boolean;
  /**
   * Whoever is pressing. A tick is optimistic, so the name under the row has to be
   * known here — waiting for the server to say who did it would leave the one row
   * somebody is looking at as the only one that cannot say.
   */
  me: Person;
  /**
   * Whether anybody else is in this home. A mark saying "you" on every line of a list
   * nobody else reads is decoration with nothing to tell you, so a household of one is
   * not told who did the shopping.
   */
  shared: boolean;
  /**
   * The list's fingerprint as the server drew it (`listVersion`). Somebody else ticking
   * something off changes it, and this page then redraws — see `useListFollow`.
   */
  version: string;
}) {
  const { pending, record, onlyOnline, reconcile, online, sending } = useOfflineList(listId);
  useListFollow(listId, version);
  const say = sayIn(useLanguage());

  /*
   * What the rows are drawn from: what the server last said, with everything this phone
   * has not managed to send yet laid on top.
   *
   * Offline, "what the server last said" is whatever the service worker kept from the last
   * time this page loaded — so the two together are the list as the household left it,
   * which is the whole point. React's optimistic copy sits above both and answers the
   * press itself; it is discarded as soon as the form action settles, and this is what the
   * row then falls back to instead of the state from before the tick.
   */
  const base = useMemo(() => applyPending(items, pending, me), [items, pending, me]);
  const [optimisticItems, applyChange] = useOptimistic(base, applyTo);
  const [, startTransition] = useTransition();

  // Anything the server now agrees with is finished with, whoever made it happen.
  useEffect(() => {
    reconcile(items);
  }, [items, reconcile]);

  /*
   * The rows that have just been ticked and are still being seen leaving.
   *
   * A tick used to be invisible on the row it happened to: the item was marked done and
   * moved into the completed section — closed, by default — inside the same render, so
   * the box it was pressed in was gone before it could show anything. Holding the row
   * in the open group for the length of its animation is what gives the tick somewhere
   * to happen; everything else about the row is already true by then, so what is on
   * screen during those few hundred milliseconds is the finished state sliding away
   * rather than a lie about what was stored.
   *
   * Untick a settling row and it simply stops settling — the row is staying, and an
   * animation about leaving would be describing something that is no longer happening.
   */
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Nothing here may outlive the component: a timer firing after the list has been
  // navigated away from would be setting state on something that is gone.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const [celebrating, setCelebrating] = useState(false);
  const stopCelebrating = useCallback(() => setCelebrating(false), []);

  /*
   * Halfway.
   *
   * The quieter of the two moments a list has: the bar swells once, on the tick that
   * takes it past half, and nothing is said in words — a sentence about being halfway
   * through the shopping is a sentence in the way of the shopping. Only upwards, and
   * only on the crossing: unticking back below half and ticking again would otherwise
   * make the bar pulse on every press around the middle of a long list, which is the
   * kind of movement that stops meaning anything.
   */
  const [halfway, setHalfway] = useState(false);

  function stopSettling(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setSettling((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  /*
   * The press itself, before the form action that follows it.
   *
   * Here rather than beside the optimistic change because this is what the person did,
   * not what it means for the data: React runs a form action inside a transition, where
   * an update is free to be held back a frame or two, and the one thing feedback about a
   * press must not be is late.
   */
  function handlePress(item: Item, done: boolean) {
    if (!done) {
      stopSettling(item.id);
      return;
    }

    tick();
    setSettling((current) => new Set(current).add(item.id));
    timers.current.set(
      item.id,
      setTimeout(() => stopSettling(item.id), SETTLE_MS),
    );

    // The last open row, counted before this press is applied: everything else on the
    // list is already ticked, so this is the one that clears it. A list being emptied by
    // deletions reaches the same state and is not celebrated — nothing was finished.
    const wasLast = optimisticItems.filter((other) => !other.done).length === 1;
    if (wasLast) {
      cheer();
      setCelebrating(true);
      return;
    }

    // The same press counted both ways: what the bar read before it, and what it will
    // read once it lands. The end of the list has its own celebration, so this never
    // fires on a list of two.
    const wereDone = optimisticItems.filter((other) => other.done).length;
    const size = optimisticItems.length;
    if (wereDone * 2 < size && (wereDone + 1) * 2 >= size) setHalfway(true);
  }

  const sensors = useSensors(
    // A little movement before a drag starts, so tapping the handle on a phone does
    // not read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // A row that has just been ticked stays in the open group until it has finished
  // leaving; the completed count below picks it up as it lands, which is what makes the
  // heading's own pop read as the same movement arriving.
  const open = optimisticItems
    .filter((item) => !item.done || settling.has(item.id))
    .sort(byPosition);
  const done = optimisticItems
    .filter((item) => item.done && !settling.has(item.id))
    .sort(byPosition);

  // What the bar says, which is not what the two groups above count: a settling row is
  // ticked off, and a progress bar that waited for the animation would be the one thing
  // on the page still pretending otherwise.
  const ticked = optimisticItems.filter((item) => item.done).length;
  const total = optimisticItems.length;

  // A little overshoot on "Completed" when its count goes up, not down: the row slides
  // out of the open list and into this heading, which is closed by default, so this is
  // where the movement ends. The row's own `tick-off` is the first half of it and this
  // is the second — the same tick seen arriving, which is why both use the same pop.
  const previousDone = useRef(done.length);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (done.length > previousDone.current) setJustCompleted(true);
    previousDone.current = done.length;
  }, [done.length]);

  if (total === 0) {
    return (
      <p className="animate-row-in p-6 text-center text-sm text-slate-500">
        {say(LISTS.emptyList)}
      </p>
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = open.map((item) => item.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    ids.splice(to, 0, ids.splice(from, 1)[0]!);

    const data = new FormData();
    data.set("listId", listId);
    data.set("itemIds", ids.join(","));

    startTransition(async () => {
      applyChange({ type: "reorder", ids });
      await onlyOnline(() => reorderListItems(data));
    });
  }

  function rowFor(item: Item, draggable: boolean) {
    const payload = new FormData();
    payload.set("itemId", item.id);

    return (
      <Row
        key={item.id}
        item={item}
        draggable={draggable}
        showAmount={trackAmounts}
        showWho={shared}
        settling={settling.has(item.id)}
        onPress={(nowDone) => handlePress(item, nowDone)}
        onToggle={async () => {
          applyChange({ type: "toggle", id: item.id, by: me });
          // The press means "the other one"; what is recorded is the state it lands in,
          // so the same tick sent twice from a queue still means the same thing.
          await record(
            [
              {
                id: newId(),
                kind: "tick",
                listId,
                itemId: item.id,
                done: !item.done,
              },
            ],
            () => toggleListItem(payload),
          );
        }}
        onAmount={(amount) => {
          const data = new FormData();
          data.set("itemId", item.id);
          data.set("amount", String(amount));

          startTransition(async () => {
            applyChange({ type: "amount", id: item.id, amount });
            await record(
              [{ id: newId(), kind: "amount", listId, itemId: item.id, amount }],
              () => setListItemAmount(data),
            );
          });
        }}
        onRename={(text) => {
          const data = new FormData();
          data.set("itemId", item.id);
          data.set("text", text);

          // Online-only, like the drag and the delete beside it: a rename is a
          // kitchen-table edit rather than an aisle one, and two phones renaming the
          // same row while apart would need a rule for which name wins. Left this way,
          // the optimistic text simply comes back when the action fails.
          startTransition(async () => {
            applyChange({ type: "rename", id: item.id, text });
            await onlyOnline(() => renameListItem(data));
          });
        }}
        onRemove={async () => {
          applyChange({ type: "remove", id: item.id });
          // Online-only, like the drag: the row simply comes back when there is nothing to
          // remove it against, which reads as what it is.
          await onlyOnline(() => deleteListItem(payload));
        }}
      />
    );
  }

  return (
    <>
      {celebrating && <Celebration onDone={stopCelebrating} />}

      {/* What the connection has to say, where it has anything: a tick kept on the phone
          is only trustworthy if the phone says it has it. */}
      <QueueStatus online={online} waiting={pending.length} sending={sending} />

      {/* How far along the list is, in words and as a bar. Inside the rows rather than
          up beside the title: a tick is optimistic, so this has to be told by the same
          state the rows are — a copy counted on the server would sit one press behind
          every time, which is the one thing a progress bar may not do. */}
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-medium text-slate-600">
            {ticked === total ? say(LISTS.allDone) : say(LISTS.missing, { count: total - ticked })}
          </span>
          <span className="tabular-nums text-slate-400">
            {Math.round((ticked / total) * 100)}%
          </span>
        </div>
        {/* `animationend` bubbles, so the wrapper is what clears the flag — the bar
            itself is drawn by a server component and has nothing to hang a handler on. */}
        <div onAnimationEnd={() => setHalfway(false)}>
          <ProgressBar done={ticked} total={total} className={halfway ? "animate-halfway" : ""} />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={open.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-slate-100">{open.map((item) => rowFor(item, true))}</div>
        </SortableContext>
      </DndContext>

      {open.length === 0 && (
        <p className="animate-row-in p-6 text-center text-sm text-slate-500">
          {say(LISTS.allTicked)}
        </p>
      )}

      {/* Ticked items keep their own order and are not draggable, so a dragged row
          cannot land somewhere the sort would immediately undo. */}
      {done.length > 0 && (
        <div className="border-t border-slate-100">
          <Collapsible
            summary={
              <span
                onAnimationEnd={() => setJustCompleted(false)}
                className={`inline-block origin-left ${justCompleted ? "animate-check-pop" : ""}`}
              >
                {say(LISTS.completed, { count: done.length })}
              </span>
            }
            triggerClassName="w-full px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50"
            panelClassName="divide-y divide-slate-100 border-t border-slate-100"
          >
            {done.map((item) => rowFor(item, false))}
          </Collapsible>
        </div>
      )}
    </>
  );
}
