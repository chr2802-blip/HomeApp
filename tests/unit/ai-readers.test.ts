import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The two model readers' own guards, with the SDK replaced — kept apart from
 * `cook-steps.test.ts` and `recipe-normalize.test.ts` because those hand the real schemas
 * to the real converter, and a module mock here would reach them too.
 *
 * The first thing held is the one way preparing a recipe can destroy it. The answer is written
 * back over `Recipe.instructions`, so an answer about *part* of a recipe deletes the rest on
 * save, and nothing downstream can tell: the steps and the breakdown agree with each other
 * perfectly. Both ways to get such an answer are refused here — a recipe too long to send
 * whole, and an answer that ran out of room.
 */

const parse = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class AnthropicError extends Error {}
  class APIError extends AnthropicError {}
  class Anthropic {
    static AnthropicError = AnthropicError;
    static APIError = APIError;
    messages = { parse };
  }
  return { default: Anthropic };
});

const overMonthlyLimit = vi.fn();
vi.mock("@/lib/ai-usage", () => ({ recordAiUsage: vi.fn(), overMonthlyLimit }));

const { MAX_INPUT_CHARS, PREPARE_MAX_RETRIES, PREPARE_TIMEOUT_MS, prepareCookSteps, stepRules } = await import(
  "@/lib/cook-steps"
);
const { NORMALIZE_MAX_RETRIES, NORMALIZE_TIMEOUT_MS, normalizeRecipe } = await import("@/lib/recipe-normalize");
const { ingredientRules, languageRules } = await import("@/lib/ingredient-line");
const { sortPantryGoods, MAX_GOODS_PER_SORT } = await import("@/lib/pantry-sort");
// The real price table, beside the mock above. Loaded here rather than inside the test that
// uses it: it drags in the generated Prisma client, and a cold import of that inside a test
// body counts against the test's own 5s — which a busy Vercel build machine ran past.
const { costMicros } = await vi.importActual<typeof import("@/lib/ai-usage")>("@/lib/ai-usage");

const answer = (stopReason: string) => ({
  parsed_output: { title: null, ingredients: [{ name: "mel" }], steps: [{ step: "Bland.", uses: [0], minutes: null }] },
  stop_reason: stopReason,
  usage: { input_tokens: 100, output_tokens: 50 },
});

const recipe = (instructions: string) => ({ title: "Brød", ingredients: "Mel", instructions });

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  parse.mockReset();
  overMonthlyLimit.mockReset();
  overMonthlyLimit.mockResolvedValue(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("what the reader will not answer for", () => {
  it("never sends instructions longer than it may, rather than sending the start of them", async () => {
    const long = `${"Ælt dejen grundigt. ".repeat(Math.ceil(MAX_INPUT_CHARS / 20))}\nBag i 40 minutter.`;
    expect(long.length).toBeGreaterThan(MAX_INPUT_CHARS);

    const outcome = await prepareCookSteps(recipe(long), "home", "DA");

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("sends instructions exactly at the limit, and sends them whole", async () => {
    parse.mockResolvedValue(answer("end_turn"));
    // Ingredients and instructions count together, since both are written back.
    const atLimit = "a".repeat(MAX_INPUT_CHARS - "Mel".length);

    const outcome = await prepareCookSteps(recipe(atLimit), "home", "DA");

    expect(outcome.ok).toBe(true);
    const sent = parse.mock.calls[0]![0].messages[0].content as string;
    expect(sent).toContain(atLimit);
  });

  it("refuses an answer that ran out of room, however well it parsed", async () => {
    parse.mockResolvedValue(answer("max_tokens"));

    const outcome = await prepareCookSteps(recipe("Ælt.\nBag."), "home", "DA");

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  it("takes an answer that finished", async () => {
    parse.mockResolvedValue(answer("end_turn"));

    const outcome = await prepareCookSteps(recipe("Ælt.\nBag."), "home", "DA");

    expect(outcome).toEqual({
      ok: true,
      title: "Brød",
      ingredients: "mel",
      instructions: "Bland.",
      steps: [{ uses: [0], minutes: null }],
    });
  });

  it("never sends ingredients and instructions that together are longer than it may", async () => {
    const outcome = await prepareCookSteps(
      { title: "Brød", ingredients: "m".repeat(MAX_INPUT_CHARS), instructions: "Bag." },
      "home",
      "DA",
    );

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
    expect(parse).not.toHaveBeenCalled();
  });

  // Written back, an answer with the ingredients missing would delete them from the recipe.
  it("refuses an answer that lost every ingredient the recipe had", async () => {
    parse.mockResolvedValue({ ...answer("end_turn"), parsed_output: { ingredients: [], steps: [{ step: "Bland.", uses: [] }] } });

    const outcome = await prepareCookSteps(recipe("Ælt.\nBag."), "home", "DA");

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  it("reads a recipe with ingredients and no steps yet, rather than skipping it", async () => {
    parse.mockResolvedValue({ ...answer("end_turn"), parsed_output: { ingredients: [{ name: "mel" }], steps: [] } });

    const outcome = await prepareCookSteps(recipe(""), "home", "DA");

    expect(outcome).toMatchObject({ ok: true, ingredients: "mel", instructions: "" });
    expect(parse).toHaveBeenCalledOnce();
  });
});

/*
 * "One way" for every recipe, however it arrived: the importer and the save are two
 * model calls, and the only thing that makes their ingredient lines the same shape is
 * that both are handed the same rules. So that is held here, word for word.
 */
describe("the ingredient rules", () => {
  it("are the same words in the importer's prompt and the save's", async () => {
    parse.mockResolvedValue(answer("end_turn"));
    await prepareCookSteps(recipe("Ælt."), "home", "DA");
    parse.mockResolvedValue({ ...answer("end_turn"), parsed_output: null });
    await normalizeRecipe(
      { kind: "pasted", sourceUrl: null, rawTitle: null, rawContent: "Mel", imageUrl: null, timeHintMinutes: null },
      "home",
      "DA",
    );

    const [save, importer] = parse.mock.calls.map((call) => call[0].system as string);
    expect(save).toContain(ingredientRules());
    expect(importer).toContain(ingredientRules());
    expect(save).toContain(languageRules("DA"));
    expect(importer).toContain(languageRules("DA"));
    // The importer answers the breakdown too, so an import saved untouched can be stored
    // as it was read — which is only the same answer if it was asked the same way.
    expect(save).toContain(stepRules());
    expect(importer).toContain(stepRules());
  });
});

/*
 * The monthly limit is asked inside each reader rather than at each action, so these two
 * are the whole of the proof that no way into the model forgot to ask: every action that
 * spends goes through one of these functions.
 */
describe("a home past its month's allowance", () => {
  beforeEach(() => overMonthlyLimit.mockResolvedValue(true));

  it("gets no preparing, and is told why rather than that the reader is down", async () => {
    expect(await prepareCookSteps(recipe("Ælt.\nBag."), "home", "DA")).toEqual({
      ok: false,
      reason: "over-limit",
    });
    expect(overMonthlyLimit).toHaveBeenCalledWith("home");
    expect(parse).not.toHaveBeenCalled();
  });

  it("gets no importing either", async () => {
    const raw = { kind: "pasted" as const, sourceUrl: null, rawTitle: null, rawContent: "Mel og vand", imageUrl: null, timeHintMinutes: null };

    expect(await normalizeRecipe(raw, "home", "DA")).toEqual({ ok: false, reason: "over-limit" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("gets no pantry sorting either", async () => {
    expect(await sortPantryGoods(["Gochujang"], "home")).toEqual({ ok: false, reason: "over-limit" });
    expect(parse).not.toHaveBeenCalled();
  });
});

describe("the pantry's shelf reader", () => {
  it("sends every good numbered in one call, and never more than it may", async () => {
    parse.mockResolvedValue({
      parsed_output: { goods: [{ index: 0, category: "SAUCES" }] },
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });
    const names = Array.from({ length: MAX_GOODS_PER_SORT + 5 }, (_, i) => `Vare ${i}`);

    const outcome = await sortPantryGoods(names, "home");

    expect(outcome).toEqual({ ok: true, categories: new Map([[0, "SAUCES"]]) });
    expect(parse).toHaveBeenCalledTimes(1);
    const sent = parse.mock.calls[0]![0].messages[0].content as string;
    expect(sent).toContain(`${MAX_GOODS_PER_SORT - 1}. Vare ${MAX_GOODS_PER_SORT - 1}`);
    expect(sent).not.toContain(`Vare ${MAX_GOODS_PER_SORT}`);
  });

  it("asks nothing about nothing", async () => {
    expect(await sortPantryGoods([], "home")).toEqual({ ok: true, categories: new Map() });
    expect(overMonthlyLimit).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
  });

  it("answers as down, rather than throwing, when the API will not answer", async () => {
    parse.mockRejectedValue(new Error("boom"));
    expect(await sortPantryGoods(["Panko"], "home")).toEqual({ ok: false, reason: "unavailable" });
  });
});

/*
 * What goes on the wire, for the one thing the e2e stub can never tell us: whether the
 * real API accepts it. Haiku 4.5 answers `output_config.effort` with a 400 and has no
 * adaptive thinking, so both readers must send neither. And a model this app has never
 * priced is billed at nothing, which would quietly switch off the monthly limit.
 */
describe("the request every reader sends", () => {
  it("names a priced model, and carries no thinking and no effort", async () => {
    parse.mockResolvedValue(answer("end_turn"));
    await prepareCookSteps(recipe("Ælt."), "home", "DA");
    parse.mockResolvedValue({ ...answer("end_turn"), parsed_output: null });
    await normalizeRecipe(
      { kind: "pasted", sourceUrl: null, rawTitle: null, rawContent: "Mel", imageUrl: null, timeHintMinutes: null },
      "home",
      "DA",
    );
    parse.mockResolvedValue({ ...answer("end_turn"), parsed_output: { goods: [] } });
    await sortPantryGoods(["Panko"], "home");

    expect(parse).toHaveBeenCalledTimes(3);
    for (const [request] of parse.mock.calls) {
      expect(costMicros(request.model, 1_000_000, 0)).toBeGreaterThan(0);
      expect(request.thinking).toBeUndefined();
      expect(request.output_config.effort).toBeUndefined();
    }
  });
});

const pasted = (rawContent: string) => ({
  kind: "pasted" as const,
  sourceUrl: null,
  rawTitle: null,
  rawContent,
  imageUrl: null,
  timeHintMinutes: null,
});

describe("the importer's own answer", () => {
  // An import saved untouched is stored as the importer read it (`reading-token.ts`), so
  // an answer that stopped short would be a recipe missing its end, stored.
  it("is refused when it ran out of room, however well it parsed", async () => {
    parse.mockResolvedValue({
      parsed_output: {
        isRecipe: true,
        title: "Brød",
        ingredients: [{ name: "mel" }],
        instructions: [{ step: "Bland.", uses: [0], minutes: null }],
        needsReview: false,
      },
      stop_reason: "max_tokens",
      usage: { input_tokens: 100, output_tokens: 8000 },
    });

    expect(await normalizeRecipe(pasted("Mel. Bland."), "home", "DA")).toEqual({ ok: false, reason: "unavailable" });
  });
});

/**
 * A reader that is not answering is meant to degrade — the save stores the recipe as
 * written, the import offers the paste box. That only happens if the request is still
 * alive to say so: past the route's `maxDuration` the platform cuts it off, and a
 * hand-typed recipe is lost to an error screen. The client retries a timeout, so a stuck
 * call costs its timeout once per attempt, and an import has already spent its page
 * fetches — one for a page, one per caption source for a reel — before it asks.
 */
describe("the worst case fits inside the route", () => {
  const routes = [
    "src/app/(app)/recipes/page.tsx",
    "src/app/(app)/recipes/new/page.tsx",
    "src/app/(app)/recipes/[id]/page.tsx",
    "src/app/(app)/recipes/[id]/edit/page.tsx",
    "src/app/(app)/recipes/[id]/cook/page.tsx",
  ];
  /** What is left for the database, the picture's store and the answer's way home. */
  const HEADROOM_MS = 5_000;

  async function shortestBudgetMs() {
    const { readFile } = await import("node:fs/promises");
    const seconds = await Promise.all(
      routes.map(async (file) => {
        const match = /export const maxDuration = (\d+);/.exec(await readFile(file, "utf8"));
        expect(match, `${file} sets no maxDuration`).not.toBeNull();
        return Number(match![1]);
      }),
    );
    return Math.min(...seconds) * 1000;
  }

  it("for a save, or the prepare button", async () => {
    const worst = PREPARE_TIMEOUT_MS * (PREPARE_MAX_RETRIES + 1);
    expect(worst + HEADROOM_MS).toBeLessThanOrEqual(await shortestBudgetMs());
  });

  it("for an import from a reel, which asks every caption source first", async () => {
    const { FETCH_TIMEOUT_MS } = await import("@/lib/recipe-import");
    const { captionSources } = await import("@/lib/reel-import");
    const sources = Math.max(
      captionSources("https://www.instagram.com/reel/ABC123/").length,
      captionSources("https://www.tiktok.com/@cook/video/123").length,
    );
    const worst = sources * FETCH_TIMEOUT_MS + NORMALIZE_TIMEOUT_MS * (NORMALIZE_MAX_RETRIES + 1);
    expect(worst + HEADROOM_MS).toBeLessThanOrEqual(await shortestBudgetMs());
  });
});
