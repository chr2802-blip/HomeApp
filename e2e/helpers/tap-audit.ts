import type { Page } from "@playwright/test";

/** The smallest thing a finger is asked to hit, in CSS pixels each way. */
export const MIN_TAP = 32;

/** Anything a person can press. Text fields and the like are typed in, not pressed. */
const TAPPABLE = [
  "a[href]",
  "button",
  "summary",
  "[role=button]",
  "[role=tab]",
  "[role=option]",
  "[role=menuitem]",
  "[role=radio]",
  "[role=checkbox]",
  "[role=switch]",
  "label:has(> input[type=checkbox], > input[type=radio], > input[type=file])",
  "label:has(input[type=checkbox], input[type=radio], input[type=file])",
  "input[type=checkbox]",
  "input[type=radio]",
  "input[type=file]",
  "input[type=submit]",
].join(",");

export type TapProblem = { what: string; problem: string };

/**
 * Every visible thing on the page a person can press, measured as the browser lays it out:
 * each must be at least `MIN_TAP` by `MIN_TAP`, and must press in (one of `.press-icon`,
 * `.press-button`, `.press-card`, `.press-text`, `.press-photo` in
 * `globals.css`), so a tap is felt wherever it lands.
 * A checkbox or radio that is hidden (`sr-only`) is pressed through its label, which is
 * what is measured.
 */
export async function tapProblems(page: Page): Promise<TapProblem[]> {
  return page.evaluate(
    ({ selector, min }) => {
      const pressed = (el: Element) => el.matches(".press-icon, .press-button, .press-card, .press-text, .press-photo");
      const describe = (el: Element) => {
        const name =
          el.getAttribute("aria-label") ??
          (el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 40) ??
          "";
        const href = el.getAttribute("href");
        const tag = el.tagName.toLowerCase();
        return `<${tag}${href ? ` href="${href}"` : ""}${name ? "" : ` class="${el.getAttribute("class") ?? ""}"`}> "${name}"`;
      };
      const visible = (el: Element) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") return false;
        if (el.closest("[aria-hidden=true], [inert]")) return false;
        // Visually hidden (sr-only): pressed through something else, measured there.
        if (rect.width <= 1 || rect.height <= 1) return false;
        if (style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)") return false;
        return true;
      };

      const problems: { what: string; problem: string }[] = [];
      const seen = new Set<Element>();
      for (const el of document.querySelectorAll(selector)) {
        if (!visible(el)) continue;
        // A control inside another one is pressed as part of it.
        const outer = el.parentElement?.closest(selector);
        if (outer && visible(outer)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        const width = Math.round(rect.width * 10) / 10;
        const height = Math.round(rect.height * 10) / 10;
        if (width + 0.5 < min || height + 0.5 < min) {
          problems.push({ what: describe(el), problem: `${width}×${height} px` });
        }
        // Nothing happens on a press of something switched off, so nothing answers it.
        const off = el.matches(":disabled, [aria-disabled=true]");
        if (!off && !pressed(el)) problems.push({ what: describe(el), problem: "presses without feedback" });
      }

      // A card's press shade fills its own box, cut by its own corners: it must not show
      // square in a rounded card it sits in the corner of, nor round a rounded face it holds.
      const radii = (style: CSSStyleDeclaration) =>
        [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius].map(
          (value) => parseFloat(value) || 0,
        );
      const paints = (style: CSSStyleDeclaration) =>
        style.backgroundColor !== "rgba(0, 0, 0, 0)" || parseFloat(style.borderTopWidth) > 0 || style.boxShadow !== "none";
      const clips = (style: CSSStyleDeclaration) => style.overflowX !== "visible" || style.overflowY !== "visible";
      for (const el of document.querySelectorAll(".press-card")) {
        if (!visible(el)) continue;
        const own = radii(getComputedStyle(el));
        // Measured unpressed: a press in progress would shrink the box.
        const box = el.getBoundingClientRect();
        for (let shape = el.parentElement; shape && shape !== document.body; shape = shape.parentElement) {
          const style = getComputedStyle(shape);
          const round = radii(style);
          if (clips(style)) break;
          if (!round.some((r) => r > 1) || !paints(style)) continue;
          const outer = shape.getBoundingClientRect();
          const border = parseFloat(style.borderTopWidth) || 0;
          const near = (a: number, b: number) => Math.abs(a - b) <= border + 1;
          const corners = [
            near(box.top, outer.top) && near(box.left, outer.left),
            near(box.top, outer.top) && near(box.right, outer.right),
            near(box.bottom, outer.bottom) && near(box.right, outer.right),
            near(box.bottom, outer.bottom) && near(box.left, outer.left),
          ];
          if (corners.some((at, i) => at && own[i]! + 1 < round[i]! - border)) {
            problems.push({ what: describe(el), problem: "square press shade in a rounded corner" });
          }
          break;
        }
        const face = el.children.length === 1 ? el.children[0]! : null;
        if (face && own.every((r) => r < 1) && !paints(getComputedStyle(el))) {
          const inner = face.getBoundingClientRect();
          const fills = Math.abs(inner.width - box.width) <= 1 && Math.abs(inner.height - box.height) <= 1;
          if (fills && radii(getComputedStyle(face)).some((r) => r > 1)) {
            problems.push({ what: describe(el), problem: "square press shade round a rounded face" });
          }
        }
      }
      return problems;
    },
    { selector: TAPPABLE, min: MIN_TAP },
  );
}
