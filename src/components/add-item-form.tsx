"use client";

import { Button, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { FormAction } from "@/lib/action-result";

/** The single-field row at the top of a list, kept inline rather than in a dialog. */
export function AddItemForm({ action, listId }: { action: FormAction; listId: string }) {
  // Clearing the field after a successful add is wanted here, so the next item can be
  // typed straight away; a rejected add keeps what was written.
  const { state, pending, handleSubmit } = useFormAction(action, {
    onSuccess: (form) => form.reset(),
  });

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input type="hidden" name="listId" value={listId} />
        <Input name="text" placeholder="Add an item" required className="flex-1" />
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {state?.ok === false && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
