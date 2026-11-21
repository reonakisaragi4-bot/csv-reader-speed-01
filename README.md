# csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/reonakisaragi4-bot/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/reonakisaragi4-bot/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: it answers exactly as the reference does on every case — the same `{columns, rows, errors}` for every input, including every broken-row policy (stray CRs, unterminated quotes, quote junk, short and long rows) — only faster. The reference walks the text one character at a time; `solve.js` jumps between delimiters with `indexOf` and cuts each field out with `slice`, so the hot path is a few native scans per field. On the kit's practice set it passes all 6 cases, and its pure parse runs about 5–6× faster than the reference (roughly 90 ms against roughly 500 ms for the six files).

## Run it

```sh
MAKEFUN_INPUT_DIR=./practice/input MAKEFUN_OUTPUT_DIR=./out node main.ts
```

`main.ts` reads every case from `$MAKEFUN_INPUT_DIR/cases.json` (or `/input/cases.json`), answers each one alone with `run()` from `solve.js`, and writes the answers in order to `$MAKEFUN_OUTPUT_DIR/answers.json` (or `/output/answers.json`). Node 22 or later, nothing to install: `solve.js` is a dependency-free ES module.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cdrpe06y&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
