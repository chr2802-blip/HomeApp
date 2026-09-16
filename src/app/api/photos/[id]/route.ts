import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Serves a stored picture to somebody in the home it belongs to.
 *
 * Anything they cannot reach is not found rather than refused — the same answer as an id
 * that never existed, which is the only answer that tells an outsider nothing. There are
 * no public picture URLs: a household's photographs are behind the same session as
 * everything else it keeps here.
 *
 * `?size=thumb` gives the small copy stored alongside. Which one is wanted is decided
 * by the page, because only the page knows whether it is drawing one picture or twenty.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.homeId) return new Response("Not found", { status: 404 });

  /*
   * Every home they belong to, and the one they have open. Not homeDb, which would bind
   * this to the home on screen: the header's switcher and the homes page draw the other
   * households' own pictures while a different one is being read, and those are theirs
   * to see. The home on screen is in the set for a super admin, who reads a household
   * without joining it — and is nobody else's way in, since nobody else can have one
   * open that they are not a member of.
   */
  const reachable = (homeId: string) =>
    homeId === user.homeId || user.homes.some((home) => home.id === homeId);

  const thumb = new URL(request.url).searchParams.get("size") === "thumb";

  // Only the copy being served is selected: the other one is the same picture again,
  // and pulling both into the server's memory to return one would double every read.
  const photo = thumb
    ? await prisma.photo.findUnique({
        where: { id },
        select: { homeId: true, contentType: true, thumbBytes: true },
      })
    : await prisma.photo.findUnique({
        where: { id },
        select: { homeId: true, contentType: true, bytes: true },
      });
  if (!photo || !reachable(photo.homeId)) return new Response("Not found", { status: 404 });

  const bytes = "thumbBytes" in photo ? photo.thumbBytes : photo.bytes;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": photo.contentType,
      "content-length": String(bytes.length),
      /*
       * A picture is never edited in place — replacing one stores a new row with a new
       * id — so what this URL answers can never change, and the browser is told it may
       * keep the answer for good. `private`, because it is one household's picture and
       * no shared cache has any business holding it.
       */
      "cache-control": "private, max-age=31536000, immutable",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
