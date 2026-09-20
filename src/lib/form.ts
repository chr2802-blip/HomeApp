import { z } from "zod";
import { invalid, parsed, type Parsed } from "./action-result";

/**
 * Reads a form against a schema, giving back either the fields or the first message
 * the schema produced.
 *
 * Every action validates this way, so the wording a person sees lives beside the field
 * it belongs to rather than in a chain of hand-written checks.
 */
export function readForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): Parsed<z.infer<S>> {
  const result = schema.safeParse(Object.fromEntries(formData));

  if (result.success) return parsed(result.data);

  // `||` rather than `??`: an issue carrying an empty message is still an issue with
  // nothing to show, and a refusal that says nothing is the bare `return` this type
  // exists to rule out.
  return invalid(result.error.issues[0]?.message || "Check the form and try again.");
}

/**
 * How long a stored piece of text may be, by what it is for.
 *
 * Nothing here was bounded at all until now. Postgres `text` runs to a gigabyte, so a
 * household member could make a list's title a megabyte long — and every page that
 * draws that list, the dashboard included, would carry it. That is not a way into
 * anybody else's home; it is a way to make your own unusable, and to leave a row too
 * big to render on the page you would go to in order to delete it.
 *
 * The numbers are generous rather than tight, because the cost of being wrong runs one
 * way: a cook who genuinely wants a long ingredients list is a cook this should not
 * argue with, while nothing legitimate needs a name longer than a line of a phone
 * screen. They are a ceiling on the absurd, not a style guide.
 */
export const MAX_NAME = 200;
/** A description, a note, an address — a paragraph rather than a line. */
export const MAX_NOTE = 2_000;
/**
 * A recipe's ingredients or method. Long on purpose: an imported recipe arrives with
 * whatever the site published, and refusing one at the last step of an import is worse
 * than storing a few kilobytes.
 */
export const MAX_BODY = 20_000;

/** Said the same way wherever it happens, because it is the same thing happening. */
export const tooLong = (limit: number) => `That is too long — keep it under ${limit} characters.`;

/** A required line of text, trimmed, with its own message when left blank. */
export const requiredText = (message: string, max: number = MAX_NAME) =>
  z.string({ error: message }).trim().min(1, message).max(max, tooLong(max));

/** Optional text that is stored as null rather than an empty string. */
export const optionalText = z
  .string()
  .trim()
  .max(MAX_NOTE, tooLong(MAX_NOTE))
  .optional()
  .transform((value) => value || null);

/** A long body — a recipe's ingredients or method — which may also be left empty. */
export const bodyText = z
  .string()
  .trim()
  .max(MAX_BODY, tooLong(MAX_BODY))
  .optional()
  .transform((value) => value ?? "");
