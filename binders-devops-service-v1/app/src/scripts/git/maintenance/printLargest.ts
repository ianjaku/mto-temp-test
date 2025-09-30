import { LargestBlobOptions, getLargestBlobs } from "../../../lib/git";
import { Command } from "commander";
import { getLocalRepositoryRoot } from "../../../actions/git/local";
import { humanizeBytes } from "@binders/client/lib/util/formatting";
import { info } from "@binders/client/lib/util/cli";
import { main } from "../../../lib/program";

const SCRIPT_NAME = "PrintLargestBlobs";
const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script will print the largest blobs in the repository")
    .option("-c, --count [count]", "The number of largest blobs to print")
    .option("-m, --minimalSize [minimalSize]", "The minimal size of the blobs to print. Can include units (e.g. 1MB, 1GB)")
    .option("-b, --branch [branch]", "Limit the results to the given branch")

interface ScriptOptions {
    count?: string;
    minimalSize?: string;
    branch?: string;
}

program.parse(process.argv);
const options: ScriptOptions = program.opts();


async function printLargestBlobs(repoRoot: string, options: LargestBlobOptions ): Promise<void> {
    const largetsBlobs = await getLargestBlobs(repoRoot, options);
    const suffix = options.branch ? ` in ${options.branch}` : "";
    info("");
    info(`Largest blobs${suffix}:`);
    info("");
    for (const blob of largetsBlobs) {
        info(`${humanizeBytes(blob.size)} - ${blob.file} - ${blob.hash}`);
    }
}

function getUnit(unit: string): number {
    if (unit == null) {
        return 1;
    }
    return {
        "KB": 1024,
        "MB": 1024 * 1024,
        "GB": 1024 * 1024 * 1024
    }[unit];
}

function parseSize(minSize: string): number {
    const pattern = /(\d+)([MGK]B)?/;
    const upperCasedMiminal = minSize.toUpperCase();
    const matches = upperCasedMiminal.match(pattern);
    if (!matches) {
        throw new Error(`Invalid size: ${minSize}`);
    }
    const quantity = parseInt(matches[1]);
    const unit = getUnit(matches[2]);
    return quantity * unit;
}

function buildBlobOptions(scriptOptions: ScriptOptions): LargestBlobOptions {
    const options: LargestBlobOptions = {};
    if (scriptOptions.count) {
        options.count = parseInt(scriptOptions.count);
    }
    if (scriptOptions.minimalSize) {
        options.minimalBytes = parseSize(scriptOptions.minimalSize);
    }
    if (!options.count && !options.minimalBytes) {
        options.count = 10;
    }
    if (scriptOptions.branch) {
        options.branch = scriptOptions.branch;
    }
    return options;
}

main( async () => {
    const repoRoot = await getLocalRepositoryRoot();
    const blobOptions = buildBlobOptions(options);
    await printLargestBlobs(repoRoot, blobOptions);
})