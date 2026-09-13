"use server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

/**
 * A push endpoint is issued by the browser's push service and is only known to the
 * device holding it, so possession of the endpoint is what identifies the device.
 *
 * Registering therefore claims the endpoint for whoever is signed in: on a shared
 * family tablet the subscription legitimately moves to the person now using it.
 * Removing is different — there is no case for deleting a subscription that is not
 * yours, so that is scoped to the caller.
 */
export async function saveSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const user = await requireUser();

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
}

export async function removeSubscription(endpoint: string) {
  const user = await requireUser();

  // Scoped to the caller: without this, any signed-in account could switch off
  // another person's notifications by passing their endpoint.
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}

export async function sendTestPush() {
  const user = await requireUser();
  const delivered = await sendPushToUsers([user.id], {
    title: "HomeHub",
    body: "Notifications are working.",
    url: "/dashboard",
  });
  return delivered;
}
