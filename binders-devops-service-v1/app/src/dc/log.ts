import * as chalk from "chalk";
import { formatDuration } from "../lib/utils";

const startedAt = Date.now();

/* eslint-disable no-console */
export function log(...args: unknown[]) {
    if (!args.length) { console.log(); return; }
    const elapsedMs = Date.now() - startedAt;
    console.log(`${chalk.gray(formatDuration(elapsedMs, 2))}`, ...args)
}
/* eslint-enable no-console */
