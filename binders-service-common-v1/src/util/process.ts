import { spawn } from "child-process-promise";

// eslint-disable-next-line no-console, @typescript-eslint/explicit-module-boundary-types
export let log = (msg, prefix?: string) => console.log( (prefix === undefined ? "[stdout-main]: " : prefix) + msg);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const setLogger = (newLog: (msg, prefix?: string) => void) => {
    log = newLog;
};

const printLines = (toPrint, prefix) => {
    const lines = toPrint.toString().split("\n");
    log(lines.map(line => `${prefix}${line}`).join("\n"), "");
};

export interface ICommandOptions {
    mute: boolean;
    muteStdout: boolean;
    cwd: string;
    shell: boolean;
}

export class CommandError extends Error {
    constructor(readonly output: string, readonly originalError: Error) {
        super("Command failed.");
    }
}

export const runCommand = async (command: string, args: string[] = [], options: Partial<ICommandOptions> = {}): Promise<{output: string}> => {
    const commandPromise = spawn(command, args, options );
    const childProcess = commandPromise.childProcess;
    const { stdout, stderr, pid } = childProcess;
    let collectedOutput = "";
    const handleOutput = (data, prefix, mute) => {
        const newData = data.toString();
        collectedOutput += newData;
        if (mute) {
            return;
        }
        printLines(newData, prefix);
    };
    const muteStdout = options.mute || options.muteStdout;
    const muteStderr = options.mute;
    stdout.on("data", data => handleOutput(data, `[stdout-${pid}]: `, muteStdout));
    stderr.on("data", data => handleOutput(data, `[stderr-${pid}]: `, muteStderr));
    try {
        await commandPromise;
        return {
            output: collectedOutput
        };
    } catch (err) {
        throw new CommandError(collectedOutput, err);
    }
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function main<T> (body: () => Promise<T>) {
    return body().then(
        () => {
            log("All done!");
            process.exit(0);
        },
        (error) => {
            log("!!! Something went wrong.");
            // eslint-disable-next-line no-console
            console.error(error);
            process.exit(1);
        }
    );
}