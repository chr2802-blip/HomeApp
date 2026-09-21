import * as cheerio from "cheerio";

/**
 * Stage one of an import: getting the text off the page, and nothing else.
 *
 * This module used to decide what a recipe *was* — it read `schema.org/Recipe` markup and
 * handed back a title, an ingredients block and an instructions block, ready to save. That
 * is the half that kept going wrong. A site's markup is written by its CMS rather than by
 * the cook, and the shapes it arrives in are endless: a container tagged `recipeIngredient`
 * whose children are tagged the same way, so every line came back twice; a `HowToSection`
 * carrying both a `name` and a `text` saying the same thing; steps marked up as `<li><p>`,
 * where a selector asking for both took each step once for the item and once for the
 * paragraph. Every one of those is a page that loads perfectly and imports a recipe with
 * everything in it written twice.
 *
 * So it no longer decides. It gathers whatever the page said it had and hands it on as
 * text, and `recipe-normalize.ts` — one pass, one opinion, for a web page and a reel
 * alike — is what reads it. Duplicates stop being something this has to avoid emitting and
 * become something the reader is told to remove, which it can actually do: it can see that
 * two lines are the same ingredient, and a selector cannot.
 *
 * Everything here is pure, so `tests/unit/recipe-extract.test.ts` holds it against real
 * markup with no network and no key. The fetching, with the host checks and the limits
 * every outbound request from a pasted link goes through, stays in `recipe-import.ts`.
 */

/**
 * What came off a page or a reel, before anything has been understood about it.
 *
 * One shape for all three routes in — a recipe page, a reel's caption, a caption somebody
 * pasted — because the whole point of the split is that the second stage cannot tell which
 * it is reading and does not need to.
 */
export type RawExtract = {
  kind: "page" | "reel" | "pasted";
  /** Where it came from, for the model's context. Null for a caption pasted on its own. */
  sourceUrl: string | null;
  /** Whatever the page called itself — a hint, not a title. */
  rawTitle: string | null;
  /** The only thing stage two reads. Messy on purpose: cleaning it is the other half's job. */
  rawContent: string;
  /** The picture to fetch, resolved and stored by `recipe-import.ts` as any upload is. */
  imageUrl: string | null;
  /**
   * A machine-readable duration the page published, in minutes.
   *
   * Kept apart from `rawContent` and trusted over anything the model infers: `PT1H30M` in a
   * `totalTime` field is the site stating the answer outright, and a number read back out
   * of prose is a guess however good. Null where the page said nothing, which is not zero.
   */
  timeHintMinutes: number | null;
};

/** How much readable text is ever taken off a page with no structured data to read. */
const MAX_BODY_TEXT = 12_000;

/** Every `<script type="application/ld+json">…</script>` block on the page, parsed. */
function jsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      blocks.push(JSON.parse(match[1].trim()));
    } catch {
      // Malformed JSON-LD is common enough (a stray trailing comma, HTML-escaped
      // quotes) that skipping the block is more useful than refusing the whole page.
    }
  }
  return blocks;
}

/** `@type` is either a bare string or an array of them, per the schema.org spec. */
function hasType(node: unknown, type: string): node is Record<string, unknown> {
  if (typeof node !== "object" || node === null) return false;
  const value = (node as Record<string, unknown>)["@type"];
  return value === type || (Array.isArray(value) && value.includes(type));
}

/** Every node in a JSON-LD document, including the ones nested under `@graph`. */
function flatten(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === "object" && node !== null) {
    const graph = (node as Record<string, unknown>)["@graph"];
    return graph ? [node, ...flatten(graph)] : [node];
  }
  return [];
}

function findRecipeNode(blocks: unknown[]): Record<string, unknown> | null {
  for (const node of blocks.flatMap(flatten)) {
    if (hasType(node, "Recipe")) return node;
  }
  return null;
}

/** A field that arrives as one string or a list of them, run together as lines. */
function asLines(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(asLines).filter(Boolean).join("\n");
  return "";
}

/**
 * `recipeInstructions` is the messiest field in the spec: a single block of text, a flat
 * list of strings, or a list of `HowToStep`/`HowToSection` objects nested inside one
 * another. This walks whatever shape arrives and pulls out the text.
 *
 * A `HowToSection` contributes its own name as well as its steps, because that name is
 * frequently the only place a recipe says which component a run of steps belongs to. It
 * used to be dropped in favour of the steps alone; keeping it can only mean a repeated
 * line where the section was named after its first step, and the reader takes repeats out.
 */
function instructionLines(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(instructionLines).filter(Boolean).join("\n");
  if (typeof value === "object" && value !== null) {
    const node = value as Record<string, unknown>;
    if (hasType(node, "HowToSection") && node.itemListElement) {
      const name = typeof node.name === "string" ? node.name.trim() : "";
      const steps = instructionLines(node.itemListElement);
      return [name, steps].filter(Boolean).join("\n");
    }
    if (typeof node.text === "string") return node.text.trim();
    if (typeof node.name === "string") return node.name.trim();
  }
  return "";
}

/**
 * `Recipe` markup as schema.org actually reaches the wild in a second, older shape:
 * Microdata (`itemscope`/`itemtype`/`itemprop` attributes on the page's own elements)
 * rather than a separate JSON-LD block. Both say the same thing; a site publishes
 * whichever its CMS happened to generate, sometimes both, rarely neither.
 */
function microdataRecipeRoot($: cheerio.CheerioAPI) {
  return $("[itemscope]")
    .filter((_, el) => /schema\.org\/recipe\s*$/i.test($(el).attr("itemtype")?.trim() ?? ""))
    .first();
}

type MicrodataRoot = ReturnType<typeof microdataRecipeRoot>;

function microdataText($: cheerio.CheerioAPI, root: MicrodataRoot, prop: string) {
  return root
    .find(`[itemprop="${prop}"]`)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n");
}

/**
 * A duration in Microdata is conventionally a `<time>` element's `datetime` attribute
 * (`<time itemprop="totalTime" datetime="PT30M">30 mins</time>`), because the visible text
 * is for a reader and the attribute is for exactly this kind of reading — schema.org only
 * ever promises the machine-readable value lives *somewhere* on the tagged element, so
 * `content` and the element's own text are read too, for the templates that skip `<time>`.
 */
function microdataDurationMinutes($: cheerio.CheerioAPI, root: MicrodataRoot, prop: string) {
  const el = root.find(`[itemprop="${prop}"]`).first();
  if (el.length === 0) return null;
  return isoDurationMinutes(el.attr("datetime") ?? el.attr("content") ?? el.text());
}

/**
 * `recipeInstructions` in Microdata arrives in whichever of two shapes a site chose: the
 * property repeated once per step, or once on a container whose own steps (or paragraphs,
 * where the steps are not marked up at all) sit inside it.
 *
 * The selector inside a container asks for `[itemprop="text"]`, then `li`, then `p` — in
 * that order, taking the first that matches anything, rather than all three at once. A
 * step written `<li><p>…</p></li>` matches two of them, and asking for both is where a
 * method came back with every step written twice.
 */
function microdataInstructions($: cheerio.CheerioAPI, root: MicrodataRoot) {
  const nodes = root.find('[itemprop="recipeInstructions"]');
  if (nodes.length > 1) {
    return nodes
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join("\n");
  }

  const container = nodes.first();
  const steps = ['[itemprop="text"]', "li", "p"]
    .map((selector) => container.find(selector))
    .find((found) => found.length > 0);

  return (steps ?? container)
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n");
}

/**
 * schema.org times (`prepTime`, `cookTime`, `totalTime`) are ISO 8601 durations —
 * `PT1H30M`, not "1 hour 30 minutes" — because the spec wants a machine-readable value and
 * a recipe site's template obliges. Only the units a recipe could plausibly use are read; a
 * duration naming years or months is not a cooking time this app is prepared to believe.
 */
export function isoDurationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  if (!days && !hours && !minutes && !seconds) return null;

  const totalMinutes =
    Number(days ?? 0) * 24 * 60 + Number(hours ?? 0) * 60 + Number(minutes ?? 0) + Number(seconds ?? 0) / 60;
  return Math.round(totalMinutes);
}

/**
 * A recipe's total time, the way the filter on `/recipes` wants it: one number, start to
 * finish. `totalTime` says that directly where a site publishes it; failing that, `prepTime`
 * and `cookTime` are added together, because a site publishing only those two is still
 * telling you how long the recipe takes — just in two pieces rather than one. Neither
 * present is not the same as zero, so it stays null rather than becoming a recipe that
 * claims to take no time at all.
 */
function combinedTimeMinutes(total: number | null, prep: number | null, cook: number | null) {
  if (total !== null) return total;
  if (prep === null && cook === null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** The `<title>` or `og:title` of a page, for when there is no JSON-LD title to use. */
function fallbackTitle(html: string): string {
  const og = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i.exec(html);
  if (og?.[1]) return decodeEntities(og[1]).trim();

  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return title?.[1] ? decodeEntities(title[1]).trim() : "";
}

/**
 * `image` in JSON-LD is a URL, a list of them, an `ImageObject`, or a list of those —
 * schema.org allows all four for the same property, and a site picks whichever its template
 * happened to produce.
 */
function jsonLdImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = jsonLdImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof value === "object" && value !== null) {
    const url = (value as Record<string, unknown>).url;
    if (typeof url === "string") return url;
  }
  return null;
}

/**
 * `image` in Microdata is usually the `src` of an `<img>` or the `href` of a `<link>`
 * carrying the property directly, occasionally a `<meta content>`, and rarely a nested
 * `ImageObject` with its own `url` inside.
 */
function microdataImageUrl($: cheerio.CheerioAPI, root: MicrodataRoot) {
  const el = root.find('[itemprop="image"]').first();
  if (el.length === 0) return null;

  return (
    el.attr("src") ??
    el.attr("href") ??
    el.attr("content") ??
    el.find('[itemprop="url"]').first().attr("content") ??
    null
  );
}

/** `og:image`, for a page with neither JSON-LD nor Microdata to say what its picture is. */
function ogImage(html: string): string | null {
  const match = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i.exec(html);
  return match?.[1] ? decodeEntities(match[1]).trim() : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

/**
 * Whatever a page has that reads like prose, for a site that publishes no structured data
 * at all.
 *
 * This is new, and it is only safe because of the split. Reading a recipe *out* of a page's
 * visible markup was refused outright before, and rightly: a scraper guessing which
 * paragraphs were ingredients would fill a cook's form with a site's navigation and its
 * cookie banner, and clearing that out costs more than typing the recipe in would have. But
 * handing the text to something that is allowed to answer "there is no recipe here" is a
 * different proposition — the guess is no longer this module's to make, and a page that is
 * genuinely a recipe with an old-fashioned template stops being a page this app refuses.
 *
 * The furniture goes first, since none of it is ever the dinner, and what is left is capped:
 * the reader is being asked to find a recipe, not to read a comment section.
 */
function bodyText(html: string): string {
  const $ = cheerio.load(html.replace(/<br\s*\/?>/gi, "\n"));
  $("script, style, noscript, nav, header, footer, form, aside, iframe, svg").remove();

  const text = $("main").first().text() || $("body").text() || "";
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_BODY_TEXT);
}

/** One labelled block of the raw payload, or nothing where the page said nothing. */
function block(label: string, text: string): string {
  return text.trim() ? `${label}:\n${text.trim()}` : "";
}

/**
 * A page's own markup, gathered into raw text for the reader.
 *
 * JSON-LD is read first, since it is one self-contained block rather than attributes to
 * gather across the page, and Microdata fills in whatever field it left blank: a page mixing
 * the two, or complete in neither alone, is not a page this should give up on. A page with
 * neither falls through to its visible text.
 *
 * Nothing here judges whether what it found is a recipe. The only failure is a page with no
 * text on it at all, which is not a judgement but an observation.
 */
export function extractFromHtml(html: string, sourceUrl: string): RawExtract | null {
  const jsonLd = findRecipeNode(jsonLdBlocks(html));
  const $ = cheerio.load(html);
  const microdata = microdataRecipeRoot($);
  const hasMicrodata = microdata.length > 0;

  const title =
    asLines(jsonLd?.name) ||
    (hasMicrodata ? microdataText($, microdata, "name") : "") ||
    fallbackTitle(html);
  const ingredients =
    asLines(jsonLd?.recipeIngredient) ||
    (hasMicrodata ? microdataText($, microdata, "recipeIngredient") : "");
  const instructions =
    instructionLines(jsonLd?.recipeInstructions) ||
    (hasMicrodata ? microdataInstructions($, microdata) : "");
  const description = asLines(jsonLd?.description);

  const imageUrl =
    jsonLdImageUrl(jsonLd?.image) || (hasMicrodata ? microdataImageUrl($, microdata) : null) || ogImage(html);
  const timeHintMinutes =
    combinedTimeMinutes(
      isoDurationMinutes(jsonLd?.totalTime),
      isoDurationMinutes(jsonLd?.prepTime),
      isoDurationMinutes(jsonLd?.cookTime),
    ) ??
    (hasMicrodata
      ? combinedTimeMinutes(
          microdataDurationMinutes($, microdata, "totalTime"),
          microdataDurationMinutes($, microdata, "prepTime"),
          microdataDurationMinutes($, microdata, "cookTime"),
        )
      : null);

  // Labelled, so the reader knows which of these the site itself called its ingredients and
  // which is a paragraph that merely mentions them. It is a claim about the markup, not
  // about the food: a site is perfectly capable of tagging its serving suggestion.
  const structured = [
    block("TITLE", title),
    block("DESCRIPTION", description),
    block("INGREDIENTS", ingredients),
    block("INSTRUCTIONS", instructions),
  ]
    .filter(Boolean)
    .join("\n\n");

  const rawContent = ingredients || instructions ? structured : bodyText(html);
  if (!rawContent.trim()) return null;

  return {
    kind: "page",
    sourceUrl,
    rawTitle: title || null,
    rawContent,
    imageUrl,
    timeHintMinutes,
  };
}
