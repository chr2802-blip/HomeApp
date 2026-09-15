/**
 * Showing a stored picture.
 *
 * Every picture is served from `/api/photos/<id>`, behind the session, in one of the
 * two sizes stored at upload. Which size a place asks for is the whole of the
 * performance question: a page showing one picture asks for the full one, a page
 * showing a grid of cards asks for thumbnails and moves a few kilobytes instead of a
 * few hundred.
 *
 * Each shape below is a box with a fixed aspect and the picture cropped to fill it, so
 * a portrait photograph and a landscape one occupy exactly the same space and nothing
 * on the page moves as they load. That is also why the stored dimensions are never read
 * here — the box decides the size, not the file, so drawing a picture costs no query
 * beyond the id the row already carries.
 */

export function photoUrl(photoId: string, size: "full" | "thumb" = "full") {
  return size === "thumb" ? `/api/photos/${photoId}?size=thumb` : `/api/photos/${photoId}`;
}

type PhotoProps = {
  photoId: string | null | undefined;
  /**
   * What the picture shows. Empty where the picture only decorates something already
   * named beside it — a list card says its own title, and a screen reader announcing
   * it twice helps nobody.
   */
  alt: string;
  className?: string;
};

/**
 * The picture itself, filling whatever box it is put in.
 *
 * A plain `<img>` rather than `next/image`: these are served from a route that checks
 * the session, and Next's optimiser fetches the source itself without the browser's
 * cookies, so it would find nothing. There is also nothing for it to do — the file was
 * sized for the screen before it was ever stored.
 */
function Img({ src, alt, className }: { src: string; alt: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- see above.
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}

/**
 * A picture across the top of the thing it belongs to.
 *
 * A fixed height rather than a fixed ratio: a banner sized by its width grows with the
 * window until it has pushed everything the page is actually for below the fold, and
 * the picture is cropped to fill it either way.
 *
 * `bleed` is for a banner that opens a page: it cancels the main column's own padding
 * so the picture runs edge to edge and meets the top bar, with no gap and no rounded
 * corners to mark where the page begins. The offsets mirror the padding set in the app
 * layout — change one and change the other.
 */
export function PhotoBanner({
  photoId,
  alt,
  className = "",
  bleed = false,
}: PhotoProps & { bleed?: boolean }) {
  if (!photoId) return null;

  return (
    <div
      className={`h-44 overflow-hidden bg-slate-100 sm:h-64 ${
        bleed ? "-mt-8 -mr-4 -ml-4" : "w-full rounded-xl"
      } ${className}`}
    >
      <Img src={photoUrl(photoId)} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/** The cover of a card in a directory, above its title. */
export function PhotoCover({ photoId, alt, className = "" }: PhotoProps) {
  if (!photoId) return null;

  return (
    <div className={`overflow-hidden bg-slate-100 ${className}`}>
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="aspect-[16/9] w-full object-cover" />
    </div>
  );
}

/** A small square beside a row of text. */
export function PhotoThumb({ photoId, alt, className = "" }: PhotoProps) {
  if (!photoId) return null;

  return (
    <div className={`shrink-0 overflow-hidden rounded-lg bg-slate-100 ${className}`}>
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/** The home's own picture, wherever the home is named. */
export function PhotoAvatar({ photoId, alt, className = "" }: PhotoProps) {
  if (!photoId) return null;

  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`}>
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="h-full w-full object-cover" />
    </span>
  );
}
