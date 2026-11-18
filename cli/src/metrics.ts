export type Better = "lower" | "higher";

export type MetricKind = "time" | "memory" | "size" | "throughput" | "score";

export type Direction = "improved" | "regressed" | "unchanged";

export type Words = { ratio: string; delta: string; percent: string };

export type Metric = {
  kind: MetricKind;
  better: Better;
  words: Record<Direction, Words>;
};

const UNCHANGED: Words = { ratio: "same", delta: "change", percent: "change" };

const WORDS: Record<MetricKind, { better: Better; improved: Words; regressed: Words }> = {
  time: {
    better: "lower",
    improved: { ratio: "faster", delta: "faster", percent: "less time" },
    regressed: { ratio: "slower", delta: "slower", percent: "more time" },
  },
  memory: {
    better: "lower",
    improved: { ratio: "less memory", delta: "less", percent: "less memory" },
    regressed: { ratio: "more memory", delta: "more", percent: "more memory" },
  },
  size: {
    better: "lower",
    improved: { ratio: "smaller", delta: "smaller", percent: "smaller" },
    regressed: { ratio: "larger", delta: "larger", percent: "larger" },
  },
  throughput: {
    better: "higher",
    improved: { ratio: "faster", delta: "more", percent: "more" },
    regressed: { ratio: "slower", delta: "less", percent: "less" },
  },
  score: {
    better: "higher",
    improved: { ratio: "higher", delta: "higher", percent: "higher" },
    regressed: { ratio: "lower", delta: "lower", percent: "lower" },
  },
};

export const METRIC_KINDS = Object.keys(WORDS) as MetricKind[];

export function metric(kind: MetricKind, better?: Better): Metric {
  const w = WORDS[kind];
  return { kind, better: better ?? w.better, words: { improved: w.improved, regressed: w.regressed, unchanged: UNCHANGED } };
}

export type Change = {
  direction: Direction;
  delta: number;
  ratio: number;
  percent: number;
};

export function change(before: number, after: number, better: Better): Change {
  const delta = Math.abs(before - after);
  const direction: Direction =
    before === after ? "unchanged" : (better === "lower") === after < before ? "improved" : "regressed";
  return { direction, delta, ratio: Math.max(before, after) / Math.min(before, after), percent: (delta / before) * 100 };
}

export function relative(value: number, baseline: number, better: Better): { ratio: number; direction: Direction } {
  const c = change(baseline, value, better);
  return { ratio: c.ratio, direction: c.direction };
}

export function round(n: number, digits = 3): number {
  return Number(n.toFixed(digits));
}

export function num(n: number): string {
  const a = Math.abs(n);
  if (Number.isInteger(n) || a >= 100) return Math.round(n).toLocaleString("en-US");
  if (a >= 10) return trim(n.toFixed(1));
  return trim(n.toFixed(2));
}

export function ratio(n: number): string {
  return (n >= 10 ? Math.round(n).toString() : n.toFixed(1)) + "×";
}

export function percent(n: number): string {
  return Math.round(n) + "%";
}

export function signedPercent(n: number): string {
  const r = Math.round(n);
  return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r) + "%";
}

function trim(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}
