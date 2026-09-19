import { photoUrl } from "@/components/photo";

/**
 * Somebody, small, beside a thing they did.
 *
 * `PhotoAvatar` is the picture where a person is the subject — their own page, the
 * members list — and it draws nothing at all for somebody who has not chosen one. This
 * is the other case: a mark in the corner of a row, where the point is that there *is*
 * a name attached, so a household where nobody uploaded a picture would otherwise see
 * the feature as simply missing. No picture means initials.
 *
 * No accent ring either. That ring says "this is the home", which is worth it on a
 * picture somebody is looking at; at this size, beside a ticked-off item, it is a
 * coloured halo on every row of the completed section.
 *
 * The name is given twice on purpose: as a `title`, which is the tooltip on a desktop,
 * and as text only a screen reader reads. The picture itself is decorative — it is the
 * same person either way, and "photo of Mo" beside "ticked off by Mo" is the same
 * sentence twice.
 */
export function PersonMark({
  name,
  photoId,
  what,
  className = "",
}: {
  name: string;
  photoId: string | null;
  /** What they did, as the label reads it: "Ticked off by Mo". */
  what: string;
  className?: string;
}) {
  const label = `${what} ${name}`;

  return (
    <span
      title={label}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600 ${className}`}
    >
      {photoId ? (
        // Served behind the session, as every picture in the app is; see
        // components/photo for why none of them goes through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl(photoId, "thumb")}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** One letter for a single name, two for anybody who gave more of one. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]![0]!;
  return parts.length === 1 ? first.toUpperCase() : (first + parts.at(-1)![0]!).toUpperCase();
}
