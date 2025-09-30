/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";

function addNamespaceParam(args: string[], namespace?: string): string[] {
    if (namespace) {
        if (namespace !== "--all") {
            args.push("-n", namespace);
        } else {
            args.push("--all-namespaces");
        }
    }
    return args
}

export const getDeployments = async (namespace?: string) => {
    const args = addNamespaceParam(["get", "deployments"], namespace)
    const result = await getKubeCtlDecodedJson(args);
    return result.items;
};

export const getDeployment = async (name: string, namespace: string) => {
    const args = addNamespaceParam(["get", "deployments", name], namespace)
    return getKubeCtlDecodedJson(args);
}

export const deleteDeployment = async (name: string, namespace?: string) => {
    const args = ["delete", "deployment", name];
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
};

export const updateDeploymentEnvVar = async (deploymentName: string, namespace: string, envKey: string, envValue: string) => {
    const env = { [envKey]: envValue };
    return updateDeploymentEnvVars(deploymentName, namespace, env);
};

export const updateDeploymentEnvVars = async (deploymentName: string, namespace: string, env: { [key: string]: string }) => {
    const envVars = []
    for (const key in env) {
        envVars.push(`${key}=${env[key]}`);
    }
    const args = ["set", "env", "deployment", deploymentName, "--namespace", namespace, ...envVars];
    await buildAndRunCommand(
        () => buildKubeCtlCommand(args),
        { mute: true }
    );
}