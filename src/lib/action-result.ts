/**
 * What a form action reports back. Actions that validate user input return this so the
 * form can say what happened: previously they returned nothing at all, and an invalid
 * submission closed the dialog as though it had been saved.
 *
 * `undefined` is the state before the first submission.
 */
export type ActionResult = { ok: true } | { ok: false; error: string } | undefined;

export const ok = (): ActionResult => ({ ok: true });

export const fail = (error: string): ActionResult => ({ ok: false, error });

/** A form action as React's useActionState calls it. */
export type FormAction = (previous: ActionResult, formData: FormData) => Promise<ActionResult>;

/** The outcome of reading a form: either the fields, or why they were rejected. */
export type Parsed<T> = { ok: true; fields: T } | { ok: false; error: string };

export const parsed = <T>(fields: T): Parsed<T> => ({ ok: true, fields });

export const invalid = <T>(error: string): Parsed<T> => ({ ok: false, error });
