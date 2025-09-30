/* eslint-disable no-console */
import { run, updateConfig } from "../playwright/helpers/config";
import { join } from "path";
import { tmpdir } from "os";

async function getTrackingServicePod(namespace: string): Promise<string> {
    const output = await run(`kubectl get pods -n ${namespace} -o json`);
    const podList = JSON.parse(output);
    for (const pod of podList.items) {
        if (pod.metadata.name.includes("tracking-v1")) {
            console.log(pod.metadata.name);
            return pod.metadata.name;
        }
    }
    throw new Error("No tracking service pod found. Is your environment running?");
}

async function getConfigFromK8s(namespace: string): Promise<string> {
    const trackingServicePod = await getTrackingServicePod(namespace);
    const localFile = join(tmpdir(), "development.json");
    console.log(`kubectl -n ${namespace} exec ${trackingServicePod} cp /etc/binders/staging.json  ${localFile}`)
    // we need to copy the file first using `kubectl exec`
    // because `kubectl cp` doesn't work with symlinks
    await run(`kubectl -n ${namespace} exec ${trackingServicePod} cp /etc/binders/staging.json ${localFile}`)
    await run(`kubectl -n ${namespace} cp ${trackingServicePod}:${localFile} ${localFile}`);
    console.log(`Copied staging.json from ${trackingServicePod} to ${localFile}`);
    return localFile;
}

async function doIt(namespace: string) {
    if (namespace == null) {
        throw new Error("Usage: configurePlaywrightStaging.ts <staging namespace>");
    }
    const localFile = await getConfigFromK8s(namespace);
    await updateConfig(localFile);
}

doIt(process.argv[2]).then(
    () => {
        console.log("All done!");
        process.exit(0);
    },
    err => {
        console.error(err);
        process.exit(1);
    }
)