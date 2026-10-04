"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertPublicUrl } from "@/lib/safe-fetch";
import { sendPushToUsers } from "@/lib/push";
import { sayIn } from "@/lib/copy/say";
import { APP } from "@/lib/copy/app";

/**
 * A push endpoint is issued by the browser's push service and is only known to the
 * device holding it, so possession of the endpoint is what identifies the device.
 *
 * Registering therefore claims the endpoint for whoever is signed in: on a shared
 * family tablet the subscription legitimately moves to the person now using it.
 * Removing is different — there is no case for deleting a subscription that is not
 * yours, so that is scoped to the caller.
 *
 * **The endpoint is a URL this server will POST to**, every morning and at the end of
 * every cook-mode timer, and it arrives as an argument anybody signed in can send. So it
 * is held to what a push service's address is — https, on the public internet, by name
 * and by every address the name resolves to (`assertPublicUrl`) — and the keys to what a
 * browser hands out. Anything else is not saved: a URL pointing back into the server's
 * own network would otherwise have the reminder job knocking on it daily.
 */
const subscriptionSchema = z.object({
  endpoint: z.string().max(2048).url(),
  keys: z.object({
    // base64url: a 65-byte P-256 key and a 16-byte secret, with room to spare.
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{40,200}=*$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}=*$/),
  }),
});

/** Whether a push endpoint is one this server may send to. */
async function publicEndpoint(endpoint: string): Promise<boolean> {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    await assertPublicUrl(url);
    return true;
  } catch {
    return false;
  }
}

export async function saveSubscription(raw: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<boolean> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success || !(await publicEndpoint(parsed.data.endpoint))) return false;
  const subscription = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId: user.id, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
  return true;
}

/**
 * Called by the log-out button before the session ends (`LogoutButton`): a device signed
 * out of an account stops hearing about that account's tasks and timers. Without it, the
 * next person to pick up a shared tablet was told what was due in the last one's home.
 */
export async function removeSubscription(endpoint: string) {
  const user = await requireUser();
  if (typeof endpoint !== "string" || !endpoint) return;

  // Scoped to the caller: without this, any signed-in account could switch off
  // another person's notifications by passing their endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}

export async function sendTestPush() {
  const user = await requireUser();
  const delivered = await sendPushToUsers([user.id], {
    title: "HomeHub",
    body: sayIn(user.homeLanguage)(APP.push.testBody),
    url: "/dashboard",
  });
  return delivered;
}
