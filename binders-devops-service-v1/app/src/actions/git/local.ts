import { realpath } from "../../lib/fs";
import { runCommand } from "../../lib/commands";

let memoizedRepoRoot: string | undefined = undefined;
export const getLocalRepositoryRoot = async (): Promise<string> => {
    if (memoizedRepoRoot === undefined) {
        memoizedRepoRoot = await getRepoRoot();
    }
    return memoizedRepoRoot;
};

const getRepoRoot = async () => {
    const { output } = await runCommand(
        "git",
        ["rev-parse", "--show-toplevel"],
        { mute: true }
    );
    return realpath(output.trim());
};

export const getLocalDevopsServiceDir = async (): Promise<string> => {
    const root = await getLocalRepositoryRoot();
    return `${root}/binders-devops-service-v1`;
};