import { getAllContexts, getCurrentContext, useContext } from "../actions/k8s/kubectl";
import { openSync, unlinkSync } from "fs";
import { getResourceGroupForCluster } from "../actions/aks/cluster";
import { loadFile } from "./fs";
import log from "./logging";
import { spawn } from "child_process";
import { spawn as spawnAsync } from "child-process-promise";
import { v4 as uuidv4 } from "uuid";

const printLines = (toPrint, prefix) => {
    const lines = toPrint.toString().split("\n");
    for (const line of lines) {
        if (!line.trim().length) continue;
        log(line, prefix);
    }
};

export interface ICommandOptions {
    mute: boolean;
    muteStdout: boolean;
    redirectStderrToStdout: boolean;
    cwd: string;
    shell: boolean;
    env: {[key: string]: string};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    stdio: any;
}

export class CommandError extends Error {
    constructor(readonly output: string, readonly originalError: Error) {
        super("Command failed.");
    }
}

export interface ICommand {
    command: string,
    args: string[]
}

export class Command {

    private output;
    private childProcess;
    private outputFile;

    constructor(readonly command: string, readonly args: string[] = [], readonly options: Partial<ICommandOptions> = {}) {
        this.output = "";
    }

    private addToOutput(extraContent) {
        this.output += extraContent;
    }

    private setupLogging() {
        const { stdout, stderr, pid } = this.childProcess;
        const pLog = this.addToOutput.bind(this);
        const handleOutput = (data, prefix, mute) => {
            const newData = data.toString();
            pLog(newData);
            if (mute) {
                return;
            }
            printLines(newData, prefix);
        };
        const muteStdout = this.options.mute || this.options.muteStdout;
        const muteStderr = this.options.mute;
        if (!this.options.redirectStderrToStdout) {
            stdout?.on("data", data => handleOutput(data, `[stdout-${pid}]`, muteStdout));
            stderr?.on("data", data => handleOutput(data, `[stderr-${pid}]`, muteStderr));
        }
    }

    async run(): Promise<{output: string}> {
        if (this.options.redirectStderrToStdout) {
            this.outputFile = `/tmp/${uuidv4()}`;
            const outputFd = openSync(this.outputFile, "w");
            this.options.stdio = ["inherit", outputFd, outputFd];
        }
        const commandPromise = spawnAsync(this.command, this.args, this.options);
        this.childProcess = commandPromise.childProcess;
        this.setupLogging();
        try {
            await commandPromise;
            if (this.outputFile) {
                const output = await loadFile(this.outputFile);
                unlinkSync(this.outputFile);
                return { output };

            }
            return {
                output: this.output
            };
        } catch (err) {
            throw new CommandError(this.output, err);
        }
    }

    runInBackground(): void {
        this.childProcess = spawn(this.command, this.args, this.options);
        this.setupLogging();
    }

    kill(): void {
        if (this.childProcess) {
            this.childProcess.kill("SIGKILL");
        }
    }
}
export const runCommand = async (command: string, args: string[] = [], options: Partial<ICommandOptions> = {}): Promise<{output: string}> => {
    const cmd = new Command(command, args, options);
    return cmd.run();
};

export const buildAndRunCommand = async (build: () => {command: string, args: string[]}, options: Partial<ICommandOptions> = {}): Promise<{output: string}>  => {
    const { command, args } = build();
    return runCommand(command, args, options);
};

export const buildAzCommand = (args: string[]): ICommand => ({
    command: "az",
    args
});

export const buildKubeCtlCommand = (args: string[]): ICommand => ({
    command: "kubectl",
    args
});

export const buildHelmCommand = (args: string[]): ICommand => ({
    command: "helm",
    args
});

export const buildDockerCommand = (args: string[]): ICommand => ({
    command: "docker",
    args
})

export const buildXdgOpenCommand = (args: string[]): ICommand => ({
    command: "xdg-open",
    args
})

export const buildCommandLineOptions = (validKeys: string[]): Record<string, string> => {
    const options = {};
    for (let i = 2; i < process.argv.length; i = i + 2) {
        const keyCandidate = process.argv[i];
        const valueCandidate = process.argv[i + 1];
        if (keyCandidate === undefined || valueCandidate === undefined) {
            log("Invalid usage: 'key value'");
            log("Valid keys are: " + JSON.stringify(validKeys));
            process.exit(1);
        }
        if (validKeys.indexOf(keyCandidate) === -1) {
            log("Invalid key: " + keyCandidate);
            process.exit(1);
        }
        options[keyCandidate] = valueCandidate.toString();
    }
    return options;
};

const buildGetKubeCtlConfigCommand = (clusterName, admin = true) => {
    const resourceGroup = getResourceGroupForCluster(clusterName)
    const args = [
        "aks", "get-credentials",
        "--name", clusterName,
        "--resource-group",
        resourceGroup
    ];
    if (admin) {
        args.push("--admin");
    }
    return buildAzCommand(args);
};


export const runGetKubeCtlConfig = async (clusterName: string, admin = true): Promise<void> => {
    const currentContext = await getCurrentContext();
    const contextName = (clusterName && admin) ? `${clusterName}-admin` : clusterName;
    if (currentContext && contextName === currentContext) {
        return;
    }
    const allContexts = await getAllContexts();
    if (allContexts.includes(contextName)) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        await useContext(contextName);
        return;
    }
    log(`Fetching new context ${contextName}`);
    await buildAndRunCommand( () => buildGetKubeCtlConfigCommand(clusterName, admin) );
};
