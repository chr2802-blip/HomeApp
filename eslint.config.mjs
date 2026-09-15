import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    // Playwright fixtures take a callback named `use`, which the React Hooks rule
    // mistakes for a hook call. There is no React in these files.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    /*
     * Pages are where a new feature gets written, and where a forgotten
     * `where: { homeId }` would quietly show one household another's data. They read
     * home-scoped models through `homeDb`, which carries the home for them.
     *
     * Deliberately narrow: actions and lib code is written by someone already thinking
     * about scoping, and the reminder job has to read across homes on purpose.
     */
    files: ["src/app/**/page.tsx", "src/app/**/layout.tsx", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='prisma'][property.name=/^(list|listItem|recipe|recipeCategory|task|invite|user|photo)$/]",
          message:
            "Read home-scoped models through homeDb(homeId) so the home cannot be left out. Use prisma directly only where crossing homes is the point.",
        },
        {
          /*
           * ListFavorite carries no homeId, so homeDb would pass a query straight
           * through unscoped — the opposite of the rule above. It is reached through
           * its list: include it on a list query already made through homeDb.
           */
          selector: "MemberExpression[object.name='prisma'][property.name='listFavorite']",
          message:
            "Read favourites as an include on a homeDb list query. prisma.listFavorite here would not be scoped to a home at all.",
        },
        {
          /*
           * RecipeCategoryLink carries no homeId either, for the same reason and with
           * the same consequence: it is reached through its recipe.
           */
          selector: "MemberExpression[object.name='prisma'][property.name='recipeCategoryLink']",
          message:
            "Read a recipe's categories as an include on a homeDb recipe query. prisma.recipeCategoryLink here would not be scoped to a home at all.",
        },
      ],
    },
  },
];

export default eslintConfig;
