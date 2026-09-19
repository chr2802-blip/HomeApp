import Link from "next/link";
import { Input, Label, Textarea } from "@/components/ui";
import { PhotoField } from "@/components/photo-field";
import { CATEGORY_FIELD } from "@/lib/recipes";

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
};

export type CategoryOption = { id: string; name: string };

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
}: {
  categories: CategoryOption[];
  selected?: string[];
}) {
  if (categories.length === 0) {
    return (
      <fieldset className="space-y-1">
        <legend className="block text-sm font-medium text-slate-700">Categories</legend>
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          This home has no recipe categories yet. An admin can add them under{" "}
          <Link href="/settings" className="font-medium text-slate-900 underline">
            Settings
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
      <legend className="block text-sm font-medium text-slate-700">Categories</legend>
      <p className="text-xs text-slate-500">Tick every heading this recipe belongs under.</p>
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
}: {
  recipe?: RecipeValues;
  categories: CategoryOption[];
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={recipe?.title ?? ""} required />
      </div>

      <CategoryField categories={categories} selected={recipe?.categoryIds} />

      <div className="space-y-1">
        <Label htmlFor="description">Short description</Label>
        <Input id="description" name="description" defaultValue={recipe?.description ?? ""} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="totalTimeMinutes">Total time (minutes)</Label>
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
        label="Picture"
        hint="What it looks like when it is finished — shown on the recipe and on its card."
      />

      <div className="space-y-1">
        <Label htmlFor="videoUrl">Video link (Instagram, YouTube, TikTok…)</Label>
        <Input
          id="videoUrl"
          name="videoUrl"
          type="url"
          placeholder="https://www.instagram.com/reel/..."
          defaultValue={recipe?.videoUrl ?? ""}
        />
        <p className="text-xs text-slate-500">
          Paste the link and the video is embedded on the recipe page.
        </p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ingredients">Ingredients</Label>
        <Textarea
          id="ingredients"
          name="ingredients"
          rows={5}
          placeholder={"One per line\n200 g flour\n2 eggs"}
          defaultValue={recipe?.ingredients ?? ""}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          name="instructions"
          rows={6}
          placeholder="One step per line"
          defaultValue={recipe?.instructions ?? ""}
        />
      </div>
    </>
  );
}
