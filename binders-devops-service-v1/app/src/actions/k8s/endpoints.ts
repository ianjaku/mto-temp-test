import { getKubeCtlDecodedJson } from "../../lib/k8s";

export interface Endpoint {
    pod: string;
    ip: string;
    node: string;
}

export async function getEndpoints(serviceName: string, namespace: string): Promise<Endpoint[]> {
    const args = [
        "get", "endpoints", "-n", namespace, serviceName
    ];
    const kubectlOutput = await getKubeCtlDecodedJson(args);
    const results = [];
    for(const subset of kubectlOutput.subsets) {
        for(const address of subset.addresses) {
            results.push({
                pod: address.targetRef.name,
                ip: address.ip,
                node: address.nodeName
            })
        }
    }
    return results;
}