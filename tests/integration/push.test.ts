import { describe, expect, it, vi } from "vitest";

const sendPushToUsers = vi.hoisted(() => vi.fn(async () => 1));
vi.mock("@/lib/push", () => ({ sendPushToUsers }));

const { prisma } = await import("@/lib/prisma");
const { removeSubscription, saveSubscription, sendTestPush } = await import("@/app/actions/push");
const { createHomeWithMembers, createUser, signIn } = await import("../helpers/factories");
const { expectRedirectToLogin } = await import("../helpers/expect");

const keys = { p256dh: "public-key", auth: "auth-secret" };

function subscribe(userId: string, endpoint: string) {
  return prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
}

describe("registering a device", () => {
  it("saves the subscription against the signed-in person", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await saveSubscription({ endpoint: "https://push.example.test/a", keys });

    expect(await prisma.pushSubscription.findFirstOrThrow()).toMatchObject({
      userId: member.id,
      endpoint: "https://push.example.test/a",
    });
  });

  it("updates the keys when the same device re-registers", async () => {
    const { member } = await createHomeWithMembers();
    await subscribe(member.id, "https://push.example.test/a");
    await signIn(member);

    await saveSubscription({
      endpoint: "https://push.example.test/a",
      keys: { p256dh: "rotated", auth: "rotated" },
    });

    expect(await prisma.pushSubscription.count()).toBe(1);
    expect((await prisma.pushSubscription.findFirstOrThrow()).p256dh).toBe("rotated");
  });

  it("moves a shared device to whoever is signed in on it", async () => {
    // A family tablet: the endpoint belongs to the device, so it follows the user.
    const { member, admin } = await createHomeWithMembers();
    await subscribe(member.id, "https://push.example.test/tablet");
    await signIn(admin);

    await saveSubscription({ endpoint: "https://push.example.test/tablet", keys });

    expect(await prisma.pushSubscription.count()).toBe(1);
    expect((await prisma.pushSubscription.findFirstOrThrow()).userId).toBe(admin.id);
  });

  it("turns an anonymous caller away", async () => {
    await expectRedirectToLogin(() =>
      saveSubscription({ endpoint: "https://push.example.test/a", keys }),
    );
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});

describe("removing a device", () => {
  it("removes the caller's own subscription", async () => {
    const { member } = await createHomeWithMembers();
    await subscribe(member.id, "https://push.example.test/mine");
    await signIn(member);

    await removeSubscription("https://push.example.test/mine");

    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("cannot switch off someone else's notifications", async () => {
    // Regression: this used to delete by endpoint alone, so any signed-in account
    // could unsubscribe another person's device.
    const { member } = await createHomeWithMembers();
    const other = await createUser({});
    await subscribe(member.id, "https://push.example.test/victim");
    await signIn(other);

    await removeSubscription("https://push.example.test/victim");

    expect(await prisma.pushSubscription.count()).toBe(1);
    expect((await prisma.pushSubscription.findFirstOrThrow()).userId).toBe(member.id);
  });

  it("cannot reach a subscription belonging to another home", async () => {
    const theirs = await createHomeWithMembers();
    const ours = await createHomeWithMembers();
    await subscribe(theirs.member.id, "https://push.example.test/neighbour");
    await signIn(ours.member);

    await removeSubscription("https://push.example.test/neighbour");

    expect(await prisma.pushSubscription.count()).toBe(1);
  });
});

describe("the test notification", () => {
  it("only ever targets the caller", async () => {
    const { member } = await createHomeWithMembers();
    await signIn(member);

    await sendTestPush();

    expect(sendPushToUsers).toHaveBeenCalledWith([member.id], expect.anything());
  });
});
