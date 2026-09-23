import Link from "next/link";
import type { HomeLanguage } from "@prisma/client";
import { Input, Label, Textarea } from "@/components/ui";
import { PhotoField } from "@/components/photo-field";
import type { AiWait } from "@/components/ai-overlay";
import { CATEGORY_FIELD, READING_FIELD } from "@/lib/recipes";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import { SETTINGS } from "@/lib/copy/settings";

export type RecipeValues = {
  id?: string;
  title?: string;
  /** Every heading it is filed under — one at the least, and often several. */
  categoryIds?: string[];
  description?: string | null;
  ingredients?: string;
  instructions?: string;
  videoUrl?: string | null;
  photoId?: string | null;
  totalTimeMinutes?: number | null;
  /** An import's signed reading of the ingredients and steps — see `READING_FIELD`. */
  reading?: string | null;
};

export type CategoryOption = { id: string; name: string };

/**
 * What every place that saves a recipe tells `AiOverlay` — one wording, because a
 * create, an edit page and the two edit-from-a-sheet call sites disagreeing about why
 * Save is slow would read as four different features rather than the same one. Saving
 * a recipe reads its ingredients and instructions into the stored shape in the same
 * request (`readForSaving` in `app/actions/recipes.ts`), which is the one model call
 * this can mean.
 */
export function recipeSaveOverlay(language: HomeLanguage): AiWait {
  const say = sayIn(language);
  return {
    title: say(RECIPES.savingRecipe),
    detail: say(RECIPES.savingRecipeDetail),
    stages: [
      RECIPES.savingStage1,
      RECIPES.savingStage2,
      RECIPES.savingStage3,
      RECIPES.savingStage4,
      RECIPES.savingStage5,
    ].map(say),
    expectedSeconds: 20,
  };
}

/**
 * The same for reading a link, which `RecipeImportField` shows: a page fetch and one
 * model call, so it is the same machine at work and wears the same screen.
 */
export function recipeImportOverlay(language: HomeLanguage): AiWait {
  const say = sayIn(language);
  return {
    title: say(RECIPES.reading),
    detail: say(RECIPES.readingHint),
    stages: [
      RECIPES.readingStage1,
      RECIPES.readingStage2,
      RECIPES.readingStage3,
      RECIPES.readingStage4,
      RECIPES.readingStage5,
      RECIPES.readingStage6,
    ].map(say),
    expectedSeconds: 15,
  };
}

/**
 * The category picker: a box to tick per heading, because a recipe belongs under as
 * many as the cook says it does. A lasagne is both a weeknight dinner and Italian, and
 * a picker that made them choose would file it under whichever came to mind first and
 * then fail to find it under the other.
 *
 * Boxes rather than a multiple-select list: a `<select multiple>` needs a modifier key
 * to pick a second option, which on a phone there is no way to press at all.
 *
 * A home with no categories yet cannot file a recipe anywhere, so rather than an empty
 * picker that refuses every submission, the field says what is missing and where to fix
 * it. Only an admin can act on that, but everyone is told the same thing: being shown a
 * dead end with no explanation is worse than being shown one you must ask somebody else
 * to clear.
 */
function CategoryField({
  categories,
  selected = [],
  language,
}: {
  categories: CategoryOption[];
  selected?: string[];
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  if (categories.length === 0) {
    return (
      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-slate-700">{say(RECIPES.categories)}</legend>
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          {say(RECIPES.noCategoriesField)}{" "}
          <Link href="/settings" className="font-medium text-slate-900 underline">
            {say(SETTINGS.title)}
          </Link>
          .
        </p>
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-1">
      {/* A legend rather than a label: the field is a group of boxes, and there is no
          single control for a label to point at. */}
      <legend className="block text-sm font-medium text-slate-700">{say(RECIPES.categories)}</legend>
      <p className="text-xs text-slate-500">{say(RECIPES.tickEveryHeading)}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {categories.map((category) => (
          <label key={category.id} className="pressable cursor-pointer">
            {/* Off-screen rather than hidden: a hidden input cannot be focused, and the
                keyboard is the only way some people reach it. The chip beside it shows
                both the tick and the focus ring. */}
            <input
              type="checkbox"
              name={CATEGORY_FIELD}
              value={category.id}
              defaultChecked={selected.includes(category.id)}
              className="peer sr-only"
            />
            <span className="block rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors duration-150 peer-checked:border-slate-900 peer-checked:bg-slate-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400 peer-focus-visible:ring-offset-2">
              {category.name}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The recipe form fields, shared by the create dialog and the edit page. */
export function RecipeFields({
  recipe,
  categories,
  language,
}: {
  recipe?: RecipeValues;
  categories: CategoryOption[];
  language: HomeLanguage;
}) {
  const say = sayIn(language);

  return (
    <>
      {recipe?.reading && <input type="hidden" name={READING_FIELD} value={recipe.reading} />}
      <div className="space-y-1">
        <Label htmlFor="title">{say(RECIPES.titleField)}</Label>
        <Input id="title" name="title" defaultValue={recipe?.title ?? ""} required />
      </div>

      <CategoryField categories={categories} selected={recipe?.categoryIds} language={language} />

      <div className="space-y-1">
        <Label htmlFor="description">{say(RECIPES.shortDescription)}</Label>
        <Input id="description" name="description" defaultValue={recipe?.description ?? ""} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="totalTimeMinutes">{say(RECIPES.totalTimeMinutesField)}</Label>
        <Input
          id="totalTimeMinutes"
          name="totalTimeMinutes"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={recipe?.totalTimeMinutes ?? ""}
        />
      </div>

      <PhotoField
        defaultPhotoId={recipe?.photoId ?? null}
        label={say(RECIPES.picture)}
        hint={say(RECIPES.pictureHint)}
      />

      <div className="space-y-1">
        <Label htmlFor="videoUrl">{say(RECIPES.videoLink)}</Label>
        <Input
          id="videoUrl"
          name="videoUrl"
          type="url"
          // eslint-disable-next-line no-restricted-syntax -- an example address, not prose
          placeholder="https://www.instagram.com/reel/..."
          defaultValue={recipe?.videoUrl ?? ""}
        />
        <p className="text-xs text-slate-500">{say(RECIPES.videoLinkHint)}</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ingredients">{say(RECIPES.ingredientsField)}</Label>
        <Textarea
          id="ingredients"
          name="ingredients"
          rows={5}
          placeholder={say(RECIPES.ingredientsPlaceholder)}
          defaultValue={recipe?.ingredients ?? ""}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="instructions">{say(RECIPES.instructionsField)}</Label>
        <Textarea
          id="instructions"
          name="instructions"
          rows={6}
          placeholder={say(RECIPES.onePerLineStep)}
          defaultValue={recipe?.instructions ?? ""}
        />
      </div>
    </>
  );
}
