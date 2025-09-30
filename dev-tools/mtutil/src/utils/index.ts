import chalk from "chalk";
import { repeat } from "ramda";

const { red: fgRed, yellow: fgYellow } = chalk;

export function stripAnsiCodes(input: string): string {
    // eslint-disable-next-line no-control-regex
    return input.replace(/\x1B\[[0-9;]*m/g, "");
}

export function formatJson(obj: Record<string, unknown>): string {
    if (!obj) {
        return "<undefined>";
    }
    if (!Object.keys(obj).length) {
        return "{}";
    }
    const body = Object.keys(obj).map(key => indent(`${fgYellow(key)}: ${JSON.stringify(obj[key])},`, 4))
    const lines = [ "{", ...body, "}" ];
    return lines.join("\n");
}

export function indent(str: string, level = 1): string {
    const padding = repeat(" ", level).join("");
    return str.split("\n").map(line => `${padding}${line}`).join("\n");
}

type CommandFn<T> = (...args: T[]) => Promise<void>;

export function logErrors<T>(fn: CommandFn<T>): CommandFn<T> {
    return async function(...realArgs: T[]) {
        try {
            await fn(...realArgs);
        } catch (e) {
            console.error(fgRed(e));
        }
    }
}
