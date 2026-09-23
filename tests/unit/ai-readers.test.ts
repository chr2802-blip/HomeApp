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

const { MAX_INPUT_CHARS, prepareCookSteps } = await import("@/lib/cook-steps");
const { normalizeRecipe } = await import("@/lib/recipe-normalize");

const answer = (stopReason: string) => ({
  parsed_output: { steps: [{ step: "Bland.", uses: [0], minutes: null }] },
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

    const outcome = await prepareCookSteps(recipe(long), "home");

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("sends instructions exactly at the limit, and sends them whole", async () => {
    parse.mockResolvedValue(answer("end_turn"));
    const atLimit = "a".repeat(MAX_INPUT_CHARS);

    const outcome = await prepareCookSteps(recipe(atLimit), "home");

    expect(outcome.ok).toBe(true);
    const sent = parse.mock.calls[0]![0].messages[0].content as string;
    expect(sent).toContain(atLimit);
  });

  it("refuses an answer that ran out of room, however well it parsed", async () => {
    parse.mockResolvedValue(answer("max_tokens"));

    const outcome = await prepareCookSteps(recipe("Ælt.\nBag."), "home");

    expect(outcome).toEqual({ ok: false, reason: "unavailable" });
  });

  it("takes an answer that finished", async () => {
    parse.mockResolvedValue(answer("end_turn"));

    const outcome = await prepareCookSteps(recipe("Ælt.\nBag."), "home");

    expect(outcome).toEqual({ ok: true, instructions: "Bland.", steps: [{ uses: [0], minutes: null }] });
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
    expect(await prepareCookSteps(recipe("Ælt.\nBag."), "home")).toEqual({
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
