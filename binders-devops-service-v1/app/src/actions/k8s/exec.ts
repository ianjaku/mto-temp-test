// eslint-disable-next-line @typescript-eslint/no-var-requires
const stringArgv = require("string-argv");

import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";

export interface ExecOptions {
    namespace?: string;
    interactive?: boolean;
}

export const runExec = async (pod: string, commandToExec: string, options: ExecOptions = {} ): Promise<{output: string}>  => {
    const args = [
        "exec"
    ];
    if (options.interactive) {
        args.push("-it");
    }
    args.push(pod);
    if (options.namespace) {
        args.push("--namespace", options.namespace);
    }
    args.push("--", ...stringArgv(commandToExec, "", ""));
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
};