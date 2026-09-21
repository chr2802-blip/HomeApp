import sharp from "sharp";
import { MAX_EDGE, THUMB_EDGE } from "./downscale";
import { storePhoto } from "./photos";
import { extractFromHtml, type RawExtract } from "./recipe-extract";
import { normalizeRecipe } from "./recipe-normalize";
import {
  captionFromHtml,
  captionFromOEmbed,
  captionSources,
  isReelUrl,
  type CaptionSource,
  type ReelCaption,
} from "./reel-import";

/**
 * Importing a recipe, in two stages and one direction.
 *
 * **Stage one is extraction and nothing else.** A web page goes to `recipe-extract.ts`,
 * which gathers whatever its markup — or, failing that, its visible text — has to say. A
 * reel goes to `reel-import.ts`, which knows the addresses that will hand over a caption
 * without an account. A caption somebody pasted is already text. All three produce the same
 * `RawExtract` and none of them decides whether what they found is a recipe.
 *
 * **Stage two is `recipe-normalize.ts`**, which is the only thing in this app that reads
 * text as a recipe. There used to be two readers, one per route, and the recipe a cook got
 * depended on which door they came in by. Now the route decides only where the text comes
 * from; what it means is answered once.
 *
 * This module is what is left when both halves are taken out: the outbound request, which
 * has to be checked and bounded because the address is whoever pasted it's choice and not
 * this app's, and the recipe's picture, which is fetched and stored the way any upload is.
 * `sharp` lives here, which is why nothing runtime from this file may be imported by a
 * client component — only its types.
 */

export type ImportedRecipe = {
  title: string;
  ingredients: string;
  instructions: string;
  photoId: string | null;
  totalTimeMinutes: number | null;
  /**
   * Filled in only for a reel, where the link that was pasted *is* the video — so the
   * recipe keeps playing the thing it was copied from, through the embed `embed.ts`
   * already knows how to build. An ordinary recipe page is not a video and leaves this
   * null, which is what it has always been: the field is the create form's own, and a
   * cook may still paste something else into it before saving.
   */
  videoUrl: string | null;
  /**
   * What the reader thought the cook should look over — a caption that stopped mid-sentence,
   * amounts it sent the reader to a link for. Null where the recipe read cleanly.
   *
   * The same vocabulary `ActionResult.note` uses for what the pantry left off a shopping
   * list, and for the same reason: something quietly missing reads as something the app
   * lost. The form is already a review step; this says where in it to look.
   */
  note: string | null;
};

/**
 * `notARecipe` marks a failure where there is nothing more to try with this link as typed —
 * a page that loaded fine and had nothing to cook from, a reel whose description could not
 * be got at, a reader that would not answer. `RecipeImportField` turns exactly that flag
 * into the paste box and a "Start from scratch" button; a mistyped address or a page that
 * would not load is worth retrying as typed and does not get them.
 *
 * It is a flag rather than a matched error string because this module pulls in `sharp` and
 * the module next door pulls in the Anthropic SDK, neither of which may be bundled into the
 * client component that shows the error. Only the types cross.
 */
export type ImportOutcome =
  | { ok: true; recipe: ImportedRecipe }
  | { ok: false; error: string; notARecipe?: boolean };

const GENERIC_ERROR =
  "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.";

/**
 * The ways an import ends badly, kept apart because they ask the cook for different things.
 *
 * Meta refusing a signed-out request says nothing about the post and is the common one; a
 * caption that was read and is not a recipe is usually `og:description`'s truncated copy of
 * one, which pasting the whole thing fixes; and the reader being down is neither — it is
 * this app's own fault and will pass. All three point at the same box, because that box is
 * the one route into the importer that nothing on anybody else's side can block.
 */
const CAPTION_UNREACHABLE =
  "Couldn't read that reel's description — Instagram and Facebook often refuse. Paste it in below instead.";
const CAPTION_NOT_A_RECIPE =
  "Couldn't find a recipe in that description. Paste the whole thing in below, or fill the form in by hand.";
const READER_UNAVAILABLE =
  "Couldn't read that recipe just now. Try again in a moment, paste the description below, or fill the form in by hand.";

/** How much of a page is ever read — a bound on the request, not a claim about recipes. */
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
/** A recipe's own hero photo is never anywhere near this; it exists to bound the request. */
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Node's `fetch` sends no `User-Agent` at all unless told to, which plenty of ordinary
 * sites treat as reason enough to refuse the request or hand back a stripped page with
 * none of the markup this is looking for — not because the request is doing anything
 * untoward, but because "no browser looks like this" is a cheap first filter against
 * bots that never got past this app fetching a page a person explicitly linked to. A
 * browser's own string gets past that filter; it changes nothing about what is done
 * with the page once it arrives.
 */
const REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
};
// Deliberately no Accept-Language: the link already says which page a cook wants, and
// a site that negotiates by language rather than URL — some do, across country and
// language domains — took an English preference here as a reason to swap in its
// English site instead, which does not have a Danish recipe pasted from the Danish
// one. Sending none asks for whatever the address itself already means.

/**
 * Blocks the addresses a browser would never be steered toward by a recipe link: the
 * machine itself, its own network, and the link-local range cloud providers use for
 * instance metadata. This is a household app fetching a page somebody chose to paste,
 * not a browser with its own cross-origin rules, so that check has to be written here
 * instead — a `javascript:` or `file:` link is refused by the protocol check below, and
 * these are refused by address.
 */
function isBlockedHost(hostname: string): boolean {
  // IPv6 literals arrive bracketed in a URL's hostname ("[::1]"); the ranges below are
  // compared against the address itself.
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  // A URL's hostname never otherwise contains a colon, so this is the one case left:
  // an IPv6 literal. ::1 (loopback), fe80::/10 (link-local) and fc00::/7 (unique local)
  // are the ranges with the same reach as the IPv4 ones above. Checked only once it is
  // known to be an address rather than a name — "fc" and "fd" are also how plenty of
  // ordinary domains start, and matching those was refusing real sites outright.
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }

  return false;
}

/** A link this feature will actually fetch, or null for anything it should refuse. */
function safeImportUrl(rawUrl: string): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

/**
 * Fetches a recipe page and reads it, refusing anything that is not a plain web page on the
 * open internet.
 *
 * The size and time limits exist because the page is chosen by whoever pastes the link, not
 * by this app: a slow or enormous response must not be able to hold a request open or
 * exhaust memory just because somebody pasted the wrong thing.
 */
export async function fetchRecipeFromUrl(rawUrl: string, homeId: string): Promise<ImportOutcome> {
  const url = safeImportUrl(rawUrl);
  if (!url) return { ok: false, error: "That doesn't look like a web address." };

  // A reel publishes no markup worth reading and its recipe is in the paragraph under the
  // video, so it takes the other route to the same reader.
  if (isReelUrl(url.toString())) return fetchRecipeFromReel(url, homeId);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch {
    return { ok: false, error: "Couldn't reach that page. Check the link and try again." };
  }
  if (!response.ok || !response.body) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  // The redirect this app actually followed is what has to be checked, not the link
  // that was typed — a page can redirect an outside address to an internal one.
  if (isBlockedHost(new URL(response.url).hostname)) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  let bytes: Uint8Array;
  try {
    bytes = await readLimited(response.body, MAX_RESPONSE_BYTES);
  } catch {
    return { ok: false, error: GENERIC_ERROR, notARecipe: true };
  }

  const raw = extractFromHtml(decodeHtml(bytes, contentType), response.url);
  if (!raw) return { ok: false, error: GENERIC_ERROR, notARecipe: true };

  return finish(raw, homeId, { notARecipe: GENERIC_ERROR });
}

/**
 * The second route in: a reel, read from the paragraph under the video.
 *
 * Each of the addresses `captionSources` names is tried in turn and the first that hands
 * back something readable wins — they are ordered best-first, and a source that refuses,
 * times out or answers with a login wall is simply the next one's turn. None of them is a
 * supported API, so all of them failing is an ordinary outcome rather than a bug, and the
 * answer to it is the paste box rather than an apology.
 *
 * A caption that was read is handed to the reader immediately rather than tried against the
 * next source: once there is text, there is nothing another address could add, and the
 * reader is the one thing entitled to say the text is not a recipe.
 *
 * The link itself becomes the recipe's video, so a reel saved this way still plays on the
 * recipe page even where every one of these sources refused and the cook pasted the caption
 * in by hand.
 */
async function fetchRecipeFromReel(url: URL, homeId: string): Promise<ImportOutcome> {
  const sources = captionSources(url.toString());

  for (const source of sources) {
    const read = await readCaptionSource(source);
    if (!read) continue;

    return finish(reelExtract(read, url.toString(), source.url), homeId, {
      notARecipe: CAPTION_NOT_A_RECIPE,
    });
  }

  // Running out of sources is the line worth finding in a log: the cook has just been told
  // to paste the description in by hand, and the `reel_caption_source` lines immediately
  // above this one say why each address refused.
  console.error(
    JSON.stringify({
      level: "error",
      event: "reel_caption_unreachable",
      url: url.toString(),
      sourcesTried: sources.length,
      at: new Date().toISOString(),
    }),
  );

  return { ok: false, error: CAPTION_UNREACHABLE, notARecipe: true };
}

/**
 * Reads a recipe out of a description the cook pasted in themselves, which is the one route
 * into this that nothing on anybody else's side can refuse — not Meta, and not an API key
 * that has stopped working.
 *
 * `rawUrl` is whatever was in the link field when they gave up on it — optional, because a
 * description pasted on its own is still a recipe. Where there is one and it is a reel, two
 * things are still worth having from it: the link becomes the recipe's video, and the poster
 * frame is fetched for its picture. That fetch is best-effort and usually the same request
 * that just failed, so it is allowed to fail again quietly — a recipe whose text is all
 * there is never refused for want of decoration.
 */
export async function importPastedCaption(
  caption: string,
  rawUrl: string,
  homeId: string,
): Promise<ImportOutcome> {
  const text = caption.trim();
  if (!text) return { ok: false, error: "Paste the reel's description first." };

  const url = safeImportUrl(rawUrl);
  const isReel = url !== null && isReelUrl(url.toString());

  const raw: RawExtract = {
    kind: "pasted",
    sourceUrl: url?.toString() ?? null,
    rawTitle: null,
    rawContent: text,
    // The picture is the one thing a pasted description cannot say, so where the link is a
    // reel it is worth one request for the poster frame.
    imageUrl: null,
    timeHintMinutes: null,
  };

  return finish(raw, homeId, {
    notARecipe: CAPTION_NOT_A_RECIPE,
    videoUrl: isReel ? url.toString() : null,
    photoId: isReel ? await fetchReelThumbnail(url, homeId) : null,
  });
}

/**
 * The one path from raw text to a saved-shaped recipe, whichever door it came in by.
 *
 * Everything that happens after the text exists happens here and only here: the reader, the
 * picture, and the two ways of failing that the cook is told apart. Both routes funnel
 * through it so neither can come to mean something slightly different by "imported".
 *
 * The picture is fetched only once the recipe is good — there is no point storing bytes for
 * a page that turned out not to be a recipe — and never in a way that can fail the import: a
 * picture that cannot be fetched or does not survive `storePhoto`'s own checks is left out
 * rather than refusing a recipe that was otherwise perfectly readable.
 */
async function finish(
  raw: RawExtract,
  homeId: string,
  options: { notARecipe: string; videoUrl?: string | null; photoId?: string | null },
): Promise<ImportOutcome> {
  const read = await normalizeRecipe(raw, homeId);
  if (!read.ok) {
    return {
      ok: false,
      error: read.reason === "unavailable" ? READER_UNAVAILABLE : options.notARecipe,
      notARecipe: true,
    };
  }

  const photoId =
    options.photoId !== undefined
      ? options.photoId
      : await importRecipeImage(raw.imageUrl, raw.sourceUrl ?? "", homeId);

  return {
    ok: true,
    recipe: {
      title: read.recipe.title,
      ingredients: read.recipe.ingredients,
      instructions: read.recipe.instructions,
      totalTimeMinutes: read.recipe.totalTimeMinutes,
      note: read.recipe.note,
      photoId,
      videoUrl: options.videoUrl ?? (raw.kind === "reel" ? raw.sourceUrl : null),
    },
  };
}

/**
 * What a reel's page said, as the same raw payload a web page produces.
 *
 * The poster frame's address is resolved here rather than downstream, because it is
 * relative to whichever of `captionSources`' addresses actually answered — the embed page,
 * say — and not to the reel link the cook pasted, which is what `sourceUrl` has to stay for
 * the recipe's video to point at the right post.
 */
function reelExtract(read: ReelCaption, reelUrl: string, fetchedFrom: string): RawExtract {
  let imageUrl: string | null = null;
  if (read.imageUrl) {
    try {
      imageUrl = new URL(read.imageUrl, fetchedFrom).toString();
    } catch {
      // A poster frame nobody can address is decoration this recipe does without.
    }
  }

  return {
    kind: "reel",
    sourceUrl: reelUrl,
    // Instagram's own title is the account's name and the first few words ("kitchen on
    // Instagram: …"), which is a poor name for a dish but better than nothing where the
    // caption never says what it is making.
    rawTitle: read.pageTitle || null,
    rawContent: read.caption,
    imageUrl,
    timeHintMinutes: null,
  };
}

/**
 * A reel's poster frame, or null. Only the first source is asked: this runs on the path
 * where the automatic read already failed, and a cook waiting on a form they have
 * already filled in by hand should not wait through the whole chain again for a picture
 * they will be offered the chance to replace anyway.
 */
async function fetchReelThumbnail(url: URL, homeId: string): Promise<string | null> {
  const [first] = captionSources(url.toString());
  if (!first) return null;

  const read = await readCaptionSource(first);
  return read ? importRecipeImage(read.imageUrl, first.url, homeId) : null;
}

/**
 * One caption source fetched and read, under the same limits as any other link — and every
 * way it can fail written down.
 *
 * A reel that will not import is the one failure in this app with nothing to look at. Meta
 * refusing a signed-out request, a login wall served instead of the post, the eight-second
 * limit running out, the embed page quietly changing shape: all four ended here as the same
 * `null`, and the cook got the same sentence about Instagram often refusing. Which of them
 * it actually was decides whether there is anything to be done — a timeout is a number in
 * this file, a 403 from a datacenter is not something code can fix — so each one now says so
 * on its way past.
 *
 * `warn` rather than `error`: one source refusing is ordinary and expected, and only running
 * out of them is worth anybody's attention. The body is never logged, only shapes read off
 * it — a login wall is worth knowing about and a stranger's recipe is not ours to keep.
 */
async function readCaptionSource(source: CaptionSource): Promise<ReelCaption | null> {
  const note = (outcome: string, detail: Record<string, unknown> = {}) =>
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "reel_caption_source",
        url: source.url,
        kind: source.kind,
        outcome,
        ...detail,
        at: new Date().toISOString(),
      }),
    );

  const url = safeImportUrl(source.url);
  if (!url) {
    note("blocked_address");
    return null;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch (error) {
    // A timeout arrives here as a `TimeoutError`, which is the one failure on this list that
    // a number in this file could fix, so it is worth telling apart from a refused connection.
    const name = error instanceof Error ? error.name : "unknown";
    note(name === "TimeoutError" ? "timed_out" : "fetch_failed", {
      afterMs: FETCH_TIMEOUT_MS,
      name,
    });
    return null;
  }
  if (!response.ok || !response.body) {
    note("http_error", { status: response.status });
    return null;
  }
  if (isBlockedHost(new URL(response.url).hostname)) {
    note("redirected_to_blocked_address");
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  let bytes: Uint8Array;
  try {
    bytes = await readLimited(response.body, MAX_RESPONSE_BYTES);
  } catch {
    note("too_large", { limit: MAX_RESPONSE_BYTES });
    return null;
  }

  const body = decodeHtml(bytes, contentType);
  const read = source.kind === "json" ? captionFromOEmbed(body) : captionFromHtml(body);
  if (!read) {
    // Answered 200 and still no caption, which is the interesting case: a login wall dressed
    // as a page, or an embed page whose markup has moved. Told apart by what is in it, since
    // both are a perfectly ordinary-looking success as far as the request is concerned.
    note("no_caption", {
      status: response.status,
      bytes: bytes.byteLength,
      contentType,
      looksLikeLoginWall: /accounts\/login|loginForm|"LoginAndSignupPage"/i.test(body),
      hasCaptionElement: body.includes("class=\"Caption"),
      hasOgDescription: body.includes('property="og:description"'),
    });
    return null;
  }

  return read;
}

/**
 * Fetches a recipe's own picture and files it under the home doing the import, or
 * gives up quietly. A page's `image` is frequently relative to the page itself, so it
 * is resolved against the address this app actually landed on rather than the link
 * that was pasted — the same reasoning `isBlockedHost` already applies to redirects
 * applies here: whatever the page points at is checked as its own address, not assumed
 * safe for having been mentioned by a page that itself passed the check.
 */
async function importRecipeImage(
  imageUrl: string | null,
  pageUrl: string,
  homeId: string,
): Promise<string | null> {
  if (!imageUrl) return null;

  let resolved: URL;
  try {
    resolved = new URL(imageUrl, pageUrl || undefined);
  } catch {
    return null;
  }
  const url = safeImportUrl(resolved.toString());
  if (!url) return null;

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: REQUEST_HEADERS,
    });
  } catch {
    return null;
  }
  if (!response.ok || !response.body) return null;
  if (isBlockedHost(new URL(response.url).hostname)) return null;

  let bytes: Uint8Array;
  try {
    bytes = await readLimited(response.body, MAX_IMAGE_BYTES);
  } catch {
    return null;
  }

  try {
    const { full, thumb } = await downscaleForStorage(bytes);
    const stored = await storePhoto(homeId, full, thumb);
    return stored.ok ? stored.id : null;
  } catch {
    // A file that claims to be a picture but is not one sharp can decode, say — this
    // is decoration for a recipe that is otherwise complete, not a reason to refuse it.
    return null;
  }
}

/**
 * The server-side equivalent of `lib/downscale.ts`, which needs a browser's canvas and
 * so cannot run here. Same edges, same rough quality, for the same reason: nothing in
 * this app shows a picture larger than `MAX_EDGE`, and a page's own hero image is
 * ordinarily much larger than that.
 */
async function downscaleForStorage(bytes: Uint8Array) {
  const source = sharp(bytes, { failOn: "none" }).rotate();
  const [full, thumb] = await Promise.all([
    source
      .clone()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer(),
    source
      .clone()
      .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer(),
  ]);
  return { full, thumb };
}

async function readLimited(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Response too large");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

/**
 * Decodes a page's bytes the way a browser would: by what the page itself says its
 * encoding is, never by assuming UTF-8. Most sites are UTF-8 and this changes nothing
 * for them, but the ones that are not are disproportionately the ones with characters
 * outside plain English in the first place — æ, ø and å among them — so assuming wrong
 * is exactly invisible on an English test page and wrong on every other kind.
 */
function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const declared =
    /charset=([^;]+)/i.exec(contentType)?.[1] ??
    // The HTML spec allows the charset to be declared in a <meta> tag instead of the
    // response header, always within the first kilobyte — no need to read further.
    /<meta[^>]+charset=["']?([a-z0-9_-]+)/i.exec(
      Buffer.from(bytes.subarray(0, 1024)).toString("latin1"),
    )?.[1];

  if (declared) {
    try {
      return new TextDecoder(declared.trim().toLowerCase()).decode(bytes);
    } catch {
      // An unrecognised or misdeclared label — fall through to the default.
    }
  }
  return new TextDecoder("utf-8").decode(bytes);
}
