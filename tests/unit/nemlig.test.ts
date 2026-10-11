import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NemligError, NemligSession, parseSearch, type NemligProduct } from "@/lib/nemlig";
import {
  fillBasket,
  formatKroner,
  pickBestMatch,
  proposeAll,
  proposeFor,
  type BasketChoice,
  type BasketLine,
} from "@/lib/nemlig-basket";
import { canSealSecrets, openSecret, sealSecret } from "@/lib/secret-box";

/**
 * "Send to Nemlig" with Nemlig played by a mock: the client's reading of each answer and
 * each way of failing, the matching that proposes a product per line, and the filling
 * of the basket, where one line going wrong must never take the rest with it.
 */

const product = (id: string, name: string, extra: Partial<NemligProduct> = {}): NemligProduct => ({
  id,
  name,
  price: 10,
  size: "1 l",
  brand: "",
  imageUrl: null,
  available: true,
  ...extra,
});

const line = (term: string, extra: Partial<BasketLine> = {}): BasketLine => ({
  itemId: `item-${term}`,
  key: term.toLowerCase(),
  text: term,
  term,
  quantity: 1,
  ...extra,
});

describe("pickBestMatch", () => {
  it("prefers a name carrying the word itself, then Nemlig's own order", () => {
    const results = [
      product("1", "Mælkechokolade"),
      product("2", "Letmælk"),
      product("3", "Mælk"),
      product("4", "Sødmælk"),
    ];
    expect(pickBestMatch("mælk", results)?.id).toBe("3");
  });

  it("finds the word inside a Danish compound when nothing names it alone", () => {
    const results = [product("1", "Kakao"), product("2", "Letmælk"), product("3", "Minimælk")];
    // Both compounds match; Nemlig ranked Letmælk first, so it stays first.
    expect(pickBestMatch("mælk", results)?.id).toBe("2");
  });

  it("reads a compound by its last part: letmælk is milk, mælkechokolade is chocolate", () => {
    const results = [product("1", "Mælkechokolade"), product("2", "Letmælk")];
    expect(pickBestMatch("mælk", results)?.id).toBe("2");
  });

  it("wants every word of the term before any of them", () => {
    const results = [product("1", "Græsk salat"), product("2", "Yoghurt naturel"), product("3", "Græsk yoghurt 10%")];
    expect(pickBestMatch("Græsk yoghurt 10%", results)?.id).toBe("3");
  });

  it("never proposes something that cannot be delivered", () => {
    const results = [product("1", "Mælk", { available: false }), product("2", "Letmælk")];
    expect(pickBestMatch("mælk", results)?.id).toBe("2");
    expect(pickBestMatch("mælk", [product("1", "Mælk", { available: false })])).toBeNull();
  });

  it("falls back to Nemlig's first available answer where no name says the term", () => {
    expect(pickBestMatch("oatly", [product("1", "Havredrik"), product("2", "Sojadrik")])?.id).toBe("1");
    expect(pickBestMatch("mælk", [])).toBeNull();
  });
});

describe("proposeFor", () => {
  const remembered = { productId: "9", name: "Arla Sødmælk", imageUrl: "https://img/9.jpg" };

  it("proposes the remembered product, fresh from the search where it came back", () => {
    const fresh = product("9", "Arla Sødmælk", { price: 15.95 });
    const proposal = proposeFor(line("mælk"), [product("3", "Mælk"), fresh], remembered);
    expect(proposal).toMatchObject({ remembered: true, problem: null, chosen: fresh });
  });

  it("still proposes it, without a price, where today's search did not bring it back", () => {
    const proposal = proposeFor(line("mælk"), [product("3", "Mælk")], remembered);
    expect(proposal.remembered).toBe(true);
    expect(proposal.chosen).toMatchObject({ id: "9", name: "Arla Sødmælk", price: null, imageUrl: "https://img/9.jpg" });
  });

  it("passes over a remembered product that is sold out today", () => {
    const proposal = proposeFor(line("mælk"), [product("9", "Arla Sødmælk", { available: false }), product("3", "Mælk")], remembered);
    expect(proposal).toMatchObject({ remembered: false, chosen: { id: "3" } });
  });

  it("says so where Nemlig found nothing", () => {
    expect(proposeFor(line("drageblod"), [], undefined)).toMatchObject({ chosen: null, problem: "notFound" });
  });
});

describe("proposeAll", () => {
  it("keeps going past a line whose search failed, and names the failure", async () => {
    const search = vi.fn(async (term: string) => {
      if (term === "æg") throw new NemligError("timeout", "slow");
      if (term === "smør") throw new Error("socket hang up");
      return [product("1", term)];
    });
    const proposals = await proposeAll([line("mælk"), line("æg"), line("smør"), line("brød")], new Map(), search);
    expect(proposals.map((p) => [p.term, p.chosen?.id ?? null, p.problem])).toEqual([
      ["mælk", "1", null],
      ["æg", null, "timeout"],
      ["smør", null, "unavailable"],
      ["brød", "1", null],
    ]);
  });

  it("starts nothing once the budget is spent, and reports those as timed out", async () => {
    let clock = 0;
    const search = vi.fn(async () => {
      clock += 600;
      return [product("1", "x")];
    });
    const proposals = await proposeAll([line("a"), line("b"), line("c")], new Map(), search, {
      now: () => clock,
      budgetMs: 1_000,
      concurrency: 1,
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(proposals.map((p) => p.problem)).toEqual([null, null, "timeout"]);
  });

  it("uses what the household chose last time for the line's key", async () => {
    const remembered = new Map([["mælk", { productId: "7", name: "Minimælk", imageUrl: null }]]);
    const [proposal] = await proposeAll([line("mælk")], remembered, async () => [product("1", "Mælk"), product("7", "Minimælk")]);
    expect(proposal).toMatchObject({ remembered: true, chosen: { id: "7" } });
  });
});

describe("fillBasket", () => {
  const choice = (id: string, quantity = 1): BasketChoice => ({
    itemId: `item-${id}`,
    key: id,
    text: id,
    quantity,
    product: { id, name: `Product ${id}`, imageUrl: null },
  });

  it("adds each line with its quantity, and one refusal does not stop the rest", async () => {
    const add = vi.fn(async (id: string) => {
      if (id === "2") throw new NemligError("refused", "Varen er udsolgt");
    });
    const outcome = await fillBasket([choice("1", 3), choice("2"), choice("3", 2)], add);
    expect(add.mock.calls).toEqual([["1", 3], ["2", 1], ["3", 2]]);
    expect(outcome.added.map((c) => c.product.id)).toEqual(["1", "3"]);
    expect(outcome.failed).toEqual([expect.objectContaining({ itemId: "item-2", reason: "refused", message: "Varen er udsolgt" })]);
  });

  it("stops asking once the login has gone, and says so against every line left", async () => {
    const add = vi.fn(async (id: string) => {
      if (id === "2") throw new NemligError("login", "Logged out");
    });
    const outcome = await fillBasket([choice("1"), choice("2"), choice("3")], add);
    expect(add).toHaveBeenCalledTimes(2);
    expect(outcome.added).toHaveLength(1);
    expect(outcome.failed.map((f) => [f.itemId, f.reason])).toEqual([
      ["item-2", "login"],
      ["item-3", "login"],
    ]);
  });

  it("reports lines it ran out of time for rather than leaving them unanswered", async () => {
    let clock = 0;
    const add = vi.fn(async () => {
      clock += 700;
    });
    const outcome = await fillBasket([choice("1"), choice("2"), choice("3")], add, { now: () => clock, budgetMs: 1_000 });
    expect(outcome.added).toHaveLength(2);
    expect(outcome.failed.map((f) => f.reason)).toEqual(["timeout"]);
  });
});

describe("the client", () => {
  type Reply = { status?: number; body?: unknown; cookie?: string } | Error;
  let replies: Record<string, Reply>;
  let calls: { url: string; init: RequestInit }[];

  beforeEach(() => {
    calls = [];
    replies = {
      "/webapi/Token": { body: { access_token: "jwt" } },
      "/webapi/v2/AppSettings/Website": { body: { CombinedProductsAndSitecoreTimestamp: "STAMP" } },
      "/webapi/user/GetCurrentUser": { body: { DebitorId: 42 } },
      "/webapi/Order/DeliverySpot": { body: { TimeslotUtc: "2026101215-60-240", TimeslotId: 7 } },
      "/webapi/login": { body: { RedirectUrl: "/" }, cookie: "session=abc; Path=/; HttpOnly" },
      "/searchgateway/api/search": {
        body: {
          Products: {
            Products: [
              {
                Id: 5001,
                Name: "Letmælk",
                Price: 12.95,
                Description: "1 l",
                Brand: "Arla",
                PrimaryImage: "https://img.nemlig.com/5001.jpg",
                Availability: { IsDeliveryAvailable: true, IsAvailableInStock: false },
              },
            ],
          },
        },
      },
      "/webapi/basket/AddToBasket": { body: { Success: true } },
    };
    vi.stubEnv("NEMLIG_BASE_URL", "https://nemlig.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, init });
        const reply = replies[new URL(url).pathname];
        if (!reply) return new Response("{}", { status: 404 });
        if (reply instanceof Error) throw reply;
        const headers = new Headers({ "Content-Type": "application/json" });
        if (reply.cookie) headers.append("Set-Cookie", reply.cookie);
        return new Response(JSON.stringify(reply.body ?? null), { status: reply.status ?? 200, headers });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const call = (path: string) => calls.find((c) => new URL(c.url).pathname === path);

  it("searches with the token and stamps Nemlig handed out, and reads the products", async () => {
    const session = await NemligSession.anonymous();
    const products = await session.search("letmælk");

    expect(products).toEqual([
      {
        id: "5001",
        name: "Letmælk",
        price: 12.95,
        size: "1 l",
        brand: "Arla",
        imageUrl: "https://img.nemlig.com/5001.jpg",
        available: false,
      },
    ]);
    const search = call("/searchgateway/api/search")!;
    const params = new URL(search.url).searchParams;
    expect(params.get("query")).toBe("letmælk");
    expect(params.get("timestamp")).toBe("STAMP");
    expect(params.get("timeslotUtc")).toBe("2026101215-60-240");
    const headers = search.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt");
    // The gateway refuses a GET carrying a Content-Type.
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("logs in, keeps the cookie, and sends it with the add", async () => {
    const session = await NemligSession.login("a@b.dk", "secret");
    await session.addToBasket("5001", 3);

    expect(JSON.parse(String(call("/webapi/login")!.init.body))).toEqual({ Username: "a@b.dk", Password: "secret" });
    const add = call("/webapi/basket/AddToBasket")!;
    expect(JSON.parse(String(add.init.body))).toEqual({ ProductId: 5001, Quantity: 3 });
    expect((add.init.headers as Record<string, string>).Cookie).toBe("session=abc");
  });

  it("calls a refused login a login failure, with Nemlig's own words", async () => {
    replies["/webapi/login"] = { body: { ErrorCode: 1, ErrorMessage: "Forkert adgangskode" } };
    await expect(NemligSession.login("a@b.dk", "nope")).rejects.toMatchObject({ kind: "login", message: "Forkert adgangskode" });

    replies["/webapi/login"] = { status: 401, body: {} };
    await expect(NemligSession.login("a@b.dk", "nope")).rejects.toMatchObject({ kind: "login" });
  });

  it("will not add to a basket without a login", async () => {
    const session = await NemligSession.anonymous();
    await expect(session.addToBasket("5001", 1)).rejects.toMatchObject({ kind: "login" });
    expect(call("/webapi/basket/AddToBasket")).toBeUndefined();
  });

  it("treats a 200 that says it failed as a refusal", async () => {
    replies["/webapi/basket/AddToBasket"] = { body: { ErrorCode: 2, ErrorMessage: "Varen er udsolgt" } };
    const session = await NemligSession.login("a@b.dk", "secret");
    await expect(session.addToBasket("5001", 1)).rejects.toMatchObject({ kind: "refused", message: "Varen er udsolgt" });

    replies["/webapi/basket/AddToBasket"] = { status: 400, body: {} };
    await expect(session.addToBasket("5001", 1)).rejects.toMatchObject({ kind: "refused" });
  });

  it("tells a timeout, an outage and a changed API apart", async () => {
    const session = await NemligSession.anonymous();

    replies["/searchgateway/api/search"] = Object.assign(new Error("aborted"), { name: "TimeoutError" });
    await expect(session.search("x")).rejects.toMatchObject({ kind: "timeout" });

    replies["/searchgateway/api/search"] = new TypeError("fetch failed");
    await expect(session.search("x")).rejects.toMatchObject({ kind: "unavailable" });

    replies["/searchgateway/api/search"] = { status: 503, body: {} };
    await expect(session.search("x")).rejects.toMatchObject({ kind: "unavailable" });

    replies["/searchgateway/api/search"] = { body: { Results: [] } };
    await expect(session.search("x")).rejects.toMatchObject({ kind: "changed" });
  });

  it("calls a missing token a changed API, not an empty search", async () => {
    replies["/webapi/Token"] = { body: { token: "renamed" } };
    await expect(NemligSession.anonymous()).rejects.toMatchObject({ kind: "changed" });
  });
});

describe("parseSearch", () => {
  it("reads an empty search as nothing found, not as a failure", () => {
    expect(parseSearch({ Products: { Products: [] } })).toEqual([]);
    expect(parseSearch({ Products: [] })).toEqual([]);
  });

  it("refuses products it cannot read at all as an API that moved", () => {
    expect(() => parseSearch({ Products: { Products: [{ ProductId: 1, Title: "Mælk" }] } })).toThrow(NemligError);
  });

  it("drops a picture that is not a web address", () => {
    const [read] = parseSearch({ Products: [{ Id: 1, Name: "Mælk", PrimaryImage: "javascript:alert(1)" }] });
    expect(read?.imageUrl).toBeNull();
  });
});

describe("secret-box", () => {
  const key = "k".repeat(40);

  it("gives back what it sealed, and a different text each time", () => {
    const a = sealSecret("hunter2", key);
    expect(a).not.toContain("hunter2");
    expect(sealSecret("hunter2", key)).not.toBe(a);
    expect(openSecret(a, key)).toBe("hunter2");
  });

  it("refuses a wrong key and a tampered value", () => {
    const sealed = sealSecret("hunter2", key);
    expect(() => openSecret(sealed, "x".repeat(40))).toThrow();
    const [v, iv, tag, body] = sealed.split(".");
    const flipped = body!.startsWith("A") ? `B${body!.slice(1)}` : `A${body!.slice(1)}`;
    expect(() => openSecret([v, iv, tag, flipped].join("."), key)).toThrow();
  });

  it("is off without a long enough key", () => {
    expect(canSealSecrets("")).toBe(false);
    expect(canSealSecrets("short")).toBe(false);
    expect(canSealSecrets(key)).toBe(true);
    expect(() => sealSecret("x", "short")).toThrow();
  });
});

describe("formatKroner", () => {
  it("writes the household's own decimal mark", () => {
    expect(formatKroner(12.5, "DA")).toBe("12,50");
    expect(formatKroner(12.5, "EN")).toBe("12.50");
  });
});
