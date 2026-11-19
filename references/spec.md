# visualize spec reference

A spec is one JSON object, or an array of them for several cards. Every card is 1600×900 units, written as a 3200×1800 PNG by default (`--scale` changes it).

Unknown fields are ignored and reported in `warnings`. Text longer than roughly fits is reported too. Item caps (rows, tiles, series) are hard errors because the layout breaks past them; split the data across cards.

## Shared fields

| Field | Default | Meaning |
|---|---|---|
| `template` | required | `compare`, `stats`, `bars`, `table`, `columns`, `progress`, `line` |
| `theme` | `dark` | `dark` (near-black with accent glow) or `cream` |
| `accent` | `blue` | `blue`, `pink`, `green`, `violet`, `orange`, `yellow`, `teal`, or `#rrggbb` |
| `eyebrow` | none | small uppercase line above the title |
| `title` | none | headline. `*text*` is accent, `~text~` is muted, `→` draws an arrow |
| `subtitle` | none | one line under the title, same markup (`~text~` there is full-strength) |
| `nextVersionOf` | none | adds `in the next version of {value}` below the heading; use the product or project name as the value |
| `footnote` | none | methodology line at the bottom left: machine, runs, versions, date |
| `source` | none | monospace bottom-right text: the command or file that produced the numbers |

Metric fields, used by `compare`, `stats` tiles, `bars` and `table`:

| `metric` | better | improved | regressed |
|---|---|---|---|
| `time` (default) | lower | faster, less time | slower, more time |
| `memory` | lower | less memory, less | more memory, more |
| `size` | lower | smaller | larger |
| `throughput` | higher | faster, more | slower, less |
| `score` | higher | higher | lower |

`better: "lower" | "higher"` overrides the metric's direction. Equal values are `unchanged`. `visualize --list` prints the exact words.

## compare

One before → after change, improvement or regression. `delta`, `ratio` and `percent` are computed, never typed in. `summary` returns them with the wording used on the card.

```json
{ "template": "compare", "layout": "pills", "hero": "delta", "metric": "time", "unit": "s",
  "before": { "label": "oxlint", "value": 42 }, "after": { "label": "bun lint", "value": 20 } }
```

- `layout`: `pills` (centered, before and after pills), `bar` (fill against a hatched track), `ring` (gauge of after as a share of before), `stack` (two block columns, good for memory).
- `hero`: `delta` (22 s faster), `ratio` (2.1× faster), `percent` (52% less time). The other two appear as secondary stats.
- `title` defaults to `~before~ → *after*`.
- The `after` side always gets the accent. For a regression card, pick a warning accent such as `orange`.

## stats

One to four tiles, each a computed change with a monospace `before → after` footer. The number is direction-free, so the `caption` carries the word ("faster startup", "slower startup").

```json
{ "template": "stats", "tiles": [
  { "caption": "smaller binary", "metric": "size", "before": 428, "after": 284, "unit": "MB" },
  { "caption": "faster startup", "metric": "time", "before": 458, "after": 382, "unit": "ms", "show": "ratio" } ] }
```

`show`: `percent` (default) or `ratio`. Tile accents cycle from the card accent. A tile `accent` overrides.

## bars

Grouped horizontal bars: one row per benchmark, one bar per series. The first series is the hero.

```json
{ "template": "bars", "metric": "throughput", "series": ["Bun.serve()", "node:http2 in Bun", "Node.js"],
  "rows": [{ "label": "Hello World", "note": "GET → 13 B", "values": [291512, 55619, 42733] }] }
```

- `scale`: `row` (default, each row scaled to its own max) or `shared`.
- `baseline`: series index the right-hand ratio compares the hero (first series) against. Defaults to the last series. A slower hero shows `N× slower` in muted color. Single-series charts show no ratio.
- `unit` is appended to each bar value. Up to 8 rows.

## table

Comparison table with one highlighted column and an optional delta column.

```json
{ "template": "table", "metric": "memory", "unit": "MB", "rowHeader": "Peak RSS",
  "columns": [{ "label": "Bun", "sub": "1.4.1" }, { "label": "Bun", "sub": "1.4.0" }],
  "highlight": 0, "delta": { "against": 1, "min": 3 },
  "rows": [{ "label": "Fastify", "values": [94, 128] }] }
```

- `columns` entries are strings or `{ label, sub }`.
- Values are numbers, strings (shown monospace) or `null` (shown as –).
- `delta.min` hides changes smaller than that many percent (default 3). Green means better under `metric`.

## columns

Vertical bars, one per item. The highlighted items get the accent. Without any `highlight`, the last item is highlighted.

```json
{ "template": "columns", "format": "ratio", "baseline": { "value": 1, "label": "TinyCC = 1×" },
  "items": [{ "label": "noop call", "note": "2.27 ns → 763 ps", "value": 3.0, "highlight": true }] }
```

`format`: `number` (with `unit`) or `ratio` (prints `3.0×`). `tag` writes text inside a bar, like "coming soon".

## progress

Pass rates. One item draws a waffle grid with one square per test. Several items draw a bar list.

```json
{ "template": "progress", "items": [{ "label": "http", "passed": 389, "total": 415 }] }
```

Percentages round, but never to 100% unless everything passes. `grid: false` turns the waffle off for a single item.

## line

Series over an ordered x axis.

```json
{ "template": "line", "unit": "MB", "x": ["", "1,000 req", "", "2,000 req"],
  "series": [{ "name": "Bun v1.4", "values": [120, 190, 214, 226], "highlight": true },
             { "name": "Node", "values": [110, 260, 320, 365] }],
  "threshold": { "value": 300, "label": "budget" },
  "annotations": [{ "at": 2, "label": "fix landed" }] }
```

- `x` labels: one per point. Empty strings skip a tick.
- One series is highlighted (accent, glow, area fill). It defaults to the first series.
- Without `hero`, each series' last value is labelled on the right. With `hero: { value, unit?, caption? }`, a big number replaces those labels.
- `yMin` defaults to 0.
