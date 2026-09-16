import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireHomeUser } from "@/lib/auth";
import { switchHome } from "@/app/actions/admin";
import { createList } from "@/app/actions/lists";
import { createTask } from "@/app/actions/tasks";
import { GET } from "@/app/api/cron/reminders/route";
import { sendPushToUsers } from "@/lib/push";
import {
  createHome,
  createHomeWithMembers,
  createUser,
  formData,
  joinHome,
  signIn,
  submit,
} from "../helpers/factories";
import { captureRedirect, expectRedirect } from "../helpers/expect";

vi.mock("@/lib/push", () => ({ sendPushToUsers: vi.fn(async () => 0) }));

/**
 * Being in more than one home.
 *
 * The rest of the suite reads as though a person had one household, because almost
 * every page still does: it shows the home they are in. These are the tests of the
 * seam — what happens when there are several, which one is on screen, and what the
 * others are entitled to while they are not.
 */

/** Somebody in two homes: an admin of the first, an ordinary member of the second. */
async function inTwoHomes() {
  const { home, member } = await createHomeWithMembers();
  const second = await createHome({ name: "Summer House" });
  await joinHome({ userId: member.id, homeId: second.id, role: "ADMIN" });
  return { first: home, second, person: member };
}

describe("the homes somebody belongs to", () => {
  it("are all carried on the session, in the order they were joined", async () => {
    const { first, second, person } = await inTwoHomes();
    await signIn(person);

    const session = await getCurrentUser();

    expect(session?.homes.map((home) => home.id)).toEqual([first.id, second.id]);
    expect(session?.homes.map((home) => home.role)).toEqual(["USER", "ADMIN"]);
  });

  it("decide which one is on screen, and the role held there", async () => {
    const { first, second, person } = await inTwoHomes();
    await signIn(person);

    expect(await getCurrentUser()).toMatchObject({ homeId: first.id, homeRole: "USER" });

    await expectRedirect(() => switchHome(formData({ homeId: second.id })), "/dashboard");

    expect(await getCurrentUser()).toMatchObject({
      homeId: second.id,
      homeName: "Summer House",
      homeRole: "ADMIN",
    });
  });

  it("fall back to the first when the one on screen is no longer theirs", async () => {
    const { first, second, person } = await inTwoHomes();
    await signIn(person);
    await expectRedirect(() => switchHome(formData({ homeId: second.id })), "/dashboard");

    // Removed from the home they were reading, while they were reading it.
    await prisma.homeMember.delete({
      where: { userId_homeId: { userId: person.id, homeId: second.id } },
    });

    const session = await getCurrentUser();
    expect(session?.homeId).toBe(first.id);
    expect(session?.homes).toHaveLength(1);
    // The stale pointer is left alone: a page render corrects nothing.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: person.id } })).activeHomeId).toBe(
      second.id,
    );
  });

  it("leave somebody in none of them with no home at all", async () => {
    const { home, member } = await createHomeWithMembers();
    await prisma.homeMember.delete({
      where: { userId_homeId: { userId: member.id, homeId: home.id } },
    });
    await signIn(member);

    expect(await getCurrentUser()).toMatchObject({ homeId: null, homes: [], homeRole: null });
    await expectRedirect(() => requireHomeUser(), "/homes");
  });

  it("are not where a super admin's reading is confined", async () => {
    const home = await createHome({ name: "Someone Else's House" });
    const superAdmin = await createUser({ role: "SUPER_ADMIN", homeId: null });
    await signIn(superAdmin);

    await expectRedirect(() => switchHome(formData({ homeId: home.id })), "/dashboard");

    const session = await getCurrentUser();
    expect(session).toMatchObject({ homeId: home.id, homeName: "Someone Else's House" });
    // Reading a household is not belonging to one, and the role says so.
    expect(session?.homes).toEqual([]);
    expect(session?.homeRole).toBeNull();
  });
});

describe("working in more than one home", () => {
  it("writes into the home on screen, and only that one", async () => {
    const { first, second, person } = await inTwoHomes();
    await signIn(person);

    // createList lands on the list it made, so each call is caught rather than awaited.
    await captureRedirect(() => submit(createList, { title: "Everyday shopping" }));
    await expectRedirect(() => switchHome(formData({ homeId: second.id })), "/dashboard");
    await captureRedirect(() => submit(createList, { title: "Holiday shopping" }));

    expect(await prisma.list.findMany({ where: { homeId: first.id } })).toMatchObject([
      { title: "Everyday shopping" },
    ]);
    expect(await prisma.list.findMany({ where: { homeId: second.id } })).toMatchObject([
      { title: "Holiday shopping" },
    ]);
  });

  it("can be handed a task in either home", async () => {
    const { first, second, person } = await inTwoHomes();
    await signIn(person);

    await submit(createTask, { title: "Bins", intervalDays: "7", assigneeId: person.id });
    await expectRedirect(() => switchHome(formData({ homeId: second.id })), "/dashboard");
    await submit(createTask, { title: "Shutters", intervalDays: "7", assigneeId: person.id });

    expect(await prisma.task.findMany({ where: { assigneeId: person.id } })).toHaveLength(2);
    expect(await prisma.task.count({ where: { homeId: first.id } })).toBe(1);
    expect(await prisma.task.count({ where: { homeId: second.id } })).toBe(1);
  });

  it("is reminded about what is due in each of them", async () => {
    const { first, second, person } = await inTwoHomes();

    for (const homeId of [first.id, second.id]) {
      await prisma.task.create({
        data: {
          homeId,
          createdById: person.id,
          title: `Due in ${homeId}`,
          intervalDays: 7,
          nextDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
    }

    await GET(
      new Request("http://localhost/api/cron/reminders", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    const notified = vi
      .mocked(sendPushToUsers)
      .mock.calls.map(([recipients]) => recipients as string[]);
    expect(notified).toHaveLength(2);
    for (const recipients of notified) expect(recipients).toContain(person.id);
  });
});
