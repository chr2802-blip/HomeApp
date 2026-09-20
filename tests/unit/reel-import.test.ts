import { describe, expect, it } from "vitest";
import {
  captionFromHtml,
  captionFromOEmbed,
  captionSources,
  isReelUrl,
  unwrapSocialDescription,
} from "@/lib/reel-import";

/**
 * The markup Instagram's own embed page hands a caller with no account: the caption in
 * a `.Caption` element with the account's name linked at the front and the comment
 * count in a block at the end, and the video's poster frame as an `EmbeddedMediaImage`.
 * Trimmed to the parts this reads, with the line breaks that carry the whole structure.
 */
const INSTAGRAM_EMBED = `<!doctype html><html><head>
  <meta property="og:title" content="somekitchen on Instagram: Pasta al limone" />
  <meta property="og:image" content="https://scontent.example/og.jpg" />
</head><body>
  <img class="EmbeddedMediaImage" src="https://scontent.example/poster.jpg" />
  <div class="Caption">
    <a class="CaptionUsername" href="/somekitchen/">somekitchen</a>
    <span> </span>
    Pasta al limone<br>Ingredienser<br>400 g spaghetti<br>2 citroner<br>Fremgangsmåde<br>Kog pastaen.
    <div class="CaptionComments"><span>57 comments</span></div>
  </div>
</body></html>`;

describe("captionSources", () => {
  it("asks Instagram's embed page before the post's own, which answers signed out", () => {
    expect(captionSources("https://www.instagram.com/reel/ABC123/")).toEqual([
      { url: "https://www.instagram.com/reel/ABC123/embed/captioned/", kind: "html" },
      { url: "https://www.instagram.com/reel/ABC123/", kind: "html" },
    ]);
  });

  it("finds the code behind a share sheet's /share/ prefix and a tracking parameter", () => {
    expect(captionSources("https://www.instagram.com/share/reel/ABC123/?igsh=xyz")[0].url).toBe(
      "https://www.instagram.com/reel/ABC123/embed/captioned/",
    );
  });

  it("normalises /reels/ and reads an ordinary post the same way", () => {
    expect(captionSources("https://instagram.com/reels/ABC123")[0].url).toBe(
      "https://www.instagram.com/reel/ABC123/embed/captioned/",
    );
    expect(captionSources("https://www.instagram.com/p/ABC123/")[0].url).toBe(
      "https://www.instagram.com/p/ABC123/embed/captioned/",
    );
  });

  it("asks TikTok's oEmbed first, which is the one open endpoint of the three", () => {
    const [first] = captionSources("https://www.tiktok.com/@cook/video/7123456789?is_from=1");
    expect(first).toEqual({
      url: "https://www.tiktok.com/oembed?url=https%3A%2F%2Fwww.tiktok.com%2F%40cook%2Fvideo%2F7123456789%3Fis_from%3D1",
      kind: "json",
    });
  });

  it("asks Facebook's own page, then the plugin that renders a post's text", () => {
    const sources = captionSources("https://www.facebook.com/reel/123456?mibextid=abc");
    expect(sources[0].url).toBe("https://www.facebook.com/reel/123456");
    expect(sources[1].url).toContain("plugins/post.php");
    expect(sources[1].url).toContain("show_text=true");
  });

  it("has nothing to say about an ordinary recipe page, which takes the other route", () => {
    expect(captionSources("https://www.example.com/recipes/lasagne")).toEqual([]);
    expect(isReelUrl("https://www.example.com/recipes/lasagne")).toBe(false);
    expect(isReelUrl("https://www.instagram.com/reel/ABC123/")).toBe(true);
  });

  it("refuses a link that is not a web address, and an Instagram link with no code", () => {
    expect(captionSources("not a link")).toEqual([]);
    expect(captionSources("javascript:alert(1)")).toEqual([]);
    expect(captionSources("https://www.instagram.com/somekitchen/")).toEqual([]);
  });
});

describe("captionFromHtml", () => {
  it("reads the caption out of Instagram's embed page, username and comments removed", () => {
    const read = captionFromHtml(INSTAGRAM_EMBED);

    expect(read?.caption).toContain("Pasta al limone");
    expect(read?.caption).not.toContain("somekitchen");
    expect(read?.caption).not.toContain("57 comments");
  });

  it("keeps the caption's line breaks, which are the whole of its structure", () => {
    // `<br>` is a caption's only line break, and cheerio's own .text() drops it — a
    // caption arriving as one long line is one the parser cannot read at all.
    expect(captionFromHtml(INSTAGRAM_EMBED)?.caption.split("\n").map((l) => l.trim())).toEqual([
      "Pasta al limone",
      "Ingredienser",
      "400 g spaghetti",
      "2 citroner",
      "Fremgangsmåde",
      "Kog pastaen.",
    ]);
  });

  it("prefers the video's own poster frame to the page's og:image", () => {
    expect(captionFromHtml(INSTAGRAM_EMBED)?.imageUrl).toBe("https://scontent.example/poster.jpg");
  });

  it("falls back to og:description, unwrapped, for a page with no embed markup", () => {
    const html = `<html><head>
      <meta property="og:title" content="somekitchen on Instagram" />
      <meta property="og:image" content="https://scontent.example/og.jpg" />
      <meta property="og:description" content="2,481 likes, 57 comments - somekitchen on June 4, 2025: &quot;Pasta al limone. Ingredienser: 400 g spaghetti&quot;" />
    </head><body></body></html>`;

    expect(captionFromHtml(html)).toEqual({
      caption: "Pasta al limone. Ingredienser: 400 g spaghetti",
      imageUrl: "https://scontent.example/og.jpg",
      pageTitle: "somekitchen on Instagram",
    });
  });

  it("returns null for a page that says nothing at all about its own content", () => {
    expect(captionFromHtml("<html><head><title>Log in</title></head><body></body></html>")).toBeNull();
  });
});

describe("unwrapSocialDescription", () => {
  it("takes off the likes-and-comments sentence Instagram wraps a caption in", () => {
    expect(
      unwrapSocialDescription(`12 likes, 3 comments - cook on May 1, 2025: "Boller i karry".`),
    ).toBe("Boller i karry");
  });

  it("leaves a description that was never wrapped exactly as it was", () => {
    expect(unwrapSocialDescription("Boller i karry, som mor lavede dem")).toBe(
      "Boller i karry, som mor lavede dem",
    );
  });
});

describe("captionFromOEmbed", () => {
  it("reads TikTok's title as the caption and its thumbnail as the picture", () => {
    const body = JSON.stringify({
      title: "Cremet pasta\nIngredienser\n400 g pasta",
      thumbnail_url: "https://p16.example/cover.jpg",
      author_name: "cook",
    });

    expect(captionFromOEmbed(body)).toEqual({
      caption: "Cremet pasta\nIngredienser\n400 g pasta",
      imageUrl: "https://p16.example/cover.jpg",
      pageTitle: "cook",
    });
  });

  it("returns null for a document with no caption in it, and for one that is not JSON", () => {
    expect(captionFromOEmbed(JSON.stringify({ thumbnail_url: "https://x.example/a.jpg" }))).toBeNull();
    expect(captionFromOEmbed("<html>an error page</html>")).toBeNull();
  });
});
