/*
 * The service worker: notifications, and the part of the app that has to work in a shop.
 *
 * Two jobs, and they share this file because a browser allows one worker per scope. The
 * push handlers at the bottom are the older of the two. Everything above them is what
 * makes a list readable with no connection: the pages a household actually opens while
 * out are kept, along with the assets and pictures they are drawn with, and served from
 * here when the network cannot be reached.
 *
 * **Nothing here is ever served in front of a working network.** A page is fetched first
 * and only falls back to what was kept, so a list is stale for exactly as long as the
 * signal is gone. Only the assets are cache-first, because their names carry a hash of
 * their contents: a chunk that answers to that name cannot have changed.
 *
 * **Nothing but GET is touched.** Ticks are not sent from here — they are written to
 * IndexedDB by the page and sent to /api/lists/sync when there is something to send
 * (see `src/lib/offline-queue.ts`). A worker that replayed POSTs would be a second,
 * invisible copy of that logic with no way to tell the page what it had done.
 *
 * Bumping VERSION drops everything kept under the old one. Do it when a change would
 * make a kept page unable to draw itself — the kept pages and the kept assets go
 * together, so neither can be left pointing at the other's leftovers.
 */

const VERSION = "v1";
const PAGES = `homehub-pages-${VERSION}`;
const ASSETS = `homehub-assets-${VERSION}`;
const PREFS = `homehub-prefs-${VERSION}`;

/**
 * The four strings this file says on its own — the offline page and the push
 * fallback — hand-written rather than imported from `src/lib/copy/`. This is a plain
 * script served as-is from `public/`, outside the bundle and its build step, so there
 * is nothing here to import that from; a real catalogue for four strings would be the
 * kind of machinery this repo's conventions exist to avoid.
 */
const SW_STRINGS = {
  EN: {
    offlineTitle: "You are offline",
    offlineBody: "This page has not been opened on this phone yet, so there is nothing to show.",
    offlineLists: "The lists you have opened before are still here",
    offlineListsLink: "your lists",
    pushTitle: "HomeHub",
    pushBody: "You have a task due.",
  },
  DA: {
    offlineTitle: "I er offline",
    offlineBody: "Denne side er ikke åbnet på telefonen endnu, så der er intet at vise.",
    offlineLists: "Listerne I har åbnet før er her stadig",
    offlineListsLink: "jeres lister",
    pushTitle: "HomeHub",
    pushBody: "En opgave forfalder.",
  },
};

/** The `Request` a language preference is stashed under — a pseudo-URL, never fetched. */
const LANGUAGE_KEY = new Request("https://homehub.internal/__language");

/** The language the last page rendered was in, or English where nothing has been said. */
async function storedLanguage() {
  const cache = await caches.open(PREFS);
  const response = await cache.match(LANGUAGE_KEY);
  const value = response ? await response.text() : "EN";
  return value === "DA" ? "DA" : "EN";
}

/**
 * Records which language the household's pages are in now, and drops the kept pages
 * when that just changed.
 *
 * The pages this worker kept were rendered in whatever language was current when they
 * were fetched — `pageFromNetworkThenCache` below does not know or care which. Serving
 * one back after a switch would answer offline in the language the household just
 * left, which is exactly the staleness this cache exists to avoid noticing. Dropping
 * `PAGES` is the same "start over" `forgetThisHousehold` already does when a session
 * ends; this is that same reset for one household's language ending instead.
 */
async function setLanguage(language) {
  const previous = await storedLanguage();
  const cache = await caches.open(PREFS);
  await cache.put(LANGUAGE_KEY, new Response(language));
  if (previous !== language) await caches.delete(PAGES);
}

/**
 * The pages worth keeping: the lists, and the dashboard.
 *
 * The lists because that is what this is for, and the dashboard because it is where an
 * installed app opens — without it, a phone with no signal would land on a browser error
 * and never reach the lists at all.
 */
function isKeptPage(url) {
  return (
    url.origin === self.location.origin && /^\/(dashboard|lists)(\/[^/]+)?\/?$/.test(url.pathname)
  );
}

/** Immutable by name, or a picture that is replaced by writing a new one with a new id. */
function isKeptAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/api/photos/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest"
  );
}

/**
 * Pages are kept under their path alone.
 *
 * A list's address carries nothing else, and keeping one entry per query string would
 * fill the cache with copies of the same page and then miss on the one that was asked
 * for.
 */
function pageKey(url) {
  return new Request(`${url.origin}${url.pathname}`);
}

self.addEventListener("install", () => {
  // Nothing is precached: what is worth keeping is whatever this household has opened,
  // and a list nobody has looked at has nothing in it worth carrying to a shop.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("homehub-") && name !== PAGES && name !== ASSETS && name !== PREFS) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

/**
 * The login page asks for this browser's copy of the household to be forgotten.
 *
 * A rendered page carries one person's household in it, so it must not outlive their
 * session: whoever opens this browser next is a different person until they have proved
 * otherwise. The queue of unsent changes is dropped by the page itself, for the same
 * reason.
 *
 * **The pictures go too, and for a while they did not.** Only the page cache was
 * dropped here, on the reading that the assets are chunks named after their own
 * contents — but `/api/photos/` is kept alongside them, and those are the household's
 * photographs: its rooms, its cooking, the faces of the people in it. Left behind they
 * outlived the session with nothing to expire them, and because assets are served
 * cache-first they were never asked of the server again — so a picture stayed readable
 * by a browser whose session had ended, and by one whose membership had been revoked.
 *
 * Only the pictures are taken. The hashed chunks are nobody's household and dropping
 * them would make the next person wait for the app to download itself again.
 */
async function forgetThisHousehold() {
  await caches.delete(PAGES);

  const assets = await caches.open(ASSETS);
  for (const request of await assets.keys()) {
    if (new URL(request.url).pathname.startsWith("/api/photos/")) {
      await assets.delete(request);
    }
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "homehub:forget") {
    event.waitUntil(forgetThisHousehold());
  }
  // Posted by `OfflineSupport` on every load, so this stays current without anybody
  // having pressed anything — a household reads the app in the language it is in.
  if (event.data && event.data.type === "homehub:language" && typeof event.data.language === "string") {
    event.waitUntil(setLanguage(event.data.language));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Only reads. A tick is not sent from here — see the note at the top.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate" && isKeptPage(url)) {
    event.respondWith(pageFromNetworkThenCache(request, url));
    return;
  }

  // A caller that explicitly asked for no cache is asking the server, and is usually
  // asking *about* the server — what it will serve for an id, and to whom.
  if (isKeptAsset(url) && request.cache !== "no-store" && request.cache !== "reload") {
    event.respondWith(assetFromCacheThenNetwork(request));
  }
});

async function pageFromNetworkThenCache(request, url) {
  const cache = await caches.open(PAGES);

  try {
    const response = await fetch(request);

    // Sent to the login page: this session is over, so everything kept under it goes —
    // the same forgetting the login page itself asks for, because arriving there with
    // an expired cookie ends a session exactly as pressing Log out does.
    if (response.redirected && new URL(response.url).pathname.startsWith("/login")) {
      await forgetThisHousehold();
      return response;
    }

    if (response.ok) await cache.put(pageKey(url), response.clone());
    return response;
  } catch {
    const kept = await cache.match(pageKey(url));
    return kept ?? (await offlinePage());
  }
}

async function assetFromCacheThenNetwork(request) {
  const cache = await caches.open(ASSETS);
  const kept = await cache.match(request);
  if (kept) return kept;

  const response = await fetch(request);
  // Only what the browser may keep and reuse: an error or a redirect is an answer about
  // right now, not about the thing that was asked for.
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

/**
 * The answer for a page nobody has opened before, asked for with no connection.
 *
 * Plain on purpose: the app's own look is in a stylesheet this request could not reach
 * either. It says which pages do work, because the one thing worse than being offline is
 * not knowing what still works.
 */
async function offlinePage() {
  const language = await storedLanguage();
  const t = SW_STRINGS[language];

  return new Response(
    `<!doctype html><html lang="${language.toLowerCase()}"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${t.offlineTitle}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;` +
      `display:grid;place-items:center;min-height:100vh;background:#e5e7eb;color:#0f172a}` +
      `div{max-width:22rem;padding:2rem;text-align:center}a{color:inherit}</style></head>` +
      `<body><div><h1>${t.offlineTitle}</h1>` +
      `<p>${t.offlineBody}</p>` +
      `<p>${t.offlineLists}: <a href="/lists">${t.offlineListsLink}</a>.</p>` +
      `</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const t = SW_STRINGS[await storedLanguage()];
      let payload = { title: t.pushTitle, body: t.pushBody, url: "/dashboard" };
      try {
        if (event.data) payload = { ...payload, ...event.data.json() };
      } catch {}

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        data: { url: payload.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
