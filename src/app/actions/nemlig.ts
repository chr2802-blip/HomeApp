"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireHomeUser } from "@/lib/auth";
import { canAdministerCurrentHome } from "@/lib/access";
import { homeDb } from "@/lib/home-db";
import { readForm, requiredText, MAX_NAME } from "@/lib/form";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { checkRateLimit, clearAttempts, recordFailedAttempt } from "@/lib/rate-limit";
import { canSealSecrets, openSecret, sealSecret } from "@/lib/secret-box";
import { NemligError, NemligSession, type NemligFailure, type NemligProduct } from "@/lib/nemlig";
import { fillBasket, proposeAll, type BasketChoice, type BasketLine, type Proposal, type Remembered } from "@/lib/nemlig-basket";
import { pantryKey } from "@/lib/pantry";
import { shoppingText } from "@/lib/recipes";
import { sayIn, type Say } from "@/lib/copy/say";
import { NEMLIG, NEMLIG_FAILURE } from "@/lib/copy/nemlig";

/**
 * "Send to Nemlig": connecting a household's nemlig.com login, proposing a product for
 * each open line of a list, and putting what the household confirmed in its basket.
 *
 * Everything that talks to Nemlig is here, on the server — the browser never sees the
 * login, and never talks to Nemlig itself. What is decided (which product, what went
 * wrong with which line) is `src/lib/nemlig-basket.ts`; this file is the wiring.
 *
 * Connecting is administration, gated like the pantry's own shelves: the home on screen,
 * asked with `canAdministerCurrentHome`. Sending is everybody's — it is the household's
 * basket, filled from the household's list.
 */

export type NemligReview = { ok: true; proposals: Proposal[] } | { ok: false; error: string };
export type NemligSearch = { ok: true; products: NemligProduct[] } | { ok: false; error: string };
export type NemligSent =
  | {
      ok: true;
      added: { itemId: string; text: string; quantity: number; name: string }[];
      failed: { itemId: string; text: string; quantity: number; name: string; reason: string }[];
    }
  | { ok: false; error: string };

function log(event: string, detail: Record<string, unknown>) {
  console.warn(JSON.stringify({ level: "warn", event, ...detail, at: new Date().toISOString() }));
}

const failureSaid = (say: Say, kind: NemligFailure) => say(NEMLIG_FAILURE[kind]);

async function adminUser() {
  const user = await requireHomeUser();
  if (!canAdministerCurrentHome(user)) redirect("/dashboard");
  return user;
}

/** A press counted against `scope`, or the sentence saying to wait. */
async function spend(scope: string, userId: string, say: Say): Promise<string | null> {
  const limit = await checkRateLimit(scope, userId);
  if (!limit.allowed) return say(NEMLIG.busy, { minutes: limit.retryAfterMinutes });
  await recordFailedAttempt(scope, userId);
  return null;
}

// ---------------------------------------------------------------------------------
// Settings

function loginSchema(say: Say) {
  return z.object({
    email: requiredText(say(NEMLIG.emailRequired)),
    // Not trimmed: a password is exactly what was typed.
    password: z.string({ error: say(NEMLIG.passwordRequired) }).min(1, say(NEMLIG.passwordRequired)).max(MAX_NAME),
  });
}

/**
 * Connects (or replaces) the household's Nemlig login. It is tried against Nemlig
 * before it is kept, so a mistyped password is said now, on the settings page, rather
 * than at the first "Send to Nemlig" of a Saturday morning.
 */
export async function connectNemlig(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await adminUser();
  const say = sayIn(user.homeLanguage);
  if (!canSealSecrets()) return fail(say(NEMLIG_FAILURE.unavailable));

  const form = readForm(loginSchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);
  const { email, password } = form.fields;

  // A password check like any other: eight wrong guesses a quarter-hour, per person.
  const limit = await checkRateLimit("nemlig-login", user.id);
  if (!limit.allowed) return fail(say(NEMLIG.busy, { minutes: limit.retryAfterMinutes }));

  try {
    await NemligSession.login(email, password);
  } catch (error) {
    const kind = error instanceof NemligError ? error.kind : "unavailable";
    if (kind === "login") await recordFailedAttempt("nemlig-login", user.id);
    log("nemlig_connect_failed", { kind, message: error instanceof Error ? error.message : String(error) });
    return fail(failureSaid(say, kind));
  }
  await clearAttempts("nemlig-login", user.id);

  const sealed = sealSecret(password);
  await homeDb(user.homeId).nemligAccount.upsert({
    where: { homeId: user.homeId },
    create: { homeId: user.homeId, username: email, password: sealed },
    update: { username: email, password: sealed },
  });
  revalidatePath("/settings");
  revalidatePath("/lists", "layout");
  return ok(say(NEMLIG.connected));
}

/** Forgets the household's Nemlig login. Nemlig's own basket and account are untouched. */
export async function disconnectNemlig() {
  const user = await adminUser();
  await homeDb(user.homeId).nemligAccount.deleteMany({});
  revalidatePath("/settings");
  revalidatePath("/lists", "layout");
}

// ---------------------------------------------------------------------------------
// Reviewing a list

/** The list's open lines as the review asks about them, read through the caller's home. */
async function openLines(homeId: string, listId: string): Promise<BasketLine[] | null> {
  const list = await homeDb(homeId).list.findUnique({
    where: { id: listId },
    select: {
      items: {
        where: { done: false },
        orderBy: { position: "asc" },
        select: { id: true, text: true, amount: true },
      },
    },
  });
  if (!list) return null;
  return list.items.flatMap((item) => {
    const term = shoppingText(item.text);
    const key = pantryKey(item.text);
    if (!term || !key) return [];
    return [{ itemId: item.id, key, text: item.text, term, quantity: Math.max(1, item.amount) }];
  });
}

async function connected(homeId: string) {
  if (!canSealSecrets()) return null;
  return homeDb(homeId).nemligAccount.findUnique({ where: { homeId } });
}

/**
 * A proposed product for every open line of a list, for the household to check before
 * anything is added. Searching needs no login, so the password is not opened here —
 * only asked whether there is one, since a review that could never be sent is a waste
 * of the household's time.
 */
export async function reviewForNemlig(listId: string): Promise<NemligReview> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  if (!(await connected(user.homeId))) return { ok: false, error: say(NEMLIG.notConnected) };

  const lines = await openLines(user.homeId, String(listId));
  if (!lines) return { ok: false, error: say(NEMLIG.nothingOpen) };
  if (lines.length === 0) return { ok: true, proposals: [] };

  const busy = await spend("nemlig-search", user.id, say);
  if (busy) return { ok: false, error: busy };

  const remembered = new Map<string, Remembered>(
    (
      await homeDb(user.homeId).nemligChoice.findMany({
        where: { key: { in: lines.map((line) => line.key) } },
        select: { key: true, productId: true, name: true, imageUrl: true },
      })
    ).map(({ key, ...choice }) => [key, choice]),
  );

  let session: NemligSession;
  try {
    session = await NemligSession.anonymous();
  } catch (error) {
    const kind = error instanceof NemligError ? error.kind : "unavailable";
    log("nemlig_session_failed", { kind, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: failureSaid(say, kind) };
  }

  const proposals = await proposeAll(lines, remembered, (term) => session.search(term));
  const problems = proposals.filter((p) => p.problem && p.problem !== "notFound");
  if (problems.length > 0) {
    log("nemlig_search_failed", { count: problems.length, kinds: [...new Set(problems.map((p) => p.problem))] });
  }
  return { ok: true, proposals };
}

/** One row's "search again", with whatever words the household typed instead. */
export async function searchNemlig(query: string): Promise<NemligSearch> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const term = String(query ?? "").trim().slice(0, MAX_NAME);
  if (!term) return { ok: true, products: [] };
  if (!(await connected(user.homeId))) return { ok: false, error: say(NEMLIG.notConnected) };

  const busy = await spend("nemlig-search", user.id, say);
  if (busy) return { ok: false, error: busy };

  try {
    const session = await NemligSession.anonymous();
    return { ok: true, products: await session.search(term) };
  } catch (error) {
    const kind = error instanceof NemligError ? error.kind : "unavailable";
    log("nemlig_search_failed", { kind, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: failureSaid(say, kind) };
  }
}

// ---------------------------------------------------------------------------------
// Filling the basket

const choicesSchema = z
  .array(
    z.object({
      itemId: z.string().min(1).max(64),
      quantity: z.number().int().min(1).max(99),
      product: z.object({
        id: z.string().regex(/^\d{1,12}$/),
        name: z.string().trim().min(1).max(MAX_NAME),
        imageUrl: z.string().regex(/^https?:\/\//).max(1_000).nullable(),
      }),
    }),
  )
  .max(200);

/**
 * Puts what the household confirmed in its Nemlig basket, and remembers each product
 * that went in for the line it went in for.
 *
 * The lines are read back from the list rather than believed from the browser — only
 * the product and the quantity are the household's to say — so a line from another
 * home's list is simply not found. A login Nemlig refuses stops the press before
 * anything is added; anything else that goes wrong is that one line's.
 */
export async function sendToNemlig(listId: string, choices: unknown): Promise<NemligSent> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);

  const parsed = choicesSchema.safeParse(choices);
  if (!parsed.success) return { ok: false, error: failureSaid(say, "refused") };

  const account = await connected(user.homeId);
  if (!account) return { ok: false, error: say(NEMLIG.notConnected) };

  const lines = await openLines(user.homeId, String(listId));
  if (!lines) return { ok: false, error: say(NEMLIG.nothingOpen) };
  // Each line once, however many times the browser named it: a double press must not be
  // two of everything in the basket.
  const byId = new Map(lines.map((line) => [line.itemId, line]));
  const confirmed: BasketChoice[] = parsed.data.flatMap((choice) => {
    const line = byId.get(choice.itemId);
    if (!line) return [];
    byId.delete(choice.itemId);
    return [{ itemId: line.itemId, key: line.key, text: line.text, quantity: choice.quantity, product: choice.product }];
  });
  if (confirmed.length === 0) return { ok: true, added: [], failed: [] };

  const busy = await spend("nemlig-send", user.id, say);
  if (busy) return { ok: false, error: busy };

  let session: NemligSession;
  try {
    session = await NemligSession.login(account.username, openSecret(account.password));
  } catch (error) {
    const kind = error instanceof NemligError ? error.kind : "login";
    log("nemlig_login_failed", { kind, message: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: failureSaid(say, kind) };
  }

  const outcome = await fillBasket(confirmed, (id, quantity) => session.addToBasket(id, quantity));
  if (outcome.failed.length > 0) {
    log("nemlig_add_failed", { count: outcome.failed.length, failures: outcome.failed.map((f) => `${f.reason}: ${f.message}`) });
  }

  // Remembered only once it went in: a product Nemlig refused is not "your usual".
  const db = homeDb(user.homeId);
  await Promise.all(
    outcome.added.map((choice) =>
      db.nemligChoice.upsert({
        where: { homeId_key: { homeId: user.homeId, key: choice.key } },
        create: {
          homeId: user.homeId,
          key: choice.key,
          productId: choice.product.id,
          name: choice.product.name,
          imageUrl: choice.product.imageUrl,
        },
        update: { productId: choice.product.id, name: choice.product.name, imageUrl: choice.product.imageUrl },
      }),
    ),
  );

  const row = (choice: BasketChoice) => ({
    itemId: choice.itemId,
    text: choice.text,
    quantity: choice.quantity,
    name: choice.product.name,
  });
  return {
    ok: true,
    added: outcome.added.map(row),
    failed: outcome.failed.map((choice) => ({ ...row(choice), reason: failureSaid(say, choice.reason) })),
  };
}
