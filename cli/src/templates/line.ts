import { num } from "../metrics";
import type { Frame, Reader } from "../spec";
import { alpha, mix } from "../theme";
import { INNER_W, div, span, svgImg, value, type Body, type Node } from "../ui";

type Series = { name: string; values: number[]; highlight: boolean };

export type Line = {
  series: Series[];
  x: string[];
  unit?: string;
  yMin: number;
  threshold?: { value: number; label: string };
  hero?: { value: string; unit?: string; caption?: string };
  annotations: { at: number; series: number; label: string }[];
};

export function parse(r: Reader): Line {
  const x = r.get("x").list(2).map((l) => (l.value === "" ? "" : l.str()));
  const series = r.get("series").list(1, 5).map((s) => {
    const values = s.get("values").list(2).map((v) => v.num());
    if (values.length !== x.length) s.get("values").fail(`expected ${x.length} values, one per x label`);
    return { name: s.get("name").text(16), values, highlight: s.get("highlight").bool(false) };
  });
  if (!series.some((s) => s.highlight)) series[0].highlight = true;
  const t = r.get("threshold");
  const h = r.get("hero");
  const annotations = r.has("annotations")
    ? r.get("annotations").list(0).map((a) => {
        const at = a.get("at").num();
        const si = a.get("series").optNum() ?? series.findIndex((s) => s.highlight);
        if (!Number.isInteger(at) || at < 0 || at >= x.length) a.get("at").fail(`expected an index from 0 to ${x.length - 1}`);
        if (!Number.isInteger(si) || si < 0 || si >= series.length) a.get("series").fail(`expected a series index from 0 to ${series.length - 1}`);
        return { at, series: si, label: a.get("label").str() };
      })
    : [];
  return {
    series,
    x,
    unit: r.get("unit").optStr(),
    yMin: r.get("yMin").optNum() ?? 0,
    threshold: t.value === undefined ? undefined : { value: t.get("value").num(), label: t.get("label").str() },
    hero: h.value === undefined ? undefined : { value: h.get("value").str(), unit: h.get("unit").optStr(), caption: h.get("caption").optStr() },
    annotations,
  };
}

function niceTicks(lo: number, hi: number, count = 4): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}

function spread(ys: number[], minGap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => [y, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(ys.length);
  let prev = -Infinity;
  for (const [y, i] of order) {
    out[i] = Math.max(y, prev + minGap, lo);
    prev = out[i];
  }
  const overflow = prev - hi;
  if (overflow > 0) for (const [, i] of order) out[i] -= overflow;
  return out;
}

export function render(m: Line, f: Frame): Body {
  const t = f.theme;
  const axisW = 96;
  const sideW = m.hero ? 400 : 250;
  const PW = INNER_W - axisW - sideW - 24;
  const PH = 470;
  const all = m.series.flatMap((s) => s.values).concat(m.threshold ? [m.threshold.value] : []);
  const ticks = niceTicks(Math.min(m.yMin, ...all), Math.max(...all) * 1.08);
  const y0 = Math.min(m.yMin, ticks[0]);
  const y1 = Math.max(ticks[ticks.length - 1], Math.max(...all));
  const n = m.x.length;
  const X = (i: number) => (i / (n - 1)) * PW;
  const Y = (v: number) => PH - ((v - y0) / (y1 - y0)) * PH;
  const pad = 14;

  const color = (s: Series, i: number) => (s.highlight ? f.accent : i % 2 ? alpha(t.muted, 0.75) : mix(t.muted, t.fg, 0.25));
  const path = (s: Series) => s.values.map((v, i) => `${i ? "L" : "M"} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const hl = m.series.find((s) => s.highlight)!;
  const area = `${path(hl)} L ${PW} ${PH} L 0 ${PH} Z`;
  const W = PW + pad * 2;
  const H = PH + pad * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${-pad} ${-pad} ${W} ${H}">
<defs>
<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.accent}" stop-opacity="0.28"/><stop offset="1" stop-color="${f.accent}" stop-opacity="0"/></linearGradient>
<filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>
${ticks.map((v) => `<line x1="0" x2="${PW}" y1="${Y(v)}" y2="${Y(v)}" stroke="${t.rule}" stroke-width="1.5"/>`).join("")}
<path d="${area}" fill="url(#a)"/>
${m.threshold ? `<line x1="0" x2="${PW}" y1="${Y(m.threshold.value)}" y2="${Y(m.threshold.value)}" stroke="${alpha(t.fg, 0.7)}" stroke-width="2.5" stroke-dasharray="12 10"/>` : ""}
${m.series.map((s, i) => (s.highlight ? "" : `<path d="${path(s)}" fill="none" stroke="${color(s, i)}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`)).join("")}
<path d="${path(hl)}" fill="none" stroke="${f.accent}" stroke-width="10" opacity="0.6" filter="url(#g)"/>
<path d="${path(hl)}" fill="none" stroke="${f.accent}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
${m.annotations.map((a) => `<circle cx="${X(a.at)}" cy="${Y(m.series[a.series].values[a.at])}" r="8" fill="${t.bg}" stroke="${color(m.series[a.series], a.series)}" stroke-width="4"/>`).join("")}
<circle cx="${X(n - 1)}" cy="${Y(hl.values[n - 1])}" r="22" fill="${alpha(f.accent, 0.25)}"/>
<circle cx="${X(n - 1)}" cy="${Y(hl.values[n - 1])}" r="10" fill="${mix(f.accent, "#ffffff", 0.3)}"/>
</svg>`;

  const abs = (left: number, top: number, w: number, child: Node, align = "flex-start") =>
    div({ position: "absolute", left, top, width: w, justifyContent: align }, child);

  const labels: Node[] = [
    ...ticks.map((v) => abs(0, Y(v) + pad - 12, axisW - 16, span({ fontSize: 20, color: t.muted }, num(v)), "flex-end")),
    ...m.x.map((l, i) => (l ? abs(axisW + pad + X(i) - 90, PH + pad * 2 + 6, 180, span({ fontSize: 21, color: t.muted }, l), "center") : null)).filter(
      (x): x is Node => x !== null,
    ),
  ];
  if (m.threshold) {
    labels.push(abs(axisW + pad + 8, Y(m.threshold.value) + pad - 36, PW, span({ fontSize: 22, fontWeight: 700, color: t.fg }, m.threshold.label)));
  }
  for (const a of m.annotations) {
    const ax = axisW + pad + X(a.at);
    labels.push(abs(Math.min(ax - 160, axisW + PW - 300), Y(m.series[a.series].values[a.at]) + pad - 44, 320, span({ fontSize: 19, fontWeight: 600, color: t.fg }, a.label), "center"));
  }
  if (!m.hero) {
    const ys = spread(m.series.map((s) => Y(s.values[n - 1]) + pad - 30), 70, 0, PH);
    m.series.forEach((s, i) =>
      labels.push(
        abs(
          axisW + PW + pad * 2 + 24,
          ys[i],
          sideW,
          div(
            { flexDirection: "column" },
            span({ fontSize: 18, fontWeight: 600, color: t.muted }, s.name),
            value(num(s.values[n - 1]), m.unit, 40, s.highlight ? f.accent : color(s, i)),
          ),
        ),
      ),
    );
  }

  const chart = div(
    { position: "relative", width: axisW + W + (m.hero ? 0 : sideW), height: H + 40 },
    div({ position: "absolute", left: axisW, top: 0 }, svgImg(svg, W, H)),
    labels,
  );

  return {
    body: div(
      { flexGrow: 1, alignItems: "flex-end", justifyContent: "space-between" },
      chart,
      m.hero &&
        div(
          { flexDirection: "column", alignItems: "flex-end", width: sideW, marginBottom: 60 },
          value(m.hero.value, m.hero.unit, 120, t.fg),
          m.hero.caption && div({ width: sideW, justifyContent: "flex-end", marginTop: 10 }, span({ fontSize: 26, color: t.muted, textAlign: "right", whiteSpace: "normal" }, m.hero.caption)),
        ),
    ),
  };
}
