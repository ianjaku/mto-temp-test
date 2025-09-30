/* eslint-disable no-console */
import { FormatLogOptions } from "./types.js";
import chalk from "chalk";
import { formatLine } from "./format.js";
import { repeat } from "ramda";

const {
    gray: fgDimmed,
    red: fgRed,
} = chalk;
chalk.level = 1

export function formatLog(options: FormatLogOptions): (line: string) => void {
    return (rawLine: string) => {
        try {
            console.error(formatLine(rawLine).join("\n"))

            if (options.printOriginal) console.error(fgDimmed(rawLine));

            if (options.printSeparator) {
                console.error();
                console.error(fgDimmed(repeat("-", 80).join("")));
                console.error();
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (options.printOther) {
                if (rawLine && rawLine[-1] === "{") {
                    console.error(fgRed(e && e.toString && e.toString()));
                    console.error(e)
                }
                console.error(fgDimmed(rawLine));
            }
        }
    }
}
