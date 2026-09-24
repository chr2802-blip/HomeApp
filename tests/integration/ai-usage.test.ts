import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  MONTHLY_LIMIT_USD,
  USD_TO_DKK,
  getAiCallTimings,
  getHomeAiSpend,
  getInstallationAiSpend,
  overMonthlyLimit,
  recordAiUsage,
} from "@/lib/ai-usage";
import { createHome, createUser } from "../helpers/factories";

async function homeWithOwner() {
  const home = await createHome();
  const user = await createUser({ homeId: home.id, role: "ADMIN" });
  return { home, user };
}

describe("recordAiUsage", () => {
  it("prices and files a call under the home that asked for it", async () => {
    const { home } = await homeWithOwner();

    await recordAiUsage(home.id, "recipe_import", "claude-sonnet-5", 1_000_000, 100_000, 12_345.6);

    const rows = await prisma.aiUsage.findMany({ where: { homeId: home.id } });
    expect(rows).toHaveLength(1);
    // $2/MTok in, $10/MTok out: a million in plus a tenth of a million out is $3.
    expect(rows[0]!.costMicros).toBe(3_000_000);
    expect(rows[0]!.durationMs).toBe(12_346);
  });

  it("never throws, so a metering failure cannot cost the recipe it is measuring", async () => {
    await expect(
      recordAiUsage("not-a-real-home", "recipe_import", "claude-sonnet-5", 100, 100, 1_000),
    ).resolves.toBeUndefined();
  });
});

describe("a home's AI spend", () => {
  it("is nothing before any call has been made", async () => {
    const { home } = await homeWithOwner();
    expect(await getHomeAiSpend(home.id)).toMatchObject({ costMicros: 0, costUsd: 0, costDkk: 0 });
  });

  it("adds up every call this calendar month, in DKK at the fixed rate", async () => {
    const { home } = await homeWithOwner();
    await recordAiUsage(home.id, "recipe_import", "claude-sonnet-5", 1_000_000, 0, 1_000); // $2
    await recordAiUsage(home.id, "recipe_import", "claude-sonnet-5", 500_000, 0, 1_000); // $1

    const spend = await getHomeAiSpend(home.id);
    expect(spend.costUsd).toBeCloseTo(3, 6);
    expect(spend.costDkk).toBeCloseTo(3 * USD_TO_DKK, 6);
  });

  it("leaves out what was spent before this calendar month began", async () => {
    const { home } = await homeWithOwner();
    const lastMonth = new Date("2026-05-15T12:00:00Z");
    const now = new Date("2026-06-10T12:00:00Z");

    await prisma.aiUsage.create({
      data: {
        homeId: home.id,
        feature: "recipe_import",
        model: "claude-sonnet-5",
        inputTokens: 1_000_000,
        outputTokens: 0,
        costMicros: 2_000_000,
        createdAt: lastMonth,
      },
    });

    expect((await getHomeAiSpend(home.id, now)).costMicros).toBe(0);
  });

  it("never counts another household's calls", async () => {
    const theirs = await homeWithOwner();
    await recordAiUsage(theirs.home.id, "recipe_import", "claude-sonnet-5", 1_000_000, 0, 1_000);

    const { home } = await homeWithOwner();
    expect((await getHomeAiSpend(home.id)).costMicros).toBe(0);
  });
});

describe("the installation's AI spend", () => {
  it("is every home's own figure, added up", async () => {
    const first = await homeWithOwner();
    const second = await homeWithOwner();
    await recordAiUsage(first.home.id, "recipe_import", "claude-sonnet-5", 1_000_000, 0, 1_000);
    await recordAiUsage(second.home.id, "recipe_import", "claude-sonnet-5", 500_000, 0, 1_000);

    const [all, one, two] = await Promise.all([
      getInstallationAiSpend(),
      getHomeAiSpend(first.home.id),
      getHomeAiSpend(second.home.id),
    ]);

    expect(all.costMicros).toBe(one.costMicros + two.costMicros);
    const share = (id: string) => all.homes.find((home) => home.id === id);
    expect(share(first.home.id)?.costMicros).toBe(one.costMicros);
    expect(share(second.home.id)?.costMicros).toBe(two.costMicros);
  });

  it("still names a home that has never made a call", async () => {
    const { home } = await homeWithOwner();
    const all = await getInstallationAiSpend();
    expect(all.homes.map((one) => one.id)).toContain(home.id);
    expect(all.homes.find((one) => one.id === home.id)?.costMicros).toBe(0);
  });

  it("lists the biggest spender first", async () => {
    const small = await homeWithOwner();
    const large = await homeWithOwner();
    await recordAiUsage(small.home.id, "recipe_import", "claude-sonnet-5", 10_000, 0, 1_000);
    await recordAiUsage(large.home.id, "recipe_import", "claude-sonnet-5", 5_000_000, 0, 1_000);

    const all = await getInstallationAiSpend();
    const ids = all.homes.map((home) => home.id);
    expect(ids.indexOf(large.home.id)).toBeLessThan(ids.indexOf(small.home.id));
  });
});

describe("a home's monthly allowance", () => {
  const spend = (homeId: string, costMicros: number, createdAt?: Date) =>
    prisma.aiUsage.create({
      data: { homeId, feature: "cook_steps", model: "claude-sonnet-5", inputTokens: 0, outputTokens: 0, costMicros, createdAt },
    });
  const limit = MONTHLY_LIMIT_USD * 1_000_000;

  it("is not spent a micro-dollar short of the limit", async () => {
    const { home } = await homeWithOwner();
    await spend(home.id, limit - 1);
    expect(await overMonthlyLimit(home.id)).toBe(false);
  });

  it("is spent at the limit exactly", async () => {
    const { home } = await homeWithOwner();
    await spend(home.id, limit);
    expect(await overMonthlyLimit(home.id)).toBe(true);
  });

  it("is one home's, not the installation's", async () => {
    const { home } = await homeWithOwner();
    const { home: other } = await homeWithOwner();
    await spend(other.id, limit * 2);
    expect(await overMonthlyLimit(home.id)).toBe(false);
  });

  it("comes back with the new month", async () => {
    const { home } = await homeWithOwner();
    await spend(home.id, limit, new Date("2026-05-20T12:00:00Z"));
    expect(await overMonthlyLimit(home.id, new Date("2026-06-02T12:00:00Z"))).toBe(false);
  });
});

describe("the System page's AI call times", () => {
  const call = (homeId: string, model: string, durationMs: number | null, createdAt?: Date) =>
    prisma.aiUsage.create({
      data: { homeId, feature: "recipe_import", model, inputTokens: 0, outputTokens: 0, costMicros: 0, durationMs, createdAt },
    });
  const now = new Date("2026-09-24T12:00:00Z");

  it("gives each model its own median and slowest, so a switch reads as before and after", async () => {
    const { home } = await homeWithOwner();
    // One pathological page among quick ones: it is the slowest, never the typical wait.
    for (const ms of [8_000, 9_000, 10_000, 40_000]) await call(home.id, "claude-sonnet-5", ms, now);
    for (const ms of [3_000, 4_000, 5_000]) await call(home.id, "claude-haiku-4-5", ms, now);

    expect(await getAiCallTimings(now)).toEqual([
      { feature: "recipe_import", model: "claude-haiku-4-5", calls: 3, typicalMs: 4_000, slowestMs: 5_000 },
      { feature: "recipe_import", model: "claude-sonnet-5", calls: 4, typicalMs: 9_500, slowestMs: 40_000 },
    ]);
  });

  it("leaves out rows stored before calls were timed, and calls older than the window", async () => {
    const { home } = await homeWithOwner();
    await call(home.id, "claude-haiku-4-5", null, now);
    await call(home.id, "claude-haiku-4-5", 99_000, new Date("2026-08-01T12:00:00Z"));
    await call(home.id, "claude-haiku-4-5", 2_000, now);

    expect(await getAiCallTimings(now)).toEqual([
      { feature: "recipe_import", model: "claude-haiku-4-5", calls: 1, typicalMs: 2_000, slowestMs: 2_000 },
    ]);
  });
});
