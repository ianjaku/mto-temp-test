import type {
    KubeConfig,
    V1HTTPIngressPath,
    V1Ingress,
    V1IngressRule
} from "@kubernetes/client-node";
import { createNetworkingV1ApiClient } from "./util";
import { log } from "../../lib/logging";

interface Path {
    path: string
    portNumber: number
    serviceName: string
}

interface Rule {
    host: string
    paths: Path[]
}

export interface IngressConfig {
    isProduction: boolean
    name: string
    namespace: string
    rules: Rule[]
}

const getTLSSecretName = isProduction => isProduction ? "tls-production-secret" : "tls-staging-secret"

function createIngressPath(p: Path): V1HTTPIngressPath {
    return {
        backend: {
            service: {
                name: p.serviceName,
                port: {
                    number: p.portNumber
                }
            }
        },
        path: p.path,
        pathType: "Prefix"
    }

}

function createIngressRules(rules: Rule[]): V1IngressRule[] {
    return rules.map(rule => {
        return {
            host: rule.host,
            http: {
                paths: rule.paths.map(createIngressPath)
            }

        }
    })
}


export async function createOrUpdateIngress(kubeConfig: KubeConfig, config: IngressConfig): Promise<void> {
    const { isProduction, namespace, name } = config
    const hosts = config.rules.map(rule => rule.host)
    const ingress: V1Ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name,
            namespace
        },
        spec: {
            ingressClassName: "nginx",
            rules: createIngressRules(config.rules),
            tls: [
                {
                    hosts,
                    secretName: getTLSSecretName(isProduction),
                },
            ],
        },
    };

    const networkingV1Api = await createNetworkingV1ApiClient(kubeConfig);
    try {
        await networkingV1Api.readNamespacedIngress({ name, namespace });
        log(`Replacing ingress: ${name} in namespace ${namespace}`);
        await networkingV1Api.replaceNamespacedIngress({ name, namespace, body: ingress });
        log(`Ingress replaced: ${name}`);
    } catch (error) {
        if (error.code === 404) {
            log(`Creating ingress: ${name} in namespace ${namespace}`);
            const response = await networkingV1Api.createNamespacedIngress({ namespace, body: ingress });
            log(`Ingress created: ${response.metadata?.name}`);
        } else {
            log(`Error when fetching & replacing ingress: ${error.body}`);
            throw new Error(error);
        }
    }
}

