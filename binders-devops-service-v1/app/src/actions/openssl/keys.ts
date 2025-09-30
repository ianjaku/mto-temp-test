import { dirname } from "path";
import { existsSync } from "fs";
import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";

export interface ICreateKeyOptions {
    modulus: number;
    createDirectory: boolean;
}

const DEFAULT_OPTIONS: ICreateKeyOptions = {
    modulus: 4096,
    createDirectory: false
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createKeyFile = async (path: string, options: Partial<ICreateKeyOptions> = {} ) => {
    log("Creating key file");
    const actualOptions: ICreateKeyOptions = Object.assign({}, DEFAULT_OPTIONS, options);
    if (actualOptions.createDirectory) {
        const dirName = dirname(path);
        const exists = existsSync(dirName);
        if (!exists) {
            log(`Creating directory ${dirName}`);
            await runCommand("mkdir", ["-p", dirName]);
        }
    }
    const commandArgs = [ "genrsa", "-out", path, actualOptions.modulus.toString() ];
    return runCommand("openssl", commandArgs, { mute: true });
};

