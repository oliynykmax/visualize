#!/usr/bin/env bun
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { homedir } from "node:os";
import { prepare, toPng, toSvg, SpecError, type Card } from "./src/render";
import { TEMPLATES } from "./src/templates";
import { METRIC_KINDS, metric } from "./src/metrics";
import { ACCENTS } from "./src/theme";

const EXAMPLES = resolve(import.meta.dir, "../examples");
const SKILL = resolve(import.meta.dir, "../SKILL.md");

const HELP = `visualize: JSON spec in, 3200x1800 PNG card out. Built for agents.

  visualize SPEC [-o OUT] [--svg] [--scale N]   render
  visualize --check SPEC                        validate only, no files written
  visualize --list                              templates, layouts, metrics, accents, examples (JSON)
  visualize --example NAME                      print an example spec (template or example name)
  visualize --examples DIR                      render every bundled example into DIR
  visualize --skill                             print the built-in agent skill instructions

SPEC is a file path, - for stdin, or inline JSON ('{...}' or '[...]'). An array renders one card per item.
Without SPEC, stdin is read when it is not a terminal.

stdout is always one JSON object:
  {"ok":true,"cards":[{"file","template","width","height","summary","warnings"}]}
  {"ok":false,"errors":[{"card","path","message"}]}
Exit 0 rendered, 2 invalid spec (nothing written), 1 other failure.

OUT defaults to SPEC with .png beside a spec file, else ~/.local/share/visualize/<time>-<id>.png.
For an array, OUT-01.png, OUT-02.png ... Field reference: references/spec.md`;

type Opts = { out?: string; svg: boolean; scale: number };

function emit(obj: unknown, code = 0): never {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

function failure(message: string, code = 1): never {
  emit({ ok: false, errors: [{ message }] }, code);
}

function take(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const v = args[i + 1];
  if (v === undefined) failure(`${flag} needs a value`, 2);
  args.splice(i, 2);
  return v;
}

function flag(args: string[], name: string): boolean {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
}

async function readSpec(src: string | undefined): Promise<{ spec: unknown; file?: string }> {
  let text: string;
  let file: string | undefined;
  if (src === undefined || src === "-") {
    if (src === undefined && process.stdin.isTTY) {
      console.log(HELP);
      process.exit(2);
    }
    text = await Bun.stdin.text();
  } else if (/^\s*[[{]/.test(src)) {
    text = src;
  } else {
    if (!existsSync(src)) failure(`${src}: no such file`, 2);
    text = readFileSync(src, "utf8");
    file = src;
  }
  try {
    return { spec: JSON.parse(text), file };
  } catch (e) {
    return failure(`invalid JSON: ${(e as Error).message}`, 2);
  }
}

function validate(specs: unknown[]): Card[] {
  const cards: Card[] = [];
  const errors: { card: number; path: string; message: string }[] = [];
  specs.forEach((s, i) => {
    try {
      cards.push(prepare(s));
    } catch (e) {
      if (!(e instanceof SpecError)) throw e;
      errors.push({ card: i, path: e.path, message: e.detail });
    }
  });
  if (errors.length) emit({ ok: false, errors }, 2);
  return cards;
}

function outputs(n: number, opts: Opts, file?: string): string[] {
  const ext = opts.svg ? ".svg" : ".png";
  const base =
    opts.out ??
    (file
      ? file.replace(/\.json$/, "") + ext
      : join(process.env.XDG_DATA_HOME || join(homedir(), ".local/share"), "visualize", `${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID().slice(0, 6)}${ext}`));
  if (n === 1) return [resolve(base)];
  const stem = base.replace(/\.(png|svg)$/, "");
  return Array.from({ length: n }, (_, i) => resolve(`${stem}-${String(i + 1).padStart(2, "0")}${ext}`));
}

async function render(cards: Card[], files: string[], opts: Opts) {
  const results = [];
  for (const [i, card] of cards.entries()) {
    const out = files[i];
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, opts.svg ? await toSvg(card.node) : await toPng(card.node, opts.scale));
    results.push({
      file: out,
      template: card.template,
      width: opts.svg ? 1600 : 1600 * opts.scale,
      height: opts.svg ? 900 : 900 * opts.scale,
      ...(card.summary === undefined ? {} : { summary: card.summary }),
      warnings: card.warnings,
    });
  }
  emit({ ok: true, cards: results });
}

function examples(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(EXAMPLES)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => [basename(f, ".json"), join(EXAMPLES, f)]),
  );
}

const args = process.argv.slice(2);
if (flag(args, "-h") || flag(args, "--help")) {
  console.log(HELP);
  process.exit(0);
}
if (flag(args, "--skill")) {
  process.stdout.write(readFileSync(SKILL, "utf8"));
  process.exit(0);
}

const opts: Opts = { out: take(args, "-o"), svg: flag(args, "--svg"), scale: Number(take(args, "--scale") ?? 2) };
if (!(opts.scale > 0 && opts.scale <= 4)) failure("--scale must be above 0 and at most 4", 2);

try {
  if (flag(args, "--list")) {
    emit({
      ok: true,
      templates: {
        compare: { layouts: ["pills", "bar", "ring", "stack"], heroes: ["delta", "ratio", "percent"] },
        ...Object.fromEntries(Object.keys(TEMPLATES).filter((t) => t !== "compare").map((t) => [t, {}])),
      },
      metrics: Object.fromEntries(METRIC_KINDS.map((k) => [k, { better: metric(k).better, words: metric(k).words }])),
      accents: Object.keys(ACCENTS),
      themes: ["dark", "cream"],
      examples: examples(),
    });
  }
  const example = take(args, "--example");
  if (example !== undefined) {
    const all = examples();
    const path = all[example] ?? Object.entries(all).find(([k]) => k.startsWith(example))?.[1];
    if (!path) failure(`no example "${example}". Available: ${Object.keys(all).join(", ")}`, 2);
    process.stdout.write(readFileSync(path, "utf8"));
    process.exit(0);
  }
  const dir = take(args, "--examples");
  if (dir !== undefined) {
    const all = Object.entries(examples());
    const cards = validate(all.map(([, p]) => JSON.parse(readFileSync(p, "utf8"))));
    await render(cards, all.map(([name]) => resolve(dir, name + (opts.svg ? ".svg" : ".png"))), opts);
  }
  const check = flag(args, "--check");
  if (args.length > 1) failure(`expected one SPEC, got ${args.length}: ${args.join(" ")}`, 2);
  const { spec, file } = await readSpec(args[0]);
  const specs = Array.isArray(spec) ? spec : [spec];
  if (!specs.length) failure("the spec array is empty", 2);
  const cards = validate(specs);
  if (check) emit({ ok: true, cards: cards.map((c) => ({ template: c.template, summary: c.summary, warnings: c.warnings })) });
  await render(cards, outputs(cards.length, opts, file), opts);
} catch (e) {
  failure((e as Error).stack ?? String(e));
}
