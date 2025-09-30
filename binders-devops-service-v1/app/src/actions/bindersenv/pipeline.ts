import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";

async function deletePath(toClean: string) {
    await runCommand("rm", ["-rf", toClean]);
}

async function copyFolder(src: string, dest: string) {
    await runCommand("cp", ["-r", src, dest]);
}

async function runInYarnWorkspace(repoRoot: string, workspace: string, command: string[]) {
    const cmdOptions = {
        cwd: repoRoot
    }
    await runCommand("yarn", ["workspace", workspace, ...command], cmdOptions);
}

export async function runClientTranspile(repoRoot: string): Promise<void> {
    const clientPackageFolder = `${repoRoot}/binders-client-v1`;
    log(`Transpiling client ${clientPackageFolder}`);
    await deletePath(`${clientPackageFolder}/lib`);
    await deletePath(`${clientPackageFolder}/tsconfig.tsbuildinfo`);
    await runInYarnWorkspace(repoRoot, "@binders/client", ["transpile"]);
    await copyFolder(`${clientPackageFolder}/assets`, `${clientPackageFolder}/lib`)
}

export async function runCommonTranspile(repoRoot: string): Promise<void> {
    const commonPackageFolder = `${repoRoot}/binders-service-common-v1`;
    log(`Transpiling common ${commonPackageFolder}`);
    await deletePath(`${commonPackageFolder}/lib`);
    await deletePath(`${commonPackageFolder}/tsconfig.tsbuildinfo`);
    await runInYarnWorkspace(repoRoot, "@binders/binders-service-common", ["transpile"]);
    await copyFolder(`${commonPackageFolder}/assets`, `${commonPackageFolder}/lib`)
}

export async function runUIKitTranspile(repoRoot: string): Promise<void> {
    const uiKitPackageFolder = `${repoRoot}/binders-ui-kit`;
    log(`Transpiling ui-kit ${uiKitPackageFolder}`);
    await deletePath(`${uiKitPackageFolder}/lib`);
    await deletePath(`${uiKitPackageFolder}/tsconfig.tsbuildinfo`);
    await runInYarnWorkspace(repoRoot, "@binders/ui-kit", ["transpile"]);
}
