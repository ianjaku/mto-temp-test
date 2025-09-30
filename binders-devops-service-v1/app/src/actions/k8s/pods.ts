/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";
import log from "../../lib/logging";

export const listPods = async (prefix = "", namespace?: string ) => {
    const args = ["get", "pods"];
    if (namespace) {
        args.push("-n", namespace);
    } else {
        args.push("--all-namespaces");
    }
    const {items: pods} = await getKubeCtlDecodedJson(args);
    if (!prefix) {
        return pods;
    }
    return filterPodsByNamePrefix(pods, prefix);
};

const filterPodsByNamePrefix = (pods, prefix) => {
    return pods.filter(pod => pod.metadata.name.startsWith(prefix));
};
const filterPodsByStatus = (pods, status) => {
    return pods.filter(pod => pod.status.phase === status);
};

async function getPodReadiness(name: string, namespace: string): Promise<boolean> {
    const args = ["get", "pod", name, "--namespace", namespace, "--output", "jsonpath={..status.conditions[?(@.type==\"Ready\")].status}"]
    try {
        const result = await buildAndRunCommand(() => buildKubeCtlCommand(args));
        return result?.output && result?.output == "True";
    } catch (error) {
        return false
    }
}

export const waitForPods = async (prefix, expectedCount, namespace: string, condition?: (pod)=> boolean) => {
    const activePods = await listPods(prefix, namespace);
    const matchingNamePods = filterPodsByNamePrefix(activePods, prefix);
    const runningPods = filterPodsByStatus(matchingNamePods, "Running");
    const filteredPods = condition ? runningPods.filter(condition) : runningPods;
    const matchingPodsCount = filteredPods.length;
    const allPodsReady = await Promise.all(matchingNamePods.map(pod => getPodReadiness(pod.metadata.name, namespace)))
    if (matchingPodsCount < expectedCount || !allPodsReady.every(ready => ready === true)) {
        log(`Found ${matchingPodsCount} out of ${expectedCount} pods matching '${prefix}'. Sleeping for 5s.`);
        return new Promise( (resolve, reject) => {
            setTimeout(
                () =>
                    waitForPods(prefix, expectedCount, namespace, condition)
                        .then(resolve, reject),
                5000
            );
        });
    }
    return Promise.resolve(undefined);
};

export interface IPodDeleteOptions {
    namespace: string;
    gracePeriod: number; // In seconds
}
function buildDeleteCmdLineOptions(options:Partial<IPodDeleteOptions>): string[] {
    const result = [];
    if (options.gracePeriod) {
        result.push("--grace-period", options.gracePeriod);
    }
    return result;
}

export const deletePods = async (podNames: string[], options:Partial<IPodDeleteOptions> = {} ) => {
    const namespace = options.namespace || "default";
    const deleteOptions = buildDeleteCmdLineOptions(options);
    const args = ["delete", "pods", "-n", namespace, ...deleteOptions, ...podNames];
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};

export const copyFile = async (source: string, destination: string, namespace?: string) => {
    const args = [
        "cp", source, destination
    ];
    if (namespace) {
        args.push("-n", namespace);
    }
    return buildAndRunCommand( () => buildKubeCtlCommand(args));
};

export interface IPodOptions {
    name: string;
    image: string;
    namespace?: string;
    command?: string[];
    args?: string[];
}

export const getPodDefintion = (options: IPodOptions) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const definition: any = {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: options.name,
        },
        spec: {
            containers: [
                {
                    name: options.name,
                    image: options.image
                }
            ]
        }
    };
    if (options.namespace) {
        definition.metadata.namespace = options.namespace;
    }
    if (options.command) {
        definition.spec.containers[0].command = options.command;
    }
    if (options.args) {
        definition.spec.containers[0].args = options.args;
    }
    return definition;
};

