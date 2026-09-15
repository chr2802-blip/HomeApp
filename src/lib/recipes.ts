/**
 * The field the category picker submits, one entry per heading ticked.
 *
 * A recipe belongs under as many headings as the cook says it does, so this arrives
 * repeated rather than once — which is why it is read on its own below rather than
 * through the recipe's schema.
 */
export const CATEGORY_FIELD = "categoryIds";

/**
 * The categories a submitted form chose: in the order the picker offered them, without
 * repeats, and with nothing blank.
 *
 * Read with `getAll` rather than through `readForm`, which builds its object with
 * `Object.fromEntries` — that keeps only the last of a repeated field, so a recipe
 * filed under three headings would arrive claiming one.
 */
export function readCategoryChoice(formData: FormData) {
  const chosen = formData
    .getAll(CATEGORY_FIELD)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return [...new Set(chosen)];
}
