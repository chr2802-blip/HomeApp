export type Embed = {
  src: string;
  aspect: "vertical" | "wide";
  /**
   * Instagram's own iframe has no parameter to leave off its header and its
   * like/comment/share row — this app renders the iframe taller than its
   * visible box and shifts it up by `top`, so only the video sits inside the
   * box and the chrome above and below it is clipped by the box's own
   * `overflow: hidden`. Both numbers are Instagram's fixed-pixel chrome,
   * read off actual embeds rather than derived from anything documented —
   * a redesign on their end can throw them off, in which case a sliver of
   * chrome starts showing again and the fix is to nudge these two numbers,
   * not to touch the rendering code that uses them.
   */
  crop?: { top: number; bottom: number };
};

/**
 * Only hosts on this allowlist are ever turned into an iframe, and the embed URL is
 * rebuilt from parsed parts rather than interpolated, so a hostile link cannot smuggle
 * script or markup into the page.
 */
export function toEmbed(rawUrl: string | null | undefined): Embed | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    const kindIndex = segments.findIndex((s) => s === "reel" || s === "reels" || s === "p" || s === "tv");
    const code = kindIndex >= 0 ? segments[kindIndex + 1] : undefined;
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    return {
      src: `https://www.instagram.com/p/${code}/embed`,
      aspect: "vertical",
      crop: { top: 60, bottom: 60 },
    };
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = segments[0] === "shorts" || segments[0] === "embed" ? segments[1] : url.searchParams.get("v");
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return { src: `https://www.youtube.com/embed/${id}`, aspect: segments[0] === "shorts" ? "vertical" : "wide" };
  }

  if (host === "youtu.be") {
    const id = segments[0];
    if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null;
    return { src: `https://www.youtube.com/embed/${id}`, aspect: "wide" };
  }

  if (host === "tiktok.com") {
    const videoIndex = segments.indexOf("video");
    const id = videoIndex >= 0 ? segments[videoIndex + 1] : undefined;
    if (!id || !/^\d+$/.test(id)) return null;
    return { src: `https://www.tiktok.com/embed/v2/${id}`, aspect: "vertical" };
  }

  if (host === "vimeo.com") {
    const id = segments[0];
    if (!id || !/^\d+$/.test(id)) return null;
    return { src: `https://player.vimeo.com/video/${id}`, aspect: "wide" };
  }

  if (host === "facebook.com" || host === "fb.watch") {
    const embedded = new URL("https://www.facebook.com/plugins/video.php");
    embedded.searchParams.set("href", url.toString());
    embedded.searchParams.set("show_text", "false");
    return { src: embedded.toString(), aspect: "vertical" };
  }

  return null;
}

/** A safe href for "open original" links — never returns a javascript: or data: URL. */
export function safeExternalHref(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
