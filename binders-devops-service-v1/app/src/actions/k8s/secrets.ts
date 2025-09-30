/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import type { KubeConfig, V1Secret } from "@kubernetes/client-node";
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { IBindersEnvironment } from "../../lib/bindersenvironment";
import { createCoreV1Api } from "../k8s-client/util";
import { dumpJSON } from "../../lib/json";
import { getKubeCtlDecodedJson } from "../../lib/k8s";
import log from "../../lib/logging";
import { unlinkSync } from "fs";

export const getK8SSecret = async (secretName: string, namespace = "default") => {
    try {
        const args = ["get", "secret", secretName, "-n", namespace];
        return await getKubeCtlDecodedJson(args);
    } catch (ex) {
        if (ex.output && ex.output.indexOf("(NotFound)")) {
            return undefined;
        }
        throw ex;
    }
};

export async function verifySecretExists(name: string, namespace: string): Promise<boolean> {
    try {
        const result = await getK8SSecret(name, namespace)
        return !!result
    } catch (error) {
        return false
    }
}

export const createK8SSecretFromFiles = async (secretName: string, files: { [key: string]: string } | string[], namespace?: string, upsert?: boolean) => {
    const args = ["create", "secret", "generic", secretName];
    if (!Array.isArray(files)) {
        for (const key in files) {
            args.push(`--from-file=${key}=${files[key]}`);
        }
    } else {
        const fileArgs = files.map(f => `--from-file=${f}`);
        args.push(...fileArgs);
    }
    if (namespace) {
        args.push("--namespace", namespace);
    }
    try {
        return await buildAndRunCommand(() => buildKubeCtlCommand(args));
    } catch (err) {
        if (
            err.output && upsert && (
                err.output.indexOf("(AlreadyExists)") > -1 ||
                err.output.indexOf("already exists") > -1
            )
        ) {
            await deleteSecret(secretName, namespace);
            return await buildAndRunCommand(() => buildKubeCtlCommand(args));
        }
        throw err;
    }

};

export const getStaticPagesTLSSecretName = () => {
    return "tls-static-pages-secret";
}

export const getTLSSecretName = (environment: IBindersEnvironment) => {
    if (environment && environment.isProduction) {
        return "tls-production-secret";
    }
    return "tls-staging-secret";
};

export const copySecret = async (secretName: string, sourceNamespace: string, targetNamespace: string, deleteSecretIfExists = false) => {
    const { output } = await buildAndRunCommand(
        () => buildKubeCtlCommand(["get", "secrets", secretName, "-o", "json", "--namespace", sourceNamespace])
    );
    const decoded = JSON.parse(output);
    decoded.metadata.namespace = targetNamespace;
    const tmpFile = "/tmp/secret.json";
    await dumpJSON(decoded, tmpFile);
    const currentSecret = await getK8SSecret(secretName, targetNamespace);
    if (currentSecret && deleteSecretIfExists) {
        log(`Deleting secret ${secretName} in namespace ${targetNamespace}`);
        await buildAndRunCommand(
            () => buildKubeCtlCommand(["delete", "secret", secretName, "--namespace", targetNamespace])
        );
    }
    await buildAndRunCommand(
        () => buildKubeCtlCommand(["create", "-f", tmpFile, "--namespace", targetNamespace])
    );
    unlinkSync(tmpFile);
};

export const getDefaultTLSSecretName = () => getTLSSecretName(undefined);

export const createTLSSecret = (secretName: string, key: string, certificate: string, namespace?: string) => {
    const args = ["create", "secret", "tls", secretName, "--key", key, "--cert", certificate];
    if (namespace) {
        args.push("--namespace", namespace);
    }
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
};

export const createSecret = (secretName: string, secret: { [key: string]: string }, namespace?: string) => {
    const secretLiterals = [];
    for (const key in secret) {
        secretLiterals.push(`--from-literal=${key}=${secret[key]}`);
    }
    const args = ["create", "secret", "generic", secretName, ...secretLiterals];
    if (namespace) {
        args.push("--namespace", namespace);
    }
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
};

export const deleteSecret = (secretName: string, namespace = "default") => {
    const args = ["delete", "secret", secretName, "-n", namespace];
    return buildAndRunCommand(() => buildKubeCtlCommand(args));
};

export const listSecrets = async (namespace?: string) => {
    const args = ["get", "secrets"];
    if (namespace) {
        args.push("-n", namespace);
    } else {
        args.push("--all-namespaces");
    }
    const result = await getKubeCtlDecodedJson(args);
    return result.items;
};


export async function getSecret(kc: KubeConfig, namespace: string, name: string): Promise<V1Secret> {
    const k8sApi = await createCoreV1Api(kc);
    return k8sApi.readNamespacedSecret({ name, namespace });
}

export async function createOrUpdateSecret(kc: KubeConfig, name: string, namespace: string, stringData: { [key: string]: string }): Promise<V1Secret> {
    const k8sApi = await createCoreV1Api(kc);
    const secretManifest: V1Secret = {
        metadata: {
            name,
            namespace,
        },
        type: "Opaque",
        stringData
    };

    try {
        await k8sApi.readNamespacedSecret({ name, namespace });
        log(`Secret '${name}' already exists. Updating...`);

        const secret = await k8sApi.replaceNamespacedSecret({ name, namespace, body: secretManifest });
        log(`Secret '${name}' updated successfully.`);
        return secret;
    } catch (error) {
        if (error.code === 404) {
            log(`Secret '${name}' does not exist. Creating...`);
            const secret = await k8sApi.createNamespacedSecret({ namespace, body: secretManifest });
            log(`Secret '${name}' created successfully.`);
            return secret;
        }
        throw new Error(`Unexpected error when creating secret: ${name} in namespace ${namespace}: ${error}`)
    }

}