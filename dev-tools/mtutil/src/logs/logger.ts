import { FormatLogOptions } from "./types.js";
import { formatLog } from "./logs";

const options = {
    minimal: {
        printData: false,
        printMsg: false,
        printOriginal: false,
        printOther: true,
        printSeparator: false,
    } as FormatLogOptions,
    basic: {
        printData: true,
        printMsg: true,
        printOriginal: false,
        printOther: true,
        printSeparator: true,
    } as FormatLogOptions,
    full: {
        printData: true,
        printMsg: true,
        printOriginal: true,
        printOther: true,
        printSeparator: true,
    } as FormatLogOptions,
}

export type Preset = keyof typeof options;

function toPreset(presetStr: string): Preset {
    switch (presetStr) {
        case "minimal":
            return "minimal";
        case "basic":
            return "basic";
        case "full":
            return "full";
    }
    throw new Error(`Unknown preset ${presetStr}`);
}

export function buildLogger(preset = "basic"): (line: string) => void {
    const logger = formatLog(options[toPreset(preset)]);
    return logger;
}
