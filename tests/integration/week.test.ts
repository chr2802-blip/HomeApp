import { beforeEach, describe, expect, it } from "vitest";
import { weekWorkload } from "@/lib/week";
import { createHomeWithMembers, createTask } from "../helpers/factories";

/**
 * Which tasks are this week's, and which side of the bar each falls on.
 *
 * Every case here is about a recurring task, because a one-off is the easy half: done
 * once and gone. A recurring task is never finished, so "completed this week" and
 * "still owed" are not opposites — and the two ways of getting that wrong are a task
 * counted twice, which makes a household of one job read "1 of 2", and a task counted
 * as done while it is sitting there due again on Friday.
 *
 * The clock is passed in rather than read, so these say Wednesday and mean Wednesday.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
});

/** Midday on a Wednesday in the home's own zone, which is midday UTC + 2 in June. */
const WEDNESDAY = new Date("2026-06-03T10:00:00Z");
/** Instants inside that same week, and outside it. */
const MONDAY = new Date("2026-06-01T10:00:00Z");
const FRIDAY = new Date("2026-06-05T10:00:00Z");
const SUNDAY_LATE = new Date("2026-06-07T21:00:00Z");
const NEXT_MONDAY = new Date("2026-06-08T10:00:00Z");
const LAST_MONTH = new Date("2026-05-04T10:00:00Z");
const NEXT_MONTH = new Date("2026-07-06T10:00:00Z");

/** A task in this home, described by whatever the case is actually about. */
const task = (options: Partial<Parameters<typeof createTask>[0]>) =>
  createTask({ homeId: home.id, createdById: member.id, ...options });

describe("weekWorkload", () => {
  it("is nothing at all for a household with no tasks", async () => {
    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 0 });
  });

  it("counts a recurring task due later this week, not only one due by now", async () => {
    await task({ title: "Bins", nextDueAt: FRIDAY, intervalDays: 7 });

    // The whole week, not the part of it that has happened: a denominator that grew
    // every time a day turned over would mean a bar that fell back each morning
    // however much the household got through.
    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 1 });
  });

  it("counts one due on the last evening of the week and stops at the next", async () => {
    await task({ title: "Sunday jobs", nextDueAt: SUNDAY_LATE });
    await task({ title: "Next week", nextDueAt: NEXT_MONDAY });

    expect(await weekWorkload(home.id, WEDNESDAY)).toMatchObject({ outstanding: 1 });
  });

  it("still owes everything overdue from before this week", async () => {
    await task({ title: "Since May", nextDueAt: LAST_MONTH });

    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 1 });
  });

  it("counts a recurring task done this week and not due again as done", async () => {
    await task({ title: "Filter", nextDueAt: NEXT_MONTH, lastCompletedAt: MONDAY });

    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 1, outstanding: 0 });
  });

  it("counts one done on Monday and due again on Friday once, as still owed", async () => {
    await task({ title: "Bins", nextDueAt: FRIDAY, intervalDays: 2, lastCompletedAt: MONDAY });

    // The job is not behind them: it is sitting there due again before the week is out.
    // Counting it on both sides would make a household of one task read "1 of 2".
    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 1 });
  });

  it("ignores a completion from before this week", async () => {
    await task({ title: "Filter", nextDueAt: NEXT_MONTH, lastCompletedAt: LAST_MONTH });

    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 0 });
  });

  it("counts a one-off finished this week as done, whatever its date says", async () => {
    // A finished one-off keeps the date it was due, which is in the past for ever —
    // the exact row that would otherwise be owed every week from now on.
    await task({
      title: "Hang the shelf",
      intervalDays: null,
      nextDueAt: LAST_MONTH,
      lastCompletedAt: MONDAY,
    });

    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 1, outstanding: 0 });
  });

  it("keeps each household's week to itself", async () => {
    const neighbour = await createHomeWithMembers();
    await task({ nextDueAt: FRIDAY });
    await createTask({
      homeId: neighbour.home.id,
      createdById: neighbour.member.id,
      nextDueAt: FRIDAY,
    });

    expect(await weekWorkload(home.id, WEDNESDAY)).toEqual({ done: 0, outstanding: 1 });
  });
});
