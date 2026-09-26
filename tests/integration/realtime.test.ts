import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET as token } from "@/app/api/realtime/token/route";
import { POST as sync } from "@/app/api/lists/sync/route";
import {
  addListItem,
  renameListItem,
  toggleListFavorite,
  toggleListItem,
} from "@/app/actions/lists";
import { addPantryToList } from "@/app/actions/pantry";
import {
  createHome,
  createHomeWithMembers,
  createList,
  formData,
  joinHome,
  signIn,
  signOut,
  submit,
} from "../helpers/factories";

// `after` needs a request to run after; here it runs at once, so a test can see what went.
const deferred: (() => unknown)[] = [];
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.push(task);
  },
}));

type Sent = { topic: string; event: string; payload: { listId: string }; private: boolean };
let sent: Sent[] = [];

async function broadcasts() {
  await Promise.all(deferred.splice(0).map((task) => task()));
  return sent;
}

function configure() {
  vi.stubEnv("SUPABASE_URL", "https://ref.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
  vi.stubEnv("SUPABASE_JWT_SECRET", "a-jwt-secret");
}

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let list: Awaited<ReturnType<typeof createList>>;

beforeEach(async () => {
  sent = [];
  deferred.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(...(JSON.parse(String(init.body)) as { messages: Sent[] }).messages);
      return new Response(null, { status: 202 });
    }),
  );
  ({ home, member } = await createHomeWithMembers());
  list = await createList({ homeId: home.id, createdById: member.id });
  await signIn(member);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const nudge = (listId: string, homeId = home.id) => ({
  topic: `home:${homeId}`,
  event: "list-changed",
  payload: { listId },
  private: true,
});

describe("a change to a list is announced on its home's channel", () => {
  beforeEach(configure);

  it("when an item is ticked off", async () => {
    const item = await prisma.listItem.create({ data: { listId: list.id, text: "Milk", position: 1 } });
    await toggleListItem(formData({ itemId: item.id }));
    expect(await broadcasts()).toEqual([nudge(list.id)]);
  });

  it("when an item is added or renamed", async () => {
    await submit(addListItem, { listId: list.id, text: "Bread" });
    const item = await prisma.listItem.findFirstOrThrow({ where: { listId: list.id } });
    await renameListItem(formData({ itemId: item.id, text: "Rye bread" }));
    expect(await broadcasts()).toEqual([nudge(list.id), nudge(list.id)]);
  });

  it("when the pantry puts what has run out on it", async () => {
    await prisma.pantryItem.create({
      data: { homeId: home.id, name: "Ris", key: "ris", quantity: 0 },
    });
    await addPantryToList(formData({ listId: list.id }));
    expect(await broadcasts()).toEqual([nudge(list.id)]);
  });

  // A person in two homes can have queued ticks in both; each goes to its own home.
  it("when a queue arrives, once per list, on each list's own home", async () => {
    const second = await createHome();
    await joinHome({ userId: member.id, homeId: second.id });
    const other = await createList({ homeId: second.id, createdById: member.id });
    const [a, b] = await Promise.all(
      [list, other].map((target) =>
        prisma.listItem.create({ data: { listId: target.id, text: "Milk", position: 1 } }),
      ),
    );

    const ops = [
      { id: "1", kind: "tick", listId: list.id, itemId: a.id, done: true },
      { id: "2", kind: "amount", listId: list.id, itemId: a.id, amount: 2 },
      { id: "3", kind: "tick", listId: other.id, itemId: b.id, done: true },
    ];
    const response = await sync(
      new Request("http://localhost/api/lists/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops }),
      }),
    );
    expect(response.status).toBe(200);

    expect(await broadcasts()).toEqual(
      expect.arrayContaining([nudge(list.id), nudge(other.id, second.id)]),
    );
    expect(sent).toHaveLength(2);
  });

  it("but not a star, which is nobody's business but the person pressing", async () => {
    await toggleListFavorite(formData({ listId: list.id }));
    expect(await broadcasts()).toEqual([]);
  });
});

describe("without Realtime configured", () => {
  it("announces nothing and schedules nothing", async () => {
    await submit(addListItem, { listId: list.id, text: "Bread" });
    expect(deferred).toHaveLength(0);
    expect(await broadcasts()).toEqual([]);
  });

  it("tells the phone to keep polling", async () => {
    const response = await token();
    expect(await response.json()).toEqual({ enabled: false });
  });
});

describe("GET /api/realtime/token", () => {
  beforeEach(configure);

  it("refuses somebody who is not signed in", async () => {
    signOut();
    expect((await token()).status).toBe(401);
  });

  it("names the home on screen as the topic, and every home they belong to in the token", async () => {
    const second = await createHome();
    await joinHome({ userId: member.id, homeId: second.id });
    const body = (await (await token()).json()) as {
      enabled: boolean;
      url: string;
      publishableKey: string;
      topic: string;
      token: string;
      expiresAt: number;
    };

    expect(body).toMatchObject({
      enabled: true,
      url: "https://ref.supabase.co",
      publishableKey: "sb_publishable_x",
      topic: `home:${home.id}`,
    });
    // The secret key never reaches a phone.
    expect(JSON.stringify(body)).not.toContain("sb_secret_x");

    const claims = JSON.parse(Buffer.from(body.token.split(".")[1], "base64url").toString());
    expect(claims.sub).toBe(member.id);
    expect(new Set(claims.homes)).toEqual(new Set([home.id, second.id]));
    expect(body.expiresAt).toBe(claims.exp);
  });

  it("leaves out a home they have been removed from", async () => {
    const second = await createHome();
    await joinHome({ userId: member.id, homeId: second.id });
    await prisma.homeMember.deleteMany({ where: { userId: member.id, homeId: second.id } });

    const body = (await (await token()).json()) as { token: string };
    const claims = JSON.parse(Buffer.from(body.token.split(".")[1], "base64url").toString());
    expect(claims.homes).toEqual([home.id]);
  });
});
