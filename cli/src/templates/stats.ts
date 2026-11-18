import { change, num, percent, ratio, round, type Change } from "../metrics";
import type { Frame, Reader } from "../spec";
import { ACCENT_CYCLE, accentColor } from "../theme";
import { MONO, arrow, div, span, value, type Body } from "../ui";

type Tile = {
  caption: string;
  before: number;
  after: number;
  unit?: string;
  show: "percent" | "ratio";
  accent?: string;
  change: Change;
};

export type Stats = { tiles: Tile[] };

export function parse(r: Reader): Stats {
  const tiles = r.get("tiles").list(1, 4).map((t) => {
    const before = t.get("before").pos();
    const after = t.get("after").pos();
    const metric = t.metric();
    const c = change(before, after, metric.better);
    return {
      caption: t.get("caption").text(16),
      before,
      after,
      unit: t.get("unit").optStr(),
      show: t.get("show").oneOf(["percent", "ratio"] as const, "percent"),
      accent: t.get("accent").accent(),
      change: c,
    };
  });
  return { tiles };
}

export function summary(m: Stats) {
  return m.tiles.map((t) => ({ caption: t.caption, direction: t.change.direction, percent: round(t.change.percent, 1), ratio: round(t.change.ratio) }));
}

export function render(m: Stats, f: Frame): Body {
  const t = f.theme;
  const big = m.tiles.length > 3 ? 130 : 170;
  return {
    body: div(
      { flexGrow: 1, gap: 28, alignItems: "center" },
      m.tiles.map((tile, i) => {
        const color = tile.accent ?? (i === 0 ? f.accent : accentColor(ACCENT_CYCLE[i % ACCENT_CYCLE.length]));
        const shown = tile.show === "percent" ? percent(tile.change.percent) : ratio(tile.change.ratio);
        const unit = shown.slice(-1);
        return div(
          {
            flex: 1,
            flexDirection: "column",
            padding: 44,
            borderRadius: 28,
            backgroundColor: t.panel,
            border: `2px solid ${t.rule}`,
          },
          div(
            { flexDirection: "column" },
            value(shown.slice(0, -1), unit, big, color),
            span({ fontSize: 48, fontWeight: 700, lineHeight: 1.08, marginTop: 18, letterSpacing: -1 }, tile.caption),
          ),
          div(
            { alignItems: "center", fontFamily: MONO, fontSize: 24, color: t.muted, marginTop: 64 },
            span({}, `${num(tile.before)} ${tile.unit ?? ""}`.trim()),
            div({ marginLeft: 14, marginRight: 14 }, arrow(24, t.muted)),
            span({ color: t.fg, fontWeight: 700 }, `${num(tile.after)} ${tile.unit ?? ""}`.trim()),
          ),
        );
      }),
    ),
  };
}
