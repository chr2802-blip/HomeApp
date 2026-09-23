import type { HomeTheme } from "@prisma/client";
import { prisma } from "./prisma";
import { homeDb } from "./home-db";
import { monthStartInstant } from "./time";

/**
 * What the app's one AI feature — reading an imported recipe, `recipe-normalize.ts` —
 * is costing each household, and how close that is to what a home may spend in a
 * month.
 *
 * A call is priced and stamped with its home the moment it happens
 * (`recordAiUsage`, called from `normalizeRecipe`), so "how much has this home spent"
 * is always a sum over rows rather than a number trusted to stay right on its own —
 * the same choice `storage.ts` makes about a home's bytes, for the same reason.
 */

/**
 * USD per million tokens, for every model this app has ever billed a call to.
 *
 * Priced at the model, not assumed: `recipe-normalize.ts` names its model in one
 * place (`MODEL`), and a price is looked up against whatever a stored row actually
 * says it used — so a model change there is a row that prices itself correctly
 * without this file needing to know it happened, and an old row keeps the price that
 * was true when it was made even after this table is edited for a new one.
 */
const PRICE_PER_MTOK_USD: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 2, output: 10 },
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
 * since what a call will cost is only known once it has been made.
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
 * Never thrown from and never awaited by the import it is metering: a household's
 * recipe is what that press was for, and losing it because a metrics write failed
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
