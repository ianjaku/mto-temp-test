/* eslint-disable no-console */
import * as readline from "readline";
import chalk from "chalk";
import { humanizeBytes } from "./formatting";

type Color = "red" | "purple" | "white" | "green" | "blue" | "yellow" | "dimmed";
const BOX_PADDING = 7;

const isColorsEnabled = (): boolean => chalk.enabled;

/**
 * Enables color output globally
 */
export function enableColors(): void {
    chalk.enabled = true;
}

/**
 * Disables color output globally
 */
export function disableColors(): void {
    chalk.enabled = false;
}

/**
 * Strips the string from the ANSI codes
 */
export function stripColors(raw: string): string {
    // eslint-disable-next-line no-control-regex
    const ansiEscapeRegex = /\u001b\[.*?m/g;
    return raw.replace(ansiEscapeRegex, "");
}

/**
 * Formats the text as bold.
 * @param text - The text to format.
 * @returns The formatted text.
 */
export const bold = (text: string): string => chalk.bold(text);

/**
 * Formats the text as dimmed.
 * @param text - The text to format.
 * @returns The formatted text.
 */
export const dim = (text: string): string => chalk.gray(text);

/**
 * Starts color output with dimmed color. Any text printed to console after this call will be colored.
 * @param color - color of the text
 */
export const startDim = (): void => {
    if (isColorsEnabled()) process.stdout.write("\x1b[30m");
}

/**
 * Resets all colors
 */
export const resetColors = (): void => {
    if (isColorsEnabled()) process.stdout.write("\x1b[0m");
}

/**
 * Logs an error message with a red foreground.
 * @param msgs - The message(s) to log.
 */
export function error(...msgs: unknown[]): void {
    console.log(`${box("red", "ERROR", BOX_PADDING)} ${chalk.red(msgs.join(" "))}`);
}

/**
 * Logs an info message.
 * @param msgs - The message(s) to log.
 */
export function info(...msgs: unknown[]): void {
    console.log(`${box("white", "INFO", BOX_PADDING)} ${msgs.join(" ")}`);
}

/**
 * Logs a performance metric.
 * @param msgs - The message(s) to log.
 */
export function perf(...msgs: unknown[]): void {
    console.log(`${box("purple", "PERF", BOX_PADDING)} ${msgs.join(" ")}`);
}

/**
 * Logs a warning message.
 * @param msgs - The message(s) to log.
 */
export function warn(...msgs: unknown[]): void {
    console.log(`${box("yellow", "WARN", BOX_PADDING)} ${msgs.join(" ")}`);
}

/**
 * Logs a success message.
 * @param msgs - The message(s) to log.
 */
export function ok(...msgs: unknown[]): void {
    console.log(`${box("green", "OK", BOX_PADDING)} ${msgs.join(" ")}`);
}

/**
 * Creates a box with colored background around the provided text.
 * @param color - The background color of the box.
 * @param text - The text to be enclosed in the box.
 * @param [width=-1] - The width of the box (optional, default is the length of `text`).
 * @returns The string representing the box.
 */
export function box(color: Color, text: string, width = -1): string {
    if (!isColorsEnabled()) return text;
    const str = text || "";
    const bg = {
        red: chalk.bgRed,
        blue: chalk.bgBlue,
        white: chalk.bgWhite,
        green: chalk.bgGreen,
        purple: chalk.bgMagenta,
        yellow: chalk.bgYellow,
        dimmed: chalk.bgBlackBright,
    }[color];
    const padL = 1;
    const padR = width > 0 ? Math.max(1, width - str.length + 1) : 1;
    const padLeft = " ".repeat(padL);
    const padRight = " ".repeat(padR);
    return chalk.black(bg(`${padLeft}${str}${padRight}`));
}

/**
 * Prompts the user with a confirmation question and resolves with a boolean indicating the user's response.
 * Reads only first character of the user input and is case insensitive.
 * @param question - The question to prompt the user.
 * @param [defaultAnswer='n'] - The default answer if the user inputs nothing (optional, default is 'n').
 * @returns {Promise<boolean>} A promise that resolves with `true` if the user confirms, and `false` otherwise.
 */
export function confirm(
    question: string,
    defaultAnswer = "n",
): Promise<boolean> {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const yes = defaultAnswer === "y" ? "Y" : "y";
        const no = defaultAnswer === "n" ? "N" : "n";
        rl.question(`${question} [${yes}/${no}] `, (input) => {
            let answer = input.trim().toLowerCase();
            if (!answer.length) answer = defaultAnswer;
            if (answer.at(0) === "y") {
                resolve(true);
            } else {
                resolve(false);
            }
            rl.close();
        });
    });
}

/**
 * Logs memory usage statistics including RSS, heap total, heap used, and external memory.
 */
export function memusage(): void {
    const mem = process.memoryUsage();
    perf([
        `memory usage: rss: ${bold(humanizeBytes(mem.rss))}`,
        `heap total: ${bold(humanizeBytes(mem.heapTotal))}`,
        `heap used: ${bold(humanizeBytes(mem.heapUsed))}`,
        `external: ${bold(humanizeBytes(mem.external))}`
    ].join(", "));
}

/**
 * Logs a success message and exits with status code 0.
 * @param msgs - The message(s) to log.
 */
export function success(...msgs: unknown[]): never {
    ok(...msgs);
    process.exit(0);
}

/**
 * Logs an error message with a red "PANIC" label and exits the process with a status code of 1.
 * @param msg - The error message.
 */
export function panic(msg: string): never {
    console.error(box("red", "PANIC"), chalk.red(msg));
    process.exit(1)
}

