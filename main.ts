// Entry driver for the csv-reader-speed bounty: the harness runs `node /bot/main.ts`
// (Node 22). It reads every case from /input/cases.json, answers each one alone with
// run() from solve.js, and writes the answers, in the cases' order, to
// /output/answers.json. Outside a container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFlagsFromString } from "node:v8";

// Turn V8's incremental marking off before solve.js loads, so the whole run — and
// the timing the house measures — happens under the same flag its baseline runs with.
setFlagsFromString("--no-incremental-marking");

const solve = (await import(new URL("./solve.js", import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

type Case = { id: string; input: unknown };
const cases = JSON.parse(readFileSync(join(inputDir, "cases.json"), "utf8")) as Case[];

const answers = cases.map(({ input }) => solve.run(input));
writeFileSync(join(outputDir, "answers.json"), JSON.stringify(answers));
