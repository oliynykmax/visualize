import { num, ratio, relative, round, type Metric } from "../metrics";
import type { Frame, Reader } from "../spec";
import { alpha, mix, type Theme } from "../theme";
import { INNER_W, div, span, type Body } from "../ui";

type Row = { label: string; note?: string; values: number[] };

export type Bars = {
  series: string[];
  rows: Row[];
  unit?: string;
  metric: Metric;
  scale: "row" | "shared";
  baseline?: number;
};

export function parse(r: Reader): Bars {
  const series = r.get("series").list(1, 4).map((s) => s.text(24));
  const rows = r.get("rows").list(1, 8).map((row) => {
    const values = row.get("values").list(series.length).map((v) => v.pos());
    if (values.length !== series.length) row.get("values").fail(`expected ${series.length} values, one per series`);
    return { label: row.get("label").text(18), note: row.get("note").optText(30), values };
  });
  const baselineRaw = r.get("baseline").optNum();
  const baseline = baselineRaw ?? (series.length > 1 ? series.length - 1 : undefined);
  if (baseline !== undefined && (baseline < 1 || baseline >= series.length || !Number.isInteger(baseline))) {
    r.get("baseline").fail(`expected a series index from 1 to ${series.length - 1}`);
  }
  return {
    series,
    rows,
    unit: r.get("unit").optStr(),
    metric: r.metric(),
    scale: r.get("scale").oneOf(["row", "shared"] as const, "row"),
    baseline,
  };
}

export function summary(m: Bars) {
  if (m.baseline === undefined) return undefined;
  return m.rows.map((row) => {
    const rel = relative(row.values[0], row.values[m.baseline!], m.metric.better);
    return { label: row.label, ratio: round(rel.ratio), direction: rel.direction };
  });
}

export function seriesColors(n: number, accent: string, t: Theme): string[] {
  const base = [accent, mix(accent, t.muted, 0.55), alpha(t.muted, 0.55), alpha(t.muted, 0.35)];
  return Array.from({ length: n }, (_, i) => base[Math.min(i, base.length - 1)]);
}

export function legend(series: string[], colors: string[], f: Frame) {
  return div(
    { gap: 28, fontSize: 21, fontWeight: 600, color: f.theme.fg },
    series.map((s, i) =>
      div({ alignItems: "center" }, div({ width: 18, height: 18, borderRadius: 5, backgroundColor: colors[i], marginRight: 10 }), span({}, s)),
    ),
  );
}

export function render(m: Bars, f: Frame): Body {
  const t = f.theme;
  const colors = seriesColors(m.series.length, f.accent, t);
  const labelW = 300;
  const ratioW = m.baseline !== undefined ? 190 : 0;
  const barMax = INNER_W - labelW - ratioW - 170;
  const shared = Math.max(...m.rows.flatMap((r) => r.values));
  const rowGap = m.rows.length > 5 ? 10 : 18;
  const thick = Math.max(10, Math.min(26, Math.floor((520 / m.rows.length - rowGap) / m.series.length) - 6));
  const unit = m.unit ? " " + m.unit : "";
  return {
    body: div(
      { flexDirection: "column", flexGrow: 1 },
      m.series.length > 1 && div({ marginBottom: 18 }, legend(m.series, colors, f)),
      div(
        { flexDirection: "column", flexGrow: 1, justifyContent: "space-around" },
        m.rows.map((row, ri) => {
          const max = m.scale === "row" ? Math.max(...row.values) : shared;
          const rel = m.baseline === undefined ? undefined : relative(row.values[0], row.values[m.baseline], m.metric.better);
          return div(
            {
              alignItems: "center",
              paddingTop: rowGap / 2,
              paddingBottom: rowGap / 2,
              borderTop: ri ? `1px solid ${t.rule}` : "none",
            },
            div(
              { flexDirection: "column", width: labelW, paddingRight: 20 },
              span({ fontSize: 27, fontWeight: 700 }, row.label),
              row.note && span({ fontSize: 17, color: t.muted, marginTop: 4 }, row.note),
            ),
            div(
              { flexDirection: "column", gap: 5, width: barMax + 170 },
              row.values.map((v, i) =>
                div(
                  { alignItems: "center" },
                  div({
                    width: Math.max(6, Math.round((barMax * v) / max)),
                    height: thick,
                    borderRadius: 4,
                    backgroundColor: colors[i],
                    backgroundImage: i === 0 ? `linear-gradient(90deg, ${f.accent}, ${mix(f.accent, "#ffffff", 0.45)})` : "none",
                  }),
                  span(
                    { fontSize: Math.max(15, Math.min(20, thick)), marginLeft: 10, color: i === 0 ? t.fg : t.muted, fontWeight: i === 0 ? 700 : 500 },
                    num(v) + unit,
                  ),
                ),
              ),
            ),
            rel &&
              div(
                { width: ratioW, justifyContent: "flex-end", alignItems: "baseline" },
                span({ fontSize: 42, fontWeight: 800, color: rel.direction === "regressed" ? t.muted : f.accent, letterSpacing: -1 }, ratio(rel.ratio)),
                span({ fontSize: 19, color: t.muted, marginLeft: 8 }, m.metric.words[rel.direction].ratio),
              ),
          );
        }),
      ),
    ),
  };
}
