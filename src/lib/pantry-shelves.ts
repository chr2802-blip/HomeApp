import type { HomeLanguage, PantryCategory } from "@prisma/client";
import { PANTRY_CATEGORIES } from "./pantry";
import { sayIn } from "./copy/say";
import { PANTRY_CATEGORY_LABELS } from "./copy/pantry";

/**
 * Which shelf an entry is on, as one answer.
 *
 * A shelf is either one of the built-ins (`PantryCategory`) or one the household made
 * (`PantryShelf`), and an entry carries exactly one of the two columns — never both,
 * which `readShelfChoice` keeps on every write. Everything past the database reads it as
 * this single string: the built-in's own name (`"SPICES"`) or the household's shelf's
 * id. The two cannot collide — an id is a lower-case cuid, a built-in is capitals.
 */
export type ShelfId = string;

/** A shelf as a page draws it: what is submitted, what is read, and whose it is. */
export type Shelf = { id: ShelfId; name: string; custom: boolean };

/** The one shelf an entry is on, or null for "not sorted yet". */
export function shelfOf(item: { category: PantryCategory | null; shelfId: string | null }): ShelfId | null {
  return item.shelfId ?? item.category;
}

/**
 * Every shelf a home has, in the order the pantry draws them: the built-ins in their
 * fixed order, then the household's own by name, then "Other" — last, because it is the
 * shelf for what fits on none of the others, the household's own included.
 *
 * Named here, from the language the caller hands over, so a client component is handed
 * words rather than reaching for the catalogue (see CLAUDE.md on `src/lib`).
 */
export function shelvesOf(custom: { id: string; name: string }[], language: HomeLanguage): Shelf[] {
  const say = sayIn(language);
  const builtIn = (category: PantryCategory): Shelf => ({
    id: category,
    name: say(PANTRY_CATEGORY_LABELS[category]),
    custom: false,
  });
  const own = [...custom]
    .sort((a, b) => a.name.localeCompare(b.name, language === "DA" ? "da" : "en"))
    .map((shelf): Shelf => ({ id: shelf.id, name: shelf.name, custom: true }));
  return [
    ...PANTRY_CATEGORIES.filter((category) => category !== "OTHER").map(builtIn),
    ...own,
    builtIn("OTHER"),
  ];
}

/**
 * Whether `name` is already a built-in shelf's, in either language. A household's own
 * "Fridge" beside the built-in one would be two chips with one word on them, and which
 * one somebody meant would be anybody's guess.
 */
export function namesBuiltInShelf(name: string): boolean {
  const wanted = name.trim().toLocaleLowerCase();
  return PANTRY_CATEGORIES.some((category) =>
    Object.values(PANTRY_CATEGORY_LABELS[category]).some((label) => label.toLocaleLowerCase() === wanted),
  );
}
