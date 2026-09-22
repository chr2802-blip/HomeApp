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
            "MemberExpression[object.name='prisma'][property.name=/^(list|recipe|recipeCategory|task|invite|homeMember|photo)$/]",
          message:
            "Read home-scoped models through homeDb(homeId) so the home cannot be left out. Use prisma directly only where crossing homes is the point.",
        },
        {
          /*
           * User is not home-scoped: somebody belongs to several homes, so there is no
           * homeId on the row for homeDb to carry. A page that asks prisma.user for a
           * home's people is asking for every account on the installation.
           */
          selector: "MemberExpression[object.name='prisma'][property.name='user']",
          message:
            "A user belongs to several homes, so there is no such thing as this home's users. Read the roster as homeDb(homeId).homeMember and the person as an include on it.",
        },
        {
          /*
           * ListItem and ListFavorite carry no homeId, so homeDb would pass a query
           * straight through unscoped — the opposite of the rule above. Both are
           * reached through their list: include them on a list query already made
           * through homeDb. `homeDb` refuses them outright for the same reason, so
           * the advice above would not even have worked.
           */
          selector:
            "MemberExpression[object.name='prisma'][property.name=/^(listItem|listItemSource|listFavorite)$/]",
          message:
            "Read a list's items, the recipes that put them there and its favourites as an include on a homeDb list query. Reaching them directly here would not be scoped to a home at all.",
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
  {
    /*
     * A string written into a screen is a string one of these households cannot read.
     *
     * Nothing derived can catch this: a line in JSX that never reached
     * `src/lib/copy/` is not in any structure a test could walk, and it renders
     * perfectly in English for however long it takes somebody Danish to open that
     * screen. So it is caught where `prisma.list` is caught — by the shape of the
     * syntax, at the moment it is typed.
     *
     * `files` is the frontier, not a style choice: it names exactly the screens and
     * components already converted, and widening it is how the rest of the app gets
     * done. When it reads `src/app/**` and `src/components/**` whole, there is
     * nothing left to convert, and the rule itself says so rather than somebody's
     * count.
     */
    files: [
      "src/app/(app)/layout.tsx",
      "src/app/(app)/pantry/page.tsx",
      "src/app/(app)/lists/page.tsx",
      "src/app/(app)/lists/[id]/page.tsx",
      "src/components/pantry-row.tsx",
      "src/components/add-to-list-menu.tsx",
      "src/components/new-recipe-dialog.tsx",
      "src/components/recipe-import-field.tsx",
      "src/components/home-menu.tsx",
      "src/components/bottom-nav.tsx",
      "src/components/nav-links.tsx",
      "src/components/language-field.tsx",
      "src/components/item-menu.tsx",
      "src/components/confirm-button.tsx",
      "src/components/confirm-dialog.tsx",
      "src/components/modal.tsx",
      "src/components/context-menu.tsx",
      "src/components/list-directory.tsx",
      "src/components/list-items.tsx",
      "src/components/add-item-form.tsx",
      "src/components/amounts-field.tsx",
      "src/components/favorite-button.tsx",
      "src/components/amount-picker.tsx",
      "src/components/queue-status.tsx",
      "src/app/(app)/tasks/page.tsx",
      "src/components/task-card.tsx",
      "src/components/task-done-button.tsx",
      "src/components/task-snooze.tsx",
      "src/components/repeat-field.tsx",
      "src/components/assignee-field.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // Three letters rather than one, so `&nbsp;`, `·`, `%` and an emoji pass.
          selector: "JSXText[value=/[A-Za-z]{3}/]",
          message:
            "Say this through a phrase in src/lib/copy/ — a line written here is English for every household, including the Danish ones.",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(title|label|description|placeholder|message|summaryLabel|submitLabel|pendingLabel|successLabel|hint|aria-label)$/] > Literal[value=/[A-Za-z]{3}/]",
          message:
            "Say this through a phrase in src/lib/copy/. A label passed as a literal is copy wherever it is going.",
        },
      ],
    },
  },
];

export default eslintConfig;
