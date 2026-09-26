import { saveSubscription } from "@/app/actions/push";

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

export async function readPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return "unconfigured";
  if (Notification.permission === "denied") return "blocked";
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    return (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Asks for permission and subscribes. Has to be called from a press: a browser refuses
 *  the permission prompt otherwise. */
export async function turnOnPush(): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string),
  });
  const json = subscription.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  await saveSubscription({ endpoint: json.endpoint, keys: json.keys });
  return "on";
}
