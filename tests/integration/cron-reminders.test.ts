import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPushToUsers = vi.hoisted(() => vi.fn(async () => 0));
vi.mock("@/lib/push", () => ({ sendPushToUsers }));

const { prisma } = await import("@/lib/prisma");
const { GET } = await import("@/app/api/cron/reminders/route");
const { dueAtDaysFrom, endOfDayInZone } = await import("@/lib/time");
const { createHome, createHomeWithMembers, createTask, createUser } = await import(
  "../helpers/factories"
);

const CRON_SECRET = process.env.CRON_SECRET!;

function request(token?: string) {
  return new Request("http://localhost/api/cron/reminders", {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysAhead = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

beforeEach(() => {
  sendPushToUsers.mockClear();
  sendPushToUsers.mockResolvedValue(0);
});

describe("authorisation", () => {
  it("refuses a request with no token", async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("refuses a wrong token", async () => {
    expect((await GET(request("wrong-secret"))).status).toBe(401);
  });

  it("refuses a token that merely starts with the right value", async () => {
    expect((await GET(request(CRON_SECRET.slice(0, 4)))).status).toBe(401);
    expect((await GET(request(`${CRON_SECRET}extra`))).status).toBe(401);
  });

  it("accepts the configured token", async () => {
    expect((await GET(request(CRON_SECRET))).status).toBe(200);
  });

  it("sends nothing when it is not authorised", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAgo(1) });

    await GET(request("wrong"));

    expect(sendPushToUsers).not.toHaveBeenCalled();
  });
});

describe("choosing which tasks to notify about", () => {
  it("notifies about a task that is due today or overdue", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      title: "Overdue task",
      nextDueAt: daysAgo(2),
    });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 1 });
    expect(sendPushToUsers).toHaveBeenCalledTimes(1);
    expect(sendPushToUsers).toHaveBeenCalledWith(expect.any(Array), {
      title: "Task due",
      body: "Overdue task",
      url: "/tasks",
    });
  });

  /**
   * The one path with no session at all — a cron job — so it cannot read a language
   * off the reader the way every other push and every page does. It reads the home's
   * own row instead, which is the only place left to ask.
   */
  it("says it in the home's own language, not the reader's", async () => {
    const home = await createHome({ language: "DA" });
    const member = await createUser({ homeId: home.id, role: "USER" });
    await createTask({
      homeId: home.id,
      createdById: member.id,
      title: "Overdue task",
      nextDueAt: daysAgo(2),
    });

    await GET(request(CRON_SECRET));

    expect(sendPushToUsers).toHaveBeenCalledWith(expect.any(Array), {
      title: "Opgave forfalder",
      body: "Overdue task",
      url: "/tasks",
    });
  });

  it("leaves a task that is not due yet alone", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAhead(3) });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 0 });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("notifies every member of the task's home, and nobody else", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    const otherHome = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAgo(1) });

    await GET(request(CRON_SECRET));

    const [recipients] = sendPushToUsers.mock.calls[0] as unknown as [string[]];
    expect([...recipients].sort()).toEqual([admin.id, member.id].sort());
    expect(recipients).not.toContain(otherHome.member.id);
  });

  it("reports how many notifications actually went out", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAgo(1) });
    sendPushToUsers.mockResolvedValue(2);

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toEqual({ tasksDue: 1, notificationsSent: 2 });
  });

  it("handles several homes in one run", async () => {
    const first = await createHomeWithMembers();
    const second = await createHomeWithMembers();
    await createTask({ homeId: first.home.id, createdById: first.member.id, nextDueAt: daysAgo(1) });
    await createTask({
      homeId: second.home.id,
      createdById: second.member.id,
      nextDueAt: daysAgo(5),
    });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 2 });
    expect(sendPushToUsers).toHaveBeenCalledTimes(2);
  });

  it("says so plainly when there is nothing to do", async () => {
    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toEqual({ tasksDue: 0, notificationsSent: 0 });
  });

  it("notifies about a one-off that has not been done", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      intervalDays: null,
      nextDueAt: daysAgo(1),
    });

    expect(await (await GET(request(CRON_SECRET))).json()).toMatchObject({ tasksDue: 1 });
  });

  it("leaves a one-off that has been done alone, however long its date has passed", async () => {
    // A finished one-off keeps the date it was due, so without this it would be
    // reminded about every morning for ever.
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      intervalDays: null,
      nextDueAt: daysAgo(30),
      lastCompletedAt: daysAgo(29),
    });

    expect(await (await GET(request(CRON_SECRET))).json()).toEqual({
      tasksDue: 0,
      notificationsSent: 0,
    });
    expect(sendPushToUsers).not.toHaveBeenCalled();
  });

  it("notifies about a recurring task that has been completed before", async () => {
    // A completed recurring task is not finished — it comes round again, and the
    // filter that hides done one-offs must not catch it.
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: daysAgo(1),
      lastCompletedAt: daysAgo(8),
    });

    expect(await (await GET(request(CRON_SECRET))).json()).toMatchObject({ tasksDue: 1 });
  });
});

describe("notifying on the due day itself", () => {
  /**
   * Regression: the job used to ask for tasks due at or before the moment it ran.
   * It runs in the early morning while tasks come due at 09:00 local, so a task was
   * never due yet on its own day and every reminder arrived twenty-four hours late.
   */
  it("notifies about a task due later the same day", async () => {
    const { home, member } = await createHomeWithMembers();
    const laterToday = endOfDayInZone(new Date());
    laterToday.setMinutes(laterToday.getMinutes() - 1);

    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: laterToday });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 1 });
  });

  it("notifies about a task due at this morning's usual hour", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: dueAtDaysFrom(0),
    });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 1 });
  });

  it("still leaves tomorrow's task alone", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: dueAtDaysFrom(1),
    });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 0 });
  });
});

describe("who an assigned task reaches", () => {
  it("notifies only the member a task names", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: daysAgo(1),
      assigneeId: member.id,
    });

    await GET(request(CRON_SECRET));

    const [recipients] = sendPushToUsers.mock.calls[0] as unknown as [string[]];
    expect(recipients).toEqual([member.id]);
    expect(recipients).not.toContain(admin.id);
  });

  it("still notifies the whole home when a task names nobody", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAgo(1) });

    await GET(request(CRON_SECRET));

    const [recipients] = sendPushToUsers.mock.calls[0] as unknown as [string[]];
    expect([...recipients].sort()).toEqual([admin.id, member.id].sort());
  });

  // Recipients are chosen per task rather than once for the run, which a single home
  // in the fixture would not have shown.
  it("narrows one home's assigned task while another's still reaches everybody", async () => {
    const first = await createHomeWithMembers();
    const second = await createHomeWithMembers();
    await createTask({
      homeId: first.home.id,
      createdById: first.member.id,
      nextDueAt: daysAgo(1),
      assigneeId: first.admin.id,
    });
    await createTask({
      homeId: second.home.id,
      createdById: second.member.id,
      nextDueAt: daysAgo(1),
    });

    await GET(request(CRON_SECRET));

    const sent = sendPushToUsers.mock.calls.map((call) =>
      [...(call as unknown as [string[]])[0]].sort(),
    );
    expect(sent).toContainEqual([first.admin.id]);
    expect(sent).toContainEqual([second.admin.id, second.member.id].sort());
  });

  /**
   * An assignment can outlive the membership it was made under: a super admin switches
   * their active home without anything clearing the tasks they were handed. Silence is
   * the one outcome that must not happen — a task nobody hears about looks exactly like
   * a week with nothing due — so the household picks it up again.
   */
  it("falls back to the household when the named member has left it", async () => {
    const { home, admin, member } = await createHomeWithMembers();
    const leaver = await createUser({ homeId: home.id });
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: daysAgo(1),
      assigneeId: leaver.id,
    });

    await prisma.homeMember.delete({
      where: { userId_homeId: { userId: leaver.id, homeId: home.id } },
    });

    await GET(request(CRON_SECRET));

    const [recipients] = sendPushToUsers.mock.calls[0] as unknown as [string[]];
    expect([...recipients].sort()).toEqual([admin.id, member.id].sort());
  });
});

describe("not repeating itself", () => {
  it("does not notify twice in the same day", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({ homeId: home.id, createdById: member.id, nextDueAt: daysAgo(1) });

    await GET(request(CRON_SECRET));
    const second = await GET(request(CRON_SECRET));

    expect(await second.json()).toMatchObject({ tasksDue: 0 });
    expect(sendPushToUsers).toHaveBeenCalledTimes(1);
  });

  it("records when it last notified", async () => {
    const { home, member } = await createHomeWithMembers();
    const task = await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: daysAgo(1),
    });

    await GET(request(CRON_SECRET));

    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).lastNotifiedAt,
    ).toBeInstanceOf(Date);
  });

  it("nudges again the next day while the task stays undone", async () => {
    const { home, member } = await createHomeWithMembers();
    await createTask({
      homeId: home.id,
      createdById: member.id,
      nextDueAt: daysAgo(3),
      lastNotifiedAt: daysAgo(1),
    });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 1 });
  });

  it("still counts a task whose home has no members, without sending anything", async () => {
    const home = await createHome();
    const outsider = await createUser({ homeId: null });
    const task = await createTask({ homeId: home.id, createdById: outsider.id, nextDueAt: daysAgo(1) });

    const response = await GET(request(CRON_SECRET));

    expect(await response.json()).toMatchObject({ tasksDue: 1, notificationsSent: 0 });
    expect(sendPushToUsers).toHaveBeenCalledWith([], expect.anything());
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).lastNotifiedAt,
    ).toBeInstanceOf(Date);
  });
});
