import type { KubeConfig, V1PodDisruptionBudgetSpec } from "@kubernetes/client-node";
import { buildAndRunCommand, buildKubeCtlCommand } from "../commands";
import { createPolicyV1Api } from "../../actions/k8s-client/util";
import log from "../logging";

export async function createOrUpdatePdb(kc: KubeConfig, name: string, namespace: string, spec: V1PodDisruptionBudgetSpec): Promise<void> {
    const k8sApi = await createPolicyV1Api(kc);
    try {
        await k8sApi.readNamespacedPodDisruptionBudget({ name, namespace });
        log(`Updating existing PodDisruptionBudget: ${name}`);
        await k8sApi.replaceNamespacedPodDisruptionBudget({
            name,
            namespace,
            body: {
                metadata: {
                    name: name,
                    namespace: namespace,
                },
                spec: spec,
            }
        });
        log(`PodDisruptionBudget updated: ${name}`);
    } catch (error) {
        if (error.code === 404) {
            log(`Creating new PodDisruptionBudget: ${name}`);
            await k8sApi.createNamespacedPodDisruptionBudget({
                namespace,
                body: {
                    metadata: {
                        name: name,
                        namespace: namespace,
                    },
                    spec: spec,
                }
            });
            log(`PodDisruptionBudget created: ${name}`);
        } else {
            log("Error managing PodDisruptionBudget:", error);
        }
    }
}

export function getPodDisruptionBudgetSpec(labelKey: string, labelValue: string): V1PodDisruptionBudgetSpec {
    return {
        maxUnavailable: 1,
        selector: {
            matchLabels: {
                [labelKey]: labelValue
            },
        },
    };
}


interface PodDisruptionBudgetConfig {
    deploymentName: string;
    maxUnavailable?: number;
    minAvailable?: number;
    podSelector: string
}

interface PodDisruptionBudget {
    apiVersion: string;
    kind: string;
    metadata: {
        name: string;
    };
    spec: {
        selector: {
            matchLabels: {
                component: string;
            };
        };
        maxUnavailable?: number;
        minAvailable?: number;
    };
}

export function getPDBName(deploymentName: string): string {
    return deploymentName.replace("deployment", "pdb")
}

export function createPDB(config: PodDisruptionBudgetConfig): PodDisruptionBudget {
    return {
        apiVersion: "policy/v1",
        kind: "PodDisruptionBudget",
        metadata: {
            name: getPDBName(config.deploymentName),
        },
        spec: {
            selector: {
                matchLabels: {
                    component: config.podSelector,
                },
            },
            ...(config.maxUnavailable !== undefined && {
                maxUnavailable: config.maxUnavailable,
            }),
            ...(config.minAvailable !== undefined && {
                minAvailable: config.minAvailable,
            }),
        },
    };
}

export async function deletePDB(name: string, namespace: string): Promise<void> {
    const args = ["delete", "pdb", name];
    if (namespace) {
        args.push("-n", namespace);
    }
    try {
        await buildAndRunCommand(
            () => buildKubeCtlCommand(args),
            { mute: true }
        );
    } catch (exc) {
        if (exc?.output?.indexOf("(NotFound)") > -1) {
            return;
        }
        throw exc;
    }
}