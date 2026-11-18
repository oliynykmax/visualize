# visualize

`visualize` turns a JSON specification into a 3200×1800 PNG card for benchmark results, release notes, PRs, reports, and slides. It derives deltas, ratios, percentages, and direction-aware wording from raw values so the text and graphic agree.

## Install

```sh
git clone https://github.com/oliynykmax/visualize.git
cd visualize/cli
bun install
bun link
cd ..
```

## Use

```sh
visualize examples/compare-pills.json -o /tmp/compare.png
visualize --check '{"template":"compare","unit":"s","before":{"label":"old","value":42},"after":{"label":"new","value":20}}'
visualize --examples /tmp/visualize-examples
```

`visualize --help` explains the JSON input and command line options. The complete specification is in [`references/spec.md`](references/spec.md), with ready-to-copy input files in [`examples/`](examples/).

## Built-in agent skill

The checked-in instructions for agents are [`SKILL.md`](SKILL.md). The installed CLI prints the same file with:

```sh
visualize --skill
```

## Development

```sh
cd cli
bun test
bun check
```
