import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Reader, SpecError, readFrame } from "./spec";
import { TEMPLATES, type TemplateName } from "./templates";
import { frame, type Node } from "./ui";
import { WIDTH, HEIGHT } from "./theme";

const require = createRequire(import.meta.url);

function font(name: string, pkg: string, file: string, weight: number) {
  const buf = readFileSync(require.resolve(`${pkg}/files/${file}`));
  return { name, weight: weight as 400, style: "normal" as const, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
}

let fonts: ReturnType<typeof font>[] | undefined;
function loadFonts() {
  fonts ??= [
    ...[400, 500, 600, 700, 800].map((w) => font("Inter", "@fontsource/inter", `inter-latin-${w}-normal.woff`, w)),
    ...[400, 700].map((w) => font("Inter Greek", "@fontsource/inter", `inter-greek-${w}-normal.woff`, w)),
    ...[400, 500, 700].map((w) => font("JetBrains Mono", "@fontsource/jetbrains-mono", `jetbrains-mono-latin-${w}-normal.woff`, w)),
  ];
  return fonts;
}

export type Card = { template: TemplateName; node: Node; summary?: unknown; warnings: string[] };

export function prepare(spec: unknown): Card {
  const r = new Reader(spec, "");
  const template = r.get("template").oneOf(Object.keys(TEMPLATES) as TemplateName[]);
  const t = TEMPLATES[template];
  const f = readFrame(r);
  const model = t.parse(r);
  if (!f.title && t.defaultTitle) f.title = t.defaultTitle(model);
  const node = frame(f, t.render(model, f));
  return { template, node, summary: t.summary?.(model), warnings: [...r.ctx.warnings, ...r.unknownFields()] };
}

export function build(spec: unknown): Node {
  return prepare(spec).node;
}

export async function toPng(node: Node, scale = 2): Promise<Buffer> {
  const svg = await toSvg(node);
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH * scale }, font: { loadSystemFonts: false } }).render().asPng();
}

export function toSvg(node: Node): Promise<string> {
  return satori(node as never, { width: WIDTH, height: HEIGHT, fonts: loadFonts() });
}

export { SpecError };
