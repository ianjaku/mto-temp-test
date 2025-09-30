import log from "../../lib/logging"
import { main } from "../../lib/program"
import moment from "moment";
import { runCommand } from "../../lib/commands"
import { shortenBranchName } from "../../lib/k8s"

const DAYS_TO_KEEP = 180;

interface IRemoteBranch {
    name: string;
    lastCommitDate: moment.Moment;
    staleInDays: number;
}

async function listAllRemoteBranches(): Promise<IRemoteBranch[]> {
    const { output } = await runCommand(
        "git",
        [ "branch", "-r", "--format=%(refname:short) %(committerdate)" ],
        { mute: true }
    );
    return parseRemoteBranches(output);
}

function parseGitBranchDate(dateStr: string): moment.Moment {
    return moment(dateStr, "ddd MMM DD hh:mm:ss YYYY ZZ");
}

function parseGetTagDate(dateStr: string): moment.Moment {
    return moment(dateStr, "YYYY-MMM-DD hh:mm:ss ZZ");
}

function parseGitAge(dateStr: string): number {
    const date = parseGetTagDate(dateStr);
    return moment().diff(date, "day");
}

function parseRemoteBranch(line: string): IRemoteBranch {
    const parts = line.split(" ");
    const name = parts.shift();
    const dateStr = parts.join(" ");
    const lastCommitDate = parseGitBranchDate(dateStr);
    const staleInDays = moment().diff(lastCommitDate, "day");
    return {
        name,
        lastCommitDate,
        staleInDays
    };
}

function parseRemoteBranches(data: string): IRemoteBranch[] {
    return data.split("\n")
        .filter(l => !!l)
        .filter(l => !l.startsWith("origin/HEAD"))
        .map(parseRemoteBranch);
}

function isProtectedBranch(branch: IRemoteBranch): boolean {
    const { name } = branch;
    return name === "develop" || name === "origin/develop" ||
        name === "master" || name === "origin/master";
}

function isReleaseBranch(branch: IRemoteBranch): boolean {
    const { name } = branch;
    return name.startsWith("origin/rel-") || name.startsWith("rel-");
}

function isTooRecent(branch: IRemoteBranch): boolean {
    const { staleInDays } = branch;
    return staleInDays < DAYS_TO_KEEP;
}

async function fetchAllTags() {
    const { output } = await runCommand(
        "git",
        [ "ls-remote", "--tags", "origin" ],
        { mute: true}
    );
    return output.split("\n")
        .filter(l => !!l && !l.endsWith("}"))
        .map(l => {
            const matches = l.match(/\S+\s+(\S+)/);
            if (!matches) {
                throw new Error(`Can't parse ${l}`);
            }
            return matches[1].substr("/refs/tags/".length - 1)
        })
}

const deletedItems = new Set();
let allTags;
async function getAllTags(): Promise<string[]> {
    if (!allTags) {
        allTags = await fetchAllTags();
    }
    return allTags;
}

function filterBranches(toFilter: IRemoteBranch[]): IRemoteBranch[] {
    return toFilter.filter(rb => (
        !isProtectedBranch(rb) &&
        !isReleaseBranch(rb) &&
        !isTooRecent(rb)
    ))
}

async function gitPushDelete(items: string[]) {
    log(`!!!!! git push origin --delete ${items.join(" ")}`)
    await runCommand(
        "git",
        [ "push", "origin", "--delete", ...items]
    )
    items.forEach(item => deletedItems.add(item));
}

async function deleteTags(branchToDelete: IRemoteBranch): Promise<void> {
    const tags = await getAllTags();
    const shortBranchName = shortenBranchName(branchToDelete.name.substr("origin/".length - 1));
    const branchTagsToDelete = tags
        .filter(t => t.startsWith(shortBranchName))
        .filter(t => !deletedItems.has(t));
    if (branchTagsToDelete.length === 0) {
        return;
    }
    log(`Deleting ${branchTagsToDelete.length} tags for branch ${branchToDelete.name}`);
    await gitPushDelete(branchTagsToDelete);
}

async function deleteBranch(branchToDelete: IRemoteBranch): Promise<void> {
    const { name } = branchToDelete;
    const shortName = name.substr("origin/".length);
    log(`Deleting branch ${shortName}`);
    await gitPushDelete([shortName]);
}

async function deleteBranchAndTags(branchToDelete: IRemoteBranch): Promise<void> {
    await deleteTags(branchToDelete);
    await deleteBranch(branchToDelete);
}

async function deleteBranchesAndTags(branchesToDelete: IRemoteBranch[]): Promise<void> {
    for (const branchToDelete of branchesToDelete) {
        await deleteBranchAndTags(branchToDelete);
    }
}

async function getRefAge(ref: string): Promise<number> {
    // git log -1 --format=%ai ${tag}
    const { output } = await runCommand(
        "git",
        ["log", "-1", "--format=%ai", ref],
        { mute: true }
    );
    return parseGitAge(output.trim());
}

async function filterTagsByAge(tags: string[], daysToKeep: number): Promise<string[]> {
    const results = [];
    for (const tag of tags) {
        const age = await getRefAge(tag);
        if (age > daysToKeep) {
            results.push(tag);
        }
    }
    return results;
}

async function deleteDevelopTags() {
    const allTags = await getAllTags();
    const developTags = allTags.filter(t => t.startsWith("develop-"));
    const developTagsToDelete = await filterTagsByAge(developTags, DAYS_TO_KEEP);
    log(`Deleting ${developTagsToDelete.length} tags on develop branch.`);
    await gitPushDelete(developTagsToDelete);
}

async function cleanBranches () {
    const allBranches = await listAllRemoteBranches();
    const branchesToDelete = filterBranches(allBranches);
    await deleteBranchesAndTags(branchesToDelete);
    await deleteDevelopTags();
}

main( cleanBranches );