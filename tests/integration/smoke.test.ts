import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createHomeWithMembers, signIn, signOut } from "../helpers/factories";

describe("test harness", () => {
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
