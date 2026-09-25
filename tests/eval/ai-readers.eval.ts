import { afterAll, describe, expect, it, vi } from "vitest";
import type { HomeLanguage } from "@prisma/client";
import type { RawExtract } from "@/lib/recipe-extract";
import type { StoredStep } from "@/lib/cook";
import { ingredientLines, instructionLines } from "@/lib/recipes";

/**
 * What the two readers make of real recipes, checked against the household's own rules —
 * `npm run eval:ai`, with a real `ANTHROPIC_API_KEY`. See `vitest.eval.config.ts` for why
 * this is not a suite.
 *
 * Each case names the handful of things a cook would notice going wrong, taken from the
 * bullets of `ingredientRules`: a preparation left on its line instead of moved into a
 * step, one ingredient written twice, a heading turned into an errand, a cup that never
 * became metric, a recipe left in the language it arrived in. The checks are loose on
 * purpose — they ask whether a step mentions the cut, never for a sentence — because the
 * model is allowed its own words and the question is only whether it followed the rules.
 *
 * A failure is a finding, not a flake: the same case failing twice in a row is a rule the
 * model does not follow, and the scorecard printed at the end is what a change of model is
 * judged by. `ai-usage` is replaced so nothing here needs a database; the time each call
 * took is measured here instead.
 */

vi.mock("@/lib/ai-usage", () => ({
  recordAiUsage: vi.fn(async () => {}),
  overMonthlyLimit: vi.fn(async () => false),
}));

const { prepareCookSteps } = await import("@/lib/cook-steps");
const { normalizeRecipe } = await import("@/lib/recipe-normalize");

/** What a reading came back as, whichever reader it was. */
type Reading = { ingredients: string; instructions: string; steps: StoredStep[] };

type Case = {
  name: string;
  language: HomeLanguage;
  /** A save reads a recipe typed by hand; an import reads text off a page or a reel. */
  input:
    | { via: "save"; title: string; ingredients: string; instructions: string }
    | { via: "import"; kind: RawExtract["kind"]; text: string };
  /** False for text that is not a recipe, which the importer must refuse. */
  isRecipe?: boolean;
  /** Each appears on exactly one ingredient line — present, and not written twice. */
  once?: string[];
  /** The line naming the first carries the second as its amount. */
  amounts?: [string, string][];
  /** The line naming the ingredient has lost the words; some step now carries them. */
  moved?: { ingredient: string; gone: RegExp; step: RegExp }[];
  /** Never on any ingredient line. */
  neverInIngredients?: RegExp[];
  /** Never anywhere in the recipe. */
  never?: RegExp[];
};

const CASES: Case[] = [
  {
    name: "a hand-typed Danish dinner with its preparation on the lines",
    language: "DA",
    input: {
      via: "save",
      title: "Boller i karry",
      ingredients: [
        "500 g hakket svinekød",
        "1 stort løg, finthakket",
        "2 æg",
        "1 dl mælk",
        "2 spsk karry",
        "2 spsk smør",
        "1 stk æble i tern",
        "Salt og peber efter smag",
      ].join("\n"),
      instructions: [
        "Rør farsen med æg og mælk. Form boller og kog dem i 10 min.",
        "Smelt smørret, svits løg og karry. Tilsæt æblet.",
        "Jævn saucen og smag til.",
      ].join("\n"),
    },
    once: ["svinekød", "løg", "æble", "salt", "peber"],
    moved: [
      { ingredient: "løg", gone: /stor|fint|hakket/i, step: /hak/i },
      { ingredient: "æble", gone: /tern/i, step: /tern/i },
      { ingredient: "salt", gone: /smag/i, step: /smag/i },
    ],
    neverInIngredients: [/\bstk\b/i, /\bog\b/i],
  },
  {
    name: "one ingredient in two components, with headings",
    language: "DA",
    input: {
      via: "save",
      title: "Kanelsnegle",
      ingredients: [
        "Dej:",
        "25 g gær",
        "2,5 dl lunken mælk",
        "100 g smør, smeltet",
        "500 g hvedemel",
        "Fyld:",
        "50 g blødt smør",
        "75 g brun farin",
        "1 spsk kanel",
      ].join("\n"),
      instructions: [
        "Opløs gæren i mælken. Tilsæt smør og mel, og ælt dejen. Lad den hæve i 30 minutter.",
        "Rør smør, farin og kanel sammen. Rul dejen ud, smør fyldet på og rul sammen.",
        "Skær i snegle og bag ved 200 grader i 12 minutter.",
      ].join("\n"),
    },
    once: ["smør", "mælk", "kanel"],
    amounts: [["smør", "150"]],
    moved: [
      { ingredient: "mælk", gone: /lunk/i, step: /lunk/i },
      { ingredient: "smør", gone: /smeltet|blødt/i, step: /smelt/i },
    ],
    neverInIngredients: [/:\s*$/m, /^(dej|fyld)$/im],
  },
  {
    name: "an American page read into a Danish kitchen",
    language: "DA",
    input: {
      via: "import",
      kind: "page",
      text: [
        "Best Chocolate Chip Cookies",
        "Ingredients",
        "1 cup (225g) unsalted butter, softened",
        "2 1/4 cups all-purpose flour",
        "1 1/2 cups semi-sweet chocolate chips",
        "2 large eggs, at room temperature",
        "1 tsp vanilla extract",
        "1/2 tsp salt",
        "Instructions",
        "Preheat the oven to 350°F. Beat the butter until creamy, then beat in the eggs and vanilla.",
        "Stir in the flour and salt, then fold in the chocolate chips.",
        "Bake for 10-12 minutes until golden.",
        "Did you make this recipe? Tag me on Instagram!",
      ].join("\n"),
    },
    once: ["smør", "mel", "æg", "salt"],
    amounts: [["smør", "225"]],
    moved: [
      { ingredient: "smør", gone: /blød|softened/i, step: /blød|stuetemp/i },
      { ingredient: "æg", gone: /stuetemp|room|stor|large/i, step: /stuetemp|stor/i },
    ],
    neverInIngredients: [/\bcups?\b/i, /\boz\b/i, /\btsp\b/i, /[(),]/],
    never: [/instagram|tag me/i, /butter|flour/i],
  },
  {
    name: "a reel caption full of hashtags",
    language: "DA",
    input: {
      via: "import",
      kind: "reel",
      text: [
        "Verdens nemmeste pastaret 🍝🔥 Gem den til senere!",
        "Du skal bruge: 400 g pasta, 1 dåse hakkede tomater, 2-3 fed hvidløg, presset, 1 dl fløde og parmesan til servering.",
        "Kog pastaen. Steg hvidløget i olie, tilsæt tomater og fløde og lad det simre 10 min. Vend pastaen i.",
        "Følg for flere opskrifter 👉 @madmedmig #pasta #aftensmad #nemmad",
      ].join("\n"),
    },
    once: ["pasta", "hakkede tomater", "hvidløg", "parmesan"],
    amounts: [["hvidløg", "3"]],
    moved: [
      { ingredient: "hvidløg", gone: /presse/i, step: /pres/i },
      { ingredient: "parmesan", gone: /servering/i, step: /server/i },
    ],
    never: [/#\w/, /@\w/, /følg for/i, /gem den/i],
  },
  {
    name: "an alternative and a cut, in the importer",
    language: "DA",
    input: {
      via: "import",
      kind: "pasted",
      text: [
        "Carbonara",
        "400 g spaghetti",
        "150 g bacon eller pancetta",
        "1 rødløg i tynde skiver",
        "3 æggeblommer",
        "50 g parmesan, revet",
        "Kog spaghettien. Steg bacon og løg. Pisk blommer og ost og vend det hele sammen væk fra varmen.",
      ].join("\n"),
    },
    once: ["spaghetti", "bacon", "rødløg", "parmesan"],
    moved: [
      { ingredient: "bacon", gone: /pancetta|eller/i, step: /pancetta/i },
      { ingredient: "rødløg", gone: /skive/i, step: /skive/i },
      { ingredient: "parmesan", gone: /revet/i, step: /riv|revet/i },
    ],
  },
  {
    name: "a Danish recipe saved in an English home",
    language: "EN",
    input: {
      via: "save",
      title: "Ovnkartofler",
      ingredients: "1 kg kartofler, skrællede\n2 spsk olivenolie\n1 tsk groft salt",
      instructions: "Skær kartoflerne i både.\nVend dem i olie og salt.\nBag ved 220 grader i 40 minutter.",
    },
    once: ["potato", "olive oil", "salt"],
    moved: [{ ingredient: "potato", gone: /peel/i, step: /peel/i }],
    neverInIngredients: [/\bspsk\b/i, /\btsk\b/i, /kartof/i],
    never: [/kartof|olivenolie|grader/i],
  },
  {
    name: "a caption that is not a recipe",
    language: "DA",
    input: {
      via: "import",
      kind: "reel",
      text: "Dejlig aften i haven med familien ☀️ Grillen var tændt og ungerne løb rundt. #sommer #hygge #familietid",
    },
    isRecipe: false,
  },
];

type Row = { case: string; checks: number; failed: string[]; ms: number };
const scorecard: Row[] = [];

async function read(test: Case): Promise<{ ok: true; reading: Reading } | { ok: false; reason: string }> {
  if (test.input.via === "save") {
    const outcome = await prepareCookSteps(test.input, "eval", test.language);
    return outcome.ok ? { ok: true, reading: outcome } : { ok: false, reason: outcome.reason };
  }
  const raw: RawExtract = {
    kind: test.input.kind,
    sourceUrl: null,
    rawTitle: null,
    rawContent: test.input.text,
    imageUrl: null,
    timeHintMinutes: null,
  };
  const outcome = await normalizeRecipe(raw, "eval", test.language);
  return outcome.ok ? { ok: true, reading: outcome.recipe } : { ok: false, reason: outcome.reason };
}

describe("the AI readers, against the household's rules", () => {
  it("has a key to call the real API with", () => {
    // Failed rather than skipped: an eval that quietly skipped reads as one that passed.
    expect(process.env.ANTHROPIC_API_KEY, "set ANTHROPIC_API_KEY (in .env or the environment)").toBeTruthy();
  });

  for (const test of CASES) {
    it.skipIf(!process.env.ANTHROPIC_API_KEY)(test.name, async () => {
      const failed: string[] = [];
      let checks = 0;
      const check = (label: string, passed: boolean) => {
        checks++;
        if (!passed) failed.push(label);
        expect.soft(passed, label).toBe(true);
      };

      const started = performance.now();
      const outcome = await read(test);
      const ms = Math.round(performance.now() - started);

      if (test.isRecipe === false) {
        check("refused as not a recipe", !outcome.ok && outcome.reason === "not-a-recipe");
        scorecard.push({ case: test.name, checks, failed, ms });
        return;
      }

      check(`read at all (${outcome.ok ? "ok" : outcome.reason})`, outcome.ok);
      if (!outcome.ok) {
        scorecard.push({ case: test.name, checks, failed, ms });
        return;
      }

      const { ingredients, instructions, steps } = outcome.reading;
      const lines = ingredientLines(ingredients);
      const stepLines = instructionLines(instructions);
      const naming = (word: string) => lines.filter((line) => line.toLowerCase().includes(word.toLowerCase()));

      check("one breakdown entry per step", steps.length === stepLines.length);
      lines.forEach((line, index) => {
        check(`"${line}" is used by some step`, steps.some((step) => step.uses.includes(index)));
      });
      for (const word of test.once ?? []) {
        const found = naming(word);
        check(`"${word}" on exactly one line (found ${found.length}: ${found.join(" | ")})`, found.length === 1);
      }
      for (const [word, amount] of test.amounts ?? []) {
        check(`"${word}" reads ${amount}`, naming(word).some((line) => line.includes(amount)));
      }
      for (const { ingredient, gone, step } of test.moved ?? []) {
        const line = naming(ingredient)[0] ?? "";
        check(`"${ingredient}" line lost ${gone}`, Boolean(line) && !gone.test(line));
        check(`a step carries ${step} for "${ingredient}"`, stepLines.some((text) => step.test(text)));
      }
      for (const pattern of test.neverInIngredients ?? []) {
        check(`no ingredient line matches ${pattern}`, !lines.some((line) => pattern.test(line)));
      }
      for (const pattern of test.never ?? []) {
        check(`nothing matches ${pattern}`, !pattern.test(`${ingredients}\n${instructions}`));
      }

      if (failed.length) {
        console.log(`\n── ${test.name}\n${ingredients}\n\n${instructions}\n`);
      }
      scorecard.push({ case: test.name, checks, failed, ms });
    });
  }

  afterAll(() => {
    if (!scorecard.length) return;
    const total = scorecard.reduce((sum, row) => sum + row.checks, 0);
    const failed = scorecard.reduce((sum, row) => sum + row.failed.length, 0);
    const times = scorecard.map((row) => row.ms).sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];

    console.log("\nAI readers — scorecard");
    for (const row of scorecard) {
      const mark = row.failed.length ? "✗" : "✓";
      console.log(`${mark} ${row.case} — ${row.checks - row.failed.length}/${row.checks}, ${row.ms} ms`);
      for (const label of row.failed) console.log(`    ✗ ${label}`);
    }
    console.log(`\n${total - failed}/${total} checks passed. Median call ${median} ms, slowest ${times.at(-1)} ms.\n`);
  });
});
