"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHomeUser } from "@/lib/auth";
import { assertHomeAccess } from "@/lib/access";
import { homeDb } from "@/lib/home-db";
import { homeScoped } from "@/lib/scoped";
import { readForm, requiredText } from "@/lib/form";
import { MAX_ITEM_TEXT } from "@/lib/offline-ops";
import { clampAmount, MIN_AMOUNT } from "@/lib/amount";
import { ingredientLines, shoppingText } from "@/lib/recipes";
import {
  ambiguousLines,
  pantryNote,
  readPantryKeep,
  stripStocked,
  type PantryDecision,
} from "@/lib/pantry";
import { stockedKeys } from "@/lib/pantry-stock";
import { weekDays, weekStartInZone, weekStartOn } from "@/lib/time";
import { discardPhoto, discardReplaced, readPhotoChoice } from "@/lib/photos";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  addItem,
  nextPosition,
  restoreItem,
  setItemAmount,
  setItemDone,
  setItemText,
} from "@/lib/list-writes";

/**
 * The three places a list's state is read, refreshed together.
 *
 * Ticking something off changes what the list's own page shows, how full the bar on its
 * card is, and — when that tick clears the list — the household's streak on the
 * dashboard. Refreshing only the page the press happened on left the other two showing
 * the count from before it, which is the one thing a bar that is meant to be live may
 * not do.
 */
function refreshListViews(listId: string) {
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
  revalidatePath("/dashboard");
}

const listInScope = homeScoped("List", (id) => prisma.list.findUnique({ where: { id } }));
/**
 * The recipe an ingredient run is copying from, checked the same way a list is. Both
 * ids arrive from the same press, so both are checked against the caller's homes: a
 * recipe from one household must not be able to write into another's shopping.
 */
const recipeInScope = homeScoped("Recipe", (id) => prisma.recipe.findUnique({ where: { id } }));

/** An absent amount means one, which is what a list that ignores them always sends. */
const amount = z
  .string()
  .optional()
  .transform((value) => clampAmount(value ?? 1));

/** An unticked checkbox is absent from the form rather than present and false. */
const checkbox = z
  .string()
  .optional()
  .transform((value) => value !== undefined);

const listSchema = z.object({
  title: requiredText("Give the list a name."),
  trackAmounts: checkbox,
});
/*
 * The same ceiling `opsSchema` puts on a queued add (`lib/offline-ops.ts`). The two have
 * to agree: a line this accepted and the queue refused would be a line somebody could
 * type at the kitchen table and not in a shop, which is the one place this app promises
 * to keep working.
 */
const itemSchema = z.object({
  text: requiredText("Write something to add.", MAX_ITEM_TEXT),
  amount,
});

export async function createList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const form = readForm(listSchema, formData);
  if (!form.ok) return fail(form.error);

  const photo = await readPhotoChoice(formData, user.homeId);
  if (!photo.ok) return fail(photo.error);

  const list = await prisma.list.create({
    data: {
      title: form.fields.title,
      trackAmounts: form.fields.trackAmounts,
      photoId: photo.photoId ?? null,
      homeId: user.homeId,
      createdById: user.id,
    },
  });

  revalidatePath("/lists");
  redirect(`/lists/${list.id}`);
}

export async function deleteList(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));
  await prisma.list.delete({ where: { id: list.id } });
  // Nothing else can be pointing at it: a picture belongs to the one thing it was
  // added to.
  await discardPhoto(list.homeId, list.photoId);
  revalidatePath("/lists");
  redirect("/lists");
}

export async function updateList(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(listSchema, formData);
  if (!form.ok) return fail(form.error);

  const photo = await readPhotoChoice(formData, list.homeId);
  if (!photo.ok) return fail(photo.error);

  await prisma.list.update({
    where: { id: list.id },
    data: {
      title: form.fields.title,
      trackAmounts: form.fields.trackAmounts,
      photoId: photo.photoId,
    },
  });

  // Only once the row no longer points at it, so a failed update cannot leave a list
  // holding a picture that has already gone.
  await discardReplaced(list.homeId, list.photoId, photo.photoId);

  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  return ok();
}

/**
 * Stars or unstars a list for whoever is looking at it.
 *
 * Favourites are personal, so the row is keyed by the caller's own id — never by an id
 * the form supplied. Like toggling an item this acts on one id and reports nothing.
 */
export async function toggleListFavorite(formData: FormData) {
  const user = await requireHomeUser();
  const list = await listInScope(String(formData.get("listId")));
  const key = { userId_listId: { userId: user.id, listId: list.id } };

  const starred = await prisma.listFavorite.findUnique({ where: key });
  if (starred) {
    await prisma.listFavorite.delete({ where: key });
  } else {
    await prisma.listFavorite.create({ data: { userId: user.id, listId: list.id } });
  }

  revalidatePath("/dashboard");
  revalidatePath("/lists");
  revalidatePath(`/lists/${list.id}`);
}

/**
 * Adding something already on the list brings it back rather than duplicating it.
 *
 * A shopping list is written the same way most weeks, and once everything is ticked
 * off the old entries are exactly the vocabulary for the next shop. Typing "Milk" when
 * a ticked "Milk" is sitting there should mean "I need milk again", not "make a second
 * milk".
 */
export async function addListItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const list = await listInScope(String(formData.get("listId")));
  const form = readForm(itemSchema, formData);
  if (!form.ok) return fail(form.error);

  // The same write the offline queue's endpoint makes, including what it means to add
  // something already on the list — see `addItem`. An id is passed only where one was
  // chosen before the row existed, which is the queue's case and not this one.
  const outcome = await addItem(list.id, form.fields.text, form.fields.amount);
  if (!outcome.ok) return fail(`"${outcome.clash}" is already on the list.`);

  revalidatePath(`/lists/${list.id}`);
  return ok();
}

/**
 * Puts a ticked item back on the list, used when one is picked from the suggestions
 * under the add box. The amount standing in the add box comes with it.
 */
export async function restoreListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await restoreItem(item.id, item.listId, clampAmount(formData.get("amount") ?? 1));
  revalidatePath(`/lists/${item.listId}`);
}

/**
 * Writes a new running order after a drag.
 *
 * Only ids that genuinely belong to this list are touched, so a request naming
 * somebody else's item reorders nothing. Positions are rewritten in one transaction,
 * because a half-applied order is worse than the one it replaced.
 */
export async function reorderListItems(formData: FormData) {
  const list = await listInScope(String(formData.get("listId")));

  const requested = String(formData.get("itemIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (requested.length === 0) return;

  const owned = new Set(
    (
      await prisma.listItem.findMany({
        where: { listId: list.id, id: { in: requested } },
        select: { id: true },
      })
    ).map((item) => item.id),
  );

  const ordered = requested.filter((id) => owned.has(id));
  if (ordered.length === 0) return;

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.listItem.update({ where: { id, listId: list.id }, data: { position: index + 1 } }),
    ),
  );

  revalidatePath(`/lists/${list.id}`);
}

/** Items are reached through their list, which is what carries the home. */
async function itemInScope(itemId: string) {
  const user = await requireHomeUser();
  const item = await prisma.listItem.findUnique({
    where: { id: itemId },
    include: { list: true },
  });
  if (!item) return null;
  assertHomeAccess(user, item.list.homeId);
  return item;
}

/**
 * Ticks an item off, or puts it back.
 *
 * Ticking it off also drops whatever recipe put it there. The note under an item
 * answers "why is this on my list", which is a question about the shop still to do —
 * once the thing is in the basket the recipe has been dealt with, and a ticked row is
 * only next week's vocabulary. Putting it back therefore brings back the item and not
 * the note, which is the same as anything else added by hand.
 */
export async function toggleListItem(formData: FormData) {
  const user = await requireHomeUser();
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  // The press means "the other one", which is what a checkbox is; the write itself is
  // told the state to land in, so the queue's endpoint can ask for the same thing without
  // depending on what the row said when the phone last saw it.
  await setItemDone(item, !item.done, item.list.homeId, user.id);

  refreshListViews(item.listId);
}

export async function deleteListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await prisma.listItem.delete({ where: { id: item.id } });
  revalidatePath(`/lists/${item.listId}`);
}

/**
 * Sets how many of an item are wanted. Like toggling and deleting it acts on one id and
 * reports nothing: the picker can only offer amounts that are already in range, so
 * there is no rejection for a form to show.
 */
export async function setListItemAmount(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  await setItemAmount(item.id, clampAmount(formData.get("amount")));
  revalidatePath(`/lists/${item.listId}`);
}

/**
 * Renames an item, pressed into from the text itself rather than a form of its own.
 *
 * Like toggling, deleting and the amount it acts on one id and reports nothing: blank
 * text is not sent here to be rejected — the row it was pressed from already has the
 * only wording there is, so the editor falls back to that instead of asking the person
 * to type it again.
 */
export async function renameListItem(formData: FormData) {
  const item = await itemInScope(String(formData.get("itemId")));
  if (!item) return;

  const text = String(formData.get("text") ?? "").trim();
  // Blank is nothing to write; past the ceiling is the same ceiling `addListItem` and
  // the offline queue keep, so renaming cannot get round what adding refuses.
  if (!text || text.length > MAX_ITEM_TEXT) return;

  await setItemText(item.id, text);
  revalidatePath(`/lists/${item.listId}`);
}

/**
 * A recipe's ingredient lines, deduplicated against themselves: a recipe that says
 * "salt" twice means salt, not two salts. The amount and unit are stripped before the
 * comparison — "1 dl mælk" and "5 dl mælk" are the same errand wanted twice, not two
 * different lines that happen to disagree about how much.
 */
/**
 * How long the write below may take before it is given up on.
 *
 * Generous rather than tight: it is not a performance target, it is the line past which
 * something has gone wrong enough that failing cleanly beats holding a transaction
 * open. Prisma's own default is five seconds, which a week's worth of recipes can
 * genuinely reach on a slow connection without anything being broken at all.
 */
const WRITE_TIMEOUT_MS = 20_000;

function dedupedIngredients(ingredients: string): Map<string, string> {
  const wanted = new Map<string, string>();
  for (const line of ingredientLines(ingredients)) {
    const text = shoppingText(line);
    if (!wanted.has(text.toLowerCase())) wanted.set(text.toLowerCase(), text);
  }
  return wanted;
}

/**
 * Puts one or more recipes' ingredients on a list.
 *
 * What it means to "add the lasagne" is that every line of its ingredients should be on
 * the list, so a line already there is not a clash — it is the same ingredient wanted
 * once more, and the amount goes up by one. A line ticked off earlier comes back at one:
 * what is on a ticked row is what was bought last time, not what this recipe needs now.
 *
 * Each item then carries a note saying which recipe asked for it, so twenty lines of
 * shopping still read as "these three are the lasagne". Adding the same recipe twice
 * bumps the amounts and leaves one note; two recipes wanting onions leave two — which is
 * why `byText` is kept up to date as rows are written rather than read once up front: a
 * second recipe in the same run wanting the same ingredient has to land on the row the
 * first one just created, not start a duplicate.
 *
 * What the household already keeps in is left out entirely — this is the one place that
 * happens, so a recipe added from its own page and a whole week added from the meal plan
 * cannot come to disagree about the cupboard. The pantry is read now rather than when
 * the page was drawn, because it is a thing somebody may have corrected on the way to
 * the shop. What was left out comes back with the count, because a line that quietly
 * never arrives reads as one the app forgot.
 *
 * A line naming more than one thing where the pantry has some but not all of it is
 * neither — see `ambiguousLines`. `keepAmbiguous` undefined means nobody has been asked
 * yet: found one, and this returns before anything is read or written beyond the
 * pantry. A defined set, even an empty one, means the asking already happened and every
 * ambiguous line is resolved one way or the other.
 */
async function writeRecipesToList(
  list: { id: string; homeId: string },
  recipes: { id: string; ingredients: string }[],
  keepAmbiguous?: Set<string>,
): Promise<PantryDecision | { covered: string[]; added: number }> {
  // What the household already has in never reaches the list. Read here rather than in
  // the two actions above it, so a recipe added from its own page and a whole week added
  // from the meal plan cannot come to disagree about what the cupboard says — and read
  // now rather than when the page was drawn, because the pantry is a thing somebody may
  // have just corrected on the way to the shop.
  const stocked = await stockedKeys(list.homeId);
  const wantedByRecipe = recipes.map((recipe) => ({
    recipe,
    wanted: dedupedIngredients(recipe.ingredients),
  }));

  if (!keepAmbiguous) {
    const found = new Map<string, ReturnType<typeof ambiguousLines>[number]>();
    for (const { wanted } of wantedByRecipe) {
      for (const line of ambiguousLines(wanted, stocked)) found.set(line.key, line);
    }
    if (found.size > 0) return { needsDecision: true, lines: [...found.values()] };
  }

  /*
   * The cupboard is taken out of the run before anything is read or written, so a press
   * the pantry answers for in full leaves without opening a transaction — and so the two
   * things the caller has to say are both decided in one place: what is being added, and
   * what it left out.
   */
  const covered: string[] = [];
  const shopping = wantedByRecipe.map(({ recipe, wanted }) => {
    const { keep, covered: inCupboard } = stripStocked(wanted, stocked, keepAmbiguous);
    // One mention each across the whole run: two of the week's recipes both asking for
    // salt is still the one line of shopping nobody has to buy.
    for (const text of inCupboard) if (!covered.includes(text)) covered.push(text);
    return { recipe, keep };
  });

  const added = new Set(shopping.flatMap(({ keep }) => [...keep.keys()])).size;
  if (added === 0) return { covered, added };

  const onList = await prisma.listItem.findMany({
    where: { listId: list.id },
    // An open row wins over a ticked one where a list somehow holds both: what is still
    // outstanding is what the cook will be looking at.
    orderBy: { done: "asc" },
  });
  const byText = new Map<string, { id: string; done: boolean; amount: number }>();
  for (const item of onList) {
    const key = shoppingText(item.text).toLowerCase();
    if (!byText.has(key)) byText.set(key, item);
  }

  let position = await nextPosition(list.id);

  /*
   * One transaction: a half-added run is a shopping list nobody can trust, and the cook
   * has no way of telling which half arrived.
   *
   * What the transaction may not be is long. Every item is its own round trip — the
   * amounts differ per line, so there is no one statement that writes them — and this
   * is called with a whole week's cooking as well as with a single recipe: seven
   * recipes of a dozen lines each is eighty-odd of them, one after another, against a
   * pooled connection. Prisma's default ceiling is five seconds, which that can reach;
   * past it the write fails as P2028 with nothing saved and "Something went wrong" on
   * screen. So the ceiling is said out loud rather than inherited, and the one part
   * that *can* be a single statement is.
   */
  await prisma.$transaction(
    async (tx) => {
      // Which recipe asked for which item, gathered as the items are written and saved
      // in one statement at the end. It used to be an upsert per line, which doubled
      // the number of round trips inside the transaction to write rows that carry
      // nothing but two ids.
      const pairs: { itemId: string; recipeId: string }[] = [];

      // `shopping` rather than the recipes themselves: what the household already keeps
      // in was taken out above, so the cupboard is never walked here.
      for (const { recipe, keep } of shopping) {
        for (const [key, text] of keep) {
          const existing = byText.get(key);

          const itemId = existing
            ? (
                await tx.listItem.update({
                  where: { id: existing.id, listId: list.id },
                  data: existing.done
                    ? { done: false, amount: MIN_AMOUNT, position: position++ }
                    : { amount: clampAmount(existing.amount + 1) },
                  select: { id: true },
                })
              ).id
            : (
                await tx.listItem.create({
                  data: { listId: list.id, text, amount: MIN_AMOUNT, position: position++ },
                  select: { id: true },
                })
              ).id;

          byText.set(key, {
            id: itemId,
            done: false,
            amount: existing ? clampAmount(existing.amount + 1) : MIN_AMOUNT,
          });

          pairs.push({ itemId, recipeId: recipe.id });
        }
      }

      // One row per pairing, so a second run finds it already there and the item still
      // names the recipe once. `skipDuplicates` is what the upsert's empty `update` was
      // saying: a pairing that exists is a pairing that is already right.
      if (pairs.length > 0) {
        await tx.listItemSource.createMany({ data: pairs, skipDuplicates: true });
      }
    },
    { timeout: WRITE_TIMEOUT_MS },
  );

  revalidatePath(`/lists/${list.id}`);
  revalidatePath("/lists");
  revalidatePath("/dashboard");

  return { covered, added };
}

/**
 * Unlike the other actions that report, this one takes the form data alone: it is not
 * submitted by a form but pressed in a menu, so there is no previous state for React to
 * hand it. It still reports, because there are two things worth saying — a recipe with
 * nothing listed, and a list that was written to. A third outcome, `PantryDecision`, is
 * neither: `AddToListMenu` is what asks and resubmits with an answer.
 */
export async function addRecipeIngredients(
  formData: FormData,
): Promise<ActionResult | PantryDecision> {
  const user = await requireHomeUser();
  const recipe = await recipeInScope(String(formData.get("recipeId")));
  const list = await listInScope(String(formData.get("listId")));

  if (dedupedIngredients(recipe.ingredients).size === 0) {
    return fail("This recipe has no ingredients to add yet.");
  }

  const result = await writeRecipesToList(list, [recipe], readPantryKeep(formData));
  if ("needsDecision" in result) return result;
  const { covered, added } = result;

  // A recipe whose every line is already in the cupboard wrote nothing, and "Added to
  // Shopping" would be the one thing that did not happen. Said as a refusal because that
  // is what it is — there was nothing to do — and a cook who disagrees has the pantry
  // page to say so on.
  if (added === 0) return fail("Nothing to add — the pantry already has all of it.");

  return ok(pantryNote(covered, user.homeLanguage));
}

/**
 * Puts every recipe the week has planned onto one of the home's lists in one press — the
 * days with a recipe, never a night out or leftovers, which name nothing to shop for.
 *
 * `week` names which week rather than the client sending the recipe ids it saw on the
 * page: a plan can change between the page rendering and the press landing, and the
 * write should reflect whatever the week actually says now, not a snapshot of it.
 * Pressed from the same kind of menu `addRecipeIngredients` is, so it reports the same
 * way — `PantryDecision` included.
 */
export async function addMealPlanIngredients(
  formData: FormData,
): Promise<ActionResult | PantryDecision> {
  const user = await requireHomeUser();
  const list = await listInScope(String(formData.get("listId")));
  const week = weekStartOn(String(formData.get("week") ?? "")) ?? weekStartInZone(new Date());

  const db = homeDb(user.homeId);
  const plans = await db.mealPlan.findMany({
    where: { date: { in: weekDays(week) }, recipeId: { not: null } },
    select: { recipeId: true },
  });
  if (plans.length === 0) return fail("Nothing is being cooked this week yet.");

  const recipes = await db.recipe.findMany({
    where: { id: { in: [...new Set(plans.map((plan) => plan.recipeId!))] } },
    select: { id: true, ingredients: true },
  });
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  // One entry per day cooking it, not one per distinct recipe: a recipe planned twice
  // this week needs its ingredients twice, the same as adding it from its own page
  // twice over — `writeRecipesToList` already merges repeats the same way either gives
  // it one, and still names the recipe once underneath the item.
  const cooking = plans
    .map((plan) => byId.get(plan.recipeId!))
    .filter((recipe) => recipe !== undefined);

  const withIngredients = cooking.filter((recipe) => dedupedIngredients(recipe.ingredients).size > 0);
  if (withIngredients.length === 0) {
    return fail("None of this week's recipes have ingredients to add yet.");
  }

  const result = await writeRecipesToList(list, withIngredients, readPantryKeep(formData));
  if ("needsDecision" in result) return result;
  const { covered, added } = result;
  if (added === 0) return fail("Nothing to add — the pantry already has all of it.");

  return ok(pantryNote(covered, user.homeLanguage));
}
