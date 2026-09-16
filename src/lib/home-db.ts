import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Which models belong to a home, read from the schema rather than written down.
 *
 * A model carries a home if it has a `homeId` column, and Prisma already knows that —
 * so asking it is both shorter and incapable of drifting. The list this replaced was
 * kept by hand and had to be remembered every time the schema grew.
 */
const HOME_SCOPED = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === "homeId"))
    .map((model) => model.name),
);

/**
 * What to do with the models that carry no `homeId`, one entry each.
 *
 * They divide into two kinds and the difference is the whole point of this file. Some
 * read as though they belong to a home and do not — a list's items, a recipe's
 * headings — and scoping them would pass the query through untouched, which is the
 * failure this module exists to prevent. Others have genuinely nothing to do with
 * homes, and passing them through is correct.
 *
 * Telling them apart is a judgement nobody can make from the column alone, so it is
 * made once, here, and written down. A model in neither list is refused outright rather
 * than guessed at: see `decide` below.
 */
const NO_HOME_ID: Record<string, { refuse: true; because: string } | { refuse: false }> = {
  // Reads like a home's model; is not. Refusing is the protection.
  User: {
    refuse: true,
    because: "a user belongs to several homes; ask homeMember, and read the user through it",
  },
  ListItem: { refuse: true, because: "reached through its list" },
  ListFavorite: { refuse: true, because: "reached through its list" },
  RecipeCategoryLink: { refuse: true, because: "reached through its recipe" },

  // Nothing to do with any home. Scoping these would be a query error, not a leak.
  Home: { refuse: false },
  LoginAttempt: { refuse: false },
  CronRun: { refuse: false },
  SlowQuery: { refuse: false },
  PushSubscription: { refuse: false },
};

/**
 * What this client should do with one model.
 *
 * The unknown case is the reason this function exists. A model that has just been added
 * to the schema without a `homeId`, and that nobody has classified above, used to be
 * passed straight through — the same treatment as `CronRun`, and exactly what let
 * `homeDb(id).listItem.findMany()` hand back every household's shopping. So an
 * unclassified model is an error rather than a default: adding one to the schema now
 * makes the decision impossible to skip instead of merely easy to forget.
 */
function decide(model: string): "scope" | "refuse" | "pass" {
  if (HOME_SCOPED.has(model)) return "scope";

  const known = NO_HOME_ID[model];
  if (!known) {
    throw new Error(
      `homeDb does not know what ${model} is. It carries no homeId, so it is either ` +
        "reached through the record that does (add it as refuse: true) or has nothing " +
        "to do with homes (add it as refuse: false). Say which in lib/home-db.ts.",
    );
  }

  return known.refuse ? "refuse" : "pass";
}

/** Operations that select rows. Prisma accepts a non-unique field here as well. */
const FILTERED = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

type Args = Record<string, unknown>;

/**
 * A Prisma client bound to one home.
 *
 * Every query it makes against a home-scoped model carries that home's id, whether or
 * not the caller wrote one — so a query that forgets the clause returns nothing rather
 * than another household's rows. Rows it creates are stamped with the same id, so a
 * record cannot be filed under the wrong home either.
 *
 * This is the difference between separation that depends on remembering and separation
 * that holds by construction. It does not replace the permission checks in
 * `lib/access.ts`; it removes the chance to ask the wrong question in the first place.
 */
export function homeDb(homeId: string) {
  return prisma.$extends({
    name: "home-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Always a model here: `$allModels` sees model operations only, and a raw
          // query is not one of those. An unrecognised name is `decide`'s to refuse.
          const verdict = decide(model);

          if (verdict === "refuse") {
            const { because } = NO_HOME_ID[model] as { refuse: true; because: string };
            throw new Error(`homeDb cannot scope ${model}: it carries no homeId — ${because}.`);
          }
          if (verdict === "pass") return query(args);

          const scoped = { ...(args as Args) };

          if (FILTERED.has(operation)) {
            scoped.where = { ...((scoped.where as Args) ?? {}), homeId };
          } else if (operation === "create") {
            scoped.data = { ...((scoped.data as Args) ?? {}), homeId };
          } else if (operation === "createMany") {
            const rows = scoped.data as Args | Args[];
            scoped.data = Array.isArray(rows)
              ? rows.map((row) => ({ ...row, homeId }))
              : { ...rows, homeId };
          } else if (operation === "upsert") {
            scoped.where = { ...((scoped.where as Args) ?? {}), homeId };
            scoped.create = { ...((scoped.create as Args) ?? {}), homeId };
          } else {
            // An operation nobody has used yet. Refusing is safer than passing it
            // through unscoped and finding out from a support message.
            throw new Error(
              `homeDb does not know how to scope "${operation}" on ${model}. ` +
                "Add it to lib/home-db.ts before using it.",
            );
          }

          return query(scoped);
        },
      },
    },
  });
}

/**
 * Every model in the schema, sorted into what `homeDb` will do with it.
 *
 * Exported for `tests/unit/home-scoping.test.ts`, which walks the schema and fails if
 * any model is unclassified. That test is the point of the whole arrangement: it turns
 * "somebody forgot to update home-db.ts" from a silent cross-home read into a failing
 * unit test, before the model is ever queried.
 */
export function classifyModels() {
  return Prisma.dmmf.datamodel.models.map((model) => ({
    model: model.name,
    verdict: decide(model.name),
  }));
}
