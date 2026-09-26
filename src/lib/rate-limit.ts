import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;

/**
 * How many attempts a scope allows in `WINDOW_MS`. Eight is the guess-a-password number,
 * and is right for anything guarding a secret.
 *
 * `prepare` is not guarding anything: it counts saves that go to the model, and a save
 * over it does not fail — it stores the recipe as written and clears its cooking-mode
 * breakdown, which nobody is told about. A household tidying a shelf of old recipes in
 * one evening reached eight honestly, so it is set where only a loop would reach it. The
 * money is bounded elsewhere, by the home's monthly allowance (`overMonthlyLimit`).
 *
 * `cook-timer` counts timers scheduled to ring on a locked phone, each one a QStash
 * message out of a daily quota the whole installation shares. A dinner with five timed
 * steps, some restarted, is a dozen; going over is silent too — the timer still counts
 * in the page, it just cannot ring with the page closed.
 */
const MAX_ATTEMPTS: Record<string, number> = { prepare: 30, "cook-timer": 40 };
const DEFAULT_MAX_ATTEMPTS = 8;

export function attemptsAllowed(scope: string): number {
  return MAX_ATTEMPTS[scope] ?? DEFAULT_MAX_ATTEMPTS;
}

/**
 * Attempts are keyed by a hash of scope + client IP + identifier, so the table never
 * holds a raw address or email. Counting in the database rather than in memory means the
 * limit still holds when the app runs across several serverless instances.
 */
async function attemptKey(scope: string, identifier: string) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${scope}:${ip}:${identifier.trim().toLowerCase()}`)
    .digest("hex");
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterMinutes: number };

export async function checkRateLimit(scope: string, identifier: string): Promise<RateLimitResult> {
  const key = await attemptKey(scope, identifier);
  const since = new Date(Date.now() - WINDOW_MS);

  const attempts = await prisma.loginAttempt.findMany({
    where: { key, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (attempts.length < attemptsAllowed(scope)) return { allowed: true };

  const oldest = attempts[0]!.createdAt.getTime();
  const retryAfterMs = Math.max(0, oldest + WINDOW_MS - Date.now());
  return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil(retryAfterMs / 60000)) };
}

export async function recordFailedAttempt(scope: string, identifier: string) {
  const key = await attemptKey(scope, identifier);
  await prisma.loginAttempt.create({ data: { key } });
  // Opportunistic cleanup so the table cannot grow without bound.
  await prisma.loginAttempt
    .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - WINDOW_MS) } } })
    .catch(() => {});
}

export async function clearAttempts(scope: string, identifier: string) {
  const key = await attemptKey(scope, identifier);
  await prisma.loginAttempt.deleteMany({ where: { key } });
}
