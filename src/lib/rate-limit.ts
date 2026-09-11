import { createHash } from "crypto";
import { headers } from "next/headers";
import { prisma } from "./prisma";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

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

  if (attempts.length < MAX_ATTEMPTS) return { allowed: true };

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
