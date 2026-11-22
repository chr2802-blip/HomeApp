import { RecipeCategoriesAdmin } from "@/components/recipe-categories-admin";
import { PantryShelvesAdmin } from "@/components/pantry-shelves-admin";
import { settingsHome } from "@/lib/settings-home";

/**
 * The two sets of headings the household files things under, kept the same way: a list
 * of what has been made, a "+" to make another, three dots on each.
 */
export default async function SettingsCategoriesPage() {
  const { user, home } = await settingsHome();
  if (!home) return null;

  return (
    <>
      <RecipeCategoriesAdmin homeId={home.id} language={user.homeLanguage} />
      <PantryShelvesAdmin homeId={home.id} language={user.homeLanguage} />
    </>
  );
}
