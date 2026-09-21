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
    { name: "pasta", amount: 400, unit: "g", preparation: null, note: null, group: null },
    { name: "kyllingebryst", amount: 500, unit: "g", preparation: "i strimler", note: null, group: null },
    { name: "fløde", amount: 2, unit: "dl", preparation: null, note: null, group: null },
    { name: "salt", amount: null, unit: null, preparation: null, note: "efter smag", group: null },
  ],
  instructions: [
    { step: "Kog pastaen.", component: null },
    { step: "Steg kyllingen.", component: null },
  ],
  needsReview: false,
  reviewReason: null,
};

/** The marker a test puts in its text when it wants the other answer. */
const NOT_A_RECIPE = "aften i haven";

/** And the one that asks for a recipe worth checking over. */
const NEEDS_REVIEW = "resten i bio";

function answer(sent) {
  if (sent.includes(NOT_A_RECIPE)) {
    return { ...RECIPE, isRecipe: false, ingredients: [], instructions: [] };
  }
  if (sent.includes(NEEDS_REVIEW)) {
    return { ...RECIPE, needsReview: true, reviewReason: "Resten af opskriften står i profilen." };
  }
  return RECIPE;
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
      model: "claude-sonnet-5",
      content: [{ type: "text", text: JSON.stringify(answer(sent)) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    response.writeHead(200, { "content-type": "application/json" }).end(body);
  });
}).listen(port, "127.0.0.1");
