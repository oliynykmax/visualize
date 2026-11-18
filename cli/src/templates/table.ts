import { num, signedPercent, type Metric } from "../metrics";
import type { Frame, Reader } from "../spec";
import { INNER_W, MONO, div, span, type Body, type Node } from "../ui";

type Column = { label: string; sub?: string };
type Cell = number | string | null;

export type Table = {
  rowHeader?: string;
  columns: Column[];
  rows: { label: string; values: Cell[] }[];
  unit?: string;
  highlight?: number;
  delta?: { against: number; min: number };
  metric: Metric;
};

export function parse(r: Reader): Table {
  const columns = r.get("columns").list(1, 7).map((c) =>
    typeof c.value === "string" ? { label: c.str() } : { label: c.get("label").str(), sub: c.get("sub").optStr() },
  );
  const rows = r.get("rows").list(1, 9).map((row) => {
    const values = row.get("values").list(columns.length).map((v): Cell => {
      if (v.value === null || typeof v.value === "string") return v.value as Cell;
      return v.num();
    });
    if (values.length !== columns.length) row.get("values").fail(`expected ${columns.length} values, one per column`);
    return { label: row.get("label").text(18), values };
  });
  const index = (key: Reader) => {
    const i = key.optNum();
    if (i !== undefined && (!Number.isInteger(i) || i < 0 || i >= columns.length)) key.fail(`expected a column index from 0 to ${columns.length - 1}`);
    return i;
  };
  const highlight = index(r.get("highlight")) ?? 0;
  const against = r.has("delta") ? index(r.get("delta").get("against")) : undefined;
  if (against !== undefined && against === highlight) r.get("delta").get("against").fail("must differ from highlight");
  return {
    rowHeader: r.get("rowHeader").optStr(),
    columns,
    rows,
    unit: r.get("unit").optStr(),
    highlight,
    delta: against === undefined ? undefined : { against, min: r.get("delta").get("min").optNum() ?? 3 },
    metric: r.metric(),
  };
}

export function render(m: Table, f: Frame): Body {
  const t = f.theme;
  const labelW = 300;
  const cols: { kind: "value" | "delta"; index: number }[] = [];
  m.columns.forEach((_, i) => {
    cols.push({ kind: "value", index: i });
    if (m.delta && i === m.highlight) cols.push({ kind: "delta", index: i });
  });
  const colW = Math.floor((INNER_W - labelW) / cols.length);
  const rowH = Math.min(84, Math.floor(560 / (m.rows.length + 1)));
  const size = Math.min(40, Math.round(rowH * 0.5));

  const cellBox = (c: (typeof cols)[number], children: Node | Node[], extra = {}) =>
    div(
      {
        width: colW,
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.kind === "value" && c.index === m.highlight ? t.panel : "transparent",
        ...extra,
      },
      children,
    );

  const header = div(
    { height: rowH + 10, alignItems: "stretch", borderBottom: `1px solid ${t.rule}` },
    div(
      { width: labelW, alignItems: "flex-end", paddingBottom: 14 },
      m.rowHeader ? span({ fontSize: 17, fontWeight: 700, letterSpacing: 2.5, color: t.muted }, m.rowHeader.toUpperCase()) : null,
    ),
    cols.map((c) => {
      const col = m.columns[c.index];
      const label = c.kind === "delta" ? "Δ" : col.label;
      const ref = c.kind === "delta" ? m.columns[m.delta!.against] : undefined;
      const sub = ref ? `vs ${ref.sub ? `${ref.label} ${ref.sub}` : ref.label}` : col.sub;
      const strong = c.kind === "value" && c.index === m.highlight;
      return cellBox(
        c,
        div(
          { flexDirection: "column", alignItems: "center" },
          span({ fontSize: 26, fontWeight: 700, color: strong ? t.fg : t.muted }, label),
          sub ? span({ fontSize: 16, color: t.muted, marginTop: 2 }, sub) : null,
        ),
        { alignItems: "flex-end", paddingBottom: 12, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
      );
    }),
  );

  const unit = (v: number, color: string, weight: number) =>
    div(
      { alignItems: "baseline", color },
      span({ fontSize: size, fontWeight: weight, letterSpacing: -0.5 }, num(v)),
      m.unit ? span({ fontSize: Math.round(size * 0.5), marginLeft: 4, color: t.muted }, m.unit) : null,
    );

  const body = m.rows.map((row, ri) =>
    div(
      { height: rowH, alignItems: "stretch", borderBottom: ri < m.rows.length - 1 ? `1px solid ${t.rule}` : "none" },
      div({ width: labelW, alignItems: "center" }, span({ fontSize: Math.min(30, size), fontWeight: 700 }, row.label)),
      cols.map((c) => {
        if (c.kind === "delta") {
          const a = row.values[c.index];
          const b = row.values[m.delta!.against];
          if (typeof a !== "number" || typeof b !== "number") return cellBox(c, span({ fontSize: size * 0.8, color: t.muted }, "–"));
          const pct = ((a - b) / b) * 100;
          if (Math.abs(pct) < m.delta!.min) return cellBox(c, span({ fontSize: size * 0.8, color: t.muted }, "–"));
          const good = m.metric.better === "lower" ? pct < 0 : pct > 0;
          return cellBox(c, span({ fontSize: size * 0.85, fontWeight: 800, color: good ? t.good : t.bad }, signedPercent(pct)));
        }
        const v = row.values[c.index];
        const strong = c.index === m.highlight;
        const last = ri === m.rows.length - 1;
        const extra = strong && last ? { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 } : {};
        if (v === null) return cellBox(c, span({ fontSize: size * 0.8, color: t.muted }, "–"), extra);
        if (typeof v === "string") return cellBox(c, span({ fontSize: size * 0.7, fontFamily: MONO, color: strong ? t.fg : t.muted }, v), extra);
        return cellBox(c, unit(v, strong ? t.fg : t.muted, strong ? 800 : 600), extra);
      }),
    ),
  );

  return { body: div({ flexDirection: "column", flexGrow: 1, justifyContent: "center" }, header, body) };
}
