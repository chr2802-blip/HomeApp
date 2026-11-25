"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

/**
 * Keeps the page at `href` fetched in full, so going to it draws at once rather than after
 * the server has answered. A `<Link prefetch>` fetches once, but `router.refresh()` and a
 * server action's revalidation both empty the router's cache — so it is asked again every
 * time `stamp` changes, which a server page's props do on each of those.
 */
export function useKeepWarm(href: string, stamp: unknown) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(href, { kind: PrefetchKind.FULL });
  }, [router, href, stamp]);
}

/** How old a page drawn from the router's cache may be before it asks the server again. */
const FRESH_MS = 5_000;

/**
 * A page drawn from what `useKeepWarm` fetched can be minutes old by the time it is shown;
 * this asks the server once on arrival when it is, so it draws at once *and* catches up.
 * `renderedAt` is when the server drew it (epoch ms).
 */
export function useCatchUp(renderedAt: number) {
  const router = useRouter();
  useEffect(() => {
    if (Date.now() - renderedAt > FRESH_MS) router.refresh();
    // Only on arrival: a refresh hands down a new `renderedAt`, which is fresh by definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
