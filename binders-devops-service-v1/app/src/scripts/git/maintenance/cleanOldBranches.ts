import { main, runCommand } from "@binders/binders-service-common/lib/util/process";
import { info } from "@binders/client/lib/util/cli";
import { listBranchesToDelete } from "./config";

const DRY_RUN = false;

async function cleanOldBranches(repoRoot: string): Promise<void> {
    const branchesToRemove = await listBranchesToDelete(repoRoot, false);
    info(`Going to delete ${branchesToRemove.length} branches`);
    info(JSON.stringify(branchesToRemove, null, 2));
    if (!DRY_RUN) {
        await runCommand(
            "git", [ "branch", "-D", ...branchesToRemove ],
            { cwd: repoRoot, mute: true }
        );
    }
}


main( async () => {
    const repoRoot = process.env.GIT_TARGET_FOLDER;
    if (! repoRoot) {
        throw new Error("GIT_TARGET_FOLDER env var not set");
    }
    await cleanOldBranches(repoRoot);
});