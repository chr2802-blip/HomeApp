"use server";

import { requireHomeUser } from "@/lib/auth";
import { fetchRecipeFromUrl, importPastedCaption, type ImportOutcome } from "@/lib/recipe-import";

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

/**
 * "Paste the description instead", the way into the same importer for a reel whose own
 * page would not be read.
 *
 * Instagram and Facebook refuse a signed-out request often enough that the automatic
 * route cannot be the only one: a cook standing in front of a recipe they can see is
 * not helped by being told this app cannot. So the caption is a field they can fill
 * themselves, and it is read by exactly the same parser the automatic route uses —
 * there is one answer in this app to what a caption means, whichever way it arrived.
 *
 * The link comes along where there is one, so the reel still becomes the recipe's video
 * and its poster frame is still worth a try, neither of which the pasted text can say.
 */
export async function importRecipeFromCaption(
  _prev: ImportOutcome | undefined,
  formData: FormData,
): Promise<ImportOutcome> {
  const user = await requireHomeUser();

  const caption = String(formData.get("importCaption") ?? "");
  const url = String(formData.get("importUrl") ?? "").trim();

  return importPastedCaption(caption, url, user.homeId);
}
