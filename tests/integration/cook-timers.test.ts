import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendPushToUsers = vi.hoisted(() => vi.fn(async () => 1));
vi.mock("@/lib/push", () => ({ sendPushToUsers }));

// QStash itself is a service somebody else runs: the tests hold what this app asks of
// it and what it does with what comes back, never whether QStash keeps its word.
const qstash = vi.hoisted(() => ({
  publishJSON: vi.fn<(request: unknown) => Promise<{ messageId: string }>>(async () => ({
    messageId: "msg_1",
  })),
  get: vi.fn<(id: string) => Promise<{ body?: string }>>(async () => ({ body: "" })),
  cancel: vi.fn<(id: string) => Promise<{ cancelled: number }>>(async () => ({ cancelled: 1 })),
  verify: vi.fn<(request: unknown) => Promise<boolean>>(async () => true),
}));
vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = qstash.publishJSON;
    messages = { get: qstash.get, cancel: qstash.cancel };
  },
  Receiver: class {
    verify = qstash.verify;
  },
}));

const { prisma } = await import("@/lib/prisma");
const { POST, DELETE } = await import("@/app/api/cook-timers/route");
const { POST: RING } = await import("@/app/api/cook-timers/ring/route");
const { STALE_AFTER_MS, MAX_TIMER_MS, readTimerRequest, ringUrl } = await import(
  "@/lib/cook-timer-push"
);
const { createHome, createHomeWithMembers, createRecipe, createUser, signIn, signOut } =
  await import("../helpers/factories");

const MINUTE = 60_000;

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let recipe: Awaited<ReturnType<typeof createRecipe>>;

function subscribe(userId: string) {
  return prisma.pushSubscription.create({
    data: { userId, endpoint: `https://push.example.test/${userId}`, p256dh: "p", auth: "a" },
  });
}

function schedule(body: unknown) {
  return POST(
    new Request("http://localhost/api/cook-timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function cancel(ids: unknown) {
  return DELETE(
    new Request("http://localhost/api/cook-timers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  );
}

function ring(body: unknown, signature: string | null = "signed") {
  return RING(
    new Request("http://localhost/api/cook-timers/ring", {
      method: "POST",
      headers: signature ? { "upstash-signature": signature } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  vi.stubEnv("QSTASH_TOKEN", "token");
  vi.stubEnv("QSTASH_CURRENT_SIGNING_KEY", "current");
  vi.stubEnv("QSTASH_NEXT_SIGNING_KEY", "next");
  vi.stubEnv("APP_URL", "https://homehub.example.test");
  for (const mock of [sendPushToUsers, ...Object.values(qstash)]) mock.mockClear();
  qstash.verify.mockResolvedValue(true);
  qstash.publishJSON.mockResolvedValue({ messageId: "msg_1" });

  ({ home, member } = await createHomeWithMembers());
  recipe = await createRecipe({ homeId: home.id, createdById: member.id, title: "Risotto" });
  await signIn(member);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("starting a timer", () => {
  it("asks QStash to call back at the timer's end, carrying who and what", async () => {
    await subscribe(member.id);
    const endsAt = Date.now() + 10 * MINUTE + 400;

    const response = await schedule({ recipeId: recipe.id, step: 2, endsAt, portions: 6 });

    expect(await response.json()).toEqual({ id: "msg_1", available: true });
    expect(qstash.publishJSON).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://homehub.example.test/api/cook-timers/ring",
        // Rounded up: a second late is a timer, a second early rang before the page said so.
        notBefore: Math.ceil(endsAt / 1000),
        body: { userId: member.id, recipeId: recipe.id, step: 2, endsAt, portions: 6 },
      }),
    );
  });

  it("spends nothing on somebody with no device to ring", async () => {
    const response = await schedule({ recipeId: recipe.id, step: 0, endsAt: Date.now() + MINUTE });

    expect(await response.json()).toEqual({ id: null, available: true });
    expect(qstash.publishJSON).not.toHaveBeenCalled();
  });

  it("is off, and says so, where QStash is not configured", async () => {
    await subscribe(member.id);
    vi.stubEnv("QSTASH_TOKEN", "");

    const response = await schedule({ recipeId: recipe.id, step: 0, endsAt: Date.now() + MINUTE });

    expect(await response.json()).toEqual({ id: null, available: false });
    expect(qstash.publishJSON).not.toHaveBeenCalled();
  });

  it("is a timer that rings in the page only when QStash will not answer", async () => {
    await subscribe(member.id);
    qstash.publishJSON.mockRejectedValueOnce(new Error("503"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const response = await schedule({ recipeId: recipe.id, step: 0, endsAt: Date.now() + MINUTE });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: null, available: true });
  });

  it("finds nothing for another home's recipe", async () => {
    await subscribe(member.id);
    const other = await createHome();
    const cook = await createUser({ homeId: other.id });
    const theirs = await createRecipe({ homeId: other.id, createdById: cook.id });

    const response = await schedule({ recipeId: theirs.id, step: 0, endsAt: Date.now() + MINUTE });

    expect(response.status).toBe(404);
    expect(qstash.publishJSON).not.toHaveBeenCalled();
  });

  it("refuses somebody who is not signed in", async () => {
    signOut();
    const response = await schedule({ recipeId: recipe.id, step: 0, endsAt: Date.now() + MINUTE });
    expect(response.status).toBe(401);
  });
});

describe("reading what a browser asked for", () => {
  const now = 1_000_000;

  it("takes a timer still to come, up to a day", () => {
    expect(readTimerRequest({ recipeId: "r", step: 0, endsAt: now + MAX_TIMER_MS }, now)).toEqual({
      recipeId: "r",
      step: 0,
      endsAt: now + MAX_TIMER_MS,
      portions: null,
    });
  });

  it.each([
    ["already over", { recipeId: "r", step: 0, endsAt: now }],
    ["further than a day", { recipeId: "r", step: 0, endsAt: now + MAX_TIMER_MS + 1 }],
    ["a negative step", { recipeId: "r", step: -1, endsAt: now + MINUTE }],
    ["a fractional step", { recipeId: "r", step: 1.5, endsAt: now + MINUTE }],
    ["no recipe", { step: 0, endsAt: now + MINUTE }],
    ["an end that is not a number", { recipeId: "r", step: 0, endsAt: "soon" }],
  ])("refuses %s", (_name, body) => {
    expect(readTimerRequest(body, now)).toBeNull();
  });

  it("reads nonsense portions as the recipe as written", () => {
    expect(readTimerRequest({ recipeId: "r", step: 0, endsAt: now + 1, portions: 0 }, now)?.portions).toBeNull();
  });
});

describe("where QStash is told to call", () => {
  it("prefers APP_URL, then the production address Vercel names, then the request", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "home.vercel.app");
    expect(ringUrl("http://localhost:3000/x")).toBe("https://homehub.example.test/api/cook-timers/ring");
    vi.stubEnv("APP_URL", "");
    expect(ringUrl("http://localhost:3000/x")).toBe("https://home.vercel.app/api/cook-timers/ring");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(ringUrl("http://localhost:3000/x")).toBe("http://localhost:3000/api/cook-timers/ring");
  });
});

describe("stopping a timer", () => {
  it("cancels a message that is the caller's own", async () => {
    qstash.get.mockResolvedValueOnce({ body: JSON.stringify({ userId: member.id }) });

    await cancel(["msg_1"]);

    expect(qstash.cancel).toHaveBeenCalledWith("msg_1");
  });

  it("leaves another person's timer alone", async () => {
    qstash.get.mockResolvedValueOnce({ body: JSON.stringify({ userId: "somebody-else" }) });

    await cancel(["msg_1"]);

    expect(qstash.cancel).not.toHaveBeenCalled();
  });

  it("answers fine for a message already gone", async () => {
    qstash.get.mockRejectedValueOnce(new Error("404"));

    const response = await cancel(["msg_gone"]);

    expect(response.status).toBe(200);
    expect(qstash.cancel).not.toHaveBeenCalled();
  });
});

describe("a timer running out", () => {
  const due = () => ({
    userId: member.id,
    recipeId: recipe.id,
    step: 2,
    endsAt: Date.now() - 1000,
    portions: 6,
  });

  it("refuses a request QStash did not sign, before anything is sent", async () => {
    expect((await ring(due(), null)).status).toBe(401);
    qstash.verify.mockResolvedValueOnce(false);
    expect((await ring(due())).status).toBe(401);
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("tells the person who started it, and opens action mode at the same amounts", async () => {
    await ring(due());

    expect(sendPushToUsers).toHaveBeenCalledWith([member.id], {
      title: "Risotto",
      body: "The timer for step 3 is done",
      url: `/recipes/${recipe.id}/cook?portions=6`,
      tag: `cook-timer:${recipe.id}:2`,
      requireInteraction: true,
    });
  });

  it("speaks the recipe's home's language, with nobody signed in to ask", async () => {
    await prisma.home.update({ where: { id: home.id }, data: { language: "DA" } });
    signOut();

    await ring(due());

    expect(sendPushToUsers).toHaveBeenCalledWith(
      [member.id],
      expect.objectContaining({ body: "Timeren til trin 3 er færdig" }),
    );
  });

  it("stays quiet about a timer that ended too long ago to be news", async () => {
    await ring({ ...due(), endsAt: Date.now() - STALE_AFTER_MS - 1000 });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("stays quiet for somebody no longer in the household", async () => {
    await prisma.homeMember.delete({
      where: { userId_homeId: { userId: member.id, homeId: home.id } },
    });

    await ring(due());

    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("answers QStash with a 200 for a recipe since deleted, so it does not retry", async () => {
    const body = due();
    await prisma.recipe.delete({ where: { id: recipe.id } });

    const response = await ring(body);

    expect(response.status).toBe(200);
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("drops a body it never wrote", async () => {
    const response = await ring("not json");
    expect(response.status).toBe(200);
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });
});
