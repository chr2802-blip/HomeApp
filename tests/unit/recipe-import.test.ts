import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchRecipeFromUrl, importPastedCaption } from "@/lib/recipe-import";
import type { RawExtract } from "@/lib/recipe-extract";

/**
 * The wiring: which addresses this app will fetch and which it refuses outright, what it
 * sends when it does, how it reads the bytes that come back, and which of the raw payloads
 * reaches the reader.
 *
 * The reader itself is stubbed. It is a model call, so a test that let it run would be a
 * test of somebody else's uptime and would cost money to run; and what is worth pinning
 * here is not what it answers but what it is *given* — the extraction half is where a
 * page's charset, its redirects and its structured data are decided, and every one of those
 * shows up as the text handed over. Where the reader's answers matter, the stub says so and
 * the assertion is about what this module does with them.
 */

const HOME_ID = "home-1";

const { normalizeRecipe } = vi.hoisted(() => ({ normalizeRecipe: vi.fn() }));

vi.mock("@/lib/recipe-normalize", () => ({ normalizeRecipe }));

/** What the reader saw — the thing most of these tests are actually asserting about. */
function wasRead(): RawExtract {
  expect(normalizeRecipe).toHaveBeenCalled();
  return normalizeRecipe.mock.calls.at(-1)![0] as RawExtract;
}

function reads(fields: Partial<{ title: string; ingredients: string; instructions: string; totalTimeMinutes: number | null; note: string | null }> = {}) {
  normalizeRecipe.mockResolvedValue({
    ok: true,
    recipe: {
      title: "Pancakes",
      ingredients: "200 g mel",
      instructions: "Steg dem.",
      totalTimeMinutes: null,
      note: null,
      ...fields,
    },
  });
}

beforeEach(() => {
  normalizeRecipe.mockReset();
  reads();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function pageWithLdJson(recipe: unknown, extra = "") {
  return `<!doctype html><html><head>
    <title>Fallback title</title>
    ${extra}
    <script type="application/ld+json">${JSON.stringify(recipe)}</script>
  </head><body></body></html>`;
}

function htmlResponse(html: string | Buffer, overrides: Partial<Response> = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(typeof html === "string" ? new TextEncoder().encode(html) : html);
      controller.close();
    },
  });
  return {
    ok: true,
    // Set because the diagnostics log it: a fake response with no status logs no status,
    // which reads as the code forgetting rather than the fixture being thin.
    status: 200,
    url: "https://example.com/recipe",
    body,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    ...overrides,
  } as Response;
}

const goodHtml = pageWithLdJson({
  "@type": "Recipe",
  name: "Pancakes",
  recipeIngredient: ["200 g mel"],
  recipeInstructions: "Steg dem.",
});

describe("fetchRecipeFromUrl", () => {
  it("fetches a page, reads it, and hands back the recipe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    expect(await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).toEqual({
      ok: true,
      recipe: {
        title: "Pancakes",
        ingredients: "200 g mel",
        instructions: "Steg dem.",
        photoId: null,
        totalTimeMinutes: null,
        note: null,
        videoUrl: null,
      },
    });
  });

  it("hands the reader the page's own text, labelled", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(wasRead()).toMatchObject({
      kind: "page",
      sourceUrl: "https://example.com/recipe",
      rawContent: expect.stringContaining("INGREDIENTS:\n200 g mel"),
    });
  });

  it("carries what the reader wants checked back to the form", async () => {
    reads({ note: "Opskriften mangler mængder til fyldet." });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    const result = await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(result.ok && result.recipe.note).toBe("Opskriften mangler mængder til fyldet.");
  });

  it("never fetches a link that is not http or https", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("javascript:alert(1)", HOME_ID);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://localhost/recipe",
    "http://127.0.0.1/recipe",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/recipe",
    "http://192.168.1.1/recipe",
    "http://[::1]/recipe",
  ])("never fetches %s", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl(url, HOME_ID);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses a redirect that lands on a blocked address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(htmlResponse(goodHtml, { url: "http://169.254.169.254/" })),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
    expect(normalizeRecipe).not.toHaveBeenCalled();
  });

  // fc00::/7 is a real IPv6 range worth refusing, but plenty of ordinary domains also
  // start with "fc" or "fd" — a check that did not first confirm it was looking at an
  // address, not a name, refused every one of them.
  it.each(["https://fcbarcelona.com/recipe", "https://fdic.gov/recipe"])(
    "fetches an ordinary domain that happens to start with fc or fd: %s",
    async (url) => {
      const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
      vi.stubGlobal("fetch", fetchMock);

      const result = await fetchRecipeFromUrl(url, HOME_ID);

      expect(fetchMock).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    },
  );

  it("sends a browser-like User-Agent, so an ordinary site does not just refuse a bare request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["User-Agent"]).toMatch(/Mozilla/);
  });

  // A site that negotiates language rather than reading it off the URL — some
  // multi-country sites do — took an English preference as a reason to swap in its
  // English site instead of the Danish page actually being asked for, which does not
  // have the Danish recipe the link pointed at.
  it("sends no Accept-Language, so a multi-locale site cannot swap in the wrong one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).not.toHaveProperty("Accept-Language");
  });

  it("decodes a page in the charset it declares, rather than assuming UTF-8", async () => {
    // "Kødsauce", the way ISO-8859-1 spells it — the same bytes read as UTF-8 would
    // come out as mojibake, which is exactly the failure this guards against.
    const html = Buffer.from(
      pageWithLdJson({
        "@type": "Recipe",
        name: "K\xf8dsauce",
        recipeIngredient: ["Hakket oksek\xf8d"],
        recipeInstructions: "Brun k\xf8det.",
      }),
      "latin1",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(html, {
          url: "https://example.dk/opskrift",
          headers: new Headers({ "content-type": "text/html; charset=iso-8859-1" }),
        }),
      ),
    );

    await fetchRecipeFromUrl("https://example.dk/opskrift", HOME_ID);

    expect(wasRead().rawContent).toContain("Hakket oksekød");
    expect(wasRead().rawTitle).toBe("Kødsauce");
  });

  /*
   * `charset="iso-8859-1"` — with the quotes, which is legal and which Instagram sends —
   * used to be captured quotes and all, handed to `TextDecoder` as a name it has never
   * heard of, and thrown away in favour of UTF-8. Invisible on a page that really is UTF-8
   * and mojibake on the Danish one, which is the exact case this decoding exists for.
   */
  it("decodes a charset the header wrapped in quotes", async () => {
    const html = Buffer.from(
      pageWithLdJson({
        "@type": "Recipe",
        name: "K\xf8dsauce",
        recipeIngredient: ["Hakket oksek\xf8d"],
        recipeInstructions: "Brun k\xf8det.",
      }),
      "latin1",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(html, {
          url: "https://example.dk/opskrift",
          headers: new Headers({ "content-type": 'text/html; charset="iso-8859-1"' }),
        }),
      ),
    );

    await fetchRecipeFromUrl("https://example.dk/opskrift", HOME_ID);

    expect(wasRead().rawContent).toContain("Hakket oksekød");
  });

  it("refuses a response that is not HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(goodHtml, { headers: new Headers({ "content-type": "application/pdf" }) }),
      ),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
    expect(normalizeRecipe).not.toHaveBeenCalled();
  });

  it("reports a network failure rather than throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));

    expect(await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).toEqual({
      ok: false,
      error: "Couldn't reach that page. Check the link and try again.",
    });
  });

  // A page that reaches fine but turns out to hold no recipe — a shop page, an article
  // about food — is what `NewRecipeDialog` offers "Start from scratch" for, and it tells
  // the two apart by this flag rather than by matching the message: a mistyped address or
  // a page that would not load is worth trying again as typed, and neither sets it.
  it("marks a page the reader says is not a recipe as not a recipe", async () => {
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "not-a-recipe" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    expect(await fetchRecipeFromUrl("https://example.com/shop", HOME_ID)).toEqual({
      ok: false,
      error: "Couldn't read a recipe from that page. Check the link, or fill the form in by hand.",
      notARecipe: true,
    });
  });

  /*
   * The reader being down is this app's own fault and says nothing about the link, so it
   * gets its own wording — but it still sets `notARecipe`, because the thing it puts in
   * front of the cook is the same: the paste box, and a way to the plain form. There is no
   * falling back to a second, worse reader; that was the arrangement this replaced.
   */
  it("says so plainly when the reader cannot be reached, and still offers the paste box", async () => {
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "unavailable" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(goodHtml)));

    const result = await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("Couldn't read that recipe just now"),
      notARecipe: true,
    });
  });

  it("does not mark a mistyped address as not a recipe", async () => {
    const result = await fetchRecipeFromUrl("not a link", HOME_ID);

    expect(result).toEqual({ ok: false, error: "That doesn't look like a web address." });
  });

  it("gives up on a response larger than the limit", async () => {
    const bigChunk = new Uint8Array(1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 4; i++) controller.enqueue(bigChunk);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://example.com/recipe",
        body,
        headers: new Headers({ "content-type": "text/html" }),
      }),
    );

    expect((await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID)).ok).toBe(false);
  });

  // No `image` field anywhere in `goodHtml`, so none of the tests above ever ask this
  // app to fetch a second URL or touch the database — importRecipeImage short-circuits
  // on a null imageUrl. The image fetch itself, which does touch storePhoto and so a
  // real database, is covered in tests/integration/recipe-import.test.ts instead.
  it("never fetches an image when the page names none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never fetches an image whose resolved address is blocked", async () => {
    const withImage = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["200 g mel"],
      recipeInstructions: "Steg dem.",
      image: "http://169.254.169.254/pancakes.jpg",
    });
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(withImage));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    // The recipe itself is still good — a blocked or unreachable picture is left out,
    // never a reason to refuse an otherwise readable recipe.
    expect(result.ok && result.recipe.photoId).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Nothing is stored for a page that turned out not to be a recipe: the picture is
  // fetched only once the reading has come back good.
  it("never fetches an image for a page the reader refused", async () => {
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "not-a-recipe" });
    const withImage = pageWithLdJson({
      "@type": "Recipe",
      name: "Pancakes",
      recipeIngredient: ["200 g mel"],
      recipeInstructions: "Steg dem.",
      image: "https://example.com/pancakes.jpg",
    });
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(withImage));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * A reel takes the other route through stage one entirely: no `schema.org/Recipe` markup is
 * ever coming, so the caption is the text and the link is the video. What is pinned here is
 * which addresses are asked, in which order, and what happens when every one of them
 * refuses, which on Meta's side is an ordinary Tuesday. Reading the markup itself belongs
 * to `reel-import.test.ts`.
 */
describe("fetchRecipeFromUrl — a reel", () => {
  const REEL = "https://www.instagram.com/reel/ABC123/";

  const embedPage = `<html><body>
    <img class="EmbeddedMediaImage" src="https://scontent.example/poster.jpg" />
    <div class="Caption">
      <a class="CaptionUsername">somekitchen</a>
      Pasta al limone<br>Ingredienser<br>400 g spaghetti<br>2 citroner<br>Fremgangsmåde<br>Kog pastaen.
      <div class="CaptionComments">57 comments</div>
    </div>
  </body></html>`;

  it("hands the reader the caption, and keeps the link as the video", async () => {
    // The picture is fetched and stored like any other upload, which wants a database
    // this suite does not have — so it fails quietly, exactly as a blocked one would.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(embedPage, { url: REEL })));
    reads({ title: "Pasta al limone", ingredients: "400 g spaghetti", instructions: "Kog pastaen." });

    const result = await fetchRecipeFromUrl(REEL, HOME_ID);

    expect(wasRead()).toMatchObject({ kind: "reel", sourceUrl: REEL });
    expect(wasRead().rawContent).toContain("400 g spaghetti");
    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Pasta al limone",
        ingredients: "400 g spaghetti",
        instructions: "Kog pastaen.",
        photoId: null,
        totalTimeMinutes: null,
        note: null,
        videoUrl: REEL,
      },
    });
  });

  it("asks the embed page first, since it is the one written for a caller with no account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(embedPage, { url: REEL }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchRecipeFromUrl(REEL, HOME_ID);

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://www.instagram.com/reel/ABC123/embed/captioned/",
    );
  });

  /*
   * A browser string gets the single-page app: 632 KB of JavaScript with the caption in
   * none of it. Markup is what these sites serve a crawler, because a link with no preview
   * is a link nobody shares — so this is the one place in the app that does not ask as a
   * browser, and an ordinary recipe page still does.
   */
  it("asks a social network as a crawler, and an ordinary recipe page as a browser", async () => {
    const reelFetch = vi.fn().mockResolvedValue(htmlResponse(embedPage, { url: REEL }));
    vi.stubGlobal("fetch", reelFetch);
    await fetchRecipeFromUrl(REEL, HOME_ID);
    expect(reelFetch.mock.calls[0][1].headers["User-Agent"]).toMatch(/HomeHubBot/);

    vi.unstubAllGlobals();

    const pageFetch = vi.fn().mockResolvedValue(htmlResponse(goodHtml));
    vi.stubGlobal("fetch", pageFetch);
    await fetchRecipeFromUrl("https://example.com/recipe", HOME_ID);
    expect(pageFetch.mock.calls[0][1].headers["User-Agent"]).toMatch(/Mozilla\/5\.0 \(Windows/);
  });

  it("tries the next source when the first refuses, rather than giving up on the reel", async () => {
    const withOgDescription = `<html><head>
      <meta property="og:description" content="12 likes - somekitchen: &quot;Boller&#10;Ingredienser&#10;500 g mel&quot;" />
    </head></html>`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, url: REEL, body: null, headers: new Headers() } as Response)
      .mockResolvedValue(htmlResponse(withOgDescription, { url: REEL }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl(REEL, HOME_ID);

    expect(result.ok).toBe(true);
    expect(wasRead().rawContent).toContain("500 g mel");
  });

  /*
   * Once a caption has been read there is nothing another address could add, so the reader
   * gets it immediately rather than the chain carrying on. The reader is the only thing
   * entitled to say the text is not a recipe, and asking Instagram twice will not change
   * its mind about that.
   */
  it("stops asking once a caption has been read, even when the reader refuses it", async () => {
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "not-a-recipe" });
    const chat = `<html><body><div class="Caption">Sikke en dejlig aften i haven</div></body></html>`;
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(chat, { url: REEL }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchRecipeFromUrl(REEL, HOME_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("Couldn't find a recipe in that description"),
      notARecipe: true,
    });
  });

  it("offers the paste box when every source refuses, and says why", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")));

    const result = await fetchRecipeFromUrl(REEL, HOME_ID);

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("Paste it in below"),
      notARecipe: true,
    });
    expect(normalizeRecipe).not.toHaveBeenCalled();
  });

  /*
   * A reel that will not import is the one failure in this app with nothing to look at.
   * Meta refusing, a login wall served as a page, the timeout running out and the embed
   * markup moving all used to end as the same silent `null`, and the cook got the same
   * sentence for all four — so nobody could tell which of them had anything to be done
   * about it. These pin that each one now says so, because a log line nobody wrote is a
   * log line nobody can read.
   */
  describe("says why each source refused", () => {
    function captureLogs() {
      const lines: Record<string, unknown>[] = [];
      const record = (text: unknown) => {
        try {
          lines.push(JSON.parse(String(text)));
        } catch {
          // Not one of ours.
        }
      };
      vi.spyOn(console, "warn").mockImplementation(record);
      vi.spyOn(console, "error").mockImplementation(record);
      return lines;
    }

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("names the status when a source answers with one", async () => {
      const lines = captureLogs();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status: 403, url: REEL, body: null, headers: new Headers() } as Response),
      );

      await fetchRecipeFromUrl(REEL, HOME_ID);

      expect(lines).toContainEqual(
        expect.objectContaining({ event: "reel_caption_source", outcome: "http_error", status: 403 }),
      );
    });

    it("tells a timeout apart from a refused connection, since only one is ours to change", async () => {
      const lines = captureLogs();
      const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));

      await fetchRecipeFromUrl(REEL, HOME_ID);

      expect(lines).toContainEqual(
        expect.objectContaining({ event: "reel_caption_source", outcome: "timed_out" }),
      );
    });

    // The interesting one: a perfectly ordinary 200 that is a login wall rather than a post.
    it("says a page answered and still had no caption, and what it looked like", async () => {
      const lines = captureLogs();
      const loginWall = `<html><body><div id="loginForm">Log in to see this</div></body></html>`;
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(loginWall, { url: REEL })));

      await fetchRecipeFromUrl(REEL, HOME_ID);

      expect(lines).toContainEqual(
        expect.objectContaining({
          event: "reel_caption_source",
          outcome: "no_caption",
          status: 200,
          looksLikeLoginWall: true,
          hasCaptionElement: false,
        }),
      );
    });

    /*
     * The field the first round of diagnostics did not have, and the one that would have
     * settled it: an embed page that redirected to the app's front door and an embed page
     * that answered in person are indistinguishable from here without it.
     */
    it("says where the request actually landed, not where it was aimed", async () => {
      const lines = captureLogs();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          htmlResponse("<html><head><title>Instagram</title></head><body>app shell</body></html>", {
            url: "https://www.instagram.com/accounts/login/",
          }),
        ),
      );

      await fetchRecipeFromUrl(REEL, HOME_ID);

      expect(lines).toContainEqual(
        expect.objectContaining({
          event: "reel_caption_source",
          outcome: "no_caption",
          landedOn: "https://www.instagram.com/accounts/login/",
          title: "Instagram",
        }),
      );
    });

    it("records running out of sources, which is the line the cook's error came from", async () => {
      const lines = captureLogs();
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("refused")));

      await fetchRecipeFromUrl(REEL, HOME_ID);

      expect(lines).toContainEqual(
        expect.objectContaining({ event: "reel_caption_unreachable", url: REEL, sourcesTried: 2 }),
      );
    });
  });
});

describe("importPastedCaption", () => {
  const CAPTION = "Boller\nIngredienser\n500 g mel\n25 g gær\nFremgangsmåde\nÆlt det sammen.";

  it("hands the reader exactly what was pasted, and keeps the reel beside it as the video", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("still refused")));
    reads({ title: "Boller", ingredients: "500 g mel\n25 g gær", instructions: "Ælt det sammen." });

    const result = await importPastedCaption(CAPTION, "https://www.instagram.com/reel/ABC123/", HOME_ID);

    expect(wasRead()).toMatchObject({ kind: "pasted", rawContent: CAPTION });
    expect(result).toEqual({
      ok: true,
      recipe: {
        title: "Boller",
        ingredients: "500 g mel\n25 g gær",
        instructions: "Ælt det sammen.",
        photoId: null,
        totalTimeMinutes: null,
        note: null,
        videoUrl: "https://www.instagram.com/reel/ABC123/",
      },
    });
  });

  it("reads a caption pasted with no link at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await importPastedCaption(CAPTION, "", HOME_ID);

    expect(result.ok).toBe(true);
    expect(result.ok && result.recipe.videoUrl).toBeNull();
    // Nothing to fetch a poster frame from, so nothing is fetched.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an empty paste without troubling the reader", async () => {
    expect((await importPastedCaption("   ", "", HOME_ID)).ok).toBe(false);
    expect(normalizeRecipe).not.toHaveBeenCalled();
  });

  it("passes the reader's refusal on, with the wording that points at the box", async () => {
    normalizeRecipe.mockResolvedValue({ ok: false, reason: "not-a-recipe" });

    const result = await importPastedCaption("Sikke en dejlig aften i haven", "", HOME_ID);

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining("Couldn't find a recipe in that description"),
      notARecipe: true,
    });
  });
});
