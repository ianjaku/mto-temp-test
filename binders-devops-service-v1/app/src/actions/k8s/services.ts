/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { extractBodyFromApiResult, getKubeCtlDecodedJson } from "../../lib/k8s";
import { isIPv4 } from "net";
import log from "../../lib/logging";

export const listServices = async (client, namespace ?: string) => {
    const endpoint = namespace ?
        client.api.v1.namespaces(namespace).services.get :
        client.api.v1.services.get;
    const response = extractBodyFromApiResult(await endpoint());
    return response.items;
};

export const getServices = async (namespace ?: string) => {
    const args = [ "get", "services" ];
    if (namespace) {
        args.push("-n", namespace);
    }
    const result = await getKubeCtlDecodedJson(args);
    return result.items;
};

export const deleteService = async (name: string, namespace: string) => {
    const args = [ "get", "services", name ];
    if (namespace) {
        args.push("-n", namespace);
    }
    try {
        return await getKubeCtlDecodedJson(args);
    } catch (ex) {
        log(ex)
    }

}

export const getService = async (name: string, namespace?: string) => {
    const args = [ "get", "services", name ];
    if (namespace) {
        args.push("-n", namespace);
    }
    try {
        return await getKubeCtlDecodedJson(args);
    } catch (ex) {
        if (ex.output && ex.output.indexOf("(NotFound)") > -1) {
            return undefined;
        }
        throw ex;
    }
}

export async function getExternalIpFromService(name: string, namespace: string): Promise<{ valid: boolean, ip: string }> {
    try {
        const args = ["get", "svc", name, "--namespace", namespace, "--output", "jsonpath=\"{.status.loadBalancer.ingress[*].ip}\""]
        const result = await buildAndRunCommand(() => buildKubeCtlCommand(args));
        const ip = result.output.replace(/^"(.*)"$/, "$1")
        return {
            ip,
            valid: isIPv4(ip)
        }
    } catch (error) {
        log(`Error when fetching external ip ${error}`)
        return {
            valid: false,
            ip: undefined
        }
    }
}