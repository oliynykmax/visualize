import { num, ratio } from "../metrics";
import type { Frame, Reader } from "../spec";
import { alpha, mix } from "../theme";
import { INNER_W, div, span, value, type Body } from "../ui";

type Item = { label: string; note?: string; value: number; highlight: boolean; tag?: string };

export type Columns = {
  items: Item[];
  unit?: string;
  format: "number" | "ratio";
  baseline?: { value: number; label: string };
};

export function parse(r: Reader): Columns {
  const items = r.get("items").list(2, 10).map((it) => ({
    label: it.get("label").text(18),
    note: it.get("note").optText(24),
    value: it.get("value").pos(),
    highlight: it.get("highlight").bool(false),
    tag: it.get("tag").optStr(),
  }));
  if (!items.some((i) => i.highlight)) items[items.length - 1].highlight = true;
  const b = r.get("baseline");
  return {
    items,
    unit: r.get("unit").optStr(),
    format: r.get("format").oneOf(["number", "ratio"] as const, "number"),
    baseline: b.value === undefined ? undefined : { value: b.get("value").pos(), label: b.get("label").str() },
  };
}

export function render(m: Columns, f: Frame): Body {
  const t = f.theme;
  const plotH = 440;
  const max = Math.max(...m.items.map((i) => i.value), m.baseline?.value ?? 0);
  const gap = m.items.length > 6 ? 18 : 36;
  const colW = Math.floor((INNER_W - gap * (m.items.length - 1)) / m.items.length);
  const barW = Math.min(170, colW - 10);
  const label = (v: number) => (m.format === "ratio" ? ratio(v) : num(v));
  const valueSize = m.items.length > 6 ? 34 : 48;
  return {
    body: div(
      { flexDirection: "column", flexGrow: 1, justifyContent: "flex-end" },
      div(
        { position: "relative", height: plotH + valueSize + 20, alignItems: "flex-end", gap, borderBottom: `2px solid ${t.rule}` },
        m.items.map((it) => {
          const h = Math.max(8, Math.round((plotH * it.value) / max));
          const color = it.highlight ? f.accent : t.faint;
          return div(
            { width: colW, flexDirection: "column", alignItems: "center", justifyContent: "flex-end" },
            value(label(it.value), m.format === "ratio" ? undefined : m.unit, valueSize, it.highlight ? f.accent : t.muted, { marginBottom: 12 }),
            div(
              {
                width: barW,
                height: h,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                backgroundColor: color,
                backgroundImage: it.highlight ? `linear-gradient(180deg, ${mix(f.accent, "#ffffff", 0.25)}, ${f.accent})` : "none",
                alignItems: "center",
                justifyContent: "center",
                padding: 10,
              },
              it.tag && span({ fontSize: 24, fontWeight: 800, color: "#ffffff", textAlign: "center" }, it.tag),
            ),
          );
        }),
        m.baseline &&
          div(
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: Math.round((plotH * m.baseline.value) / max),
              borderTop: `2px dashed ${alpha(t.muted, 0.6)}`,
              alignItems: "flex-end",
            },
            div({ marginTop: -16, padding: "4px 12px", borderRadius: 8, backgroundColor: t.bg }, span({ fontSize: 17, fontWeight: 700, letterSpacing: 2, color: t.muted }, m.baseline.label.toUpperCase())),
          ),
      ),
      div(
        { gap, marginTop: 14 },
        m.items.map((it) =>
          div(
            { width: colW, flexDirection: "column", alignItems: "center", textAlign: "center" },
            span({ fontSize: m.items.length > 6 ? 20 : 26, fontWeight: it.highlight ? 800 : 600, color: it.highlight ? t.fg : t.muted }, it.label),
            it.note && span({ fontSize: 16, color: t.muted, marginTop: 4 }, it.note),
          ),
        ),
      ),
    ),
  };
}
