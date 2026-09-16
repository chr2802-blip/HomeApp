import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { classifyModels } from "@/lib/home-db";

/**
 * The guard on the arrangement `homeDb` depends on.
 *
 * Every model in the schema has to be one of three things: scoped by its `homeId`,
 * refused because it reads like a home's model and is not, or passed through because it
 * has nothing to do with homes. The first is derived from the schema and cannot drift.
 * The other two are a judgement written down by hand, and a hand-written list is a list
 * somebody forgets.
 *
 * So this walks the schema rather than a list of its own. Adding a model without a
 * `homeId` and not saying which kind it is fails here, in a unit test that needs no
 * database, rather than at the first query — which is how `ListItem` came to return
 * every household's shopping.
 */
describe("every model is classified", () => {
  it("sorts the whole schema without refusing to decide", () => {
    const models = Prisma.dmmf.datamodel.models.map((model) => model.name);
    expect(models.length).toBeGreaterThan(0);

    // `classifyModels` throws on the first model it cannot place, which is the failure
    // this test exists to produce. Naming the model in the message matters more than
    // the assertion below: that is what tells whoever added it what to do.
    expect(() => classifyModels()).not.toThrow();
    expect(classifyModels()).toHaveLength(models.length);
  });

  it("scopes exactly the models that carry a homeId, and no others", () => {
    const carriesHome = new Set(
      Prisma.dmmf.datamodel.models
        .filter((model) => model.fields.some((field) => field.name === "homeId"))
        .map((model) => model.name),
    );

    for (const { model, verdict } of classifyModels()) {
      expect(verdict === "scope").toBe(carriesHome.has(model));
    }
  });

  /**
   * The three that read as though they belong to a home and do not. Spelled out rather
   * than derived, because "looks home-scoped but is reached through its parent" is
   * exactly the judgement no column can express — and getting it wrong is silent.
   */
  it.each(["User", "ListItem", "ListFavorite", "RecipeCategoryLink"])(
    "refuses %s rather than passing it through unscoped",
    (name) => {
      const found = classifyModels().find((entry) => entry.model === name);
      expect(found?.verdict).toBe("refuse");
    },
  );

  it("passes through the models that have nothing to do with a home", () => {
    const verdicts = new Map(classifyModels().map((entry) => [entry.model, entry.verdict]));

    for (const name of ["Home", "LoginAttempt", "CronRun", "SlowQuery", "PushSubscription"]) {
      expect(verdicts.get(name)).toBe("pass");
    }
  });
});
