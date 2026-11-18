import { test, expect } from "bun:test";
import { readFileSync, readdirSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { build, prepare, toPng, SpecError } from "./src/render";
import type { Node } from "./src/ui";

const EXAMPLES = join(import.meta.dir, "../examples");
const examples = readdirSync(EXAMPLES)
  .filter((f) => f.endsWith(".json"))
  .map((f) => [f, JSON.parse(readFileSync(join(EXAMPLES, f), "utf8"))] as const);

function texts(n: Node | string | number | unknown): string[] {
  if (typeof n === "string" || typeof n === "number") return [String(n)];
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const kids = (n as Node).props.children;
  return (Array.isArray(kids) ? kids : [kids]).flatMap(texts);
}

function pngSize(buf: Buffer) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const ci = (before: number, after: number, extra = {}) => ({
  template: "compare",
  unit: "s",
  before: { label: "old", value: before },
  after: { label: "new", value: after },
  ...extra,
});

test("compare derives the delta, ratio and share the Bun CI cards print", () => {
  expect(texts(build(ci(42, 20)))).toEqual(expect.arrayContaining(["22", "2.1×", "52%", "faster", "less time"]));
  expect(texts(build(ci(5.2, 3.1, { hero: "ratio", layout: "bar" })))).toEqual(expect.arrayContaining(["1.7×", "2.1", "40%"]));
  expect(texts(build(ci(90, 21, { layout: "ring" })))).toEqual(expect.arrayContaining(["69", "4.3×", "77%"]));
});

test("memory and throughput metrics change the wording", () => {
  expect(texts(build(ci(43.6, 7.9, { metric: "memory", unit: "GiB", hero: "ratio", layout: "stack" })))).toEqual(
    expect.arrayContaining(["5.5×", "less memory", "35.7", "82%"]),
  );
  expect(texts(build(ci(1000, 4000, { metric: "throughput", hero: "ratio" })))).toEqual(expect.arrayContaining(["4.0×", "faster", "more"]));
});

test("a regression is drawn as a regression with the matching wording", () => {
  const card = prepare(ci(20, 42, { layout: "bar" }));
  expect(texts(card.node)).toEqual(expect.arrayContaining(["22", "slower", "2.1×", "110%", "more time"]));
  expect(card.summary).toMatchObject({ direction: "regressed", hero: "22 s slower" });
  expect(texts(build(ci(4000, 1000, { metric: "throughput", hero: "ratio", layout: "ring" })))).toEqual(expect.arrayContaining(["4.0×", "slower", "less"]));
  expect(prepare(ci(10, 10)).summary).toMatchObject({ direction: "unchanged" });
});

test("bars word a slower hero series as slower", () => {
  const card = prepare({ template: "bars", series: ["new", "old"], rows: [{ label: "x", values: [30, 10] }] });
  expect(texts(card.node)).toEqual(expect.arrayContaining(["3.0×", "slower"]));
  expect(card.summary).toEqual([{ label: "x", ratio: 3, direction: "regressed" }]);
});

test("unknown fields and text that may overflow come back as warnings", () => {
  const card = prepare({ ...ci(42, 20), befor: 1, title: "x".repeat(80), after: { label: "new", value: 20, colour: "red" } });
  expect(card.warnings).toEqual(
    expect.arrayContaining([expect.stringMatching(/^befor: unknown field/), expect.stringMatching(/^after\.colour: unknown field/), expect.stringMatching(/^title: 80 characters may not fit/)]),
  );
  expect(prepare(ci(42, 20)).warnings).toEqual([]);
});

test("spec errors name the offending path", () => {
  expect(() => build({ template: "pie" })).toThrow(/template: expected one of compare, stats, bars/);
  expect(() => build({ template: "bars", series: ["a", "b"], rows: [{ label: "x", values: [1] }] })).toThrow(/rows\[0\]\.values: expected at least 2 items/);
  expect(() => build({ template: "progress", items: [{ label: "x", passed: 9, total: 5 }] })).toThrow(/items\[0\]\.passed: expected 0 to 5/);
  expect(() => build({ ...ci(42, 20), accent: "mauve" })).toThrow(/accent: expected one of blue/);
  expect(() => build({ template: "stats", tiles: Array(5).fill({ caption: "x", before: 2, after: 1 }) })).toThrow(/tiles: expected at most 4 items, got 5/);
});

test("table delta compares against the named column and hides small changes", () => {
  const t = texts(
    build({
      template: "table",
      metric: "memory",
      columns: ["new", "old"],
      delta: { against: 1 },
      rows: [
        { label: "a", values: [94, 128] },
        { label: "b", values: [48, 47] },
      ],
    }),
  );
  expect(t).toEqual(expect.arrayContaining(["Δ", "vs old", "−27%", "–"]));
});

test("progress never rounds a partial pass up to 100%", () => {
  expect(texts(build({ template: "progress", items: [{ label: "x", passed: 999, total: 1000 }] }))).toContain("99%");
  expect(texts(build({ template: "progress", items: [{ label: "x", passed: 389, total: 415 }] }))).toContain("94%");
});

test.each(examples)("example %s renders a 3200x1800 PNG in both themes", async (_, spec) => {
  for (const theme of ["dark", "cream"]) {
    expect(pngSize(await toPng(build({ ...spec, theme })))).toEqual({ w: 3200, h: 1800 });
  }
});

const cli = (...args: string[]) => {
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "visualize.ts"), ...args]);
  return { code: p.exitCode, out: JSON.parse(p.stdout.toString()) };
};

test("the CLI renders an inline array and reports each card as JSON", () => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "visualize-"));
  const r = cli(JSON.stringify([ci(42, 20), ci(20, 42, { layout: "ring" })]), "-o", join(dir, "card.png"));
  expect(r.code).toBe(0);
  expect(r.out.ok).toBe(true);
  expect(r.out.cards.map((c: { file: string }) => c.file)).toEqual([join(dir, "card-01.png"), join(dir, "card-02.png")]);
  expect(r.out.cards[1]).toMatchObject({ template: "compare", width: 3200, height: 1800, summary: { direction: "regressed" }, warnings: [] });
  expect(existsSync(join(dir, "card-01.png")) && existsSync(join(dir, "card-02.png"))).toBe(true);
});

test("the CLI reports every invalid card at once, writes nothing and exits 2", () => {
  const dir = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "visualize-"));
  const r = cli(JSON.stringify([ci(42, 20), { template: "pie" }, ci(42, -1)]), "-o", join(dir, "card.png"));
  expect(r.code).toBe(2);
  expect(r.out).toEqual({
    ok: false,
    errors: [
      { card: 1, path: "template", message: expect.stringContaining("expected one of compare") },
      { card: 2, path: "after.value", message: "expected a number above 0" },
    ],
  });
  expect(readdirSync(dir)).toEqual([]);
});

test("--check validates without writing and --example prints a usable spec", () => {
  expect(cli("--check", JSON.stringify(ci(5.2, 3.1)))).toMatchObject({ code: 0, out: { ok: true, cards: [{ summary: { hero: "2.1 s faster" } }] } });
  const ex = Bun.spawnSync(["bun", join(import.meta.dir, "visualize.ts"), "--example", "bars"]);
  expect(JSON.parse(ex.stdout.toString()).template).toBe("bars");
});

test("--skill prints the checked-in agent instructions", () => {
  const result = Bun.spawnSync(["bun", join(import.meta.dir, "visualize.ts"), "--skill"]);
  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain("name: visualize");
});
