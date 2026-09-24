"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { ActionResult, FormAction } from "@/lib/action-result";

/**
 * Submits a form action and keeps its result.
 *
 * Deliberately uses onSubmit rather than the `action` prop: React clears an
 * uncontrolled form once its action completes, which on a rejected submission would
 * throw away everything the person had just typed. Here the fields are left alone,
 * and only a successful submission resets them — and only where that is wanted.
 */
export function useFormAction(
  action: FormAction,
  options: { onSuccess?: (form: HTMLFormElement) => void } = {},
) {
  const [state, setState] = useState<ActionResult>(undefined);
  const [pending, startTransition] = useTransition();
  // What was sent last, for a caller whose pending state depends on what was asked —
  // `aiWaitActive` draws the AI wait only for a save that will actually be read.
  const [submitted, setSubmitted] = useState<FormData | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSubmitted(data);

    startTransition(async () => {
      // An action that redirects never returns; Next unwinds the call and navigates.
      const result = await action(undefined, data);
      setState(result);
      if (result?.ok) options.onSuccess?.(form);
    });
  }

  return { state, pending, submitted, handleSubmit };
}
