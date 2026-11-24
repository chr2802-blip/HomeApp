"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireHomeUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { readForm, requiredText } from "@/lib/form";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { sayIn, type Say } from "@/lib/copy/say";
import { BABY } from "@/lib/copy/baby";
import { instantFromLocal } from "@/lib/time";
import {
  BOTTLE_MILKS,
  BREAST_SIDES,
  MAX_BABY_NAME_LENGTH,
  MAX_BOTTLE_ML,
  MAX_FOOD_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_SIDE_SECONDS,
  readBabyDetails,
  resumableFeed,
  switchBreastSide,
  type BreastDetails,
  type BreastSide,
  type DiaperDetails,
  type FeedDetails,
} from "@/lib/baby";

/**
 * The baby log: starting one, its settings, and writing, correcting and deleting its
 * entries.
 *
 * Everybody's, like the pantry: who fed the baby at three in the morning is not a
 * question about who runs the household, so there is no admin check. The home comes
 * from the session and every query goes through `homeDb`, so an id from another home is
 * simply not found.
 *
 * Every time arrives as a `datetime-local` value and is read on the household's clock
 * (`instantFromLocal`), never the server's or the phone's.
 */

/** Everything the log draws hangs off `/baby`, its charts included. */
function refresh() {
  revalidatePath("/baby", "layout");
}

/** The home's baby — the first, which is the only one the page shows. */
async function homeBaby(homeId: string) {
  return homeDb(homeId).baby.findFirst({ orderBy: { createdAt: "asc" } });
}

/** An entry in the caller's own home, or nothing. */
async function entryInScope(homeId: string, id: string) {
  return homeDb(homeId).babyEvent.findUnique({ where: { id } });
}

/** The last value sent under a name — a checkbox sends a hidden "off" before its "on". */
function lastValue(formData: FormData, name: string): string | undefined {
  const values = formData.getAll(name);
  const last = values[values.length - 1];
  return typeof last === "string" ? last : undefined;
}

function readNote(formData: FormData): string | null {
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_NOTE_LENGTH);
  return note || null;
}

/** A time field, defaulting to now when left empty; refused when unreadable or ahead. */
function readTime(raw: FormDataEntryValue | null, say: Say, now: Date): { ok: true; at: Date } | { ok: false; error: string } {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: true, at: now };
  const at = instantFromLocal(value);
  if (!at) return { ok: false, error: say(BABY.badTime) };
  // A minute's grace: a phone's clock a little ahead of the server's is not the future.
  if (at.getTime() > now.getTime() + 60_000) return { ok: false, error: say(BABY.notYetHappened) };
  // The field holds minutes. Left on the minute it is now, it means now — to the second,
  // so two things logged in the same minute keep the order they were logged in.
  if (Math.floor(at.getTime() / 60_000) === Math.floor(now.getTime() / 60_000)) return { ok: true, at: now };
  return { ok: true, at };
}

function babySchema(say: Say) {
  return z.object({ name: requiredText(say(BABY.nameRequired), MAX_BABY_NAME_LENGTH) });
}

/** Starts the home's log, named after the baby. A second press finds the first one. */
export async function createBaby(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const form = readForm(babySchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);
  if (!(await homeBaby(user.homeId))) {
    await homeDb(user.homeId).baby.create({ data: { homeId: user.homeId, name: form.fields.name } });
  }
  refresh();
  return ok();
}

const TRACKS = ["trackSleep", "trackBreast", "trackBottle", "trackSolid", "trackDiaper"] as const;

/** The baby's name and which kinds the page offers. A kind not mentioned is left alone. */
export async function updateBaby(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const form = readForm(babySchema(say), formData, user.homeLanguage);
  if (!form.ok) return fail(form.error);
  const baby = await homeBaby(user.homeId);
  if (!baby) return fail(say(BABY.nameRequired));

  const data: Prisma.BabyUpdateInput = { name: form.fields.name };
  for (const track of TRACKS) {
    const value = lastValue(formData, track);
    if (value === "on" || value === "off") data[track] = value === "on";
  }
  await homeDb(user.homeId).baby.update({ where: { id: baby.id }, data });
  refresh();
  return ok();
}

/**
 * The one-press sleep button: asleep now if the baby is awake in the log, awake now if
 * a sleep is running. Asked of the stored log rather than the button's label, so two
 * parents pressing at once end up with one sleep, not two.
 */
export async function toggleSleep(): Promise<void> {
  const user = await requireHomeUser();
  const baby = await homeBaby(user.homeId);
  if (!baby) return;
  const db = homeDb(user.homeId);
  const now = new Date();
  const running = await db.babyEvent.findFirst({
    where: { homeId: user.homeId,
        babyId: baby.id, kind: "SLEEP", endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    await db.babyEvent.update({ where: { id: running.id }, data: { endedAt: now } });
  } else {
    await db.babyEvent.create({
      data: {
        homeId: user.homeId,
        babyId: baby.id,
        kind: "SLEEP",
        startedAt: now,
        details: { night: null },
        createdById: user.id,
      },
    });
  }
  refresh();
}

/**
 * A sleep written or corrected by hand — the one somebody forgot to press for. An end
 * left empty is a sleep still going; the kind is "auto" (decided by the start time),
 * "nap" or "night".
 */
export async function saveSleep(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const baby = await homeBaby(user.homeId);
  if (!baby) return fail(say(BABY.badTime));
  const now = new Date();

  const start = readTime(formData.get("start"), say, now);
  if (!start.ok) return fail(start.error);
  const endRaw = String(formData.get("end") ?? "").trim();
  let endedAt: Date | null = null;
  if (endRaw) {
    const end = readTime(endRaw, say, now);
    if (!end.ok) return fail(end.error);
    if (end.at.getTime() <= start.at.getTime()) return fail(say(BABY.endBeforeStart));
    endedAt = end.at;
  }
  const kind = String(formData.get("sleepKind") ?? "auto");
  const night = kind === "night" ? true : kind === "nap" ? false : null;

  const db = homeDb(user.homeId);
  const id = String(formData.get("id") ?? "");
  const existing = id ? await entryInScope(user.homeId, id) : null;
  if (id && (!existing || existing.kind !== "SLEEP")) return fail(say(BABY.badTime));

  // One sleep running at a time: a second one would make "asleep since" ambiguous.
  if (!endedAt) {
    const running = await db.babyEvent.findFirst({
      where: { homeId: user.homeId,
        babyId: baby.id, kind: "SLEEP", endedAt: null, NOT: existing ? { id: existing.id } : undefined },
    });
    if (running) return fail(say(BABY.alreadyAsleep));
  }

  const data = { startedAt: start.at, endedAt, details: { night }, note: readNote(formData) };
  if (existing) await db.babyEvent.update({ where: { id: existing.id }, data });
  else {
    await db.babyEvent.create({
      data: { ...data, homeId: user.homeId,
        babyId: baby.id, kind: "SLEEP", createdById: user.id },
    });
  }
  refresh();
  return ok();
}

/**
 * A breast feed's side pressed: starts a feed on it if none is running, switches to it
 * if another side is, and pauses it if it is the side already running. Each step banks
 * what ran before (`switchBreastSide`), and everything is worked out from instants, so
 * the timer is right on every phone and after the app was closed.
 */
export async function pressBreastSide(formData: FormData): Promise<void> {
  const user = await requireHomeUser();
  const baby = await homeBaby(user.homeId);
  const side = String(formData.get("side") ?? "") as BreastSide;
  if (!baby || !BREAST_SIDES.includes(side)) return;
  const db = homeDb(user.homeId);
  const now = new Date();

  const running = await db.babyEvent.findFirst({
    where: { homeId: user.homeId,
        babyId: baby.id, kind: "FEED", endedAt: null, details: { path: ["method"], equals: "BREAST" } },
    orderBy: { startedAt: "desc" },
  });
  if (running) {
    const details = readBabyDetails("FEED", running.details).details as BreastDetails;
    const next = switchBreastSide(details, details.running === side ? null : side, now);
    await db.babyEvent.update({ where: { id: running.id }, data: { details: next } });
  } else {
    const empty: BreastDetails = { method: "BREAST", left: 0, right: 0, running: null, runningSince: null, lastSide: null };
    await db.babyEvent.create({
      data: {
        homeId: user.homeId,
        babyId: baby.id,
        kind: "FEED",
        startedAt: now,
        details: switchBreastSide(empty, side, now),
        createdById: user.id,
      },
    });
  }
  refresh();
}

/**
 * A finished breast feed carried on: its end is taken off again and its sides keep what
 * they had, so the timer picks up where "Done" left it rather than starting a new feed.
 * Paused, with no side running — the next press on a side starts it. Only the feed
 * `resumableFeed` names can be carried on, so a feed from the morning, or one while
 * another timer runs, is left alone.
 */
export async function resumeFeed(formData: FormData): Promise<void> {
  const user = await requireHomeUser();
  const baby = await homeBaby(user.homeId);
  const id = String(formData.get("id") ?? "");
  if (!baby || !id) return;
  const db = homeDb(user.homeId);
  const now = new Date();
  const feeds = await db.babyEvent.findMany({
    where: { homeId: user.homeId, babyId: baby.id, kind: "FEED", details: { path: ["method"], equals: "BREAST" } },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
  const feed = resumableFeed(feeds, now);
  if (!feed || feed.id !== id) return;
  const details = readBabyDetails("FEED", feed.details).details as BreastDetails;
  await db.babyEvent.update({
    where: { id: feed.id },
    data: { endedAt: null, details: switchBreastSide(details, null, now) },
  });
  refresh();
}

const minutesField = z.coerce.number().min(0).max(MAX_SIDE_SECONDS / 60).catch(-1);

/**
 * A feed written, corrected or finished. `method` is BREAST, BOTTLE or SOLID; a
 * running breast feed sent with `finish` is stopped here, with its sides banked and its
 * end at now. A breast feed typed by hand is its minutes on each side.
 */
export async function saveFeed(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const baby = await homeBaby(user.homeId);
  if (!baby) return fail(say(BABY.badTime));
  const db = homeDb(user.homeId);
  const now = new Date();

  const id = String(formData.get("id") ?? "");
  const existing = id ? await entryInScope(user.homeId, id) : null;
  if (id && (!existing || existing.kind !== "FEED")) return fail(say(BABY.badTime));
  const note = readNote(formData);

  // The live timer's "Done": the time and the sides are the timer's own.
  if (existing && formData.get("finish") === "1") {
    const details = readBabyDetails("FEED", existing.details).details as FeedDetails;
    if (details.method !== "BREAST") return fail(say(BABY.badTime));
    const stopped = switchBreastSide(details, null, now);
    await db.babyEvent.update({ where: { id: existing.id }, data: { details: stopped, endedAt: now, note } });
    refresh();
    return ok();
  }

  // The timer's sheet sent before any side was pressed: there is no feed yet to save.
  if (!existing && formData.get("timer") === "1") return fail(say(BABY.tapASide));

  const time = readTime(formData.get("at"), say, now);
  if (!time.ok) return fail(time.error);
  const method = String(formData.get("method") ?? "");

  let details: FeedDetails;
  let endedAt: Date | null = null;
  if (method === "BREAST") {
    const left = minutesField.parse(formData.get("left") || 0);
    const right = minutesField.parse(formData.get("right") || 0);
    if (left < 0 || right < 0) return fail(say(BABY.tooMuch));
    if (left + right === 0) return fail(say(BABY.noMinutes));
    const ended = String(formData.get("lastSide") ?? "");
    const lastSide: BreastSide = BREAST_SIDES.includes(ended as BreastSide) ? (ended as BreastSide) : right > 0 ? "RIGHT" : "LEFT";
    details = { method, left: Math.round(left * 60), right: Math.round(right * 60), running: null, runningSince: null, lastSide };
    endedAt = new Date(time.at.getTime() + (details.left + details.right) * 1000);
  } else if (method === "BOTTLE") {
    const milk = String(formData.get("milk") ?? "");
    const mlRaw = String(formData.get("ml") ?? "").trim();
    const ml = mlRaw ? Number(mlRaw) : null;
    if (ml !== null && (!Number.isInteger(ml) || ml < 0 || ml > MAX_BOTTLE_ML)) return fail(say(BABY.tooMuch));
    details = { method, milk: BOTTLE_MILKS.includes(milk as never) ? (milk as (typeof BOTTLE_MILKS)[number]) : "FORMULA", ml };
  } else if (method === "SOLID") {
    const food = String(formData.get("food") ?? "").trim();
    if (!food) return fail(say(BABY.foodRequired));
    details = { method, food: food.slice(0, MAX_FOOD_LENGTH) };
  } else {
    return fail(say(BABY.badTime));
  }

  const data = { startedAt: time.at, endedAt, details, note };
  if (existing) await db.babyEvent.update({ where: { id: existing.id }, data });
  else {
    await db.babyEvent.create({
      data: { ...data, homeId: user.homeId,
        babyId: baby.id, kind: "FEED", createdById: user.id },
    });
  }
  refresh();
  return ok();
}

/** A nappy: wet, dirty or both, at a time that defaults to now. */
export async function saveDiaper(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireHomeUser();
  const say = sayIn(user.homeLanguage);
  const baby = await homeBaby(user.homeId);
  if (!baby) return fail(say(BABY.badTime));
  const now = new Date();

  const content = String(formData.get("content") ?? "");
  const details: DiaperDetails | null =
    content === "WET"
      ? { wet: true, dirty: false }
      : content === "DIRTY"
        ? { wet: false, dirty: true }
        : content === "BOTH"
          ? { wet: true, dirty: true }
          : null;
  if (!details) return fail(say(BABY.chooseDiaper));
  const time = readTime(formData.get("at"), say, now);
  if (!time.ok) return fail(time.error);

  const db = homeDb(user.homeId);
  const id = String(formData.get("id") ?? "");
  const existing = id ? await entryInScope(user.homeId, id) : null;
  if (id && (!existing || existing.kind !== "DIAPER")) return fail(say(BABY.badTime));

  const data = { startedAt: time.at, details, note: readNote(formData) };
  if (existing) await db.babyEvent.update({ where: { id: existing.id }, data });
  else {
    await db.babyEvent.create({
      data: { ...data, homeId: user.homeId,
        babyId: baby.id, kind: "DIAPER", createdById: user.id },
    });
  }
  refresh();
  return ok();
}

/** An entry taken out of the log, for everyone. */
export async function deleteBabyEvent(formData: FormData): Promise<void> {
  const user = await requireHomeUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // `deleteMany` through homeDb: another home's id deletes nothing rather than throwing.
  await homeDb(user.homeId).babyEvent.deleteMany({ where: { id } });
  refresh();
}
