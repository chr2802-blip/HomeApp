import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { completeTask, createTask, deleteTask, updateTask } from "@/app/actions/tasks";
import {
  createHomeWithMembers,
  createTask as seedTask,
  formData,
  signIn,
} from "../helpers/factories";

let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
});

const only = () => prisma.recurringTask.findFirstOrThrow();

describe("createTask", () => {
  it("creates a task in the caller's home", async () => {
    await createTask(formData({ title: "Change the filter", intervalDays: "30", notes: "Kitchen" }));

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
      formData({ title: "Descale kettle", intervalDays: "90", firstDueAt: "2026-06-01" }),
    );

    const task = await only();
    expect(task.nextDueAt.getFullYear()).toBe(2026);
    expect(task.nextDueAt.getMonth()).toBe(5);
    expect(task.nextDueAt.getDate()).toBe(1);
    expect(task.nextDueAt.getHours()).toBe(9);
  });

  it("defaults to due today when no date is given", async () => {
    await createTask(formData({ title: "Water plants", intervalDays: "7" }));

    const task = await only();
    expect(task.nextDueAt.toDateString()).toBe(new Date().toDateString());
  });

  it("stores blank notes as null rather than an empty string", async () => {
    await createTask(formData({ title: "Task", intervalDays: "7", notes: "   " }));

    expect((await only()).notes).toBeNull();
  });

  it("ignores a task with no title", async () => {
    await createTask(formData({ title: "   ", intervalDays: "7" }));

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
    await createTask(formData({ title: "Task", intervalDays }));

    expect(await prisma.recurringTask.count()).toBe(0);
  });

  it("accepts the boundary intervals", async () => {
    await createTask(formData({ title: "Daily", intervalDays: "1" }));
    await createTask(formData({ title: "Decade", intervalDays: "3650" }));

    expect(await prisma.recurringTask.count()).toBe(2);
  });

  it("falls back to today when the given date is unparseable", async () => {
    await createTask(
      formData({ title: "Task", intervalDays: "7", firstDueAt: "not-a-date" }),
    );

    const task = await only();
    expect(Number.isNaN(task.nextDueAt.getTime())).toBe(false);
    expect(task.nextDueAt.toDateString()).toBe(new Date().toDateString());
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
    const expected = new Date();
    expected.setDate(expected.getDate() + 10);

    expect(updated.nextDueAt.toDateString()).toBe(expected.toDateString());
    expect(updated.nextDueAt.getHours()).toBe(9);
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

    const expected = new Date();
    expected.setDate(expected.getDate() + 7);
    expect((await only()).nextDueAt.toDateString()).toBe(expected.toDateString());
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

    expect(second.toDateString()).toBe(first.toDateString());
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
    expect(updated.nextDueAt.getMonth()).toBe(11);
    expect(updated.nextDueAt.getDate()).toBe(24);
  });

  it("keeps the existing due date when none is supplied", async () => {
    const original = new Date("2026-05-05T09:00:00");
    const task = await seedTask({ homeId: home.id, createdById: member.id, nextDueAt: original });

    await updateTask(formData({ taskId: task.id, title: "Renamed", intervalDays: "7" }));

    expect((await only()).nextDueAt.toISOString()).toBe(original.toISOString());
  });

  it("rejects an invalid interval and leaves the task untouched", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id, intervalDays: 7 });

    await updateTask(formData({ taskId: task.id, title: "Renamed", intervalDays: "0" }));

    expect(await only()).toMatchObject({ title: "Water the plants", intervalDays: 7 });
  });
});

describe("deleteTask", () => {
  it("removes the task", async () => {
    const task = await seedTask({ homeId: home.id, createdById: member.id });

    await deleteTask(formData({ taskId: task.id }));

    expect(await prisma.recurringTask.count()).toBe(0);
  });
});
