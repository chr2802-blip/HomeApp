import { describe, expect, it } from "vitest";
import { safeExternalHref, toEmbed } from "@/lib/embed";

describe("toEmbed — Instagram", () => {
  it("embeds a reel", () => {
    expect(toEmbed("https://www.instagram.com/reel/Cx1y2Z3aBcD/")).toEqual({
      src: "https://www.instagram.com/p/Cx1y2Z3aBcD/embed",
      aspect: "vertical",
    });
  });

  it("embeds posts, tv and the reels spelling", () => {
    for (const kind of ["p", "tv", "reels"]) {
      expect(toEmbed(`https://instagram.com/${kind}/AbC123/`)?.src).toBe(
        "https://www.instagram.com/p/AbC123/embed",
      );
    }
  });

  it("handles a username in the path and tracking query params", () => {
    expect(toEmbed("https://www.instagram.com/somecook/reel/AbC123/?igsh=tracking")?.src).toBe(
      "https://www.instagram.com/p/AbC123/embed",
    );
  });

  it("rejects a profile link with no shortcode", () => {
    expect(toEmbed("https://www.instagram.com/somecook/")).toBeNull();
  });
});

describe("toEmbed — YouTube", () => {
  it("embeds a watch URL", () => {
    expect(toEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "wide",
    });
  });

  it("embeds a short as vertical", () => {
    expect(toEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      aspect: "vertical",
    });
  });

  it("embeds youtu.be links", () => {
    expect(toEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe(
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rejects a YouTube URL with no video id", () => {
    expect(toEmbed("https://www.youtube.com/watch")).toBeNull();
    expect(toEmbed("https://www.youtube.com/")).toBeNull();
  });
});

describe("toEmbed — other hosts", () => {
  it("embeds TikTok videos", () => {
    expect(toEmbed("https://www.tiktok.com/@chef/video/7234567890123456789")).toEqual({
      src: "https://www.tiktok.com/embed/v2/7234567890123456789",
      aspect: "vertical",
    });
  });

  it("rejects a TikTok id that is not numeric", () => {
    expect(toEmbed("https://www.tiktok.com/@chef/video/not-a-number")).toBeNull();
  });

  it("embeds Vimeo videos", () => {
    expect(toEmbed("https://vimeo.com/123456789")).toEqual({
      src: "https://player.vimeo.com/video/123456789",
      aspect: "wide",
    });
  });

  it("routes Facebook videos through the plugin player", () => {
    const embed = toEmbed("https://www.facebook.com/watch/?v=123456789");
    expect(embed?.src.startsWith("https://www.facebook.com/plugins/video.php?")).toBe(true);
    expect(embed?.src).toContain("show_text=false");
  });
});

describe("toEmbed — refuses anything not allowlisted", () => {
  it("returns null for an unknown host", () => {
    expect(toEmbed("https://evil.example.com/video/1")).toBeNull();
  });

  it("returns null for dangerous schemes", () => {
    expect(toEmbed("javascript:alert(1)")).toBeNull();
    expect(toEmbed("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(toEmbed("file:///etc/passwd")).toBeNull();
  });

  it("returns null for empty and malformed input", () => {
    expect(toEmbed(null)).toBeNull();
    expect(toEmbed(undefined)).toBeNull();
    expect(toEmbed("")).toBeNull();
    expect(toEmbed("not a url")).toBeNull();
  });

  it("is not fooled by a lookalike host", () => {
    expect(toEmbed("https://youtube.com.evil.example/watch?v=abcdef")).toBeNull();
    expect(toEmbed("https://notinstagram.com/reel/AbC123/")).toBeNull();
  });

  it("cannot be used to smuggle markup into the iframe src", () => {
    const embed = toEmbed('https://www.instagram.com/reel/abc"><script>alert(1)</script>/');
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
