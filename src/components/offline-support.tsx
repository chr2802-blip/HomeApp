"use client";

import { useEffect } from "react";
import type { HomeLanguage } from "@prisma/client";
import { useQueueFlush } from "@/components/use-offline-list";
import { clearQueue } from "@/lib/offline-queue";

/**
 * Installs the service worker on every visit to the app.
 *
 * It used to be registered only by somebody turning notifications on, which was fine
 * while push was all it did. What it does now has to be in place *before* the signal goes
 * — a worker installed in an aisle is a worker that has kept nothing — so it is asked for
 * on every page of the app instead. Registering twice is free: a browser with this worker
 * already installed does nothing with the second call.
 *
 * A browser with no service workers at all (an old one, or a private window in some) is
 * left alone. It loses the reload-with-no-signal half of this and keeps the other half:
 * ticks are still queued and still sent, because that part is the page's own doing.
 *
 * It also sends whatever is waiting, from wherever in the app the household happens to be.
 * A shop's ticks must not have to wait for somebody to open a list again: coming back to
 * the dashboard is coming back, and the queue belongs to the browser rather than to the
 * page that filled it.
 *
 * `language` is posted to the worker on every load too, for the same reason the
 * registration happens here rather than on a switch: the worker has to know before the
 * signal goes, and a household reads the app in whatever language it is in right now,
 * not the language it happened to be in the last time somebody pressed Save on
 * `/settings`. The worker drops its kept pages when the posted language differs from
 * the one it last saw — see `setLanguage` in `public/sw.js`.
 */
export function OfflineSupport({ language }: { language: HomeLanguage }) {
  useQueueFlush();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A browser that refuses is a browser without the offline half of the app, which is
      // no reason to trouble the person reading it.
    });
  }, []);

  useEffect(() => {
    navigator.serviceWorker?.controller?.postMessage({ type: "homehub:language", language });
  }, [language]);

  return null;
}

/**
 * Forgets this browser's copy of somebody's household, on the one page that means the
 * session is over.
 *
 * Two things go: the pages the worker kept, which each carry a rendered household in
 * them, and the queue of changes nobody managed to send, whose ops name rows only the
 * session that made them could see. Whoever opens this browser next is a different person
 * until they have proved otherwise, and finding the last one's shopping there is worse
 * than losing a tick to a session that ended before it could be sent.
 */
export function ForgetOfflineData() {
  useEffect(() => {
    void clearQueue();
    navigator.serviceWorker?.controller?.postMessage({ type: "homehub:forget" });
  }, []);

  return null;
}
