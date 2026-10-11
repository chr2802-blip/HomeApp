import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Nemlig itself is played here — the session is the one thing replaced, so everything
 * on this side of it (the gate, the sealing, the home scoping, what is remembered) runs
 * against the real database. The client's own reading of Nemlig's answers is
 * `tests/unit/nemlig.test.ts`'s.
 */
const nemlig = vi.hoisted(() => ({
  catalogue: {} as Record<string, { id: string; name: string }[]>,
  refuse: new Set<string>(),
  password: "right-password",
  logins: [] as { username: string; password: string }[],
  basket: [] as { id: string; quantity: number }[],
}));

vi.mock("@/lib/nemlig", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/nemlig")>();
  class FakeSession {
    static async anonymous() {
      return new FakeSession();
    }
    static async login(username: string, password: string) {
      nemlig.logins.push({ username, password });
      if (password !== nemlig.password) throw new actual.NemligError("login", "Forkert adgangskode");
      return new FakeSession();
    }
    async search(term: string) {
      return (nemlig.catalogue[term.toLowerCase()] ?? []).map((p) => ({
        ...p,
        price: 10,
        size: "",
        brand: "",
        imageUrl: null,
        available: true,
      }));
    }
    async addToBasket(id: string, quantity: number) {
      if (nemlig.refuse.has(id)) throw new actual.NemligError("refused", "Varen er udsolgt");
      nemlig.basket.push({ id, quantity });
    }
  }
  return { ...actual, NemligSession: FakeSession };
});

import { prisma } from "@/lib/prisma";
import { connectNemlig, disconnectNemlig, reviewForNemlig, sendToNemlig } from "@/app/actions/nemlig";
import { createHomeWithMembers, createList, signIn, submit } from "../helpers/factories";
import { expectRedirect } from "../helpers/expect";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  vi.stubEnv("NEMLIG_SECRET_KEY", "integration-test-key-".padEnd(48, "x"));
  nemlig.catalogue = {
    mælk: [
      { id: "1", name: "Mælkechokolade" },
      { id: "2", name: "Letmælk" },
    ],
    æg: [{ id: "3", name: "Æg 10 stk" }],
    kanel: [{ id: "4", name: "Kanel" }],
  };
  nemlig.refuse = new Set(["4"]);
  nemlig.logins = [];
  nemlig.basket = [];
  ({ home, admin, member } = await createHomeWithMembers());
  await signIn(admin);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function connect() {
  return submit(connectNemlig, { email: "alex@example.com", password: "right-password" });
}

async function shoppingList(homeId: string, createdById: string, items: { text: string; amount?: number; done?: boolean }[]) {
  const list = await createList({ homeId, createdById });
  await prisma.listItem.createMany({
    data: items.map((item, position) => ({ listId: list.id, text: item.text, amount: item.amount ?? 1, done: item.done ?? false, position })),
  });
  return list;
}

describe("connecting a login", () => {
  it("tries it against Nemlig, and keeps it sealed rather than as typed", async () => {
    expect(await connect()).toMatchObject({ ok: true });
    const account = await prisma.nemligAccount.findUniqueOrThrow({ where: { homeId: home.id } });
    expect(account.username).toBe("alex@example.com");
    expect(account.password).not.toContain("right-password");
    expect(nemlig.logins).toEqual([{ username: "alex@example.com", password: "right-password" }]);
  });

  it("keeps nothing when Nemlig refuses it", async () => {
    expect(await submit(connectNemlig, { email: "alex@example.com", password: "wrong" })).toMatchObject({ ok: false });
    expect(await prisma.nemligAccount.count()).toBe(0);
  });

  it("is administration: a plain member is turned away", async () => {
    await signIn(member);
    await expectRedirect(() => connect(), "/dashboard");
    expect(await prisma.nemligAccount.count()).toBe(0);
  });

  it("is forgotten on disconnect", async () => {
    await connect();
    await disconnectNemlig();
    expect(await prisma.nemligAccount.count()).toBe(0);
  });
});

describe("reviewing and sending a list", () => {
  it("refuses a home with no login before asking Nemlig anything", async () => {
    const list = await shoppingList(home.id, admin.id, [{ text: "Mælk" }]);
    expect(await reviewForNemlig(list.id)).toMatchObject({ ok: false });
  });

  it("proposes a product for each open line, by what is bought rather than how it is written", async () => {
    await connect();
    await signIn(member);
    const list = await shoppingList(home.id, admin.id, [
      { text: "2 dl mælk", amount: 2 },
      { text: "Æg" },
      { text: "Drageblod" },
      { text: "Smør", done: true },
    ]);

    const review = await reviewForNemlig(list.id);
    if (!review.ok) throw new Error(review.error);
    expect(review.proposals.map((p) => [p.text, p.term, p.quantity, p.chosen?.id ?? null, p.problem])).toEqual([
      ["2 dl mælk", "Mælk", 2, "2", null],
      ["Æg", "Æg", 1, "3", null],
      ["Drageblod", "Drageblod", 1, null, "notFound"],
    ]);
  });

  it("fills the basket, keeps going past a refusal, and remembers only what went in", async () => {
    await connect();
    const list = await shoppingList(home.id, admin.id, [{ text: "Mælk" }, { text: "Kanel" }, { text: "Æg" }]);
    const items = await prisma.listItem.findMany({ where: { listId: list.id }, orderBy: { position: "asc" } });
    const pick = (index: number, id: string, quantity = 1) => ({
      itemId: items[index]!.id,
      quantity,
      product: { id, name: `Product ${id}`, imageUrl: null },
    });

    const sent = await sendToNemlig(list.id, [pick(0, "2", 3), pick(1, "4"), pick(2, "3")]);
    expect(sent).toMatchObject({
      ok: true,
      added: [{ text: "Mælk", quantity: 3 }, { text: "Æg", quantity: 1 }],
      failed: [{ text: "Kanel" }],
    });
    expect(nemlig.basket).toEqual([{ id: "2", quantity: 3 }, { id: "3", quantity: 1 }]);
    // The login it used is the one that was connected, opened from its seal.
    expect(nemlig.logins.at(-1)).toEqual({ username: "alex@example.com", password: "right-password" });

    // Compared as a map, not in database order: where "æg" sorts against "mælk" is the
    // database's collation's opinion (bytes put æ after m, a locale reads it as "ae").
    const kept = await prisma.nemligChoice.findMany({ where: { homeId: home.id } });
    expect(Object.fromEntries(kept.map((c) => [c.key, c.productId]))).toEqual({ mælk: "2", æg: "3" });

    // Next time, "mælk" starts on what was chosen rather than the best guess.
    nemlig.catalogue["mælk"] = [{ id: "1", name: "Mælk" }, { id: "2", name: "Letmælk" }];
    const review = await reviewForNemlig(list.id);
    if (!review.ok) throw new Error(review.error);
    expect(review.proposals[0]).toMatchObject({ remembered: true, chosen: { id: "2" } });
  });

  it("adds nothing when Nemlig no longer accepts the login", async () => {
    await connect();
    nemlig.password = "changed-on-nemlig";
    const list = await shoppingList(home.id, admin.id, [{ text: "Mælk" }]);
    const [item] = await prisma.listItem.findMany({ where: { listId: list.id } });

    const sent = await sendToNemlig(list.id, [{ itemId: item!.id, quantity: 1, product: { id: "2", name: "Letmælk", imageUrl: null } }]);
    expect(sent).toMatchObject({ ok: false });
    expect(nemlig.basket).toEqual([]);
    nemlig.password = "right-password";
  });

  it("will not send another home's list, nor remember into it", async () => {
    await connect();
    const other = await createHomeWithMembers();
    const theirs = await shoppingList(other.home.id, other.admin.id, [{ text: "Mælk" }]);
    const [item] = await prisma.listItem.findMany({ where: { listId: theirs.id } });

    expect(await reviewForNemlig(theirs.id)).toMatchObject({ ok: false });
    const sent = await sendToNemlig(theirs.id, [{ itemId: item!.id, quantity: 1, product: { id: "2", name: "Letmælk", imageUrl: null } }]);
    expect(sent).toMatchObject({ ok: false });
    expect(nemlig.basket).toEqual([]);
    expect(await prisma.nemligChoice.count()).toBe(0);
  });

  it("ignores a line from another list sent alongside this one's", async () => {
    await connect();
    const mine = await shoppingList(home.id, admin.id, [{ text: "Mælk" }]);
    const elsewhere = await shoppingList(home.id, admin.id, [{ text: "Æg" }]);
    const [milk] = await prisma.listItem.findMany({ where: { listId: mine.id } });
    const [eggs] = await prisma.listItem.findMany({ where: { listId: elsewhere.id } });

    const sent = await sendToNemlig(mine.id, [
      { itemId: milk!.id, quantity: 1, product: { id: "2", name: "Letmælk", imageUrl: null } },
      { itemId: eggs!.id, quantity: 1, product: { id: "3", name: "Æg", imageUrl: null } },
    ]);
    expect(sent).toMatchObject({ ok: true, added: [{ text: "Mælk" }], failed: [] });
    expect(nemlig.basket).toEqual([{ id: "2", quantity: 1 }]);
  });

  it("adds a line once however many times it was sent", async () => {
    await connect();
    const list = await shoppingList(home.id, admin.id, [{ text: "Mælk" }]);
    const [item] = await prisma.listItem.findMany({ where: { listId: list.id } });
    const milk = { itemId: item!.id, quantity: 1, product: { id: "2", name: "Letmælk", imageUrl: null } };
    await sendToNemlig(list.id, [milk, milk]);
    expect(nemlig.basket).toEqual([{ id: "2", quantity: 1 }]);
  });

  it("refuses a product id that is not one", async () => {
    await connect();
    const list = await shoppingList(home.id, admin.id, [{ text: "Mælk" }]);
    const [item] = await prisma.listItem.findMany({ where: { listId: list.id } });
    const sent = await sendToNemlig(list.id, [{ itemId: item!.id, quantity: 1, product: { id: "../checkout", name: "x", imageUrl: null } }]);
    expect(sent).toMatchObject({ ok: false });
    expect(nemlig.basket).toEqual([]);
  });
});
