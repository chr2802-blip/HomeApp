import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeTask, createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import {
  createHomeWithMembers,
  createTask as seedTask,
  createUser,
  formData,
  signIn,
} from "../helpers/factories";
import { dueAtDaysFrom, formatInZone, todayInZone } from "@/lib/time";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let admin: Awaited<ReturnType<typeof createHomeWithMembers>>["admin"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, admin, member } = await createHomeWithMembers());
  await signIn(member);
});

const only = () => prisma.recurringTask.findFirstOrThrow();

describe("createTask", () => {
  it("creates a task in the caller's home", async () => {
    await createTask(undefined, formData({ title: "Change the filter", intervalDays: "30", notes: "Kitchen" }));

    expect(await only()).toMatchObject({
      title: "Change the filter",
      intervalDays: 30,
      notes: "Kitchen",
      homeId: home.id,
      createdById: member.id,
      lastCompletedAt: null,
    });
  });

  it("honours a chosen first due date, at 9am", async () => {
    await createTask(
      undefined,
      formData({ title: "Descale kettle", intervalDays: "90", firstDueAt: "2026-06-01" }),
    );

    // Read on the household's clock, not the machine's: the stored instant is 07:00Z
    // in summer, and asserting getHours() would only pass in that one timezone.
    expect(formatInZone((await only()).nextDueAt, "yyyy-MM-dd HH:mm")).toBe("2026-06-01 09:00");
  });

  it("defaults to due today when no date is given", async () => {
    await createTask(undefined, formData({ title: "Water plants", intervalDays: "7" }));

    expect(formatInZone((await only()).nextDueAt, "yyyy-MM-dd")).toBe(todayInZone());
  });

  it("stores blank notes as null rather than an empty string", async () => {
    await createTask(undefined, formData({ title: "Task", intervalDays: "7", notes: "   " }));

    expect((await only()).notes).toBeNull();
  });

  it("ignores a task with no title", async () => {
    await createTask(undefined, formData({ title: "   ", intervalDays: "7" }));

    expect(await prisma.recurringTask.count()).toBe(0);
  });

  it.each([
    ["zero", "0"],
    ["negative", "-5"],
    ["fractional", "1.5"],
    ["not a number", "soon"],
    ["absurdly large", "4000"],
    ["empty", ""],
  ])("refuses a %s interval", async (_label, intervalDays) => {
    await createTask(undefined, formData({ title: "Task", intervalDays }));

    expect(await prisma.recurringTask.count()).toBe(0);
  });

  it("accepts the boundary intervals", async () => {
    await createTask(undefined, formData({ title: "Daily", intervalDays: "1" }));
    await createTask(undefined, formData({ title: "Decade", intervalDays: "3650" }));

    expect(await prisma.recurringTask.count()).toBe(2);
  });

  it("reports an unparseable date rather than quietly using today", async () => {
    const result = await createTask(
      undefined,
      formData({ title: "Task", intervalDays: "7", firstDueAt: "not-a-date" }),
    );

    expect(result).toEqual({ ok: false, error: "That first due date is not a real date." });
    expect(await prisma.recurringTask.count()).toBe(0);
  });

  it("says which interval values are allowed", async () => {
    const result = await createTask(undefined, formData({ title: "Task", intervalDays: "0" }));

    expect(result).toEqual({ ok: false, error: "Repeat every 1 to 3650 days." });
  });

  it("asks for a title when none is given", async () => {
    const result = await createTask(undefined, formData({ title: "  ", intervalDays: "7" }));

    expect(result).toEqual({ ok: false, error: "Give the task a name." });
  });
});

describe("completeTask", () => {
  it("schedules the next run one interval from today, at 9am", async () => {
    const task = await seedTask({
      homeId: home.id,
      createdById: member.id,
      intervalDays: 10,
      nextDueAt: new Date("2020-01-01T09:00:00"),
    });

    await completeTask(formData({ taskId: task.id }));

    const updated = await only();
    expect(updated.nextDueAt.toISOString()).toBe(dueAtDaysFrom(10).toISOString());
    expect(formatInZone(updated.nextDueAt, "HH:mm")).toBe("09:00");
    expect(updated.lastCompletedAt).toBeInstanceOf(Date);
  });

  it("measures the interval from the completion date, not the old due date", async () => {
    // Three weeks overdue: the next one is still 7 days from now, not from when it was due.
    const task = await seedTask({
      homeId: home.id,
      createdById: member.id,
      intervalDays: 7,
      nextDueAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    });

    await completeTask(formData({ taskId: task.id }));

    expect((await only()).nextDueAt.toISOString()).toBe(dueAtDaysFrom(7).toISOString());
  });

  it("clears the reminder stamp so the next due date can notify again", async () => {
    const task = await seedTask({
      homeId: home.id,
      createdById: member.id,
      lastNotifiedAt: new Date(),
    });

    await completeTask(formData({ taskId: task.id }));

    expect((await only()).lastNotifiedAt).toBeNull();
  });

  it("can be completed repeatedly, moving the due date each time", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, intervalDays: 3 });

    await completeTask(formData({ taskId: task.id }));
    const first = (await only()).nextDueAt;
    await completeTask(formData({ taskId: task.id }));
    const second = (await only()).nextDueAt;

    expect(formatInZone(second, "yyyy-MM-dd")).toBe(formatInZone(first, "yyyy-MM-dd"));
    expect(await prisma.recurringTask.count()).toBe(1);
  });

  it("fails loudly for a task that does not exist", async () => {
    await expect(completeTask(formData({ taskId: "missing" }))).rejects.toThrow("Task not found");
  });
});

describe("updateTask", () => {
  it("changes the title, notes, interval and due date", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id });

    await updateTask(
      undefined,
      formData({
        taskId: task.id,
        title: "Replace the filter",
        intervalDays: "60",
        notes: "Under the sink",
        nextDueAt: "2026-12-24",
      }),
    );

    const updated = await only();
    expect(updated).toMatchObject({
      title: "Replace the filter",
      intervalDays: 60,
      notes: "Under the sink",
    });
    expect(formatInZone(updated.nextDueAt, "yyyy-MM-dd")).toBe("2026-12-24");
  });

  it("keeps the existing due date when none is supplied", async () => {
    const original = new Date("2026-05-05T09:00:00");
    const task = await seedTask({ homeId: home.id, createdById: member.id, nextDueAt: original });

    await updateTask(undefined, formData({ taskId: task.id, title: "Renamed", intervalDays: "7" }));

    expect((await only()).nextDueAt.toISOString()).toBe(original.toISOString());
  });

  it("rejects an invalid interval and leaves the task untouched", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, intervalDays: 7 });

    await updateTask(undefined, formData({ taskId: task.id, title: "Renamed", intervalDays: "0" }));

    expect(await only()).toMatchObject({ title: "Water the plants", intervalDays: 7 });
  });
});

describe("assigning a task", () => {
  it("hands a new task to a member of the home", async () => {
    await createTask(
      undefined,
      formData({ title: "Bins", intervalDays: "7", assigneeId: admin.id }),
    );

    expect(await only()).toMatchObject({ assigneeId: admin.id });
  });

  it("leaves a task to the whole home when nobody is named", async () => {
    await createTask(undefined, formData({ title: "Bins", intervalDays: "7" }));

    expect((await only()).assigneeId).toBeNull();
  });

  it("treats an empty choice as the whole home rather than a bad id", async () => {
    const result = await createTask(
      undefined,
      formData({ title: "Bins", intervalDays: "7", assigneeId: "" }),
    );

    expect(result).toEqual({ ok: true });
    expect((await only()).assigneeId).toBeNull();
  });

  it("refuses somebody from another household", async () => {
    const neighbour = await createHomeWithMembers();

    const result = await createTask(
      undefined,
      formData({ title: "Bins", intervalDays: "7", assigneeId: neighbour.member.id }),
    );

    expect(result).toEqual({ ok: false, error: "That person is not in this home." });
    expect(await prisma.recurringTask.count()).toBe(0);
  });

  it("refuses somebody who is in no home at all", async () => {
    const outsider = await createUser({ homeId: null });

    const result = await createTask(
      undefined,
      formData({ title: "Bins", intervalDays: "7", assigneeId: outsider.id }),
    );

    expect(result).toEqual({ ok: false, error: "That person is not in this home." });
  });

  it("refuses a user id that does not exist", async () => {
    const result = await createTask(
      undefined,
      formData({ title: "Bins", intervalDays: "7", assigneeId: "nobody" }),
    );

    expect(result).toEqual({ ok: false, error: "That person is not in this home." });
  });

  it("moves a task from one member to another", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, assigneeId: member.id });

    await updateTask(
      undefined,
      formData({ taskId: task.id, title: "Bins", intervalDays: "7", assigneeId: admin.id }),
    );

    expect((await only()).assigneeId).toBe(admin.id);
  });

  it("hands a task back to the home when the picker is cleared", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, assigneeId: admin.id });

    await updateTask(
      undefined,
      formData({ taskId: task.id, title: "Bins", intervalDays: "7", assigneeId: "" }),
    );

    expect((await only()).assigneeId).toBeNull();
  });

  it("leaves the assignment alone when an edit is rejected", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, assigneeId: admin.id });

    await updateTask(
      undefined,
      formData({ taskId: task.id, title: "Bins", intervalDays: "0", assigneeId: "" }),
    );

    expect((await only()).assigneeId).toBe(admin.id);
  });

  it("keeps a completion from disturbing who the task is for", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, assigneeId: admin.id });

    await completeTask(formData({ taskId: task.id }));

    expect((await only()).assigneeId).toBe(admin.id);
  });

  it("returns the task to the whole home when its assignee is removed", async () => {
    // removeMember deletes the user outright. The task is the household's, not theirs,
    // so it has to survive them and fall back to everybody.
    const task = await seedTask({ homeId: home.id, createdById: member.id, assigneeId: admin.id });

    await prisma.user.delete({ where: { id: admin.id } });

    expect(await prisma.recurringTask.findUnique({ where: { id: task.id } })).toMatchObject({
      assigneeId: null,
    });
  });
});

describe("deleteTask", () => {
  it("removes the task", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id });

    await deleteTask(formData({ taskId: task.id }));

    expect(await prisma.recurringTask.count()).toBe(0);
  });
});
