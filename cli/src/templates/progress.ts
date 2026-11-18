import { num } from "../metrics";
import type { Frame, Reader } from "../spec";
import { INNER_W, MONO, div, span, svgImg, type Body, type Node } from "../ui";

type Item = { label: string; passed: number; total: number };

export type Progress = { items: Item[]; grid: boolean };

export function parse(r: Reader): Progress {
  const items = r.get("items").list(1, 8).map((it) => {
    const total = it.get("total").pos();
    const passed = it.get("passed").num();
    if (!Number.isInteger(total) || !Number.isInteger(passed)) it.fail("passed and total must be whole numbers");
    if (passed < 0 || passed > total) it.get("passed").fail(`expected 0 to ${total}`);
    return { label: it.get("label").text(16), passed, total };
  });
  const grid = r.get("grid").bool(items.length === 1 && items[0].total <= 2000);
  if (grid && items.length > 1) r.get("grid").fail("the grid needs exactly one item");
  return { items, grid };
}

function share(it: Item): string {
  const p = Math.round((100 * it.passed) / it.total);
  return (it.passed < it.total ? Math.min(p, 99) : p) + "%";
}

function failedCells(passed: number, total: number): Set<number> {
  const failed = total - passed;
  const out = new Set<number>();
  for (let k = 0; k < failed; k++) out.add(Math.floor(((k + 0.5) * total) / failed));
  return out;
}

function waffle(it: Item, f: Frame, width: number, height: number): Node {
  let cell = 44;
  let cols = 0;
  let rows = 0;
  for (; cell > 4; cell--) {
    const step = cell + Math.max(2, Math.round(cell * 0.25));
    cols = Math.floor((width + step - cell) / step);
    rows = Math.ceil(it.total / cols);
    if (rows * step - (step - cell) <= height) break;
  }
  const step = cell + Math.max(2, Math.round(cell * 0.25));
  const failed = failedCells(it.passed, it.total);
  const rects: string[] = [];
  for (let i = 0; i < it.total; i++) {
    const x = (i % cols) * step;
    const y = Math.floor(i / cols) * step;
    rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${Math.round(cell * 0.22)}" fill="${failed.has(i) ? f.theme.faint : f.accent}"/>`);
  }
  const w = cols * step - (step - cell);
  const h = rows * step - (step - cell);
  return svgImg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects.join("")}</svg>`, w, h);
}

function track(it: Item, f: Frame, height: number): Node {
  return div(
    { width: "100%", height, borderRadius: height, backgroundColor: f.theme.faint },
    div({ width: `${(100 * it.passed) / it.total}%`, height, borderRadius: height, backgroundColor: f.accent }),
  );
}

export function render(m: Progress, f: Frame): Body {
  const t = f.theme;
  if (m.grid) {
    const it = m.items[0];
    return {
      body: div(
        { flexDirection: "column", flexGrow: 1 },
        div(
          { justifyContent: "space-between", alignItems: "baseline" },
          span({ fontFamily: MONO, fontSize: 44, fontWeight: 700 }, it.label),
          span({ fontSize: 64, fontWeight: 800, color: f.accent, letterSpacing: -2 }, share(it)),
        ),
        div({ marginTop: 14, marginBottom: 28 }, track(it, f, 14)),
        waffle(it, f, INNER_W, 400),
        span({ fontFamily: MONO, fontSize: 30, color: t.muted, marginTop: 24 }, `${num(it.passed)} / ${num(it.total)}`),
      ),
    };
  }
  return {
    body: div(
      { flexDirection: "column", flexGrow: 1, justifyContent: "space-around" },
      m.items.map((it) =>
        div(
          { alignItems: "center", gap: 28 },
          div({ width: 300 }, span({ fontFamily: MONO, fontSize: 30, fontWeight: 700 }, it.label)),
          div({ flexGrow: 1 }, track(it, f, 22)),
          div({ width: 200, justifyContent: "flex-end" }, span({ fontFamily: MONO, fontSize: 22, color: t.muted }, `${num(it.passed)} / ${num(it.total)}`)),
          div({ width: 120, justifyContent: "flex-end" }, span({ fontSize: 40, fontWeight: 800, color: f.accent }, share(it))),
        ),
      ),
    ),
  };
}
