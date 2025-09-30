/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "./commands";
import { dumpYaml, yamlStringify } from "./yaml";
import { dumpFile } from "./fs";
import { unlinkSync } from "fs";

// az aks get-versions --location westeurope --output table
// https://storage.googleapis.com/kubernetes-release/release/stable.txt
export const KUBERNETES_VERSION = "1.12.7";
export const KUBERNETES_API_VERSION = "1.10";

export const shortenBranchName = b => b.substr(0, 16)
    .replace(/[/_]/g, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .toLowerCase();
export const shortenCommitRef = c => c.substr(0, 8).toLowerCase();

export const extractBodyFromApiResult = (apiResult) => {
    if (apiResult.statusCode !== 200) {
        // eslint-disable-next-line no-console
        console.log(apiResult);
        throw new Error("API call failed");
    }
    return apiResult.body;
};

export const runKubeCtlFile = async (file: string, create: boolean, namespace?: string): Promise<void> => {
    const verb = create ? "create" : "apply";
    const args = [verb, "-f", file];
    if (namespace) {
        args.push("-n", namespace);
    }
    await buildAndRunCommand( () => buildKubeCtlCommand(args));
};

export const dumpAndRunKubeCtl = async (k8sObject, tmpFileName, create = true, unlink = true): Promise<void> => {
    const tmpFile = `/tmp/${tmpFileName}`;
    await dumpYaml(k8sObject, tmpFile);
    await runKubeCtlFile(tmpFile, create);
    if (unlink) {
        unlinkSync(tmpFile);
    }
};

export const getKubeCtlDecodedJson = async (args: string[]) => {
    const { output } = await buildAndRunCommand(
        () => buildKubeCtlCommand(["-o", "json", ...args]),
        { mute: true }
    );
    return JSON.parse(output);
};

export const waitForPod = async (podName: string): Promise<void> => {
    const args = [
        "wait", "--for=condition=Ready", `pod/${podName}`
    ];
    await buildAndRunCommand( () => buildKubeCtlCommand(args));
};

export async function createK8sResources(clusterName: string, fileName: string, namespace: string, resources: unknown[]) {
    const fileContents = resources
        .map(resource => yamlStringify(resource))
        .join("\n---\n");
    const file = `/tmp/${fileName}.yaml`;
    await dumpFile(file, fileContents);
    await runGetKubeCtlConfig(clusterName, true)
    await runKubeCtlFile(file, false, namespace);
}