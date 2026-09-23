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

const { MAX_INPUT_CHARS, prepareCookSteps, stepRules } = await import("@/lib/cook-steps");
const { normalizeRecipe } = await import("@/lib/recipe-normalize");
const { ingredientRules, languageRules } = await import("@/lib/ingredient-line");

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

    const [save, importer] = parse.mock.calls.map(
      (call) => (call[0].system as [{ text: string }])[0].text,
    );
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
});
