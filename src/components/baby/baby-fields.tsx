"use client";

import { useId, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { Input, Label } from "@/components/ui";
import { sayIn } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { instantFromLocal, localInputValue } from "@/lib/time";
import { clockWords, durationWords } from "@/lib/baby-words";
import {
  MAX_BOTTLE_ML,
  MAX_FOOD_LENGTH,
  MAX_NOTE_LENGTH,
  NIGHT_FROM_HOUR,
  NIGHT_UNTIL_HOUR,
  readBabyDetails,
  type BabyEntry,
  type BottleDetails,
  type BreastDetails,
  type FeedMethod,
  type SolidDetails,
} from "@/lib/baby";

/**
 * The fields of the baby log's sheets, shared by the sheet that writes an entry and the
 * one behind an entry's three dots that corrects it — so the two cannot come to ask
 * different things. Big targets throughout: these are filled in with one hand.
 */

/** A row of big choices, one of them chosen — a radio group drawn as chips. */
export function Chips({
  name,
  options,
  defaultValue,
  label,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  label: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className="press-button flex h-12 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-center text-sm font-semibold text-slate-600 has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent)] has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent)]"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            onChange={() => onChange?.(option.value)}
            className="sr-only"
          />
          <span className="truncate">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

/** A day and a time, on the household's clock, starting on `value` (now, for a new one). */
export function TimeField({
  name,
  label,
  value,
  required = true,
  hint,
  onChange,
}: {
  name: string;
  label: string;
  value: Date | null;
  required?: boolean;
  hint?: string;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="datetime-local"
        required={required}
        defaultValue={value ? localInputValue(value) : ""}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        className="h-12 text-base"
      />
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function NoteField({ value }: { value?: string | null }) {
  const say = sayIn(useLanguage());
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{say(BABY.note)}</Label>
      <Input id={id} name="note" defaultValue={value ?? ""} maxLength={MAX_NOTE_LENGTH} className="h-12 text-base" />
    </div>
  );
}

/** A sleep: when it began, when it ended (empty while still asleep), nap or night. */
export function SleepFields({ entry, now }: { entry?: BabyEntry; now: Date }) {
  const language = useLanguage();
  const say = sayIn(language);
  const awakeId = useId();
  const night = entry ? readBabyDetails("SLEEP", entry.details).details : null;
  const chosen = night && "night" in night ? (night.night === null ? "auto" : night.night ? "night" : "nap") : "auto";
  const storedAwake = night ? Math.round(night.awake / 60) : 0;
  const [start, setStart] = useState(() => localInputValue(entry?.startedAt ?? now));
  const [end, setEnd] = useState(() => (entry?.endedAt ? localInputValue(entry.endedAt) : ""));
  const [awake, setAwake] = useState(storedAwake ? String(storedAwake) : "");

  // What the sleep comes to as the fields stand: its span, less the time awake inside it.
  // A sleep with no end yet runs to now.
  const from = instantFromLocal(start);
  const to = end ? instantFromLocal(end) : now;
  const awakeMs = (Number(awake) || 0) * 60_000;
  const slept = from && to ? to.getTime() - from.getTime() - awakeMs : null;

  return (
    <>
      <TimeField name="start" label={say(BABY.fellAsleep)} value={entry?.startedAt ?? now} onChange={setStart} />
      <TimeField
        name="end"
        label={say(BABY.wokeUp)}
        value={entry ? entry.endedAt : null}
        required={false}
        hint={say(BABY.stillAsleepHint)}
        onChange={setEnd}
      />
      <div className="space-y-1">
        <Label htmlFor={awakeId}>{say(BABY.awakeMinutes)}</Label>
        <Input
          id={awakeId}
          name="awake"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={awake}
          onChange={(event) => setAwake(event.target.value)}
          placeholder="0"
          className="h-12 text-base"
        />
      </div>
      {slept !== null && slept > 0 && (
        <div className="text-center" data-baby-slept>
          <span className="block text-xs font-bold tracking-wide text-slate-500 uppercase">{say(BABY.timeAsleep)}</span>
          <span className="block text-4xl font-bold text-slate-800 tabular-nums">{clockWords(slept)}</span>
          {awakeMs > 0 && (
            <span className="block text-sm text-slate-500">{say(BABY.awakeFor, { time: durationWords(awakeMs, language) })}</span>
          )}
        </div>
      )}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">{say(BABY.kindOfSleep)}</span>
        <Chips
          name="sleepKind"
          label={say(BABY.kindOfSleep)}
          defaultValue={chosen}
          options={[
            { value: "auto", label: say(BABY.automatic) },
            { value: "nap", label: say(BABY.nap) },
            { value: "night", label: say(BABY.night) },
          ]}
        />
        <p className="text-xs text-slate-500">
          {say(BABY.automaticHint, { from: NIGHT_FROM_HOUR, until: String(NIGHT_UNTIL_HOUR).padStart(2, "0") })}
        </p>
      </div>
      <NoteField value={entry?.note} />
    </>
  );
}

/** The kinds of feed this household keeps, as chips' options. */
export function feedMethodOptions(methods: FeedMethod[], language: Parameters<typeof sayIn>[0]) {
  const say = sayIn(language);
  const names: Record<FeedMethod, string> = {
    BREAST: say(BABY.breast),
    BOTTLE: say(BABY.bottle),
    SOLID: say(BABY.solid),
  };
  return methods.map((method) => ({ value: method, label: names[method] }));
}

/**
 * A feed's own fields, for one method: minutes on each side for a breast feed typed by
 * hand, milk and millilitres for a bottle, what was eaten for solids. The time and the
 * note are the caller's.
 */
export function FeedMethodFields({
  method,
  entry,
  solids,
}: {
  method: FeedMethod;
  entry?: BabyEntry;
  solids: string[];
}) {
  const say = sayIn(useLanguage());
  const details = entry ? readBabyDetails("FEED", entry.details).details : null;
  const leftId = useId();
  const rightId = useId();
  const mlId = useId();
  const foodId = useId();
  const listId = useId();
  const [food, setFood] = useState(details && "food" in details ? (details as SolidDetails).food : "");

  if (method === "BREAST") {
    const breast = details && "left" in details ? (details as BreastDetails) : null;
    return (
      <>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor={leftId}>{say(BABY.minutesLeft)}</Label>
            <Input id={leftId} name="left" type="number" inputMode="numeric" min={0} max={240} defaultValue={breast ? Math.round(breast.left / 60) : ""} className="h-12 text-base" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={rightId}>{say(BABY.minutesRight)}</Label>
            <Input id={rightId} name="right" type="number" inputMode="numeric" min={0} max={240} defaultValue={breast ? Math.round(breast.right / 60) : ""} className="h-12 text-base" />
          </div>
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">{say(BABY.endedOn)}</span>
          <Chips
            name="lastSide"
            label={say(BABY.endedOn)}
            defaultValue={breast?.lastSide ?? undefined}
            options={[
              { value: "LEFT", label: say(BABY.left) },
              { value: "RIGHT", label: say(BABY.right) },
            ]}
          />
        </div>
      </>
    );
  }

  if (method === "BOTTLE") {
    const bottle = details && "milk" in details ? (details as BottleDetails) : null;
    return (
      <>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">{say(BABY.milk)}</span>
          <Chips
            name="milk"
            label={say(BABY.milk)}
            defaultValue={bottle?.milk ?? "FORMULA"}
            options={[
              { value: "BREAST_MILK", label: say(BABY.breastMilk) },
              { value: "FORMULA", label: say(BABY.formula) },
            ]}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={mlId}>{say(BABY.amount)}</Label>
          <Input id={mlId} name="ml" type="number" inputMode="numeric" min={0} max={MAX_BOTTLE_ML} step={5} defaultValue={bottle?.ml ?? ""} className="h-12 text-base" />
        </div>
      </>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={foodId}>{say(BABY.food)}</Label>
      <Input
        id={foodId}
        name="food"
        required
        list={listId}
        maxLength={MAX_FOOD_LENGTH}
        value={food}
        onChange={(event) => setFood(event.target.value)}
        className="h-12 text-base"
      />
      <datalist id={listId}>
        {solids.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {solids.length > 0 && (
        <div className="space-y-1">
          <span className="block text-xs font-semibold tracking-wide text-slate-500 uppercase">{say(BABY.eatenBefore)}</span>
          <div className="flex flex-wrap gap-2">
            {solids.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFood(name)}
                className="press-button h-9 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** A nappy: wet, dirty or both. */
export function DiaperFields({ entry, now }: { entry?: BabyEntry; now: Date }) {
  const say = sayIn(useLanguage());
  const details = entry ? readBabyDetails("DIAPER", entry.details).details : null;
  const chosen =
    details && "wet" in details ? (details.wet && details.dirty ? "BOTH" : details.dirty ? "DIRTY" : "WET") : undefined;
  return (
    <>
      <div className="space-y-2">
        <span className="block text-sm font-medium text-slate-700">{say(BABY.howWasIt)}</span>
        <Chips
          name="content"
          label={say(BABY.howWasIt)}
          defaultValue={chosen}
          options={[
            { value: "WET", label: say(BABY.wet) },
            { value: "DIRTY", label: say(BABY.dirty) },
            { value: "BOTH", label: say(BABY.both) },
          ]}
        />
      </div>
      <TimeField name="at" label={say(BABY.time)} value={entry?.startedAt ?? now} />
      <NoteField value={entry?.note} />
    </>
  );
}
