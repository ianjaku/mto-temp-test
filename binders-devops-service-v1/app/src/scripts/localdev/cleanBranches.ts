import { getLocalRepositoryRoot } from "../../actions/git/local"
import { log } from "../../lib/logging"
import { main } from "../../lib/program"
import { runCommand } from "../../lib/commands"

const getLocalBranches = async (): Promise<string[]> => {
    const repoRoot = await getLocalRepositoryRoot();
    const { output } = await runCommand(
        "git",
        ["for-each-ref", "--format='%(refname:short)'", "refs/heads/"],
        { cwd: repoRoot, mute: true }
    );
    return output
        .split("\n")
        .map(b => b.trim())
        .filter(b => !!b)
        .map(b => b.replace(/^'(.*)'$/, "$1"))
        .filter(b =>
            !!b.match(/^MT-/) ||
            !!b.match(/^fix-/) ||
            !!b.match(/^fix\//) ||
            !!b.match(/^hotfix-/) ||
            !!b.match(/^hf-/)
        );
}

const removeLocalBranches = async (branches: string[]): Promise<void> => {
    if (branches.length === 0) {
        log("Nothing to delete.");
        return;
    }
    log(`Going to delete ${branches.length} branches:`)
    log(`\t${branches.join(", ")}`);
    await runCommand("git", ["branch", "-d", ...branches]);
}

const protectedBranches = [
    "develop", "master"
];

const doIt = async () => {
    const localBranches = await getLocalBranches();
    const filteredBranches = localBranches.filter(b =>
        !protectedBranches.includes(b) &&
        !b.startsWith("rel-")
    );
    await removeLocalBranches(filteredBranches);
}

main(doIt);