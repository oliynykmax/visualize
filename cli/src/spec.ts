import { METRIC_KINDS, metric, type Metric, type MetricKind, type Better } from "./metrics";
import { ACCENTS, THEMES, accentColor, type Theme, type ThemeName } from "./theme";

export class SpecError extends Error {
  constructor(
    readonly path: string,
    readonly detail: string,
  ) {
    super(`${path || "spec"}: ${detail}`);
  }
}

type Ctx = { seen: Set<string>; warnings: string[] };

export class Reader {
  constructor(
    readonly value: unknown,
    readonly path: string,
    readonly ctx: Ctx = { seen: new Set([""]), warnings: [] },
  ) {}

  fail(msg: string): never {
    throw new SpecError(this.path, msg);
  }

  warn(msg: string): void {
    this.ctx.warnings.push(`${this.path || "spec"}: ${msg}`);
  }

  get(key: string): Reader {
    const v = this.value;
    if (typeof v !== "object" || v === null || Array.isArray(v)) this.fail("expected an object");
    const path = this.path ? `${this.path}.${key}` : key;
    this.ctx.seen.add(path);
    return new Reader((v as Record<string, unknown>)[key], path, this.ctx);
  }

  has(key: string): boolean {
    return this.get(key).value !== undefined;
  }

  str(): string {
    if (typeof this.value !== "string" || !this.value.trim()) this.fail("expected a non-empty string");
    return this.value as string;
  }

  optStr(): string | undefined {
    return this.value === undefined ? undefined : this.str();
  }

  text(fits: number): string {
    const s = this.str();
    const visible = s.replace(/[*~]/g, "").length;
    if (visible > fits) this.warn(`${visible} characters may not fit (about ${fits} fit). Shorten it or check the PNG`);
    return s;
  }

  optText(fits: number): string | undefined {
    return this.value === undefined ? undefined : this.text(fits);
  }

  num(): number {
    if (typeof this.value !== "number" || !Number.isFinite(this.value)) this.fail("expected a number");
    return this.value as number;
  }

  pos(): number {
    const n = this.num();
    if (n <= 0) this.fail("expected a number above 0");
    return n;
  }

  optNum(): number | undefined {
    return this.value === undefined ? undefined : this.num();
  }

  bool(fallback: boolean): boolean {
    if (this.value === undefined) return fallback;
    if (typeof this.value !== "boolean") this.fail("expected true or false");
    return this.value;
  }

  oneOf<T extends string>(options: readonly T[], fallback?: T): T {
    if (this.value === undefined && fallback !== undefined) return fallback;
    if (!options.includes(this.value as T)) this.fail(`expected one of ${options.join(", ")}`);
    return this.value as T;
  }

  list(min = 1, max = Infinity): Reader[] {
    if (!Array.isArray(this.value)) this.fail("expected an array");
    const a = this.value as unknown[];
    if (a.length < min) this.fail(`expected at least ${min} item${min === 1 ? "" : "s"}`);
    if (a.length > max) this.fail(`expected at most ${max} items, got ${a.length}. Split the data across several cards`);
    return a.map((v, i) => {
      const path = `${this.path}[${i}]`;
      this.ctx.seen.add(path);
      return new Reader(v, path, this.ctx);
    });
  }

  accent(): string | undefined {
    const name = this.optStr();
    if (name === undefined) return undefined;
    if (!(name in ACCENTS) && !/^#[0-9a-f]{6}$/i.test(name)) this.fail(`expected one of ${Object.keys(ACCENTS).join(", ")} or #rrggbb`);
    return accentColor(name);
  }

  metric(): Metric {
    const kind = this.get("metric").oneOf<MetricKind>(METRIC_KINDS, "time");
    const better = this.has("better") ? this.get("better").oneOf<Better>(["lower", "higher"]) : undefined;
    return metric(kind, better);
  }

  unknownFields(): string[] {
    const out: string[] = [];
    const walk = (v: unknown, path: string) => {
      if (!this.ctx.seen.has(path)) {
        out.push(`${path}: unknown field, ignored`);
        return;
      }
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    };
    walk(this.value, this.path);
    return out;
  }
}

export type Frame = {
  theme: Theme;
  themeName: ThemeName;
  accent: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  footnote?: string;
  source?: string;
};

export function readFrame(r: Reader): Frame {
  const themeName = r.get("theme").oneOf<ThemeName>(["dark", "cream"], "dark");
  return {
    theme: THEMES[themeName],
    themeName,
    accent: r.get("accent").accent() ?? accentColor("blue"),
    eyebrow: r.get("eyebrow").optText(70),
    title: r.get("title").optText(48),
    subtitle: r.get("subtitle").optText(100),
    footnote: r.get("footnote").optText(130),
    source: r.get("source").optText(60),
  };
}
