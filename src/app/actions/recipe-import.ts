"use server";

import { requireHomeUser } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limit";
import { fetchRecipeFromUrl, importPastedCaption, type ImportOutcome } from "@/lib/recipe-import";
import { sayIn } from "@/lib/copy/say";
import { RECIPES } from "@/lib/copy/recipes";
import type { HomeLanguage } from "@prisma/client";

/**
 * An import costs this app an outbound fetch and a model call, and both of those are spent
 * on somebody else's say-so: the link is whatever was pasted, and the reading is billed.
 * So the same limiter the login form uses is pointed at it — eight in a quarter of an hour,
 * per person per address, which no cook filing away recipes will ever notice and which
 * bounds what a stolen session can run up.
 *
 * `recordFailedAttempt` is recording an attempt here rather than a failure; the name is the
 * login form's and is left alone rather than churning `auth.ts` for it. Every import counts,
 * successful or not, because it is the spending that is being limited and not the mistakes.
 */
async function overLimit(userId: string, language: HomeLanguage) {
  const limit = await checkRateLimit("import", userId);
  if (limit.allowed) {
    await recordFailedAttempt("import", userId);
    return null;
  }
  return {
    ok: false as const,
    error: sayIn(language)(RECIPES.rateLimited, { minutes: limit.retryAfterMinutes }),
  };
}

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
  if (!url) return { ok: false, error: sayIn(user.homeLanguage)(RECIPES.pasteLinkFirst) };

  const limited = await overLimit(user.id, user.homeLanguage);
  if (limited) return limited;

  return fetchRecipeFromUrl(url, user.homeId, user.homeLanguage);
}

/**
 * "Paste the description instead", the way into the same importer for a reel whose own
 * page would not be read — and for anything else a cook is looking at and this app is not.
 *
 * Instagram and Facebook refuse a signed-out request often enough that the automatic route
 * cannot be the only one: a cook standing in front of a recipe they can see is not helped
 * by being told this app cannot see it. So the text is a field they can fill themselves,
 * and it goes to exactly the same reader the automatic route uses — there is one answer in
 * this app to what a piece of text means, whichever way it arrived.
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

  if (!caption.trim()) return { ok: false, error: sayIn(user.homeLanguage)(RECIPES.pasteCaptionFirst) };

  const limited = await overLimit(user.id, user.homeLanguage);
  if (limited) return limited;

  return importPastedCaption(caption, url, user.homeId, user.homeLanguage);
}
