"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button, ButtonLink, Card } from "@/components/ui";
import { Modal, ModalBody, ModalFooter } from "@/components/modal";
import { DialogSubmitButton } from "@/components/form-dialog";
import { MealPicker, type PlanGroup } from "@/components/meal-picker";
import { PLAN_FIELD, PLAN_NOTHING, PLAN_OUT, leftoversDay } from "@/lib/meals";
import type { ActionResult, FormAction } from "@/lib/action-result";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { MEALS } from "@/lib/copy/meals";
import { APP } from "@/lib/copy/app";

/** One day of the week, exactly as its row and its sheet need it. */
export type MealDayInfo = {
  date: string;
  title: string;
  selected: string;
  groups: PlanGroup[];
  highlighted: boolean;
  /** A day already lived through: its row does not open, and a swipe cannot land on it. */
  disabled: boolean;
  face: React.ReactNode;
};

/**
 * How far a drag has to travel, in pixels, before it counts as a swipe rather than a tap
 * that wandered a little on the way to lifting a finger, or a vertical scroll through the
 * picker's own list.
 */
const SWIPE_THRESHOLD_PX = 60;

/**
 * The recipe a day's already-saved answer names, or null where it names something else.
 *
 * `selected` carries the same four shapes the picker's own field does — see
 * `lib/meals.ts` — and a recipe is the one shape worth a way to its own page: eating out
 * and nothing planned have no page, and leftovers already names the recipe under its own
 * row, on the day it was actually cooked.
 */
function recipeIdOf(selected: string): string | null {
  return selected !== PLAN_NOTHING && selected !== PLAN_OUT && !leftoversDay(selected)
    ? selected
    : null;
}

/**
 * The week's seven rows, and the one sheet shared between them.
 *
 * One sheet rather than one per day: swiping between days has to feel like turning a
 * page inside a single sheet, not like one closing and a different one opening in its
 * place — which is what a sheet each would show, seams and all, every time a swipe
 * landed.
 *
 * Saving still works exactly as it did — Save writes the day and closes, Cancel closes
 * without writing anything — and swiping is a second way in on top of it: a horizontal
 * drag past `SWIPE_THRESHOLD_PX` saves the day being left, the same write Save makes, and
 * moves the sheet on to the next or previous one rather than closing.
 */
export function MealWeek({ days, action }: { days: MealDayInfo[]; action: FormAction }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const say = sayIn(useLanguage());
  const day = openIndex !== null ? days[openIndex] : null;

  // The sheet's own content stays on the last day shown while it closes: `day` goes
  // straight to null the instant a close is asked for, but the Modal underneath keeps
  // rendering for as long as its exit animation runs, and a blank sheet flashing white
  // for that stretch is worse than the day it was just showing staying put.
  const [shown, setShown] = useState<MealDayInfo | null>(null);
  useEffect(() => {
    if (day) setShown(day);
  }, [day]);

  const [choice, setChoice] = useState("");
  const [state, setState] = useState<ActionResult>(undefined);
  const [pending, startTransition] = useTransition();

  // Which way the content should slide in — set only by a swipe landing, and read once,
  // by the `key` below forcing a remount to replay it. A row press or Save/Cancel needs
  // none of this: the Modal's own entrance and exit already say something happened.
  const [enter, setEnter] = useState<"forward" | "back" | null>(null);

  // The picker reads back the day's own stored answer whenever the sheet lands on a
  // different one — whether that is the row somebody just pressed, or the day a swipe
  // just saved and moved on from. And whatever the previous day's save had to say is not
  // this one's business. Keyed on the date alone, deliberately: `shown` is a fresh object
  // every render, and resetting on that would throw away what somebody is mid-way
  // through picking every time a sibling row's data changes.
  useEffect(() => {
    if (shown) {
      setChoice(shown.selected);
      setState(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.date]);

  function openAt(index: number) {
    if (days[index]!.disabled) return;
    setEnter(null);
    setOpenIndex(index);
  }

  function close() {
    setOpenIndex(null);
  }

  /** Writes one day's choice — the same call Save makes, and the one a swipe makes too. */
  function write(date: string, value: string) {
    const data = new FormData();
    data.set("date", date);
    data.set(PLAN_FIELD, value);
    return action(undefined, data);
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!day) return;
    startTransition(async () => {
      const result = await write(day.date, choice);
      setState(result);
      if (result?.ok) close();
    });
  }

  /** The nearest day in one direction that is not locked in the past. */
  function nearestOpen(from: number, direction: 1 | -1): number | null {
    for (let index = from + direction; index >= 0 && index < days.length; index += direction) {
      if (!days[index]!.disabled) return index;
    }
    return null;
  }

  /**
   * Saves the day being left and only then moves — a household swiping through the week
   * must never lose what they just picked because the next gesture arrived before the
   * write did. At either edge of the week, with nowhere further to go, this is exactly
   * what Save does: it writes the day and closes.
   */
  function swipe(direction: 1 | -1) {
    if (openIndex === null || pending) return;
    const from = days[openIndex]!;
    const target = nearestOpen(openIndex, direction);

    startTransition(async () => {
      const result = await write(from.date, choice);
      setState(result);
      if (result?.ok === false) return;
      if (target === null) {
        close();
      } else {
        // Forward reveals the day to the right, the way dragging the page itself would;
        // back reveals the one to the left. Set before the day changes, so the new
        // content is born already carrying the class its entrance animation reads.
        setEnter(direction === 1 ? "forward" : "back");
        setOpenIndex(target);
      }
    });
  }

  const drag = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(event: React.PointerEvent) {
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = drag.current;
    drag.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Horizontal enough, and past the threshold — otherwise this was a tap on something
    // inside the sheet, or scrolling the picker's own list, not a swipe between days.
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
    swipe(dx < 0 ? 1 : -1);
  }

  return (
    <>
      <div className="space-y-3">
        {days.map((entry, index) => {
          const recipeId = recipeIdOf(entry.selected);

          return (
            <div
              key={entry.date}
              className="animate-row-in"
              style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
            >
              <Card
                padded={false}
                className={`overflow-hidden ${
                  entry.highlighted ? "border-[var(--accent-line)] accent-tint-ring" : ""
                }`}
              >
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => openAt(index)}
                    disabled={entry.disabled}
                    // Hydration leaves no mark of its own, so the trigger says when it
                    // can actually open — what a browser test waits on instead of the
                    // markup, which looks identical before React has attached anything.
                    data-ready="true"
                    className={`pressable flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left ${
                      entry.disabled ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50"
                    }`}
                  >
                    {entry.face}
                  </button>
                  {/* Beside the row's own button rather than inside it: a button cannot
                      hold a link, and going to the recipe must not also open the sheet. */}
                  {recipeId && (
                    <ButtonLink
                      href={`/recipes/${recipeId}`}
                      variant="info"
                      className="mr-3 shrink-0 px-2.5 py-1.5 text-xs"
                    >
                      {say(MEALS.goToRecipe)}
                    </ButtonLink>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <Modal open={day !== null} onClose={close} title={shown?.title ?? ""}>
        {shown && (
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            {/* Where the swipe is read: a horizontal drag anywhere in the body saves this
                day and moves to the next or previous one — `ModalBody` itself, since it
                is the one element here guaranteed to fill the sheet's full height
                whatever the picker draws, where a wrapper sized to its own short content
                would leave the empty space below it deaf to a drag. Keyed on the date so
                a swipe's slide replays: the animation runs from the moment the element is
                in the document, and a class changed on the same node that is already on
                screen would not run it again. */}
            <ModalBody
              key={shown.date}
              className={`touch-pan-y space-y-4 ${
                enter === "forward"
                  ? "animate-page-forward"
                  : enter === "back"
                    ? "animate-page-back"
                    : ""
              }`}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
            >
              <input type="hidden" name="date" value={shown.date} />
              <MealPicker
                name={PLAN_FIELD}
                groups={shown.groups}
                selected={choice}
                onSelect={setChoice}
              />
            </ModalBody>
            <ModalFooter>
              {state?.ok === false && (
                <p role="alert" className="mb-3 text-sm text-red-600">
                  {state.error}
                </p>
              )}
              <div className="flex gap-2">
                <DialogSubmitButton label={say(APP.save)} pending={pending} />
                <Button type="button" variant="secondary" onClick={close}>
                  {say(APP.cancel)}
                </Button>
              </div>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
