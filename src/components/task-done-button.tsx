"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { tick } from "@/lib/haptics";
import { useLanguage } from "@/components/language-provider";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

/**
 * Marking a task done, and being seen to.
 *
 * A list item has somewhere to go when it is ticked — out of the open rows and into the
 * completed section — and the movement between the two is the feedback. A task has no
 * such journey: a recurring one books itself in again and stays exactly where it was
 * with a new date, and a one-off moves only once the server has answered and the page
 * has been rebuilt. Left alone, the most-pressed button in the app was the one that
 * showed nothing at all.
 *
 * So the moment is drawn at the button: a tick rises out of it and fades (`stamp` in
 * `globals.css`), alongside the same short buzz a list item gets. It plays on the press
 * rather than on the answer, which is what makes it feedback — the spinner in
 * `SubmitButton` is what says the answer has not arrived yet, and the two are doing
 * different jobs.
 *
 * Green, which is the one colour in the app that would otherwise be out of place here:
 * a finished task already wears a green "Done" badge on the tasks page, so this is that
 * badge arriving rather than a new meaning for the colour.
 *
 * One component for both places a task is completed from — the card on `/tasks` and the
 * row on the dashboard — because it is the same press and should not be the same code
 * twice.
 */
export function TaskDoneButton({
  taskId,
  action,
  label,
  variant = "secondary",
}: {
  taskId: string;
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const [stamped, setStamped] = useState(false);
  const say = sayIn(useLanguage());

  return (
    <form action={action} className="relative inline-flex">
      <input type="hidden" name="taskId" value={taskId} />
      <SubmitButton
        variant={variant}
        pendingLabel={say(APP.saving)}
        onClick={() => {
          tick();
          setStamped(true);
        }}
      >
        {label}
      </SubmitButton>

      {/* Above the button and out of the way of everything: `absolute` inside a relative
          form, so a card that clips its own contents still lets it rise — and
          `pointer-events-none` so the second press of an impatient thumb still lands on
          the button underneath it. */}
      {stamped && (
        <span
          aria-hidden="true"
          onAnimationEnd={() => setStamped(false)}
          className="animate-stamp pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-lg leading-none font-bold text-emerald-600"
        >
          ✓
        </span>
      )}
    </form>
  );
}
