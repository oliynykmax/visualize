import type { Frame } from "./spec";
import { alpha, WIDTH, HEIGHT } from "./theme";

export type Style = Record<string, string | number>;
export type Node = { type: string; props: { style?: Style; children?: Child | Child[]; [k: string]: unknown } };
export type Child = Node | string | number | false | null | undefined;

export function h(type: string, style: Style, ...children: (Child | Child[])[]): Node {
  const kids = children.flat().filter((c) => c !== false && c !== null && c !== undefined && c !== "");
  const s = type === "div" && !("display" in style) ? { display: "flex", ...style } : style;
  return { type, props: { style: s, children: kids.length === 1 ? kids[0] : kids } };
}

export const div = (style: Style, ...children: (Child | Child[])[]) => h("div", style, ...children);
export function span(style: Style, text: string | number): Node {
  const s = String(text);
  if (!s.includes("→")) return h("span", { whiteSpace: "pre", ...style }, s);
  const size = typeof style.fontSize === "number" ? style.fontSize : 24;
  const color = typeof style.color === "string" ? style.color : "currentColor";
  const parts = s.split("→");
  return div(
    { alignItems: "center", ...style },
    parts.flatMap((p, i) => [
      p.trim() ? h("span", { whiteSpace: "pre" }, p.trim()) : null,
      i < parts.length - 1 ? arrow(size, color === "currentColor" ? "#8b92a3" : color, false, true) : null,
    ]),
  );
}

export const MONO = "JetBrains Mono";
export const SANS = "Inter, Inter Greek";

export function img(src: string, width: number, height: number, style: Style = {}): Node {
  return { type: "img", props: { src, width, height, style: { width, height, ...style } } };
}

export function svgImg(svg: string, width: number, height: number, style: Style = {}): Node {
  return img(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, width, height, style);
}

export function rich(text: string, f: Frame, style: Style, mutedColor = f.theme.muted): Node {
  const words: Node[] = [];
  const re = /\*([^*]+)\*|~([^~]+)~|([^*~]+)/g;
  for (const m of text.matchAll(re)) {
    const color = m[1] ? f.accent : m[2] ? mutedColor : undefined;
    const part = m[1] ?? m[2] ?? m[3];
    for (const w of part.split(/(?<=\s)/)) {
      if (!w) continue;
      if (w.trim() === "→") words.push(arrow(size(style), color ?? f.theme.muted, w.endsWith(" ")));
      else words.push(span(color ? { color } : {}, w));
    }
  }
  return div({ flexWrap: "wrap", alignItems: "baseline", ...style }, words);
}

function size(style: Style): number {
  return typeof style.fontSize === "number" ? style.fontSize : 32;
}

export function arrow(fontSize: number, color: string, trailingSpace = false, inline = false): Node {
  const w = Math.round(fontSize * 0.9);
  const hgt = Math.round(fontSize * 0.7);
  const sw = Math.max(2, fontSize * 0.085);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hgt}" viewBox="0 0 ${w} ${hgt}"><path d="M ${sw} ${hgt / 2} H ${w - sw * 1.2} M ${w - hgt / 2 - sw / 2} ${sw} L ${w - sw * 1.2} ${hgt / 2} L ${w - hgt / 2 - sw / 2} ${hgt - sw}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return svgImg(svg, w, hgt, { marginLeft: inline ? fontSize * 0.3 : 0, marginRight: trailingSpace || inline ? fontSize * 0.3 : 0, alignSelf: "center" });
}

export function value(v: string, unit: string | undefined, size: number, color: string, style: Style = {}): Node {
  return div(
    { alignItems: "baseline", color, ...style },
    span({ fontSize: size, fontWeight: 800, letterSpacing: -0.035 * size, lineHeight: 1 }, v),
    unit ? span({ fontSize: Math.round(size * (size >= 120 ? 0.42 : 0.6)), fontWeight: 700, marginLeft: size * 0.06, lineHeight: 1 }, unit) : null,
  );
}

export const PAD_X = 84;
export const INNER_W = WIDTH - 2 * PAD_X;

export type Body = { body: Node; align?: "left" | "center" };

export function frame(f: Frame, { body, align = "left" }: Body): Node {
  const t = f.theme;
  const center = align === "center";
  return div(
    {
      width: WIDTH - 2 * PAD_X,
      height: HEIGHT - 64 - 48,
      flexDirection: "column",
      paddingTop: 64,
      paddingRight: PAD_X,
      paddingBottom: 48,
      paddingLeft: PAD_X,
      overflow: "hidden",
      backgroundColor: t.bg,
      backgroundImage: `radial-gradient(circle at ${center ? "50% 40%" : "18% 0%"}, ${alpha(f.accent, t.glow)} 0%, ${alpha(f.accent, 0)} 62%)`,
      color: t.fg,
      fontFamily: SANS,
    },
    div(
      { flexDirection: "column", alignItems: center ? "center" : "flex-start", textAlign: center ? "center" : "left" },
      f.eyebrow &&
        span({ fontSize: 19, fontWeight: 700, letterSpacing: 3.4, color: f.accent, marginBottom: 14, textTransform: "uppercase" }, f.eyebrow),
      f.title &&
        rich(f.title, f, { fontSize: 50, fontWeight: 700, letterSpacing: -1.2, lineHeight: 1.12, justifyContent: center ? "center" : "flex-start" }),
      f.subtitle && rich(f.subtitle, f, { fontSize: 25, color: t.muted, marginTop: 12, justifyContent: center ? "center" : "flex-start" }, t.fg),
    ),
    div({ flexGrow: 1, flexDirection: "column", marginTop: 28, minHeight: 0 }, body),
    (f.footnote || f.source) &&
      div(
        { justifyContent: center ? "center" : f.source ? "space-between" : "flex-start", marginTop: 20, fontSize: 17, color: t.muted, opacity: 0.85 },
        f.footnote && span({}, f.footnote),
        f.source && span({ fontFamily: MONO, fontSize: 15, marginLeft: 24 }, f.source),
      ),
  );
}
