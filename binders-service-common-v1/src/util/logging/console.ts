/* eslint-disable no-console */

export function debugLog(...msgs: unknown[]): void {
    console.log("\n", "\x1b[38;5;17;48;5;214m", "🛠️ ", ...msgs, "\x1b[0m", "\n");
}

export function panicLog(msg: unknown): void {
    console.log(JSON.stringify({
        msg,
        category: "panic",
        level: 50,
        tags: ["panic"],
        time: new Date().toISOString(),
    }));
}