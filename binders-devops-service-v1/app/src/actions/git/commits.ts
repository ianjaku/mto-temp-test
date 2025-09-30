/* eslint-disable @typescript-eslint/explicit-module-boundary-types */


import { runCommand } from "../../lib/commands";

export const findMergeBase = async (branchToMerge: string, originalBranch: string) => {
    const { output } = await runCommand("git", ["merge-base", `origin/${branchToMerge}`, `origin/${originalBranch}`]);
    return output.trim();
};

export const getChangedFiles = async (fromCommitRef: string, toCommitRef: string) => {
    const { output } = await runCommand(
        "git",
        ["diff", "--name-only", fromCommitRef, toCommitRef ],
        { mute: true }
    );
    const changes = output.trim().split("\n");
    return changes;
};

export const getCommitDate = async (commitRef: string) => {
    const { output } = await runCommand(
        "git",
        ["show", "-s", "--format=%ct", commitRef],
        { mute: true }
    );
    const timestamp = 1000 * parseInt(output.trim(), 10);
    return new Date(timestamp);
};

export const getCurrentCommitRef = async () => {
    const { output } = await runCommand(
        "git",
        ["rev-parse", "HEAD"],
        { mute: true }
    );
    return output.trim();
}

export const assertUnchanged = async (cached?: boolean) => {
    if (process.env.BINDERS_BUILD_TEST === "1") {
        return;
    }
    const args = [
        "diff", "--name-only"
    ];
    if (cached) {
        args.push("--cached");
    }
    const { output } = await runCommand( "git", args, { mute: true } );
    const changedFiles = output.split("\n").filter(l => l !== "");
    if (changedFiles.length > 0) {
        throw new Error(`\n\nFound changed files (cached: ${!!cached}): \n - ${changedFiles.join("\n - ")}\n\n`);
    }

}

export const assertNoUncommitted = async () => {
    await assertUnchanged();
    await assertUnchanged(true)
}