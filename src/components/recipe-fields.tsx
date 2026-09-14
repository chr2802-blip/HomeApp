import Link from "next/link";
import { Input, Label, Select, Textarea } from "@/components/ui";

export type RecipeValues = {
  id?: string;
  title?: string;
  categoryId?: string;
  description?: string | null;
  ingredients?: string;
  instructions?: string;
  videoUrl?: string | null;
};

export type CategoryOption = { id: string; name: string };

/**
 * The category picker.
 *
 * A home with no categories yet cannot file a recipe anywhere, so rather than an empty
 * dropdown that refuses every submission, the field says what is missing and where to
 * fix it. Only an admin can act on that, but everyone is told the same thing: being
 * shown a dead end with no explanation is worse than being shown one you must ask
 * somebody else to clear.
 */
function CategoryField({
  categories,
  selected,
}: {
  categories: CategoryOption[];
  selected?: string;
}) {
  if (categories.length === 0) {
    return (
      <div className="space-y-1">
        <Label htmlFor="categoryId">Category</Label>
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
          This home has no recipe categories yet. An admin can add them under{" "}
          <Link href="/admin" className="font-medium text-slate-900 underline">
            Administration
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="categoryId">Category</Label>
      <Select id="categoryId" name="categoryId" defaultValue={selected ?? ""} required className="w-full">
        <option value="" disabled>
          Choose a category…
        </option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
    </div>
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

      <CategoryField categories={categories} selected={recipe?.categoryId} />

      <div className="space-y-1">
        <Label htmlFor="description">Short description</Label>
        <Input id="description" name="description" defaultValue={recipe?.description ?? ""} />
      </div>

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
