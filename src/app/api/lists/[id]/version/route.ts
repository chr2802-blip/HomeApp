import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";
import { listVersion } from "@/lib/list-version";

export const dynamic = "force-dynamic";

/**
 * What an open list asks every few seconds: has anything on it changed since I was drawn?
 *
 * Answers with `listVersion` over the same fields the page draws, and nothing else — the
 * rows themselves come from a `router.refresh()` of the page, so there is one place that
 * decides what a list looks like rather than a second copy of it here.
 *
 * A route rather than a server action for the reason `/api/lists/sync` is one: a phone
 * that has been sitting on the list across a deploy is still asking, and an action's
 * identity belongs to the build that made it. Through `homeDb` like the page, so another
 * home's list — or one in a home this person has since switched away from — is simply
 * not found, and the phone asking stops refreshing rather than being told anything.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.homeId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = await homeDb(user.homeId).list.findUnique({
    where: { id },
    select: {
      title: true,
      trackAmounts: true,
      photoId: true,
      items: {
        select: {
          id: true,
          text: true,
          amount: true,
          done: true,
          position: true,
          completedById: true,
          // The page's own order, so the two hash the recipes the same way round.
          sources: { orderBy: { createdAt: "asc" }, select: { recipeId: true } },
        },
      },
    },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const version = listVersion({
    ...list,
    items: list.items.map(({ sources, ...item }) => ({
      ...item,
      sourceIds: sources.map((source) => source.recipeId),
    })),
  });

  // Never from a cache: the whole question is what the database says now.
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
