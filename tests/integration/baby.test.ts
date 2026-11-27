import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createBaby,
  deleteBabyEvent,
  finishBreastFeed,
  pressBreastSide,
  resumeFeed,
  resumeSleep,
  saveDiaper,
  saveFeed,
  saveSleep,
  toggleSleep,
  updateBaby,
} from "@/app/actions/baby";
import { localInputValue } from "@/lib/time";
import { readBabyDetails, type BreastDetails } from "@/lib/baby";
import { createHome, createHomeWithMembers, createUser, formData, signIn, submit } from "../helpers/factories";

/**
 * The baby log's writes: everybody in the home may keep it, every entry stays in its own
 * home, a timer is a row with no end, and what a sheet sends is checked before it is
 * stored.
 */
let home: Awaited<ReturnType<typeof createHomeWithMembers>>["home"];
let member: Awaited<ReturnType<typeof createHomeWithMembers>>["member"];

beforeEach(async () => {
  ({ home, member } = await createHomeWithMembers());
  await signIn(member);
  expect(await submit(createBaby, { name: "Ella" })).toEqual({ ok: true });
});

const local = (minutesAgo: number) => localInputValue(new Date(Date.now() - minutesAgo * 60_000));
const events = () => prisma.babyEvent.findMany({ where: { homeId: home.id }, orderBy: { startedAt: "asc" } });

describe("the log itself", () => {
  it("is started by an ordinary member, once per home", async () => {
    expect(await submit(createBaby, { name: "Again" })).toEqual({ ok: true });
    const babies = await prisma.baby.findMany({ where: { homeId: home.id } });
    expect(babies.map((baby) => baby.name)).toEqual(["Ella"]);
  });

  it("turns kinds on and off, leaving one not mentioned alone", async () => {
    await submit(updateBaby, { name: "Ella Marie", trackBreast: ["off"], trackSolid: ["off", "on"] });
    const baby = await prisma.baby.findFirstOrThrow({ where: { homeId: home.id } });
    expect(baby).toMatchObject({ name: "Ella Marie", trackBreast: false, trackSolid: true, trackSleep: true });
  });
});

describe("sleep", () => {
  it("starts and stops with one button, one sleep at a time", async () => {
    await toggleSleep();
    let [sleep] = await events();
    expect(sleep).toMatchObject({ kind: "SLEEP", endedAt: null, createdById: member.id });

    await toggleSleep();
    [sleep] = await events();
    expect(sleep!.endedAt).not.toBeNull();
    expect(await events()).toHaveLength(1);
  });

  it("leaves a sleep alone when a press says what it already is", async () => {
    await toggleSleep(formData({ to: "asleep" }));
    await toggleSleep(formData({ to: "asleep" }));
    let [sleep] = await events();
    expect(sleep!.endedAt).toBeNull();
    await toggleSleep(formData({ to: "awake" }));
    await toggleSleep(formData({ to: "awake" }));
    [sleep] = await events();
    expect(sleep!.endedAt).not.toBeNull();
    expect(await events()).toHaveLength(1);
  });

  it("is written by hand across midnight, and corrected", async () => {
    const result = await submit(saveSleep, { start: "2026-01-10T20:05", end: "2026-01-11T06:25", sleepKind: "auto" });
    expect(result).toEqual({ ok: true });
    const [sleep] = await events();
    expect(sleep!.startedAt).toEqual(new Date("2026-01-10T19:05:00Z"));
    expect(sleep!.endedAt).toEqual(new Date("2026-01-11T05:25:00Z"));

    await submit(saveSleep, { id: sleep!.id, start: "2026-01-10T20:00", end: "2026-01-11T06:25", sleepKind: "nap", note: "Urolig" });
    const [again] = await events();
    expect(again).toMatchObject({ details: { night: false }, note: "Urolig" });
    expect(again!.startedAt).toEqual(new Date("2026-01-10T19:00:00Z"));
  });

  it("refuses an end before its start, a time to come, and a second sleep running", async () => {
    expect(await submit(saveSleep, { start: local(10), end: local(30) })).toMatchObject({ ok: false });
    expect(await submit(saveSleep, { start: local(-120) })).toMatchObject({ ok: false });
    await toggleSleep();
    expect(await submit(saveSleep, { start: local(60) })).toMatchObject({ ok: false });
    expect(await events()).toHaveLength(1);
  });
});

describe("carrying on", () => {
  it("carries on a sleep stopped minutes ago, banking the gap as time awake", async () => {
    const baby = await prisma.baby.findFirstOrThrow({ where: { homeId: home.id } });
    const sleep = await prisma.babyEvent.create({
      data: {
        homeId: home.id,
        babyId: baby.id,
        kind: "SLEEP",
        startedAt: new Date(Date.now() - 60 * 60_000),
        endedAt: new Date(Date.now() - 5 * 60_000),
        details: { night: null, awake: 120 },
      },
    });
    await resumeSleep(formData({ id: sleep.id }));
    const [again] = await events();
    expect(again!.endedAt).toBeNull();
    const awake = readBabyDetails("SLEEP", again!.details).details.awake;
    expect(awake).toBeGreaterThanOrEqual(120 + 299);
    expect(awake).toBeLessThan(120 + 330);
    expect(await events()).toHaveLength(1);
  });

  it("leaves a sleep stopped past the window alone", async () => {
    const baby = await prisma.baby.findFirstOrThrow({ where: { homeId: home.id } });
    const sleep = await prisma.babyEvent.create({
      data: { homeId: home.id, babyId: baby.id, kind: "SLEEP", startedAt: new Date(Date.now() - 3 * 3_600_000), endedAt: new Date(Date.now() - 45 * 60_000), details: { night: null } },
    });
    await resumeSleep(formData({ id: sleep.id }));
    expect((await events())[0]!.endedAt).not.toBeNull();
  });

  it("carries on a finished breast feed, paused, keeping its sides", async () => {
    await pressBreastSide(formData({ side: "LEFT" }));
    let [feed] = await events();
    await submit(saveFeed, { id: feed!.id, finish: "1" });
    await resumeFeed(formData({ id: feed!.id }));
    [feed] = await events();
    expect(feed!.endedAt).toBeNull();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: null, lastSide: "LEFT" });

    // Still one feed: the next press on a side runs this one, not a new one.
    await pressBreastSide(formData({ side: "RIGHT" }));
    expect(await events()).toHaveLength(1);
  });

  it("writes and refuses time awake typed into a sleep", async () => {
    expect(await submit(saveSleep, { start: local(90), end: local(10), awake: "15" })).toEqual({ ok: true });
    expect((await events())[0]!.details).toMatchObject({ awake: 900 });
    expect(await submit(saveSleep, { start: local(200), end: local(180), awake: "30" })).toMatchObject({ ok: false });
  });
});

describe("feeds", () => {
  it("runs a breast feed's timer on the server, side by side, and finishes it", async () => {
    await pressBreastSide(formData({ side: "LEFT" }));
    let [feed] = await events();
    let details = readBabyDetails("FEED", feed!.details).details as BreastDetails;
    expect(feed!.endedAt).toBeNull();
    expect(details).toMatchObject({ method: "BREAST", running: "LEFT", lastSide: "LEFT" });

    await pressBreastSide(formData({ side: "RIGHT" }));
    [feed] = await events();
    details = readBabyDetails("FEED", feed!.details).details as BreastDetails;
    expect(details).toMatchObject({ running: "RIGHT", lastSide: "RIGHT" });

    expect(await submit(saveFeed, { id: feed!.id, finish: "1", note: "Godt" })).toEqual({ ok: true });
    [feed] = await events();
    details = readBabyDetails("FEED", feed!.details).details as BreastDetails;
    expect(feed).toMatchObject({ note: "Godt" });
    expect(feed!.endedAt).not.toBeNull();
    expect(details.running).toBeNull();
    expect(await events()).toHaveLength(1);
  });

  it("does what a press said, not the opposite, when another phone got there first", async () => {
    // Phone A starts the left side; phone B, which has not heard yet, presses "start left".
    await pressBreastSide(formData({ side: "LEFT", to: "run" }));
    await pressBreastSide(formData({ side: "LEFT", to: "run" }));
    let [feed] = await events();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: "LEFT" });

    // A pause of a side that is not running changes nothing, and starts nothing.
    await pressBreastSide(formData({ side: "RIGHT", to: "pause" }));
    [feed] = await events();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: "LEFT" });

    await pressBreastSide(formData({ side: "LEFT", to: "pause" }));
    await pressBreastSide(formData({ side: "LEFT", to: "pause" }));
    [feed] = await events();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: null, lastSide: "LEFT" });

    // Started again after the pause: the same feed carries on.
    await pressBreastSide(formData({ side: "RIGHT", to: "run" }));
    [feed] = await events();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: "RIGHT" });
    expect(await events()).toHaveLength(1);
  });

  it("finishes a feed from the dashboard's tile, once", async () => {
    await pressBreastSide(formData({ side: "LEFT", to: "run" }));
    let [feed] = await events();
    await finishBreastFeed(formData({ id: feed!.id }));
    [feed] = await events();
    expect(feed!.endedAt).not.toBeNull();
    expect(readBabyDetails("FEED", feed!.details).details).toMatchObject({ running: null });
    const ended = feed!.endedAt;

    // The other phone presses "end" too, and then "Done" in its stale sheet: nothing moves.
    await finishBreastFeed(formData({ id: feed!.id }));
    expect(await submit(saveFeed, { id: feed!.id, finish: "1" })).toEqual({ ok: true });
    [feed] = await events();
    expect(feed!.endedAt).toEqual(ended);

    // A pause pressed on a phone that still shows it running starts nothing new.
    await pressBreastSide(formData({ side: "LEFT", to: "pause" }));
    expect(await events()).toHaveLength(1);
  });

  it("writes a breast feed typed by hand as minutes on each side", async () => {
    expect(await submit(saveFeed, { method: "BREAST", at: local(30), left: "12", right: "8", lastSide: "LEFT" })).toEqual({ ok: true });
    const [feed] = await events();
    expect(feed!.details).toMatchObject({ left: 720, right: 480, lastSide: "LEFT" });
    expect(feed!.endedAt!.getTime() - feed!.startedAt.getTime()).toBe(20 * 60_000);
    expect(await submit(saveFeed, { method: "BREAST", at: local(30) })).toMatchObject({ ok: false });
  });

  it("writes a bottle and solids, and refuses what cannot be", async () => {
    expect(await submit(saveFeed, { method: "BOTTLE", milk: "BREAST_MILK", ml: "120" })).toEqual({ ok: true });
    expect(await submit(saveFeed, { method: "SOLID", food: " Grød " })).toEqual({ ok: true });
    expect(await submit(saveFeed, { method: "BOTTLE", ml: "5000" })).toMatchObject({ ok: false });
    expect(await submit(saveFeed, { method: "SOLID", food: "" })).toMatchObject({ ok: false });
    expect((await events()).map((event) => event.details)).toEqual([
      { method: "BOTTLE", milk: "BREAST_MILK", ml: 120 },
      { method: "SOLID", food: "Grød" },
    ]);
  });

  it("asks for a side before the timer's sheet can be saved", async () => {
    expect(await submit(saveFeed, { method: "BREAST", timer: "1" })).toMatchObject({ ok: false });
  });
});

describe("nappies", () => {
  it("are wet, dirty or both", async () => {
    expect(await submit(saveDiaper, { content: "BOTH", at: local(5) })).toEqual({ ok: true });
    expect(await submit(saveDiaper, { content: "" })).toMatchObject({ ok: false });
    const [diaper] = await events();
    expect(diaper).toMatchObject({ kind: "DIAPER", details: { wet: true, dirty: true } });
  });
});

describe("another home", () => {
  it("cannot reach this home's entries to change or delete them", async () => {
    await submit(saveDiaper, { content: "WET" });
    const [diaper] = await events();

    const other = await createHome();
    const stranger = await createUser({ homeId: other.id, role: "ADMIN" });
    await signIn(stranger);
    await submit(createBaby, { name: "Other" });

    expect(await submit(saveDiaper, { id: diaper!.id, content: "DIRTY" })).toMatchObject({ ok: false });
    await deleteBabyEvent(formData({ id: diaper!.id }));
    expect(await prisma.babyEvent.findUnique({ where: { id: diaper!.id } })).toMatchObject({ details: { wet: true, dirty: false } });
  });

  it("deletes from its own", async () => {
    await submit(saveDiaper, { content: "WET" });
    const [diaper] = await events();
    await deleteBabyEvent(formData({ id: diaper!.id }));
    expect(await events()).toHaveLength(0);
  });
});
