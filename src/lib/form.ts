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

  return result.success
    ? parsed(result.data)
    : invalid(result.error.issues[0]?.message ?? "Check the form and try again.");
}

/** A required line of text, trimmed, with its own message when left blank. */
export const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);

/** Optional text that is stored as null rather than an empty string. */
export const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null);
