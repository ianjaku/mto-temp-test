/* eslint-disable no-console */
import { addHelmRepo, runHelmInstall, updateHelmRepoCache } from "../../actions/helm/install";
import { existsSync, lstatSync } from "fs";
import { Command } from "commander";
import { main } from "../../lib/program";

const OP_REPO_NAME = "1password"
const OP_REPO_URL = "https://1password.github.io/connect-helm-charts"
const OP_NAME = "connect"
const OP_CHART = "1password/connect"
const NAMESPACE = "monitoring"
const SCRIPTNAME = "installConnectServer"
const program = new Command()

program
    .name(SCRIPTNAME)
    .description("Install 1password connect server, that allows secret synchronization between 1password and k8s cluster")
    .version("0.0.1")
    .option("-d, --dry", "if set, won't install connect",)
    .option("-p, --path <path>", "path to connect credentials file", "/tmp/1password-credentials.json")

const options = program.parse(process.argv).opts()

function isValidPath(path) {
    return existsSync(path) && lstatSync(path).isFile();
}

main(async () => {
    if (!process.env.OP_CONNECT_TOKEN) {
        console.error("Error: OP_CONNECT_TOKEN environment variable is not set.");
        process.exit(1);
    }
    console.log(options.path, !isValidPath(options.path), options.path && !isValidPath(options.path))
    if (options.path && !isValidPath(options.path)) {
        console.error(`Error: The provided path '${options.path}' does not exist or is not a file.`);
        process.exit(1);
    }

    await addHelmRepo(OP_REPO_NAME, OP_REPO_URL)
    await updateHelmRepoCache()
    if (!options.dry) {
        const extraValues = {
            "operator.create": true,
            "operator.token.value": process.env.OP_CONNECT_TOKEN
        }
        const extraFile = {
            "connect.credentials": options.path
        }
        await runHelmInstall(OP_CHART, OP_NAME, ".", undefined, NAMESPACE, extraValues, undefined, false, extraFile)
    }
});
