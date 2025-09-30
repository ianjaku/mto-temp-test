import { log } from "./logging";

export function formatDuration(durationMS: number, decimalPlaces = 1): string {
    const sec = durationMS / 1000;
    if (sec < 60) {
        return `${sec.toFixed(decimalPlaces)}s`;
    }
    const min = Math.floor(sec / 60);
    return `${min}min ${(sec-min*60).toFixed(0)}s`;
}

export function padEnd(str: string, width: number, char = " "): string {
    return str.padEnd(width, char);
}

export function splitLine(line: string | null | undefined, sep = ","): string[] {
    if (!line || !line.length) {
        return [];
    }
    return line.split(sep).map(s => s.trim()).filter(s => s.length);
}

export async function handleAsyncWithErrorLog<T, A extends unknown[]>(
    asyncFunc: (...args: A) => Promise<T>,
    ...args: A
): Promise<T | undefined> {
    try {
        return await asyncFunc(...args);
    } catch (error) {
        log(`Error in function ${asyncFunc.name}: ${error}`);
        process.exit(1);
    }
}
