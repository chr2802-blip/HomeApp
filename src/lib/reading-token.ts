import { createHmac, timingSafeEqual } from "crypto";
import type { StoredStep } from "./cook";
import { ingredientLines, instructionLines } from "./recipes";

/**
 * What lets an imported recipe be saved without being read a second time.
 *
 * The importer answers the same question a save's reader would — the ingredient lines in
 * the one format, the steps, and which ingredients each step uses — because both are
 * handed the same rules (`ingredientRules`, `stepRules`). So when a cook imports a recipe
 * and saves it without touching its ingredients or steps, asking the save's reader again
 * would spend up to half a minute and a paid call to get back what the form already holds.
 *
 * The form carries that reading back as a token: the lines it was about, the breakdown,
 * and the home it was read for, signed with `AUTH_SECRET`. The save trusts the breakdown
 * **only** while the signature holds, the home is the one being saved into, and the
 * ingredients and steps are line for line what was read. Anything else — an edited line,
 * a token from another home, one somebody wrote by hand — is simply not a shortcut, and
 * the save reads the recipe as it would have anyway. Nothing is refused over it.
 *
 * Signed rather than trusted because the breakdown claims something about the text —
 * "this was read into the format" — and a claim a browser could make about any text it
 * liked would make the format a suggestion.
 *
 * Server only: this reads the secret.
 */

/** The lines a reading was about, compared the way every reader splits them — so a
 *  textarea sending `\r\n`, or a trailing blank line, is still the same recipe. */
const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((line, i) => line === b[i]);

type Payload = { h: string; i: string[]; s: string[]; c: StoredStep[] };

function key(): string | null {
  return process.env.AUTH_SECRET || null;
}

function mac(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`recipe-reading:${body}`).digest();
}

/** A token for this reading, or null where there is no secret to sign it with. */
export function signReading(
  homeId: string,
  reading: { ingredients: string; instructions: string; steps: StoredStep[] },
): string | null {
  const secret = key();
  if (!secret) return null;

  const payload: Payload = {
    h: homeId,
    i: ingredientLines(reading.ingredients),
    s: instructionLines(reading.instructions),
    c: reading.steps,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

/**
 * The breakdown a token vouches for, or null wherever it does not vouch for this text in
 * this home. Never throws: a token is a shortcut, and a bad one only means no shortcut.
 */
export function readingFor(
  token: unknown,
  homeId: string,
  fields: { ingredients: string; instructions: string },
): StoredStep[] | null {
  const secret = key();
  if (!secret || typeof token !== "string") return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = mac(body, secret);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.h !== homeId) return null;
  if (!sameLines(payload.i, ingredientLines(fields.ingredients))) return null;
  if (!sameLines(payload.s, instructionLines(fields.instructions))) return null;
  if (!Array.isArray(payload.c) || payload.c.length !== payload.s.length) return null;

  return payload.c;
}
