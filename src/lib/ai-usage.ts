import type { HomeTheme } from "@prisma/client";
import { prisma } from "./prisma";
import { homeDb } from "./home-db";
import { monthStartInstant } from "./time";

/**
 * What the app's two AI readers — the importer (`recipe-normalize.ts`) and the save's
 * reader (`cook-steps.ts`) — are costing each household, and how close that is to what
 * a home may spend in a month.
 *
 * A call is priced and stamped with its home the moment it happens
 * (`recordAiUsage`, called from both readers), so "how much has this home spent"
 * is always a sum over rows rather than a number trusted to stay right on its own —
 * the same choice `storage.ts` makes about a home's bytes, for the same reason.
 */

/**
 * USD per million tokens, for every model this app has ever billed a call to.
 *
 * Priced at the model, not assumed: each reader names its model in one place
 * (`MODEL`), and a price is looked up against whatever a stored row actually
 * says it used — so a model change there is a row that prices itself correctly
 * without this file needing to know it happened, and an old row keeps the price that
 * was true when it was made even after this table is edited for a new one.
 */
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** What a call to a model this app has never priced is charged: nothing, rather than a guess. */
function priceOf(model: string) {
  return PRICE_PER_MTOK_USD[model] ?? { input: 0, output: 0 };
}

/**
 * A call's price in millionths of a dollar, rounded once here and never again — every
 * further sum is plain integer addition, which is what keeps ten thousand cheap calls
 * from drifting the way floats summed one at a time would.
 */
export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceOf(model);
  const usd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  return Math.round(usd * 1_000_000);
}

/**
 * What a home may spend on AI calls in a month. Both readers ask `overMonthlyLimit`
 * before every call and answer as they do when the reader is down, so this is a limit
 * rather than a number on Settings — though a home can land one call's worth past it,
 * since what a call will cost is only known once it has been made, and a few if several
 * are in flight at once, since each asks before any has been charged. Reserving a call's
 * cost up front would close that, for a limit of a few kroner a month that is not worth
 * a second write on every call.
 */
export const MONTHLY_LIMIT_USD = 5;

/**
 * A fixed rate rather than a live one. This is a household's dashboard, not a trading
 * desk: a rate that moved under the bar between one render and the next would be a
 * second thing to explain beside the spend itself, for a number that only has to be
 * roughly right. Revisit by hand if the krone moves meaningfully.
 */
export const USD_TO_DKK = 6.9;

export const MONTHLY_LIMIT_DKK = MONTHLY_LIMIT_USD * USD_TO_DKK;

/**
 * Records what one call to the reader cost, against the home that asked for it.
 *
 * Never throws into the reading it is metering (the readers await it, and it swallows
 * its own failure): a household's recipe is what that press was for, and losing it because a metrics write failed
 * would be the tail wagging the dog. Logged the way `recipe-normalize.ts` logs the
 * reader going down, so a metering failure is visible without being able to fail
 * anything.
 */
export async function recordAiUsage(
  homeId: string,
  feature: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  durationMs: number,
): Promise<void> {
  try {
    await prisma.aiUsage.create({
      data: {
        homeId,
        feature,
        model,
        inputTokens,
        outputTokens,
        costMicros: costMicros(model, inputTokens, outputTokens),
        durationMs: Math.round(durationMs),
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "ai_usage_record_failed",
        detail: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      }),
    );
  }
}

export type HomeAiSpend = {
  costMicros: number;
  costUsd: number;
  costDkk: number;
};

function toSpend(micros: number): HomeAiSpend {
  const costUsd = micros / 1_000_000;
  return { costMicros: micros, costUsd, costDkk: costUsd * USD_TO_DKK };
}

/** One household's own AI spend so far this calendar month, in its own zone. */
export async function getHomeAiSpend(homeId: string, now: Date = new Date()): Promise<HomeAiSpend> {
  const result = await homeDb(homeId).aiUsage.aggregate({
    where: { createdAt: { gte: monthStartInstant(now) } },
    _sum: { costMicros: true },
  });
  return toSpend(result._sum.costMicros ?? 0);
}

/**
 * Whether a home has spent its month's allowance, asked by both readers before they call
 * the model — in the reader rather than at each action, so there is one place every paid
 * call passes and no way into the model that forgot to ask.
 */
export async function overMonthlyLimit(homeId: string, now: Date = new Date()): Promise<boolean> {
  const spend = await getHomeAiSpend(homeId, now);
  return spend.costMicros >= MONTHLY_LIMIT_USD * 1_000_000;
}

/** One home's share of the installation's AI spend, as the super admin's page lists them. */
export type HomeAiShare = HomeAiSpend & {
  id: string;
  name: string;
  theme: HomeTheme;
};

export type InstallationAiSpend = HomeAiSpend & {
  /** Every home, largest spend first — including the ones at zero. */
  homes: HomeAiShare[];
};

/**
 * The same question asked of every home at once, plus the installation's total.
 *
 * Crossing homes is the point here — this is the super admin's System view — so it
 * goes through `prisma` directly rather than `homeDb`, exactly as `getInstallationStorage`
 * does for bytes.
 */
export async function getInstallationAiSpend(now: Date = new Date()): Promise<InstallationAiSpend> {
  const [totals, homes] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["homeId"],
      where: { createdAt: { gte: monthStartInstant(now) } },
      _sum: { costMicros: true },
    }),
    prisma.home.findMany({ select: { id: true, name: true, theme: true } }),
  ]);

  const perHome = new Map(totals.map((row) => [row.homeId, row._sum.costMicros ?? 0]));
  const installationMicros = totals.reduce((running, row) => running + (row._sum.costMicros ?? 0), 0);

  return {
    ...toSpend(installationMicros),
    homes: homes
      .map((home) => ({ ...home, ...toSpend(perHome.get(home.id) ?? 0) }))
      .sort((a, b) => b.costMicros - a.costMicros || a.name.localeCompare(b.name)),
  };
}

/** How far back the System page's AI call times look. */
export const AI_TIMING_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long one kind of call took, for one model: `feature` is what asked, as recorded. */
export type AiCallTiming = {
  feature: string;
  model: string;
  calls: number;
  typicalMs: number;
  slowestMs: number;
};

/**
 * How long the household waited on each reader, per model, over the last
 * `AI_TIMING_WINDOW_DAYS`: the median as the typical wait, and the slowest.
 *
 * Split by model as well as by feature, because the point of measuring was to compare
 * one model against the next, and a median taken across both would describe neither.
 * The median rather than the mean, so one pathological page is the slowest row and not
 * everybody's typical wait. Raw SQL because Prisma has no percentile; across homes on
 * purpose, as `getInstallationAiSpend` is — this is the super admin's System view.
 *
 * Only calls that came back are here: one that timed out never got a row, so the real
 * slowest wait can be longer than `slowestMs` says.
 */
export async function getAiCallTimings(now: Date = new Date()): Promise<AiCallTiming[]> {
  const since = new Date(now.getTime() - AI_TIMING_WINDOW_DAYS * DAY_MS);
  const rows = await prisma.$queryRaw<
    { feature: string; model: string; calls: number; typical: number; slowest: number }[]
  >`
    SELECT "feature", "model",
           count(*)::int AS "calls",
           percentile_cont(0.5) WITHIN GROUP (ORDER BY "durationMs") AS "typical",
           max("durationMs") AS "slowest"
    FROM "AiUsage"
    WHERE "durationMs" IS NOT NULL AND "createdAt" >= ${since}
    GROUP BY "feature", "model"
    ORDER BY "feature", "model"
  `;
  return rows.map((row) => ({
    feature: row.feature,
    model: row.model,
    calls: row.calls,
    typicalMs: Math.round(row.typical),
    slowestMs: row.slowest,
  }));
}

/**
 * A DKK amount as somebody reads it off a phone screen.
 *
 * Two decimals below 10 kr. and none above, the same significant-digit rule
 * `formatBytes` uses for bytes: a single import costs a fraction of a krone, and
 * rounding that to "0 kr." on every call would read as the feature not working at
 * all, while the monthly limit itself is comfortably a whole number of kroner.
 */
export function formatDkk(dkk: number): string {
  const decimals = dkk > 0 && dkk < 10 ? 2 : 0;
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(dkk);
}
