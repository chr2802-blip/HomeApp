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
 * What can stand in for a picture nobody has added yet. One glyph per kind of thing this
 * module draws a photo for — a recipe entered by hand, a list or a task with nothing
 * uploaded are all the common case, not a special one, and a blank tile there reads as
 * broken rather than as "no photo". Each glyph is the same icon that kind already wears
 * on its own tab (`nav-items.tsx`), so the placeholder reads as "this is a recipe/list/
 * task" rather than as a second, unrelated symbol to learn.
 *
 * A home's own picture and a person's own picture are deliberately not here: those go
 * through `PhotoAvatar`, which draws nothing at all for the same reason `HomeMenu`
 * documents at its own call site — an avatar is who or what the home *is*, not a job to
 * be done, and a household or a person is never "missing" the way a recipe with no
 * picture is.
 */
const GLYPHS = {
  recipe: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3.5v8M10 3.5v8M8.5 11.5V21M7 3.5a1.5 1.5 0 0 0-1.5 1.5v3A2.5 2.5 0 0 0 8 10.5h1" />
      <path d="M17.5 3.5c-1.7 0-2.5 2.2-2.5 5s.8 4 2.5 4H18V21" />
    </svg>
  ),
  list: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 6 1.6 1.6L7.5 4.7" />
      <path d="m3 13 1.6 1.6 2.9-2.9" />
      <path d="m3 20 1.6 1.6 2.9-2.9" />
      <path d="M11 6.5h10M11 13.5h10M11 20.5h10" />
    </svg>
  ),
  task: ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
      <path d="M21 4v5h-5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
} satisfies Record<string, (props: { className?: string }) => React.ReactElement>;

/** The kinds of thing this module can draw a placeholder for. */
export type PhotoKind = keyof typeof GLYPHS;

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
 *
 * `short` is for the dashboard, where the picture is decoration above a page whose job
 * is to say what needs attention: at the full height it was a third of the first screen
 * before a single word of that. A prop rather than a height passed in `className`,
 * because both are height utilities and which one wins is decided by their order in the
 * stylesheet rather than in the class attribute — the same trap `Card`'s `padded`
 * exists to avoid. A recipe's own banner keeps the full height: there the picture is
 * what the page is about.
 */
export function PhotoBanner({
  photoId,
  alt,
  className = "",
  bleed = false,
  short = false,
  placeholder,
}: PhotoProps & { bleed?: boolean; short?: boolean; placeholder?: PhotoKind }) {
  if (!photoId && !placeholder) return null;

  const box = `${short ? "h-32 sm:h-48" : "h-44 sm:h-64"} overflow-hidden bg-slate-100 ${
    bleed ? "-mt-8 -mr-4 -ml-4" : "w-full rounded-2xl"
  } ${className}`;

  if (!photoId) {
    const Glyph = GLYPHS[placeholder!];
    return (
      <div className={`${box} flex items-center justify-center text-slate-300`}>
        <Glyph className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className={box}>
      <Img src={photoUrl(photoId)} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * The cover of a card in a directory, above its title.
 *
 * The only caller is the recipe grid, so unlike the other shapes here it draws its own
 * placeholder unconditionally rather than needing to be asked: a card with no picture is
 * the ordinary case, not a special one to opt into.
 */
export function PhotoCover({ photoId, alt, className = "" }: PhotoProps) {
  if (!photoId) {
    return (
      <div className={`flex aspect-[16/9] w-full items-center justify-center bg-slate-100 text-slate-300 ${className}`}>
        <GLYPHS.recipe className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-slate-100 ${className}`}>
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="aspect-[16/9] w-full object-cover" />
    </div>
  );
}

/** A small square beside a row of text. */
export function PhotoThumb({
  photoId,
  alt,
  className = "",
  placeholder,
}: PhotoProps & { placeholder?: PhotoKind }) {
  if (!photoId && !placeholder) return null;

  if (!photoId) {
    const Glyph = GLYPHS[placeholder!];
    return (
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-300 ${className}`}
      >
        <Glyph className="h-1/2 w-1/2" />
      </div>
    );
  }

  return (
    <div className={`shrink-0 overflow-hidden rounded-xl bg-slate-100 ${className}`}>
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * The home's own picture, wherever the home is named — and a person's own, on
 * `/profile`. The ring is a wash of the home's colour rather than a plain border: a
 * face or a household's picture is the most personal thing on the page, and tying it to
 * the colour that already means "this home" is worth more here than the discipline of
 * keeping the accent to controls alone.
 */
export function PhotoAvatar({ photoId, alt, className = "" }: PhotoProps) {
  if (!photoId) return null;

  return (
    <span
      className={`accent-tint-ring inline-block shrink-0 overflow-hidden rounded-full bg-slate-100 ${className}`}
    >
      <Img src={photoUrl(photoId, "thumb")} alt={alt} className="h-full w-full object-cover" />
    </span>
  );
}
