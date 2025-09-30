import { info } from "@binders/client/lib/util/cli";
import { runCommand } from "@binders/binders-service-common/lib/util/process";
import { subDays } from "date-fns";

export const BRANCHES_TO_MAINTAIN = [
    "develop",
    "rel-november-24",
    "rel-december-24",
    "MT-5118-add-cert-manager-annotation-for-",
    "MT-5109/flux-reader-user-store",
    "inno/vite-manage"
];

export const BRANCHES_TO_PURGE = [
    /snyk-fix-.*/
];

export const FILES_TO_PURGE = new Set([
    "azure-functions/screenshots/ffmpeg",
    "dev-tools/sort-imports/sort-imports-0.0.1.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.2.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.3.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.4.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.5.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.6.vsix",
    "dev-tools/sort-imports/sort-imports-0.0.7.vsix",
    "docs/setup/mongo_2018_01_15.tar",
    "docs/setup/mongo_2017.09.01.tar",
    "staging/staging/staging.json",
    "staging/tom/tom.json",
    "ts_project_template.tar"
]);

export const PATTERNS_TO_PURGE = [
    /.*\/config\/(staging|tom|local|development|production).json/,
    /.*\/3rd-party\/.*/
];

export const CUTOFF_IN_DAYS = 30;

export interface Branch {
    name: string;
    lastCommitDate: Date;
}

export type BranchFilter = "keep" | "remove";

interface BranchListOptions {
    useRemoteBranches: boolean;
    filter: BranchFilter;
}

const keepFilter = (branch: Branch) => {
    const cutoffDate = subDays(new Date(), CUTOFF_IN_DAYS);
    const toMaintainSet = new Set(BRANCHES_TO_MAINTAIN.map(b => `origin/${b}`))
    if (toMaintainSet.has(branch.name)) {
        return true;
    }
    if (BRANCHES_TO_PURGE.some(b => branch.name.match(b))) {
        return false;
    }
    return branch.lastCommitDate > cutoffDate;
}


function getFilter(filter: BranchFilter): (branch: Branch) => boolean {
    return filter === "keep" ?
        keepFilter :
        b => !keepFilter(b);
}

export function listBranchesToKeep(repoRoot: string, useRemoteBranches: boolean): Promise<string[]> {
    const options: BranchListOptions = { useRemoteBranches, filter: "keep" };
    return listBranches(repoRoot, options);
}

export function listBranchesToDelete(repoRoot: string, useRemoteBranches: boolean): Promise<string[]> {
    const options: BranchListOptions = { useRemoteBranches, filter: "remove" };
    return listBranches(repoRoot, options);
}

async function listBranches(repoRoot: string, options: BranchListOptions): Promise<string[]> {
    const args = [ "branch" ];
    if (options.useRemoteBranches) {
        args.push("-r");
    }
    const { output: gitBranchOutput } = await runCommand(
        "git", args,
        { cwd: repoRoot, mute: true }
    );
    const allBranches = gitBranchOutput
        .trim()
        .split("\n")
        .filter(b => !!b && !b.includes("HEAD"))
        .map(b => b.trim())
        .map(b => b.replace(/^\* /, ""));
    const branchesToKeep = [];
    for (const remoteBranch of allBranches) {
        const { output: gitShowOutput } = await runCommand(
            "git", ["show", "--format=%cd", "-q", remoteBranch],
            { cwd: repoRoot, mute: true }
        );
        const branchDate = new Date(gitShowOutput.trim());
        const filter = getFilter(options.filter);
        if (filter({ name: remoteBranch, lastCommitDate: branchDate })) {
            info(`**** Keeping branch ${remoteBranch} ****`);
            branchesToKeep.push(remoteBranch);
        } else {
            info(`---- Skipping branch ${remoteBranch} ----`);
        }
    }
    return branchesToKeep;
}