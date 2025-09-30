import { open, readFile } from "fs/promises";
import { runCommand } from "./commands";
import { warn } from "@binders/client/lib/util/cli";

export interface GitBlob {
    size: number;
    hash: string;
    file: string;
}

const lsTreeOutputFormat = /(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/;

async function listBlobsOnBranch(repoRoot: string, branch: string): Promise<GitBlob[]> {
    const { output } = await runCommand(
        "git",
        ["ls-tree", "-r", "--long", branch],
        { cwd: repoRoot, mute: true }
    );
    const lines = output.trim().split("\n");
    const blobs = [];
    for (const line of lines) {
        if (!line) {
            continue;
        }
        const matches = line.match(lsTreeOutputFormat);
        if (!matches) {
            throw new Error(`Unexpected output from git ls-tree: ${line}`);
        }
        blobs.push({
            hash: matches[3],
            size: Number.parseInt(matches[4], 10),
            file: matches[5].trimEnd()
        })
    }
    return blobs;
}

const catListOutputFormat = /'(\S+)\s+(\S+)\s+(\S+)\s+(.*)/;
async function listBlobsGlobally(repoRoot: string): Promise<GitBlob[]> {

    const revListFile = "/tmp/revlist.txt";
    const revListFileFd = await open(revListFile, "w+");
    const catFile = "/tmp/catfile.txt";

    await runCommand(
        "git", [ "rev-list", "--objects", "--all", "--missing=print"],
        { cwd: repoRoot, mute: true, stdio: ["pipe", revListFileFd, "pipe"] }
    );

    await revListFileFd.close();

    const catfileFd = await open(revListFile, "r");
    const catfileOutputFD = await open(catFile, "w+");
    await runCommand(
        "git",
        [ "cat-file", "--batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)'" ],
        { mute: true, cwd: repoRoot, stdio: [ catfileFd , catfileOutputFD, "pipe" ] }
    )

    const catFileOutput = await readFile(catFile, "utf-8");
    const catLines = catFileOutput.trim().split("\n");
    const blobs = [];
    for (const catLine of catLines) {
        if (!catLine) {
            continue;
        }
        const matches = catLine.match(catListOutputFormat);
        if (!matches) {
            throw new Error(`Unexpected output from git cat-file: ${catLine}`);
        }
        const [_, objectType, hash, size, file ] = matches;
        if (objectType === "blob") {
            if (!file) {
                warn(`No file name for blob ${hash}`);
                continue;
            }
            blobs.push({
                hash,
                size: Number.parseInt(size, 10),
                file
            });
        }
    }
    return blobs;
}

export async function listBlobs(repoRoot: string, branch: string): Promise<GitBlob[]> {
    if (branch) {
        return listBlobsOnBranch(repoRoot, branch);
    }
    return listBlobsGlobally(repoRoot)
}

export interface LargestBlobOptions{
    count?: number;
    minimalBytes?: number;
    branch?: string;
}

export async function getLargestBlobs(repoRoot: string, options: LargestBlobOptions): Promise<GitBlob[]> {
    let blobs = await listBlobs(repoRoot, options.branch);
    if (options.minimalBytes) {
        blobs = blobs.filter(blob => blob.size >= options.minimalBytes);
    }
    blobs.sort((a, b) => b.size - a.size);
    if (options.count) {
        blobs = blobs.slice(0, options.count);
    }
    return blobs;
}
