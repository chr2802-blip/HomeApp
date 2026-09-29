import { Client, Receiver } from "@upstash/qstash";

import { prisma } from "./prisma";
import { sendPushToUsers } from "./push";
import { PORTIONS_PARAM } from "./recipes";
import { sayIn } from "./copy/say";
import { APP } from "./copy/app";

/**
 * A cook-mode timer that rings on a phone whose page is not running.
 *
 * Action mode counts its timers in the page, and a page on a phone stops running the
 * moment somebody switches app or locks the screen — which is exactly when a timer is
 * wanted. Nothing in a browser can schedule a notification for later (the Notification
 * Triggers proposal was abandoned), so the only thing that can wake a phone at a set
 * time is a push sent *from somewhere else* at that time.
 *
 * That somewhere is QStash: starting a timer publishes one message with `notBefore` set
 * to the timer's end, and QStash calls `/api/cook-timers/ring` then, which sends the push.
 * Vercel's own cron cannot do it — it runs on a schedule, not at an instant somebody
 * chose a minute ago.
 *
 * **Nothing is stored here.** The timer is the browser's `endsAt` (`lib/cook-session.ts`)
 * and the message id the browser keeps beside it; QStash holds the message until it is
 * due. A row of our own would be a second copy of a timer, and the one that disagreed —
 * stopped in the page, still ringing on the phone — would be the one somebody heard. So
 * stopping, restarting or leaving action mode cancels the message by that id, and a
 * message whose cancel never arrived rings for a timer that was running when it was set.
 *
 * Unconfigured (no `QSTASH_TOKEN`, or no signing keys) is off, silently, like push itself
 * without VAPID keys: the timers still count and buzz in the page exactly as they did.
 */

/** The longest a timer can be asked for. A recipe's step is at most an afternoon in the
 *  oven; a day is the bound a mistyped number or a hand-made request cannot get past. */
export const MAX_TIMER_MS = 24 * 60 * 60_000;

/** A timer rung this long after it ended is no longer news — QStash retrying through an
 *  outage, say. Better silence than the pasta telling somebody at ten o'clock. */
export const STALE_AFTER_MS = 10 * 60_000;

export type TimerPush = {
  userId: string;
  recipeId: string;
  /** Zero-based, as action mode counts; said one-based. */
  step: number;
  endsAt: number;
  /** How many the dish was being cooked for, so tapping the notification opens action
   *  mode at the same amounts. Null for the recipe as written. */
  portions: number | null;
};

export type TimerRequest = Omit<TimerPush, "userId">;

function client(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  // Retried only briefly: the cook is standing at the hob, and a timer that failed to
  // schedule still counts in the page.
  return new Client({ token, retry: { retries: 1 } });
}

function receiver(): Receiver | null {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return null;
  return new Receiver({ currentSigningKey, nextSigningKey });
}

/** Whether a timer can ring with the page closed at all. Both halves, because publishing
 *  a message the ring endpoint would then refuse to believe spends the quota for nothing. */
export function timerPushConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN && receiver() !== null;
}

/** The shape both directions share, and nothing about when. */
function readTimerShape(body: unknown): TimerRequest | null {
  if (!body || typeof body !== "object") return null;
  const { recipeId, step, endsAt, portions } = body as Record<string, unknown>;
  if (typeof recipeId !== "string" || !recipeId || recipeId.length > 64) return null;
  if (!Number.isInteger(step) || (step as number) < 0) return null;
  if (typeof endsAt !== "number" || !Number.isFinite(endsAt)) return null;
  const shown =
    Number.isInteger(portions) && (portions as number) >= 1 && (portions as number) <= 999
      ? (portions as number)
      : null;
  return { recipeId, step: step as number, endsAt, portions: shown };
}

/**
 * Reads what a browser asked for, trusting none of it. `now` is an argument so a test can
 * say when "now" is.
 */
export function readTimerRequest(body: unknown, now: number): TimerRequest | null {
  const timer = readTimerShape(body);
  // Already over is nothing to schedule; further than a day is not a cooking timer.
  if (!timer || timer.endsAt <= now || timer.endsAt - now > MAX_TIMER_MS) return null;
  return timer;
}

/** Reads a message QStash handed back. It was signed, so it is ours — but it may have been
 *  written by an older build, and a shape this one never wrote is dropped, not guessed at.
 *  Whether it is still worth ringing is `ringTimer`'s question, not this one's. */
export function readTimerPush(body: unknown): TimerPush | null {
  const timer = readTimerShape(body);
  const { userId } = (body ?? {}) as Record<string, unknown>;
  if (!timer || typeof userId !== "string" || !userId) return null;
  return { userId, ...timer };
}

/**
 * Where QStash will call. It has to be an address the internet can reach, which a
 * request's own origin is not always — so `APP_URL` wins where it is set, then the
 * production address Vercel names for every deployment (only `main` deploys, so that is
 * this build), and only then the request's origin.
 */
export function ringUrl(requestUrl: string): string {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base =
    process.env.APP_URL || (production ? `https://${production}` : new URL(requestUrl).origin);
  return new URL("/api/cook-timers/ring", base).href;
}

/**
 * Asks QStash to ring at `endsAt`, and answers the message id — the browser keeps it to
 * cancel with. Null where nothing was scheduled: unconfigured, or a person with no device
 * to send a push to, for whom a message would only spend the quota.
 */
export async function scheduleTimerPush(timer: TimerPush, url: string): Promise<string | null> {
  const qstash = client();
  if (!qstash || !timerPushConfigured()) return null;

  const devices = await prisma.pushSubscription.count({ where: { userId: timer.userId } });
  if (devices === 0) return null;

  const { messageId } = await qstash.publishJSON({
    url,
    body: timer,
    // Whole seconds, rounded up: a push a second late is a timer; one a second early is
    // a timer that rang before the page's own countdown said it was done.
    notBefore: Math.ceil(timer.endsAt / 1000),
    retries: 2,
  });
  return messageId;
}

/**
 * Cancels a message, but only one that is this person's: the id arrived from a browser,
 * and there is no reason one cook should be able to silence another's pasta. A message
 * already delivered, already cancelled or never known is simply nothing to do.
 */
export async function cancelTimerPush(userId: string, messageId: string): Promise<void> {
  const qstash = client();
  if (!qstash) return;
  try {
    const message = await qstash.messages.get(messageId);
    let owner: unknown = null;
    try {
      owner = (JSON.parse(message.body ?? "") as { userId?: unknown }).userId;
    } catch {}
    if (owner !== userId) return;
    await qstash.messages.cancel(messageId);
  } catch {
    // Gone already — delivered, cancelled, or never ours to find.
  }
}

/** Whether a request really came from QStash, by the signature over its body. */
export async function isSignedByQstash(signature: string | null, body: string): Promise<boolean> {
  const verifier = receiver();
  if (!verifier || !signature) return false;
  try {
    return await verifier.verify({ signature, body, clockTolerance: 5 });
  } catch {
    return false;
  }
}

/**
 * Sends the push for a timer that has run out. Read with no session, so the recipe's
 * title and its home's language come from the rows; `prisma` directly, because the only
 * identity here is the one the message carries, and the question asked of it is whether
 * that person still belongs to the recipe's home — somebody removed from the household
 * mid-dinner is not told about its pasta.
 *
 * Answers how many devices it reached, zero where it chose not to send at all.
 */
export async function ringTimer(timer: TimerPush, now: number): Promise<number> {
  if (now - timer.endsAt > STALE_AFTER_MS) return 0;

  const recipe = await prisma.recipe.findUnique({
    where: { id: timer.recipeId },
    select: {
      title: true,
      home: {
        select: {
          language: true,
          members: { where: { userId: timer.userId }, select: { userId: true } },
        },
      },
    },
  });
  if (!recipe || recipe.home.members.length === 0) return 0;

  const say = sayIn(recipe.home.language);
  const query = timer.portions !== null ? `?${PORTIONS_PARAM}=${timer.portions}` : "";
  return sendPushToUsers([timer.userId], {
    title: recipe.title,
    body: say(APP.push.timerDone, { number: timer.step + 1 }),
    url: `/recipes/${timer.recipeId}/cook${query}`,
    // One per step, so a restarted timer's notification replaces the last one rather
    // than stacking beside it, and it stays until it is seen: a timer is not news that
    // should slide away on its own while somebody is draining the pasta.
    tag: `cook-timer:${timer.recipeId}:${timer.step}`,
    requireInteraction: true,
  });
}
