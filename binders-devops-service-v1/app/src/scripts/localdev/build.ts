import {
    LOCALDEV_IMAGE,
    LOCALDEV_IMAGE_DEVOPS,
    LOCALDEV_IMAGE_REPO
} from "../../actions/localdev/env";
import { doACRLogin } from "../../actions/aks/setup";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { main } from "../../lib/program";
import { realpathSync } from "fs";
import { runCommand } from "../../lib/commands";

async function runTopLevelInstall() {
    await runCommand("yarn", ["install"], { cwd: (await getLocalRepositoryRoot()) });
}

async function createDockerImage(dockerFileName: string, tag: string) {
    const dockerFolder = realpathSync(__dirname + "/../../../docker");
    const dockerFile = `${dockerFolder}/${dockerFileName}`;
    await runCommand("docker", [
        "build",
        "-t", tag,
        "-f", dockerFile,
        dockerFolder
    ]);
}

const createDockerImageDefault = () => createDockerImage("Dockerfile.localdev", LOCALDEV_IMAGE);
const createDockerImageRepo = () => createDockerImage("Dockerfile.localdev.repo", LOCALDEV_IMAGE_REPO);
const createDockerImageDevops = () => createDockerImage("Dockerfile.localdev.devops", LOCALDEV_IMAGE_DEVOPS);


main( async () => {
    await runTopLevelInstall();
    await doACRLogin()
    await createDockerImageDefault();
    await createDockerImageRepo();
    await createDockerImageDevops();
});
