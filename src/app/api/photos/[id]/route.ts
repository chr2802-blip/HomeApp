import { getCurrentUser } from "@/lib/auth";
import { homeDb } from "@/lib/home-db";

export const dynamic = "force-dynamic";

/**
 * Serves a stored picture to somebody in the home it belongs to.
 *
 * Read through `homeDb`, so another household's id is not found rather than refused —
 * the same answer as an id that never existed, which is the only answer that tells an
 * outsider nothing. There are no public picture URLs: a household's photographs are
 * behind the same session as everything else it keeps here.
 *
 * `?size=thumb` gives the small copy stored alongside. Which one is wanted is decided
 * by the page, because only the page knows whether it is drawing one picture or twenty.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user?.homeId) return new Response("Not found", { status: 404 });

  const thumb = new URL(request.url).searchParams.get("size") === "thumb";

  // Only the copy being served is selected: the other one is the same picture again,
  // and pulling both into the server's memory to return one would double every read.
  const db = homeDb(user.homeId);
  const photo = thumb
    ? await db.photo.findUnique({ where: { id }, select: { contentType: true, thumbBytes: true } })
    : await db.photo.findUnique({ where: { id }, select: { contentType: true, bytes: true } });
  if (!photo) return new Response("Not found", { status: 404 });

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
