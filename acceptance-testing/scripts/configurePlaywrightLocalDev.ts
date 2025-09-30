/* eslint-disable no-console */
import { run, updateConfig } from "../playwright/helpers/config";
import { join } from "path";
import { tmpdir } from "os";


async function getServiceContainerIds(serviceName) {
    const ids = await run (`docker ps -f "name=${serviceName}" -q`);
    return ids.trim().split("\n").filter(id => id);
}

async function getTrackingContainerId() {
    const containerIds = await getServiceContainerIds("tracking-v1");
    return containerIds[0];
}

async function getConfigFromK8s() {
    const containerId = await getTrackingContainerId();
    if (containerId == null) {
        throw new Error("No tracking service container found. Is your environment running?");
    }
    const localPath = join(tmpdir(), "development.json");
    const dockerPath = `${containerId}:/etc/binders/development.json`;
    await run(`docker cp --follow-link ${dockerPath} ${localPath}`);
    return localPath;
}


async function doIt() {
    const localFile = await getConfigFromK8s();
    await updateConfig(localFile);
}

doIt().then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)