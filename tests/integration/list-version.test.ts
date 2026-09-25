import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/lists/[id]/version/route";
import { addListItem, toggleListItem } from "@/app/actions/lists";
import {
  createHome,
  createHomeWithMembers,
  createList,
  createUser,
  formData,
  signIn,
  signOut,
  submit,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];
let list: Awaited<ReturnType<typeof createList>>;

beforeEach(async () => {
  ({ home, admin, member } = await createHomeWithMembers());
  list = await createList({ homeId: home.id, createdById: member.id });
  await signIn(member);
});

function ask(id = list.id) {
  return GET(new Request(`http://localhost/api/lists/${id}/version`), {
    params: Promise.resolve({ id }),
  });
}

async function version() {
  const response = await ask();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return ((await response.json()) as { version: string }).version;
}

describe("GET /api/lists/[id]/version", () => {
  it("moves when somebody else in the home ticks an item off", async () => {
    const item = await prisma.listItem.create({
      data: { listId: list.id, text: "Milk", position: 1 },
    });
    const before = await version();
    expect(await version()).toBe(before);

    // The other person's phone.
    await signIn(admin);
    await toggleListItem(formData({ itemId: item.id }));

    await signIn(member);
    expect(await version()).not.toBe(before);
  });

  it("moves when somebody else adds an item", async () => {
    const before = await version();

    await signIn(admin);
    await submit(addListItem, { listId: list.id, text: "Bread" });

    await signIn(member);
    expect(await version()).not.toBe(before);
  });

  it("does not answer about another home's list", async () => {
    const other = await createHome();
    const neighbour = await createUser({ homeId: other.id });
    const theirs = await createList({ homeId: other.id, createdById: neighbour.id });

    expect((await ask(theirs.id)).status).toBe(404);
  });

  it("refuses somebody who is not signed in", async () => {
    signOut();
    expect((await ask()).status).toBe(401);
  });
});
