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
            "MemberExpression[object.name='prisma'][property.name=/^(list|listItem|recipe|recurringTask|invite|user)$/]",
          message:
            "Read home-scoped models through homeDb(homeId) so the home cannot be left out. Use prisma directly only where crossing homes is the point.",
        },
      ],
    },
  },
];

export default eslintConfig;
