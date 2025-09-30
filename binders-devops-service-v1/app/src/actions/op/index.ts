import type { KubeConfig, V1Secret } from "@kubernetes/client-node";
import { createCoreV1Api, createCustomObjectsApi } from "../k8s-client/util";
import { Env } from "../../lib/environment";
import { base64decode } from "../../lib/base64";
import { log } from "../../lib/logging";

export interface User {
    username: string;
    password: string;
}

export interface OnePasswordItemConfig {
    kubeConfig: KubeConfig,
    namespace: string,
    userName: string
    environment: Env,
    kind: ItemKind
}

export type ItemKind = "grafana" | "kibana" | "kibana-binders"

const OP_MONITORING_SECRET_PREFIX = "op-monitoring-secret"

export async function fetchOnePasswordSecrets(kubeConfig: KubeConfig, kind: ItemKind, namespace: string): Promise<User[]> {
    try {
        const k8sApi = await createCoreV1Api(kubeConfig);
        const secrets = await k8sApi.listNamespacedSecret({ namespace });
        return secrets.items
            .filter(secret => secret.metadata.name.startsWith(`${OP_MONITORING_SECRET_PREFIX}-${kind}`))
            .map(parseSecret);
    } catch (error) {
        log(`Error fetching secrets: ${error}`);
        return null
    }
}


export async function createOnePasswordItem(config: OnePasswordItemConfig): Promise<void> {
    const { kubeConfig, kind, namespace, userName } = config;
    const customObjectsApi = await createCustomObjectsApi(kubeConfig);
    try {
        await customObjectsApi.getNamespacedCustomObject({
            group: "onepassword.com",
            version: "v1",
            namespace,
            plural: "onepassworditems",
            name: getOnePasswordItemName(userName, kind),
        });
        log(`OnePassword item '${userName}' already exists in namespace '${namespace}'.`);
    } catch (error) {
        if (error.code === 404) {
            try {
                await customObjectsApi.createNamespacedCustomObject({
                    group: "onepassword.com",
                    version: "v1",
                    namespace,
                    plural: "onepassworditems",
                    body: buildOnePasswordItem(config),
                });
                log(`OnePassword item created for user: ${userName}`);
            } catch (createError) {
                log("Error creating OnePassword item:", createError);
            }
        } else {
            log("Error fetching OnePassword item:", error);
        }
    }
}

function getOnePasswordItemName(userName: string, kind: ItemKind): string {
    return `${OP_MONITORING_SECRET_PREFIX}-${kind}-${userName.toLowerCase()}`
}


function parseSecret(secret: V1Secret): User {
    const username = base64decode(secret.data.username);
    const password = base64decode(secret.data.password);

    return { username, password };
}

function buildOnePasswordItem(config: OnePasswordItemConfig) {
    const { environment, namespace, userName, kind } = config
    return {
        apiVersion: "onepassword.com/v1",
        kind: "OnePasswordItem",
        metadata: {
            name: getOnePasswordItemName(userName, kind),
            namespace: namespace,
        },
        spec: {
            itemPath: `vaults/monitoring-${environment}-accounts-${userName}/items/${kind}`,
        }
    };
}
