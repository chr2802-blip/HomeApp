"use server";

import { requireHomeUser } from "@/lib/auth";
import { fetchRecipeFromUrl, type ImportOutcome } from "@/lib/recipe-import";

/**
 * "Import from a link" on the new-recipe form. Its result carries the fetched fields
 * rather than the plain ok/fail of `ActionResult` — there is something to hand back
 * beyond whether it worked, the same reason `readPhotoChoice` has its own result type
 * instead of reusing that one.
 */
export async function importRecipeFromUrl(
  _prev: ImportOutcome | undefined,
  formData: FormData,
): Promise<ImportOutcome> {
  const user = await requireHomeUser();

  const url = String(formData.get("importUrl") ?? "").trim();
  if (!url) return { ok: false, error: "Paste a link to a recipe first." };

  return fetchRecipeFromUrl(url, user.homeId);
}
