import { Button, Card } from "@/components/ui";
import { RecipeFields, type RecipeValues } from "@/components/recipe-fields";

export function RecipeForm({
  action,
  recipe,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  recipe?: RecipeValues;
  submitLabel: string;
}) {
  return (
    <Card>
      <form action={action} className="space-y-4">
        {recipe?.id && <input type="hidden" name="recipeId" value={recipe.id} />}
        <RecipeFields recipe={recipe} />
        <Button type="submit">{submitLabel}</Button>
      </form>
    </Card>
  );
}
