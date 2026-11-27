import { redirect } from "next/navigation";
import { PAGER_PARAM } from "@/lib/pager";

/**
 * The charts are drawn beside the log on `/baby` (`?tab=charts`), so the one is already
 * there while a finger drags towards it. This address is kept for anything that still
 * names it, with its period and day carried over.
 */
export default async function BabyChartsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const query = new URLSearchParams(await searchParams);
  query.set(PAGER_PARAM, "charts");
  redirect(`/baby?${query.toString()}`);
}
