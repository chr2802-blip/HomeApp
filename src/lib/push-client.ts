import { removeSubscription, saveSubscription } from "@/app/actions/push";

/**
 * This browser's side of push notifications: whether it can have them, and turning them
 * on. Two places ask — the offer on the dashboard and profile (`NotificationSetup`), and
 * action mode, which offers it beside a running timer because that is the moment somebody
 * finds out they wanted it. One copy, so the two cannot come to subscribe differently.
 */

export type PushState = "unsupported" | "unconfigured" | "off" | "on" | "blocked";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

/**
 * What this browser's notifications are, worked out once per page load — and put right on
 * the way, because a subscription can go missing on either side without anybody touching
 * it, and an iPhone is where it happens most:
 *
 * - **The browser lost it, the permission is still there.** iOS drops a home-screen app's
 *   subscription after an update, a long rest or a push it judged silent, and says nothing.
 *   This used to show the "turn on" offer again, which is what households reported as
 *   "I keep having to turn notifications on". With the permission still granted there is
 *   nothing to ask, so a new subscription is made here. Where the browser refuses one
 *   without a press (it is not documented whether WebKit does), the offer is shown as before.
 * - **The server lost it, the browser still has it.** `sendPushToUsers` deletes an endpoint
 *   a push service answers 404/410 for, and the browser keeps reading "on" while nothing
 *   arrives. So a subscription the browser holds is handed to the server again on every
 *   load; `saveSubscription` is an upsert, so one already there is left as it was.
 *
 * Memoised, because the app layout asks on every page (`OfflineSupport`) and the dashboard,
 * the profile and the kitchen ask again on the same load: one round of healing, not four.
 */
let settled: Promise<PushState> | null = null;

export function readPushState(): Promise<PushState> {
  settled ??= settlePushState().catch(() => "unsupported" as const);
  return settled;
}

async function settlePushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "blocked";
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js");
  } catch {
    return "unsupported";
  }
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await sendToServer(existing).catch(() => {});
    return "on";
  }
  if (Notification.permission !== "granted") return "off";
  try {
    await subscribeHere(registration);
    return "on";
  } catch {
    return "off";
  }
}

async function subscribeHere(registration: ServiceWorkerRegistration) {
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
  });
  await sendToServer(subscription);
}

async function sendToServer(subscription: PushSubscription) {
  const json = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  await saveSubscription({ endpoint: json.endpoint, keys: json.keys });
}

/** Asks for permission and subscribes. Has to be called from a press: a browser refuses
 *  the permission prompt otherwise. */
export async function turnOnPush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    const state = permission === "denied" ? "blocked" : "off";
    settled = Promise.resolve(state);
    return state;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  await subscribeHere(registration);
  settled = Promise.resolve("on");
  return "on";
}

/**
 * Stops this browser hearing about the account that is signing out of it: the server
 * forgets the endpoint while the session can still say whose it is, and the browser lets
 * go of the subscription so nothing else can claim it. Never throws and never takes long —
 * it runs on the way out of a log-out press, and a log-out that hung on a push service
 * would be worse than one that left a device subscribed.
 */
export async function forgetPushHere(): Promise<void> {
  settled = null;
  const forget = async () => {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await removeSubscription(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  };
  await Promise.race([forget().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 2000))]);
}
