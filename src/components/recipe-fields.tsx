import { Input, Label, Textarea } from "@/components/ui";

export type RecipeValues = {
  id?: string;
  title?: string;
  description?: string | null;
  ingredients?: string;
  instructions?: string;
  videoUrl?: string | null;
};

/** The recipe form fields, shared by the create dialog and the edit page. */
export function RecipeFields({ recipe }: { recipe?: RecipeValues }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" defaultValue={recipe?.title ?? ""} required />
      </div>

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
