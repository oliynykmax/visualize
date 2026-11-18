---
name: visualize
description: Render benchmark and change cards as 3200×1800 PNGs from a JSON spec with the bundled `visualize` CLI. Covers before → after changes (improvements and regressions), stat tiles, grouped bars, comparison tables, column charts, pass-rate waffles and annotated line charts. Use when a task needs an image of measured numbers (a speedup, a slowdown, a memory or size change, a benchmark table, a test pass rate, a metric over time) for a post, PR, README, slide or report. Triggers on "/visualize", "chart/card/graphic of these numbers", "image for this benchmark".
---

# visualize

```sh
visualize '<json>' -o /abs/out.png    # inline spec; also a file path or - for stdin
visualize --check '<json>'            # validate and preview the derived numbers, write nothing
visualize --example bars              # print a working spec to copy
visualize --list                      # templates, layouts, metrics and their wording, accents (JSON)
visualize --skill                     # print these built-in agent instructions
```

stdout is always one JSON object. Exit 0 rendered, 2 invalid spec (nothing written), 1 other failure.

```json
{"ok":true,"cards":[{"file":"/abs/out.png","template":"compare","width":3200,"height":1800,
  "summary":{"direction":"regressed","hero":"22 s slower","text":["22 s slower","2.1× slower","110% more time"]},
  "warnings":[]}]}
{"ok":false,"errors":[{"card":0,"path":"rows[2].values","message":"expected at least 3 items"}]}
```

Every field: [references/spec.md](references/spec.md). One spec per template and layout: `examples/`.

## Template by data shape

| Data | Template |
|---|---|
| One before → after value | `compare` (`layout`: `pills`, `bar`, `ring`, `stack`) |
| 1–4 before → after values from one change | `stats` |
| Benchmarks × 1–4 series | `bars` |
| Rows × up to 7 columns, exact values | `table` |
| 2–10 single values or multipliers | `columns` |
| passed / total | `progress` |
| Values over an ordered axis | `line` |

## Rules

- Pass raw `before` and `after`. The CLI computes Δ, × and % and words them from `metric` and the direction (improved, regressed, unchanged). Never precompute or round them yourself.
- Regressions render as regressions ("2.1× slower"). Check `summary.direction` matches what you expect.
- Quote `summary.hero` or `summary.text` in your own message so the prose matches the card.
- Put the method in `footnote` and the command in `source`. Leave both out if you don't know them. Don't invent them.
- Render many cards in one call with a JSON array. Errors for all cards come back together.
- Pass `-o` with an absolute path in your workspace. The default is `~/.local/share/visualize/`.

## Verify

1. Read `warnings`. `unknown field, ignored` means a typo. `may not fit` means shorten the text.
2. Open the PNG with your image-reading tool before you hand it over. Text must sit inside the card with no overlaps.

## Changing the CLI

Code is in `cli/`. Each template in `cli/src/templates/` exports `parse` (validate and derive), `render` (satori tree) and optionally `summary` (JSON for the caller), and `index.ts` registers it. After a change, run `bun test` and `bun check` in `cli/`, then `visualize --examples DIR` and look at the PNGs. Keep `boxShadow` glows small. resvg takes seconds to blur large shapes.
