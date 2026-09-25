"use client";

import { sortPantry } from "@/app/actions/pantry";
import { useFormAction } from "@/components/use-form-action";
import { AiOverlay } from "@/components/ai-overlay";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { PANTRY } from "@/lib/copy/pantry";

/**
 * Files everything under "Not sorted yet" — the entries kept since before shelves existed,
 * and any the add box's own sort could not reach. It sits on that heading and nowhere
 * else, so it is only ever offered when there is something for it to do.
 *
 * While the model is actually reading, the wait is `AiOverlay`, as every AI wait is. The
 * page says whether it will be (`asksAi`: something unsorted that `lookupGood` does not
 * know) — the same lookup `sortPantry` makes first — so a press the list answers alone
 * draws no overlay at all.
 *
 * It says why when it could not: a reader that is down, a home past its month, or a
 * person who has pressed it a lot. What it did manage is already on the page by then, so
 * success needs no words.
 */
export function PantrySortButton({ asksAi }: { asksAi: boolean }) {
  const say = sayIn(useLanguage());
  const { state, pending, handleSubmit } = useFormAction(sortPantry);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-1">
      <AiOverlay
        active={pending && asksAi}
        wait={{
          title: say(PANTRY.sortWaitTitle),
          detail: say(PANTRY.sortWaitDetail),
          stages: [say(PANTRY.sortStageRead), say(PANTRY.sortStageFile)],
          expectedSeconds: 4,
        }}
      />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="pressable rounded-full border border-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-text)] hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? say(PANTRY.sorting) : say(PANTRY.sort)}
      </button>
      {state?.ok === false && (
        <p role="alert" className="max-w-64 text-right text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
