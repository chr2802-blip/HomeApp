import { createServer } from "node:http";

/**
 * A stand-in for the Messages API, so the browser suite can drive a whole import.
 *
 * The importer's second stage is a model call, and there are only ever three ways to test
 * a browser flow that ends in one: let it run (a test of somebody else's uptime, billed by
 * the token, and different every time), assert only the failures (which is what the suite
 * did while the key was simply absent, and leaves the successful path — the form filling
 * itself — with no browser coverage at all), or answer it here. This is the third.
 *
 * It is a stub and not a fake: it does not read anything. It looks for one marker in the
 * text it was sent and otherwise hands back the same recipe every time, because what is
 * being tested on the far side of it is the wiring — that the request is built, the answer
 * parsed, the lines rendered, and the create form opened with them in it — and not the
 * reading, which is `tests/unit/recipe-normalize.test.ts`'s and the model's between them.
 *
 * Structured output comes back as an ordinary text block whose text is the JSON; the SDK
 * parses that against the schema on this side of the wire. So there is no exotic shape to
 * imitate here, which is the reason this is worth having rather than a source of its own
 * flakiness.
 */

const port = Number(process.argv[2]);
if (!Number.isInteger(port)) throw new Error("usage: anthropic-stub.mjs <port>");

/** The one recipe this stub knows, chosen to exercise every part of the render. */
const RECIPE = {
  isRecipe: true,
  title: "Cremet pasta med kylling",
  totalTimeMinutes: 25,
  ingredients: [
    { name: "pasta", amount: 400, unit: "g" },
    { name: "kyllingebryst", amount: 500, unit: "g" },
    { name: "fløde", amount: 2, unit: "dl" },
    { name: "salt", amount: null, unit: null },
  ],
  instructions: [
    { step: "Kog pastaen.", uses: [0], minutes: 10 },
    { step: "Skær kyllingebrystet i strimler, og steg det.", uses: [1, 2], minutes: null },
    { step: "Smag til med salt.", uses: [3], minutes: null },
  ],
  needsReview: false,
  reviewReason: null,
};

/**
 * The other question this stub is asked: reading a recipe as it is saved — its ingredient
 * lines and its steps for action mode (`src/lib/cook-steps.ts`). It is told apart from an import by the schema the
 * request asks for — only the importer's mentions `isRecipe`.
 *
 * Here the stub **echoes rather than answers**, and that is deliberate. Every recipe
 * saved anywhere in this suite now goes through this call, and a fixed reply would
 * silently rewrite each of their steps into somebody else's — `recipes.spec.ts` asserts
 * the text it typed is on the page afterwards, and it should. So the steps come back
 * exactly as they were sent, which is still the whole wiring under test: the request
 * built, the answer parsed, the breakdown stored and read back under each step.
 *
 * The ingredients echo too, with one piece of the real contract imitated: whatever
 * follows a comma is not the thing bought, so it is dropped here as the model would move
 * it into a step. The rest comes back as the name, measure and all — `renderIngredient`
 * writes it out unchanged, so a line a test typed as "250 g carrots, grated" is stored as
 * "250 g carrots", which is what the shopping list would have made of it either way.
 *
 * The parts it does invent are deterministic and minimal: step *n* uses ingredient *n*
 * where there is one, so a test can assert a particular line under a particular step, and
 * the first step carries a ten-minute timer so there is a chip to press.
 */
function preparedSteps(sent) {
  const request = JSON.parse(sent);
  const text = request.messages?.[0]?.content ?? "";

  const fenced = (start, end) => {
    const from = text.indexOf(start);
    const to = text.indexOf(end);
    return from === -1 || to === -1
      ? []
      : text
          .slice(from + start.length, to)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
  };

  const ingredients = fenced("--- INGREDIENTS AS WRITTEN ---", "--- END INGREDIENTS ---").filter(
    (line) => line !== "(none listed)",
  );
  const steps = fenced("--- INSTRUCTIONS AS WRITTEN ---", "--- END INSTRUCTIONS ---");

  return {
    title: null,
    ingredients: ingredients.map((line) => ({
      name: line.split(",")[0].trim(),
      amount: null,
      unit: null,
    })),
    steps: steps.map((step, index) => ({
      step,
      uses: index < ingredients.length ? [index] : [],
      minutes: index === 0 ? 10 : null,
    })),
  };
}

/**
 * The other language's recipe, answered when the system prompt's own `### Language`
 * section asked for English rather than Danish.
 *
 * This proves only that the right instruction reached the API — the literal sentence
 * `languageRules(language)` writes when `language` is `"EN"` — never that a model
 * translates anything. Nothing here reads the raw text being imported, so it cannot
 * prove a Danish source became this English recipe; that half is deterministic and
 * proved properly by `tests/unit/ingredient-line.test.ts`'s `SAME_MEASURE` and
 * amount cases, which need no server at all.
 */
const RECIPE_EN = {
  isRecipe: true,
  title: "Creamy chicken pasta",
  totalTimeMinutes: 25,
  ingredients: [
    { name: "pasta", amount: 400, unit: "g" },
    { name: "chicken breast", amount: 500, unit: "g" },
    { name: "cream", amount: 2, unit: "dl" },
    { name: "salt", amount: null, unit: null },
  ],
  instructions: [
    { step: "Cook the pasta.", uses: [0], minutes: 10 },
    { step: "Slice the chicken and fry it.", uses: [1, 2], minutes: null },
    { step: "Season with salt to taste.", uses: [3], minutes: null },
  ],
  needsReview: false,
  reviewReason: null,
};

/** The marker a test puts in its text when it wants the other answer. */
const NOT_A_RECIPE = "aften i haven";

/** And the one that asks for a recipe worth checking over. */
const NEEDS_REVIEW = "resten i bio";

/**
 * The third question: which shelf each of a household's unsorted pantry goods sits on
 * (`src/lib/pantry-sort.ts`), told apart by the fenced list its message sends. Every good
 * goes on the sauces shelf, whatever it is: only names the free list in `pantry-goods.ts`
 * does not know are ever sent here, so a test adding one sees it arrive on that shelf.
 */
function sortedGoods(sent) {
  const request = JSON.parse(sent);
  const text = request.messages?.[0]?.content ?? "";
  const from = text.indexOf("--- GOODS ---");
  const to = text.indexOf("--- END GOODS ---");
  const lines = from === -1 || to === -1 ? [] : text.slice(from, to).split("\n").slice(1).filter(Boolean);
  return { goods: lines.map((_, index) => ({ index, category: "SAUCES" })) };
}

function answer(sent) {
  if (sent.includes("--- GOODS ---")) return sortedGoods(sent);

  // Only the importer's schema names `isRecipe`, so its presence in the request is what
  // says which of the two questions this is.
  if (!sent.includes("isRecipe")) return preparedSteps(sent);

  // The exact sentence `languageRules` in src/lib/ingredient-line.ts writes for
  // English — see the doc comment on RECIPE_EN for what finding it does and does not
  // prove.
  const recipe = sent.includes("Write the recipe in English") ? RECIPE_EN : RECIPE;

  if (sent.includes(NOT_A_RECIPE)) {
    return { ...recipe, isRecipe: false, ingredients: [], instructions: [] };
  }
  if (sent.includes(NEEDS_REVIEW)) {
    return {
      ...recipe,
      needsReview: true,
      reviewReason:
        recipe === RECIPE_EN
          ? "The rest of the recipe is in the profile."
          : "Resten af opskriften står i profilen.",
    };
  }
  return recipe;
}

createServer((request, response) => {
  if (request.method !== "POST" || !request.url?.startsWith("/v1/messages")) {
    response.writeHead(404).end();
    return;
  }

  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const sent = Buffer.concat(chunks).toString("utf8");
    const body = JSON.stringify({
      id: "msg_stub",
      type: "message",
      role: "assistant",
      model: "claude-haiku-4-5",
      content: [{ type: "text", text: JSON.stringify(answer(sent)) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    response.writeHead(200, { "content-type": "application/json" }).end(body);
  });
}).listen(port, "127.0.0.1");
