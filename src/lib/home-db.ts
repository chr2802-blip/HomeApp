import { prisma } from "./prisma";

/**
 * Models that belong to exactly one home. Anything not listed here — a user's push
 * subscriptions, the login attempt log, the homes themselves — is passed through
 * untouched.
 */
const HOME_SCOPED = new Set([
  "List",
  "RecurringTask",
  "Recipe",
  "RecipeCategory",
  "Invite",
  "User",
]);

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
          if (!HOME_SCOPED.has(model)) return query(args);

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
