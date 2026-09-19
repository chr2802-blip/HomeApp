import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createHomeWithMembers, signIn, signOut } from "../helpers/factories";

describe("test harness", () => {
  /*
   * The isolation the rest of the suite assumes, asserted rather than assumed: this
   * worker is on a copy of its own, named after its process, and not on the template
   * every other worker copied from. A setup file that failed to run, or a pool that
   * stopped giving each worker a process, would otherwise show up as files truncating
   * each other's tables somewhere else entirely — the failure this whole arrangement
   * exists to prevent, and the one hardest to read backwards from.
   */
  it("runs on a database of this worker's own", async () => {
    const [{ name }] = await prisma.$queryRaw<{ name: string }[]>`
      SELECT current_database() AS name
    `;

    expect(name).toMatch(new RegExp(`_w${process.pid}_test$`));
  });

  it("starts each test with an empty database", async () => {
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.home.count()).toBe(0);
    await createHomeWithMembers();
    expect(await prisma.user.count()).toBe(2);
  });

  it("really is empty again in the next test", async () => {
    expect(await prisma.user.count()).toBe(0);
  });

  it("signs a user in through the real session cookie", async () => {
    const { member, home } = await createHomeWithMembers();
    await signIn(member);

    const current = await getCurrentUser();
    expect(current?.id).toBe(member.id);
    expect(current?.homeId).toBe(home.id);
  });

  it("has no session when signed out", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);
    signOut();
    expect(await getCurrentUser()).toBeNull();
  });
});
