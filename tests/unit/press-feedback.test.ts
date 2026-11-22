import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Everything a person can press answers the press: a button, a link, a `<summary>`, a
 * label that holds a checkbox, a radio or a file input, and a sheet's trigger
 * (`triggerClassName`) carry one of the press classes in `globals.css` — `press-icon`,
 * `press-button`, `press-card` (by size), `press-text` (a word in a line) or `press-photo`
 * (a picture). Read from the source, so a new button without one fails here, by file and
 * line, before it is merged; `e2e/tap-targets.spec.ts` measures the pages as drawn,
 * including that each is at least 32 by 32.
 *
 * A class may be written out, in a template, or in a constant or helper in the same file
 * (`const item = "press-card …"`, `buttonClass(…)`). A component that takes its whole
 * class from its caller goes in `PASSED_ON`, and its callers are read instead.
 */

const root = join(import.meta.dirname, "../..");
const PRESS = /\bpress-(icon|button|card|text|photo)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(join(root, "src"))
  .filter((path) => path.endsWith(".tsx"))
  .map((path) => relative(root, path).split("\\").join("/"));

/** Helpers from other files that are known to hand out a press class. */
const PRESSING_HELPERS = ["buttonClass"];

/**
 * Components whose pressable element takes its class from the caller, and why that is
 * where it belongs. Their callers' `className` is read as if it were on the element.
 */
const PASSED_ON: Record<string, string> = {};

/**
 * Components that draw their own button and dress it with `triggerClassName` alone (a
 * sheet's row): where they are used, `triggerClassName` is the button's class. Found by
 * reading the components, so a new one is checked without being listed.
 */
const SHEETS = new Set(
  files.flatMap((file) => {
    const text = readFileSync(join(root, file), "utf8");
    return [...text.matchAll(/export function (\w+)[\s\S]*?(?=\nexport |$)/g)]
      // Only where it dresses a bare pressable: a `<Button className={triggerClassName}>`
      // (`ConfirmButton`) already presses through `buttonClass`.
      .filter(([body]) => /<(button|a|Link|summary)\b[^>]*?className=\{triggerClassName\}/.test(body))
      .map(([, name]) => name!);
  }),
);

/** Elements a person presses, by tag. */
const PRESSABLE = new Set(["button", "a", "Link", "summary"]);

type Offence = string;

function check(file: string, text = readFileSync(join(root, file), "utf8")): Offence[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offences: Offence[] = [];

  // Constants and functions in this file whose text hands out a press class.
  const pressing = new Set(PRESSING_HELPERS);
  const visitDeclarations = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && PRESS.test(node.initializer.getText(source))) {
      pressing.add(node.name.text);
    }
    if (ts.isFunctionDeclaration(node) && node.name && node.body && PRESS.test(node.body.getText(source))) {
      pressing.add(node.name.text);
    }
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(source);

  const presses = (expression: string) =>
    PRESS.test(expression) || [...pressing].some((name) => new RegExp(`\\b${name}\\b`).test(expression));

  const attribute = (attributes: ts.JsxAttributes, name: string) =>
    attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(source) === name);

  const classText = (attributes: ts.JsxAttributes, name = "className") => {
    const found = attribute(attributes, name);
    return found?.initializer ? found.initializer.getText(source) : null;
  };

  const where = (node: ts.Node) => `${file}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;

  /** A label is pressed when it holds the input it ticks or picks. */
  const holdsChoice = (element: ts.JsxElement) => {
    let found = false;
    const visit = (node: ts.Node) => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === "input") {
        const type = classText(node.attributes, "type");
        if (type && /checkbox|radio|file/.test(type)) found = true;
      }
      ts.forEachChild(node, visit);
    };
    element.children.forEach(visit);
    return found;
  };

  const visit = (node: ts.Node) => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const tag = opening.tagName.getText(source);
      const ownClass = classText(opening.attributes);
      const isPressable =
        PRESSABLE.has(tag) ||
        tag in PASSED_ON ||
        (tag === "label" && ts.isJsxElement(node) && holdsChoice(node)) ||
        // A file field drawn as itself (not hidden behind a button) is pressed to pick.
        (/^(input|Input)$/.test(tag) && /file/.test(classText(opening.attributes, "type") ?? "") && !/sr-only|hidden/.test(ownClass ?? ""));
      // A link that only wraps another pressable (`<Link>` round a `ButtonLink`) is not one itself.
      const spreads = opening.attributes.properties.some(ts.isJsxSpreadAttribute);
      // A sheet's trigger is dressed by `triggerClassName`, which is read where it is given.
      const sheetTrigger = ownClass !== null && /^\{\s*triggerClassName\s*\}$/.test(ownClass);
      const passesOn =
        ownClass !== null &&
        /^\{\s*className\s*\}$/.test(ownClass) &&
        Object.keys(PASSED_ON).some((name) => ts.findAncestor(node, (a) => ts.isFunctionDeclaration(a) && a.name?.text === name));
      // Nothing happens on a press of something always switched off.
      const disabled = attribute(opening.attributes, "disabled");
      const switchedOff = disabled !== undefined && (!disabled.initializer || disabled.initializer.getText(source) === "{true}");
      if (isPressable && !switchedOff && !(spreads && ownClass === null) && !sheetTrigger && !passesOn) {
        if (ownClass === null || !presses(ownClass)) {
          offences.push(`${where(opening)} <${tag}> has no press class`);
        }
      }
      const trigger = SHEETS.has(tag) ? classText(opening.attributes, "triggerClassName") : null;
      if (trigger !== null && !presses(trigger) && !/^\{\s*triggerClassName\s*\}$/.test(trigger)) {
        offences.push(`${where(opening)} <${tag} triggerClassName> has no press class`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return offences;
}

describe("press feedback", () => {
  it("every button, link, choice and sheet trigger in the app carries a press class", () => {
    const offences = files.flatMap((file) => check(file));
    expect(
      offences,
      "Give each a press class from globals.css (press-icon, press-button, press-card, press-text or press-photo), " +
        "chosen by what it looks like: the shape it presses in is its own.",
    ).toEqual([]);
  });

  it("tells a pressable thing without a press class from one with", () => {
    const probe = (body: string) => check("probe.tsx", body);
    expect(probe(`const a = <button type="button">Save</button>;`)).toEqual(["probe.tsx:1 <button> has no press class"]);
    expect(probe(`const a = <Link href="/x" className="text-sm underline">x</Link>;`)).toHaveLength(1);
    expect(probe(`const a = <label><input type="checkbox" /> On</label>;`)).toHaveLength(1);
    expect(probe(`const a = <Input type="file" name="logo" />;`)).toHaveLength(1);
    expect(probe(`const a = <input type="file" className="sr-only" />;`)).toEqual([]);

    expect(probe(`const a = <button className="press-button rounded-xl">Save</button>;`)).toEqual([]);
    expect(probe("const a = <a href=\"/x\" className={`press-text ${tone}`}>x</a>;")).toEqual([]);
    expect(probe(`const item = "press-card block"; const a = <button className={item}>x</button>;`)).toEqual([]);
    expect(probe(`const a = <button className={buttonClass("primary")}>x</button>;`)).toEqual([]);
    expect(probe(`const a = <label className="press-card"><input type="radio" /> Red</label>;`)).toEqual([]);
    // A label that only names a field is not pressed; the field is.
    expect(probe(`const a = <label htmlFor="name">Name</label>;`)).toEqual([]);
  });

  it("reads a trigger's class only where it dresses a bare button", () => {
    // `ConfirmButton` hands `triggerClassName` to a `Button`, which presses already.
    expect([...SHEETS]).not.toContain("ConfirmButton");
  });

  it("names only components that exist", () => {
    const all = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    for (const name of Object.keys(PASSED_ON)) expect(all, name).toMatch(new RegExp(`function ${name}\\b`));
  });
});
