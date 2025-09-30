import { FILES_TO_PURGE, PATTERNS_TO_PURGE, listBranchesToKeep } from "./config";
import { main, runCommand } from "@binders/binders-service-common/lib/util/process";
import { readFile, writeFile } from "fs/promises";
import { getCurrentBranch } from "../../../actions/git/branches";
import { info } from "@binders/client/lib/util/cli";
import { listBlobs } from "../../../lib/git";
import { tmpdir } from "os";

const GIT_LOGS_IN_PARALLEL = 10;


function shouldBuildRenameHistory(fileName: string): boolean {
    return !fileName.startsWith(".yarn") &&
        !fileName.endsWith(".zip");
}

async function addRelevantFiles(
    branch: string,
    branchFileNamesToKeep: Array<string>,
    allFileNamesToKeep: Set<string>,
    repoRoot: string
): Promise<void> {
    let processed = 0;
    const allBranchFiles = new Set<string>();
    for (const fileName of branchFileNamesToKeep.values()) {
        if (processed % 500 === 0) {
            info(`Processed ${processed} / ${branchFileNamesToKeep.length} files (${processed / branchFileNamesToKeep.length * 100}%)`);
        }
        processed++;
        allBranchFiles.add(fileName);
        if (allFileNamesToKeep.has(fileName)) {
            continue;
        }

        if (!shouldBuildRenameHistory(fileName)) {
            allFileNamesToKeep.add(fileName);
            continue;
        }

        const { output } = await runCommand(
            "git",
            ["log", "--name-only", "--pretty=format:", "--follow", fileName.replace(/ /g, "\\ ")],
            { cwd: repoRoot, mute: true }
        );
        const lines = output.split("\n");
        lines.forEach( line => {
            const cleaned = line.trim();
            const keepLine = cleaned !== "" && !shouldFileBePurged(cleaned);
            if (keepLine) {
                allBranchFiles.add(cleaned);
                allFileNamesToKeep.add(cleaned);
            }
        })
    }
    const branchFilesFileNameInfix = branch.replace("origin/", "").replace("/", "-");
    const branchFilesFileName = tmpdir() + `/gitFilesToKeep-${branchFilesFileNameInfix}.txt`;
    await writeFile(branchFilesFileName, Array.from(allBranchFiles).sort().join("\n"));
}

function shouldFileBePurged(fileName: string): boolean {
    if(FILES_TO_PURGE.has(fileName)) {
        return true;
    }
    for (const pattern of PATTERNS_TO_PURGE) {
        if (pattern.test(fileName)) {
            return true;
        }
    }
    return false;
}




async function buildFilesToKeep(repoRoot: string): Promise<string> {
    const fileNamesToKeep = new Set<string>();
    for (const branch of await listBranchesToKeep(repoRoot, true)) {
        info(`Processing branch ${branch}`);
        await runCommand("git", ["checkout", branch], { cwd: repoRoot, mute: true });
        const filesOnBranch = new Set<string>();
        const blobsOnBranch = await listBlobs(repoRoot, branch);
        for (const blob of blobsOnBranch) {
            if (!shouldFileBePurged(blob.file)) {
                filesOnBranch.add(blob.file);
            } else {
                info(`Removing ${blob.file} (in purge list)`);
            }
        }
        const branchFileNameChunks = [];
        for (let i=0; i < GIT_LOGS_IN_PARALLEL; i++) {
            branchFileNameChunks.push([]);
        }

        let i = 0;
        for(const fileOnBranch of filesOnBranch.values()) {
            branchFileNameChunks[i].push(fileOnBranch);
            i = (i + 1) % GIT_LOGS_IN_PARALLEL;
        }
        await Promise.all(
            branchFileNameChunks.map(chunk => addRelevantFiles(branch, chunk, fileNamesToKeep, repoRoot))
        );
    }
    const fileName = tmpdir() + "/gitFilesToKeep.txt";
    const sortedFileNames = Array.from(fileNamesToKeep).sort();
    await writeFile(fileName, Array.from(sortedFileNames).join("\n"));
    return fileName;
}

async function pruneHistory(fileName: string): Promise<void> {
    // python3 git-filter-repo --paths-from-file /tmp/gitFilesToKeep.txt --force # --dry-run
    info(await readFile(fileName, "utf-8"));
}

main( async () => {
    const repoRoot = process.env.GIT_TARGET_FOLDER;
    if (! repoRoot) {
        throw new Error("GIT_TARGET_FOLDER env var not set");
    }
    await runCommand("git", ["pull"], { cwd: repoRoot });
    const currentBranch = await getCurrentBranch(repoRoot);
    try {
        const fileName = await buildFilesToKeep(repoRoot);
        await pruneHistory(fileName);
    } finally {
        await runCommand("git", ["checkout", currentBranch], { cwd: repoRoot });
    }
})