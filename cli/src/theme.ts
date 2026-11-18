export type ThemeName = "dark" | "cream";

export type Theme = {
  bg: string;
  fg: string;
  muted: string;
  faint: string;
  panel: string;
  rule: string;
  good: string;
  bad: string;
  glow: number;
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    bg: "#0b0d12",
    fg: "#f4f5f7",
    muted: "#8b92a3",
    faint: "#3a3f4c",
    panel: "rgba(255,255,255,0.045)",
    rule: "rgba(255,255,255,0.09)",
    good: "#3ee09a",
    bad: "#ff6b6b",
    glow: 0.22,
  },
  cream: {
    bg: "#faf4e8",
    fg: "#1d1a16",
    muted: "#7d7466",
    faint: "#d9d0bf",
    panel: "rgba(60,40,10,0.05)",
    rule: "rgba(60,40,10,0.12)",
    good: "#12a36b",
    bad: "#d94848",
    glow: 0.14,
  },
};

export const ACCENTS: Record<string, string> = {
  blue: "#4ea3ff",
  pink: "#ff5fae",
  green: "#36d98f",
  violet: "#a78bfa",
  orange: "#ffa24c",
  yellow: "#f2c230",
  teal: "#2ec5c9",
};

export const ACCENT_CYCLE = ["pink", "orange", "green", "blue", "violet", "teal"];

export function accentColor(name: string): string {
  const c = ACCENTS[name] ?? (/^#[0-9a-f]{6}$/i.test(name) ? name : undefined);
  if (!c) throw Error(`unknown accent "${name}". Use one of ${Object.keys(ACCENTS).join(", ")} or #rrggbb`);
  return c;
}

export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(hex: string, toward: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [p(hex), p(toward)];
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

export const WIDTH = 1600;
export const HEIGHT = 900;
