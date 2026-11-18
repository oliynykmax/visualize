import { change, num, percent, ratio, round, type Change, type Metric } from "../metrics";
import type { Frame, Reader } from "../spec";
import { alpha, mix } from "../theme";
import { INNER_W, arrow, div, span, svgImg, value, type Body, type Node } from "../ui";

const LAYOUTS = ["pills", "bar", "ring", "stack"] as const;
const HEROES = ["delta", "ratio", "percent"] as const;
type Hero = (typeof HEROES)[number];

type Side = { label: string; value: number };

export type Compare = {
  before: Side;
  after: Side;
  unit?: string;
  metric: Metric;
  hero: Hero;
  layout: (typeof LAYOUTS)[number];
  change: Change;
};

function side(r: Reader): Side {
  return { label: r.get("label").text(18), value: r.get("value").pos() };
}

export function parse(r: Reader): Compare {
  const before = side(r.get("before"));
  const after = side(r.get("after"));
  const metric = r.metric();
  return {
    before,
    after,
    unit: r.get("unit").optStr(),
    metric,
    hero: r.get("hero").oneOf(HEROES, "delta"),
    layout: r.get("layout").oneOf(LAYOUTS, "pills"),
    change: change(before.value, after.value, metric.better),
  };
}

export function defaultTitle(m: Compare): string {
  return `~${m.before.label}~ → *${m.after.label}*`;
}

type Stat = { v: string; unit?: string; word: string };

export function stats(m: Compare): Record<Hero, Stat> {
  const w = m.metric.words[m.change.direction];
  return {
    delta: { v: num(m.change.delta), unit: m.unit, word: w.delta },
    ratio: { v: ratio(m.change.ratio), word: w.ratio },
    percent: { v: percent(m.change.percent), word: w.percent },
  };
}

export function summary(m: Compare) {
  const s = stats(m);
  const say = (k: Hero) => `${s[k].v}${s[k].unit ? " " + s[k].unit : ""} ${s[k].word}`;
  const c = m.change;
  return { direction: c.direction, delta: round(c.delta), ratio: round(c.ratio), percent: round(c.percent, 1), hero: say(m.hero), text: HEROES.map(say) };
}

function heroBlock(m: Compare, f: Frame, size: number, center: boolean): Node {
  const s = stats(m)[m.hero];
  return div(
    { flexDirection: "column", alignItems: center ? "center" : "flex-start" },
    value(s.v, s.unit, size, f.accent),
    span({ fontSize: Math.round(size * 0.5), fontWeight: 800, color: f.accent, letterSpacing: -2, lineHeight: 1, marginTop: size * 0.04 }, s.word),
  );
}

function secondary(m: Compare, f: Frame, size: number, row: boolean): Node {
  const all = stats(m);
  const items = HEROES.filter((k) => k !== m.hero).map((k) =>
    div(
      { alignItems: "baseline" },
      value(all[k].v, all[k].unit, size, f.theme.fg),
      span({ fontSize: size * 0.82, color: f.theme.muted, marginLeft: size * 0.25, fontWeight: 500 }, all[k].word),
    ),
  );
  if (!row) return div({ flexDirection: "column", gap: size * 0.3 }, items);
  return div(
    { alignItems: "center", gap: size * 0.5 },
    items[0],
    div({ width: 10, height: 10, borderRadius: 5, backgroundColor: f.theme.muted, opacity: 0.6 }),
    items[1],
  );
}

function pill(side: Side, m: Compare, f: Frame, active: boolean): Node {
  const t = f.theme;
  return div(
    {
      alignItems: "baseline",
      padding: "18px 40px 20px",
      borderRadius: 999,
      border: `3px solid ${active ? "transparent" : alpha(t.muted, 0.6)}`,
      backgroundColor: active ? f.accent : t.panel,
      backgroundImage: active ? `linear-gradient(90deg, ${f.accent}, ${mix(f.accent, "#ffffff", 0.35)})` : "none",
      boxShadow: active ? `0 0 28px ${alpha(f.accent, 0.45)}` : "none",
      color: active ? "#0b0d12" : t.muted,
    },
    span({ fontSize: 46, fontWeight: 700, marginRight: 22 }, side.label),
    value(num(side.value), m.unit, 46, active ? "#0b0d12" : t.muted),
  );
}

function pills(m: Compare, f: Frame): Body {
  return {
    align: "center",
    body: div(
      { flexDirection: "column", alignItems: "center", justifyContent: "space-between", flexGrow: 1 },
      heroBlock(m, f, 220, true),
      secondary(m, f, 56, true),
      div(
        { alignItems: "center", gap: 36 },
        pill(m.before, m, f, false),
        arrow(52, f.theme.muted),
        pill(m.after, m, f, true),
      ),
    ),
  };
}

function bar(m: Compare, f: Frame): Body {
  const t = f.theme;
  const lower = m.after.value <= m.before.value;
  const max = Math.max(m.before.value, m.after.value);
  const fill = Math.min(m.before.value, m.after.value) / max;
  const track = INNER_W - 6;
  const fillSide = lower ? m.after : m.before;
  const trackSide = lower ? m.before : m.after;
  const label = (s: Side, color: string) =>
    div({ alignItems: "baseline", color }, span({ fontSize: 44, fontWeight: 700, marginRight: 18 }, s.label), value(num(s.value), m.unit, 44, color));
  return {
    body: div(
      { flexDirection: "column", flexGrow: 1, justifyContent: "space-between" },
      div({ justifyContent: "flex-end" }, label(trackSide, lower ? t.muted : f.accent)),
      div(
        {
          width: track,
          height: 76,
          borderRadius: 18,
          border: `3px solid ${alpha(t.muted, 0.5)}`,
          backgroundImage: lower
            ? `repeating-linear-gradient(135deg, ${alpha(t.muted, 0.28)} 0px, ${alpha(t.muted, 0.28)} 3px, transparent 3px, transparent 26px)`
            : `linear-gradient(90deg, ${f.accent}, ${mix(f.accent, "#ffffff", 0.3)})`,
        },
        div({
          width: Math.round((track - 6) * fill),
          height: 70,
          borderRadius: 15,
          backgroundColor: lower ? f.accent : t.faint,
          backgroundImage: lower ? `linear-gradient(90deg, ${f.accent}, ${mix(f.accent, "#ffffff", 0.35)})` : "none",
          boxShadow: lower ? `0 0 24px ${alpha(f.accent, 0.4)}` : "none",
        }),
      ),
      label(fillSide, lower ? f.accent : t.muted),
      div({ alignItems: "flex-end", gap: 60 }, heroBlock(m, f, 170, false), div({ marginBottom: 12 }, secondary(m, f, 44, false))),
    ),
  };
}

function arc(fraction: number, size: number, stroke: number, color: string, track: string): string {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const a = Math.min(fraction, 0.9999) * 2 * Math.PI;
  const x = c + r * Math.sin(a);
  const y = c - r * Math.cos(a);
  const large = a > Math.PI ? 1 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${mix(color, "#ffffff", 0.45)}"/></linearGradient></defs>
<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
<path d="M ${c} ${c - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round"/>
</svg>`;
}

function ring(m: Compare, f: Frame): Body {
  const t = f.theme;
  const lower = m.after.value <= m.before.value;
  const fraction = lower ? m.after.value / m.before.value : m.before.value / m.after.value;
  const size = 480;
  return {
    body: div(
      { flexGrow: 1, justifyContent: "space-between", alignItems: "center" },
      div({ flexDirection: "column", gap: 48 }, heroBlock(m, f, 200, false), secondary(m, f, 52, false)),
      div(
        { flexDirection: "column", alignItems: "center", gap: 18 },
        div(
          { width: size, height: size, position: "relative", alignItems: "center", justifyContent: "center" },
          svgImg(arc(fraction, size, 58, lower ? f.accent : t.muted, alpha(lower ? t.muted : f.accent, lower ? 0.35 : 0.9)), size, size, {
            position: "absolute",
            top: 0,
            left: 0,
          }),
          div(
            { flexDirection: "column", alignItems: "center", color: f.accent },
            value(num(m.after.value), m.unit, 110, f.accent),
            span({ fontSize: 40, fontWeight: 700, marginTop: 6 }, m.after.label),
          ),
        ),
        div(
          { alignItems: "baseline", color: t.muted },
          span({ fontSize: 44, fontWeight: 700, marginRight: 16 }, m.before.label),
          value(num(m.before.value), m.unit, 44, t.muted),
        ),
      ),
    ),
  };
}

function column(s: Side, m: Compare, f: Frame, height: number, active: boolean): Node {
  const color = active ? f.accent : f.theme.muted;
  const block = 30;
  return div(
    { flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: 230 },
    value(num(s.value), m.unit, 60, active ? f.accent : f.theme.muted, { marginBottom: 14 }),
    div({
      width: 190,
      height: Math.max(block, Math.round(height)),
      backgroundImage: `repeating-linear-gradient(180deg, ${alpha(color, active ? 0.95 : 0.55)} 0px, ${alpha(color, active ? 0.95 : 0.55)} ${block - 8}px, transparent ${block - 8}px, transparent ${block}px)`,
      borderRadius: 6,
    }),
    span({ fontSize: 40, fontWeight: 700, marginTop: 16, color }, s.label),
  );
}

function stack(m: Compare, f: Frame): Body {
  const max = Math.max(m.before.value, m.after.value);
  const tall = 400;
  return {
    body: div(
      { flexGrow: 1, justifyContent: "space-between", alignItems: "flex-end" },
      div({ flexDirection: "column", gap: 40, marginBottom: 20 }, heroBlock(m, f, 190, false), secondary(m, f, 50, false)),
      div(
        { alignItems: "flex-end", gap: 50 },
        column(m.before, m, f, (tall * m.before.value) / max, false),
        column(m.after, m, f, (tall * m.after.value) / max, true),
      ),
    ),
  };
}

export function render(m: Compare, f: Frame): Body {
  return { pills, bar, ring, stack }[m.layout](m, f);
}
