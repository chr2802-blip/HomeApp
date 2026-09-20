"use client";

import { Button } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";

/**
 * A plain (non-dialog) form that reports what happened. Used for the settings forms,
 * which previously gave no sign of either success or refusal.
 */
export function ActionForm({
  action,
  submitLabel,
  successLabel = "Saved.",
  className = "",
  children,
}: {
  action: FormAction;
  submitLabel: string;
  successLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { state, pending, handleSubmit } = useFormAction(action);

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {state?.ok === false && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
        {/* What the action had to say about a submission that worked, where it had
            anything — otherwise the form's own word for having saved. */}
        {state?.ok && <p className="text-sm text-emerald-700">{state.note ?? successLabel}</p>}
      </div>
    </form>
  );
}
