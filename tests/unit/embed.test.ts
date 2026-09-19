import { describe, expect, it } from "vitest";
import { parseSocialEmbed, safeExternalHref } from "@/lib/embed";

describe("parseSocialEmbed — Instagram", () => {
  it("embeds a reel through Instagram's own reel embed endpoint", () => {
    expect(parseSocialEmbed("https://www.instagram.com/reel/Cx1y2Z3aBcD/")).toEqual({
      src: "https://www.instagram.com/reel/Cx1y2Z3aBcD/embed",
      aspect: "vertical",
      fixed: { provider: "instagram", width: 380, height: 600 },
    });
  });

  it("keeps a post or a tv link on its own kind of embed, and folds the reels spelling into reel", () => {
    expect(parseSocialEmbed("https://instagram.com/p/AbC123/")?.src).toBe(
      "https://www.instagram.com/p/AbC123/embed",
    );
    expect(parseSocialEmbed("https://instagram.com/tv/AbC123/")?.src).toBe(
      "https://www.instagram.com/tv/AbC123/embed",
    );
    expect(parseSocialEmbed("https://instagram.com/reels/AbC123/")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed",
    );
  });

  it("handles a username in the path and strips tracking query params", () => {
    expect(parseSocialEmbed("https://www.instagram.com/somecook/reel/AbC123/?igsh=tracking")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed",
    );
  });

  it("accepts a mobile share link's /share/reel/ID and /share/p/ID shape", () => {
    expect(parseSocialEmbed("https://www.instagram.com/share/reel/AbC123/?utm_source=ig_web_copy_link")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed",
    );
    expect(parseSocialEmbed("https://www.instagram.com/share/p/AbC123/")?.src).toBe(
      "https://www.instagram.com/p/AbC123/embed",
    );
  });

  it("accepts the instagr.am short domain", () => {
    expect(parseSocialEmbed("https://instagr.am/reel/AbC123/")?.src).toBe(
      "https://www.instagram.com/reel/AbC123/embed",
    );
  });

  it("rejects a profile link with no shortcode", () => {
    expect(parseSocialEmbed("https://www.instagram.com/somecook/")).toBeNull();
  });
});

describe("parseSocialEmbed — YouTube", () => {
  it("embeds a watch URL", () => {
    expect(parseSocialEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "wide",
    });
  });

  it("embeds a short as vertical", () => {
    expect(parseSocialEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "vertical",
    });
  });

  it("embeds youtu.be links", () => {
    expect(parseSocialEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rejects a YouTube URL with no video id", () => {
    expect(parseSocialEmbed("https://www.youtube.com/watch")).toBeNull();
    expect(parseSocialEmbed("https://www.youtube.com/")).toBeNull();
  });
});

describe("parseSocialEmbed — other hosts", () => {
  it("embeds TikTok videos", () => {
    expect(parseSocialEmbed("https://www.tiktok.com/@chef/video/7234567890123456789")).toEqual({
      src: "https://www.tiktok.com/embed/v2/7234567890123456789",
      aspect: "vertical",
    });
  });

  it("rejects a TikTok id that is not numeric", () => {
    expect(parseSocialEmbed("https://www.tiktok.com/@chef/video/not-a-number")).toBeNull();
  });

  it("embeds Vimeo videos", () => {
    expect(parseSocialEmbed("https://vimeo.com/123456789")).toEqual({
      src: "https://player.vimeo.com/video/123456789",
      aspect: "wide",
    });
  });

  it("routes Facebook videos through the plugin player", () => {
    const embed = parseSocialEmbed("https://www.facebook.com/watch/?v=123456789");
    expect(embed?.src).toBe(
      "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fwatch%3Fv%3D123456789&show_text=false",
    );
    expect(embed?.fixed).toEqual({ provider: "facebook", width: 380, height: 680 });
  });

  it("keeps a video's own query parameters but strips tracking ones from the href it hands Facebook", () => {
    const embed = parseSocialEmbed("https://www.facebook.com/watch/?v=123456789&mibextid=abc123");
    const href = new URL(embed!.src).searchParams.get("href")!;
    expect(href).toBe("https://www.facebook.com/watch?v=123456789");
  });

  it("accepts a reel link and fb.watch, and normalizes the mobile and web subdomains", () => {
    for (const url of [
      "https://www.facebook.com/reel/123456789",
      "https://fb.watch/AbC123/",
      "https://m.facebook.com/reel/123456789",
      "https://web.facebook.com/reel/123456789",
    ]) {
      expect(parseSocialEmbed(url)?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
    }
  });
});

describe("parseSocialEmbed — refuses anything not allowlisted", () => {
  it("returns null for an unknown host", () => {
    expect(parseSocialEmbed("https://evil.example.com/video/1")).toBeNull();
  });

  it("returns null for dangerous schemes", () => {
    expect(parseSocialEmbed("javascript:alert(1)")).toBeNull();
    expect(parseSocialEmbed("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(parseSocialEmbed("file:///etc/passwd")).toBeNull();
  });

  it("returns null for empty and malformed input", () => {
    expect(parseSocialEmbed(null)).toBeNull();
    expect(parseSocialEmbed(undefined)).toBeNull();
    expect(parseSocialEmbed("")).toBeNull();
    expect(parseSocialEmbed("not a url")).toBeNull();
  });

  it("is not fooled by a lookalike host", () => {
    expect(parseSocialEmbed("https://youtube.com.evil.example/watch?v=abcdef")).toBeNull();
    expect(parseSocialEmbed("https://notinstagram.com/reel/AbC123/")).toBeNull();
  });

  it("cannot be used to smuggle markup into the iframe src", () => {
    const embed = parseSocialEmbed('https://www.instagram.com/reel/abc"><script>alert(1)</script>/');
    expect(embed).toBeNull();
  });
});

describe("safeExternalHref", () => {
  it("keeps http and https links", () => {
    expect(safeExternalHref("https://example.com/recipe")).toBe("https://example.com/recipe");
    expect(safeExternalHref("http://example.com/")).toBe("http://example.com/");
  });

  it("trims surrounding whitespace", () => {
    expect(safeExternalHref("  https://example.com/  ")).toBe("https://example.com/");
  });

  it("drops dangerous or unusable values", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeNull();
    expect(safeExternalHref("data:text/html,hi")).toBeNull();
    expect(safeExternalHref("")).toBeNull();
    expect(safeExternalHref(null)).toBeNull();
    expect(safeExternalHref("nonsense")).toBeNull();
  });
});
