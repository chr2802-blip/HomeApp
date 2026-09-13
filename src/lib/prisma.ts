import { PrismaClient } from "@prisma/client";

export const DEFAULT_SLOW_QUERY_MS = 400;

/**
 * Calls slower than this are worth knowing about; the rest are noise.
 *
 * Read per call rather than once at import so a test can raise it out of the way, or
 * lower it to prove the logging works, without needing a second client.
 */
export function slowQueryThresholdMs() {
  const configured = Number(process.env.SLOW_QUERY_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SLOW_QUERY_MS;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const base = new PrismaClient();

  return base.$extends({
    name: "slow-query-log",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const startedAt = performance.now();
        try {
          return await query(args);
        } finally {
          const durationMs = Math.round(performance.now() - startedAt);
          if (durationMs >= slowQueryThresholdMs()) record(base, model, operation, durationMs);
        }
      },
    },
  }) as unknown as PrismaClient;
}

/**
 * Writes through the unextended client, so logging a slow query cannot trigger the
 * extension again and log itself. Deliberately not awaited: the request should not
 * wait on its own instrumentation, and losing a metric matters far less than delaying
 * the page.
 */
function record(base: PrismaClient, model: string | undefined, operation: string, durationMs: number) {
  if (model === "SlowQuery") return;

  void base.slowQuery
    .create({ data: { model: model ?? null, operation, durationMs } })
    .catch(() => {});
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
