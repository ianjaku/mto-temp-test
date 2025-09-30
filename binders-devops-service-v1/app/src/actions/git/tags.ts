/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { runCommand } from "../../lib/commands";

const TAG_DATE_SEPARATOR = " / ";

export const regexForBranch = (branch) => new RegExp(`^${branch}-([0-9a-f]+|full-.*)$`);

export const getAllTagsWithDate = async (pattern: RegExp , repoRoot?: string) => {
    // git for-each-ref --sort=taggerdate --format '%(refname)' refs/tags
    const { output } = await runCommand(
        "git",
        [ "for-each-ref", "--sort=taggerdate", "--format", `%(refname)${TAG_DATE_SEPARATOR}%(taggerdate)`, "refs/tags"],
        { mute: true, cwd: repoRoot }
    );
    return output.trim()
        .split("\n")
        .map( line => (
            line.startsWith("refs/tags/") ? line.substr("refs/tags/".length) : line
        ))
        .filter(tagWithDate => {
            const tag = tagWithDate.split(TAG_DATE_SEPARATOR)[0];
            return tag.match(pattern) !== null;
        });
};

export interface DatedTag {
    name: string;
    date: Date;
}

export async function getAllDatedTags (pattern: RegExp, repoRoot: string): Promise<DatedTag[]> {
    const allTagsWithDate = await getAllTagsWithDate(pattern, repoRoot);
    return allTagsWithDate.map(twd => {
        const parts = twd.split(TAG_DATE_SEPARATOR);
        return {
            name: parts[0],
            date: new Date(parts[1])
        }
    })
}

export const getAllTags = async (pattern: RegExp) => {
    const allTagsWithDate = await getAllTagsWithDate(pattern);
    return allTagsWithDate.map(twd => twd.split(TAG_DATE_SEPARATOR)[0]);
};

export const findMostRecentTag = async (prefix: RegExp)  => {
    const allTagsWithDate = await getAllTagsWithDate(prefix);
    const mostRecentTagWithDate = allTagsWithDate.pop();
    return mostRecentTagWithDate && mostRecentTagWithDate.split(TAG_DATE_SEPARATOR)[0];
};

export const getMostRecentTagDate = async (pattern: RegExp) => {
    const allTagsWithDate = await getAllTagsWithDate(pattern);
    const mostRecentTagWithDate = allTagsWithDate.pop();
    const isoDateString = mostRecentTagWithDate && mostRecentTagWithDate.split(TAG_DATE_SEPARATOR)[1];
    return isoDateString && new Date(isoDateString);
};


async function runGitTagCommand(args: string[], failIfExists = true): Promise<boolean> {
    try {
        await runCommand("git", args);
        return true;
    } catch (ex) {
        const pattern = /tag.*already exists/;
        if (!failIfExists && ex.output && ex.output.match(pattern)) {
            return false;
        }
        throw ex;
    }
}
export const tagHead = async (newTag: string, tagMessage: string, failIfExists = true) => {
    return runGitTagCommand(["tag", "-a", newTag, "-m", tagMessage], failIfExists);
};

export const pushTag = async (tag: string, failIfExists = true) => {
    return runGitTagCommand(["push", "--no-verify", "origin", tag], failIfExists);
};