import { buildAndRunCommand } from "../../lib/commands";
import log from "../../lib/logging";

export async function getCurrentBranch (repoRoot?: string): Promise<string> {
    const options = repoRoot ? { cwd: repoRoot } : {};
    const { output } = await buildAndRunCommand(
        () => ({ command: "git", args: ["rev-parse", "--abbrev-ref", "HEAD"] }),
        { mute: true, ...options }
    );
    return output.trim();
}

export const createAndPushReleaseBranch = async (sourceBranch: string, branchName: string, mute = false): Promise<void> => {
    const currentBranch = await getCurrentBranch();
    if (currentBranch !== sourceBranch) {
        log(`Checking out source branch: ${sourceBranch}`);
        await checkoutBranch(sourceBranch, false, mute);
    }
    await pull(mute);
    await checkoutBranch(branchName, true, mute)
    await pushBranch(branchName, mute)
}

async function checkoutBranch(branchName: string, create: boolean, mute: boolean) {
    const options = create ?
        ["-b", branchName] :
        [ branchName ];
    const { output } = await buildAndRunCommand(
        () => ({ command: "git", args: ["checkout", ...options] }),
        { mute }
    );
    return output.trim();

}

async function pull(mute: boolean) {
    const { output } = await buildAndRunCommand(
        () => ({ command: "git", args: ["pull"] }),
        { mute }
    );
    return output.trim();

}

async function pushBranch(branchName: string, mute: boolean) {
    const { output } = await buildAndRunCommand(
        () => ({ command: "git", args: ["push", "--set-upstream", "origin", branchName] }),
        { mute }
    );
    return output.trim();

}