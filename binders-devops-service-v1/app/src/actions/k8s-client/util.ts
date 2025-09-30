import type { KubeConfig } from "@kubernetes/client-node";
import log from "../../lib/logging";

export async function createKubeConfig(clusterName: string, options: { useAdminContext?: boolean }): Promise<KubeConfig> {
    const { KubeConfig } = await import("@kubernetes/client-node");
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const ctx = options?.useAdminContext ? `${clusterName}-admin` : clusterName
    kc.setCurrentContext(ctx)
    log(`Current context is set to: ${kc.getCurrentContext()}`)
    return kc
}

export async function createAppsV1Api(kubeConfig: KubeConfig) {
    const { AppsV1Api } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(AppsV1Api);
}

export async function createCoreV1Api(kubeConfig: KubeConfig) {
    const { CoreV1Api } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(CoreV1Api);
}

export async function createCustomObjectsApi(kubeConfig: KubeConfig) {
    const { CustomObjectsApi } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(CustomObjectsApi);
}

export async function createNetworkingV1ApiClient(kubeConfig: KubeConfig) {
    const { NetworkingV1Api } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(NetworkingV1Api);
}

export async function createPolicyV1Api(kubeConfig: KubeConfig) {
    const { PolicyV1Api } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(PolicyV1Api);
}

export async function createRbacAuthorizationV1Api(kubeConfig: KubeConfig) {
    const { RbacAuthorizationV1Api } = await import("@kubernetes/client-node");
    return kubeConfig.makeApiClient(RbacAuthorizationV1Api);
}
