/* eslint-disable no-console */
import * as readline from "readline";
import { bold, dim, error, ok, panic } from "@binders/client/lib/util/cli";
import { cpSync, existsSync, mkdirSync, readFileSync  } from "fs";
import AzureClient from "../storage/azure/AzureClient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { inspect } from "util";

const log = (msg = "") => console.log(msg);
const debug = (errorObject: unknown) => inspect(errorObject, { showHidden: false, depth: null, colors: false });
const debugVar = (name: string, value: unknown) => console.log(dim(`${name} =`), bold(dim(debug(value))));

const NEWLINE = "\n";
const SCRIPT_NAME = "downloadOriginalVideos";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Download original videos from v2 storage account")
    .option("--visualIds [visualId...]", "Comma-separated list of visualIds")
    .option("--file [path]", "Path to a file containing visualIds on each line")
    .option("--stdin", "Read the visualIds from stdin")
    .option("--output-dir [dir]", "Directory path for downloading the files")
    .option("--no-color", "If set, will not output colors (handled automatically by chalk)")
    .option("-d, --dry-run", "If set, will not download anything")
    .option("-q, --quiet", "If set, will not print debugging info");

program.parse(process.argv);
const options: ScriptOptions = program.opts();

if (!options.quiet) {
    debugVar("options", options);
}

type ScriptOptions = {
    color?: boolean;
    dryRun?: boolean;
    env?: string;
    file?: string;
    namespace?: string;
    outputDir?: string;
    quiet?: boolean;
    stdin?: boolean;
    visualIds?: string;
};

const doIt = async () => {
    if (!options.quiet) debugVar("options", options);

    if (!options.outputDir) panic("Missing --output-dir");
    if (!options.file && !options.stdin && !options.visualIds) panic("Either --visualIds, --file, or --stdin must be specified");

    let visualIds: string[] = [];
    if (options.visualIds?.length) {
        log("==> Using visualIds passed in command option");
        visualIds = options.visualIds.split(",");
    } else {
        if (options.file) {
            log(`==> Loading from file ${options.file}`);
            visualIds = readFileSync(options.file).toString().split(NEWLINE);
        } else if (options.stdin) {
            log("==> Reading from stdin");
            visualIds = (await readStdin()).split(NEWLINE);
        }
    }
    visualIds = visualIds.map(v => v.trim()).filter(v => v.length);

    if (!options.quiet) debugVar("visualIds", visualIds);

    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);
    const azureClientV2 = new AzureClient(
        logger,
        config.getString("azure.blobs.videos-v2.account").get(),
        config.getString("azure.blobs.videos-v2.accessKey").get(),
    );

    if (!options.dryRun && !existsSync(options.outputDir)) {
        log(`===> Creating directory ${options.outputDir}`);
        mkdirSync(options.outputDir);
    }

    for (const visualId of visualIds) {
        log(`===> Visual ID: ${visualId}`);
        try {
            const targetPath = `${options.outputDir}/${visualId}`;
            if (!options.dryRun) {
                const localCopy = await azureClientV2.getLocalCopy(visualId, "ORIGINAL");
                log(`===> Visual ${visualId} downloaded to ${localCopy.path}`);
                log(`     Moving to ${targetPath}`);
                // renameSync wouldn't work, because /tmp and target directory might be on different mountpoints
                // from man rename at https://man7.org/linux/man-pages/man2/rename.2.html
                // EXDEV oldpath and newpath are not on the same mounted filesystem. (Linux permits a filesystem to be mounted at multiple points, but rename() does not work across different mount points, even if the same filesystem is mounted on both.)
                cpSync(localCopy.path, targetPath);
                localCopy.cleanup();
            }
            console.log(targetPath);
        } catch (ex) {
            error(`Failed to download ORIGINAL of Visual ${visualId}`);
            error(inspect(ex));
        }
        process.stderr.write(NEWLINE);
    }
}

async function readStdin(): Promise<string> {
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        let inputData = "";
        rl.on("line", (line) => {
            inputData += line + "\n";
        });
        rl.on("close", () => {
            resolve(inputData);
        });
    })
}

doIt()
    .then(() => {
        ok("All done!");
        process.exit(0);
    })
    .catch(ex => {
        error(inspect(ex));
        process.exit(1);
    });
