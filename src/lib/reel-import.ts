import * as cheerio from "cheerio";
import { parseRecipeFromCaption, type CaptionRecipe } from "./caption-recipe";

/**
 * Where a reel keeps its recipe, and how to get at it without an account.
 *
 * `recipe-import.ts` reads `schema.org/Recipe` markup, which every recipe site
 * publishes and no social network does — so a reel arrives there as a page that loaded
 * perfectly and had nothing to cook from, which is exactly what it is. What a reel has
 * instead is its caption, and for a recipe reel the caption *is* the recipe: whoever
 * posted it wrote the ingredients and the steps under the video because there is
 * nowhere else on that page to put them.
 *
 * This module is the addresses to ask and the reading of what comes back. Splitting the
 * caption into a recipe is `caption-recipe.ts`, and the fetching itself stays in
 * `recipe-import.ts` with the host checks and the limits that every outbound request
 * from a pasted link has to go through. Everything here is pure, so
 * `tests/unit/reel-import.test.ts` can hold it against real markup with no network.
 *
 * **None of these addresses is a supported API, and that is the honest position.**
 * Instagram's `/embed/captioned/` is the page its own embed widget loads and is the
 * only one that reliably carries a caption to a caller with no account; Meta's actual
 * oEmbed needs an app token this household does not have. So the sources are tried in
 * order and any of them may simply refuse — which is why a failure here is never a dead
 * end but an offer to paste the caption in by hand, the one route nothing can block.
 */

export type CaptionSource = {
  url: string;
  /** `json` is an oEmbed document; `html` is a page to read the caption out of. */
  kind: "html" | "json";
};

/** What was read off a reel's page, before any of it has been understood as a recipe. */
export type ReelCaption = {
  caption: string;
  /** The video's own poster frame, which is the nearest thing a reel has to a photo. */
  imageUrl: string | null;
  /** Whatever the page called itself, for a caption that never names the dish. */
  pageTitle: string;
};

/**
 * Query parameters that only say where a link was shared from. Stripped before a link
 * is handed to one of Meta's own endpoints as the post it should render, which is
 * `embed.ts`'s reasoning for the same list — kept separate from it because that one is
 * about building an iframe `src` for the browser and this is about what this app fetches.
 */
const SHARE_PARAMS = ["igsh", "igshid", "mibextid", "ref", "ref_src", "ref_url", "fbclid", "__tn__"];

function withoutShareParams(url: URL): string {
  const cleaned = new URL(url.toString());
  for (const param of SHARE_PARAMS) cleaned.searchParams.delete(param);
  cleaned.hash = "";
  return cleaned.toString();
}

/**
 * The addresses worth asking for this link's caption, best first, or an empty list for
 * a link that is not a social video at all — which is how `recipe-import.ts` tells the
 * two routes apart without a second opinion about what counts as a reel.
 *
 * Instagram's embed page is asked before the post's own page because it is the one
 * written for a caller with no account: the ordinary page answers a signed-out request
 * with a login wall about half the time, and the embed page carries the whole caption
 * where `og:description` carries a truncated copy of it.
 */
export function captionSources(rawUrl: string): CaptionSource[] {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return [];
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return [];

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "instagram.com" || host === "instagr.am") {
    // A share sheet's /share/reel/CODE sits in front of the same "reel" segment as an
    // ordinary link, so scanning for the kind finds both — the same reasoning, and the
    // same shapes, as `parseSocialEmbed`.
    const kindAt = segments.findIndex((s) => s === "reel" || s === "reels" || s === "p" || s === "tv");
    const kind = segments[kindAt] === "reels" ? "reel" : segments[kindAt];
    const code = kindAt >= 0 ? segments[kindAt + 1] : undefined;
    if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return [];
    return [
      { url: `https://www.instagram.com/${kind}/${code}/embed/captioned/`, kind: "html" },
      { url: `https://www.instagram.com/${kind}/${code}/`, kind: "html" },
    ];
  }

  if (host === "tiktok.com" || host === "vm.tiktok.com") {
    // TikTok is the one of the three with a real, open oEmbed endpoint — no token, no
    // pretending to be a browser — and its `title` is the caption verbatim.
    return [
      { url: `https://www.tiktok.com/oembed?url=${encodeURIComponent(withoutShareParams(url))}`, kind: "json" },
      { url: withoutShareParams(url), kind: "html" },
    ];
  }

  const facebookHost = host.replace(/^(m|web)\.facebook\.com$/, "facebook.com");
  if (facebookHost === "facebook.com" || facebookHost === "fb.watch") {
    const clean = withoutShareParams(url);
    const plugin = new URL("https://www.facebook.com/plugins/post.php");
    plugin.searchParams.set("href", clean);
    plugin.searchParams.set("show_text", "true");
    return [
      { url: clean, kind: "html" },
      { url: plugin.toString(), kind: "html" },
    ];
  }

  return [];
}

/** Whether a pasted link is one of the above, and so wants the caption route. */
export function isReelUrl(rawUrl: string): boolean {
  return captionSources(rawUrl).length > 0;
}

/**
 * Instagram's `og:description` wraps the caption in a sentence of its own — `2,481
 * likes, 57 comments - kitchen on June 4, 2025: "Pasta al limone …"` — so the wrapper
 * comes off before the caption is read. The quotes are the reliable part of that shape;
 * the counts and the date are not, and vary by language and by post.
 */
export function unwrapSocialDescription(description: string): string {
  const quoted = /:\s*["“”]([\s\S]*)["“”]\s*\.?\s*$/.exec(description.trim());
  return (quoted ? quoted[1] : description).trim();
}

/**
 * A caption out of whatever HTML came back, whichever of the three sent it.
 *
 * Instagram's embed page holds the real thing in a `.Caption` element, with the
 * account's name as a link at the front and the comment count in a block at the end;
 * both are stripped off, leaving the caption as it was typed. Everything else — a
 * signed-out post page, a Facebook post, a TikTok page — is read from `og:description`,
 * which is the same caption cut short but is a great deal better than nothing.
 *
 * `<br>` becomes a newline before any of this, because a caption's line breaks are the
 * whole of its structure: `cheerio`'s `.text()` drops them, and a caption arriving as
 * one long line is one `caption-recipe.ts` cannot read at all.
 */
export function captionFromHtml(html: string): ReelCaption | null {
  const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, "\n"));

  const captionNode = $(".Caption").first();
  let caption = "";
  if (captionNode.length > 0) {
    const copy = captionNode.clone();
    copy.find(".CaptionUsername, .CaptionComments").remove();
    caption = copy.text();
  }

  const description =
    $('meta[property="og:description"]').attr("content") ??
    $('meta[name="description"]').attr("content") ??
    "";
  if (!caption.trim()) caption = unwrapSocialDescription(description);

  const imageUrl =
    $("img.EmbeddedMediaImage").first().attr("src") ??
    $('meta[property="og:image"]').attr("content") ??
    null;

  const pageTitle = (
    $('meta[property="og:title"]').attr("content") ??
    $("title").first().text() ??
    ""
  ).trim();

  if (!caption.trim()) return null;
  return { caption: caption.trim(), imageUrl, pageTitle };
}

/**
 * A caption out of an oEmbed document. TikTok's `title` is the post's own caption and
 * `thumbnail_url` its poster frame, which is exactly the pair this needs; the shape is
 * standard, so anything else answering oEmbed is read the same way.
 */
export function captionFromOEmbed(body: string): ReelCaption | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const doc = parsed as Record<string, unknown>;
  const caption = typeof doc.title === "string" ? doc.title.trim() : "";
  if (!caption) return null;

  return {
    caption,
    imageUrl: typeof doc.thumbnail_url === "string" ? doc.thumbnail_url : null,
    pageTitle: typeof doc.author_name === "string" ? doc.author_name : "",
  };
}

/**
 * What a reel's page said, read as a recipe — or null where the caption was somebody's
 * lunch rather than how to make it.
 *
 * The page's own title is offered only as a fallback for a caption that never names the
 * dish, and on Instagram it is a poor one ("kitchen on Instagram: …"), which is why
 * `parseRecipeFromCaption` reaches for it last and cuts it to a first sentence when it
 * does.
 */
export function recipeFromReelCaption(read: ReelCaption): CaptionRecipe | null {
  return parseRecipeFromCaption(read.caption, read.pageTitle);
}
