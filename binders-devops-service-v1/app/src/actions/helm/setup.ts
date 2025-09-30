/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
    addClusterAdmin,
    createServiceAccount,
    deleteServiceAccount,
    removeClusterAdmin
} from  "../aks/rbac";
import { createCACert, createCSRFile, signSCRFile } from "../openssl/certs";
import { copyFile } from "../../lib/fs";
import { createKeyFile } from "../openssl/keys";
import { existsSync } from "fs";
import { getHelmHome } from "./config";
import log from "../../lib/logging";
import { runCommand } from "../../lib/commands";

interface CAConfig {
    key: string;
    cert: string;
}

interface TLSEndpointConfig {
    key: string;
    csr: string;
    cert: string;
    ca: CAConfig;
}

const TILLER_NAMESPACE = "kube-system";

export const getCAConfig = (baseDirectory: string): CAConfig => {
    const caDir = `${baseDirectory}/ca`;
    return {
        key: `${caDir}/key.pem`,
        cert: `${caDir}/cert.pem`,
    };
};

const getTLSEndpointConfig = (baseDirectory: string, endpointDirectory: string): TLSEndpointConfig => {
    const directory = `${baseDirectory}/${endpointDirectory}`;
    return {
        key: `${directory}/key.pem`,
        csr: `${directory}/csr.pem`,
        cert: `${directory}/cert.pem`,
        ca: getCAConfig(baseDirectory)
    };
};

const getTillerTLSConfig = (baseDirectory: string): TLSEndpointConfig => {
    return getTLSEndpointConfig(baseDirectory, "tiller");
};

export const getHelmTLSConfig = (baseDirectory: string): TLSEndpointConfig => {
    return getTLSEndpointConfig(baseDirectory, "helm");
};

export const createCA = async (baseDirectory: string) => {
    const { key, cert } = getCAConfig(baseDirectory);
    if (existsSync(key) || existsSync(cert)) {
        log("CA already exists");
        return;
    }
    await createKeyFile(key, { createDirectory: true });
    await createCACert(key, cert);
};

const getTillerServiceAccountForUser = (userName: string) => `${userName}-tiller`;

// helm
export const runTillerInit = async (tlsBaseDir: string, userName: string) => {
    const { ca, cert, key } = getTillerTLSConfig(tlsBaseDir);
    const accountName = getTillerServiceAccountForUser(userName);
    await runCommand("helm", [
        "init",
        "--override", "'spec.template.spec.containers[0].command'='{/tiller,--storage=secret}'",
        "--tiller-tls", "--tiller-tls-verify",
        `--tiller-tls-cert=${cert}`,
        `--tiller-tls-key=${key}`,
        `--tls-ca-cert=${ca.cert}`,
        `--service-account=${accountName}`
    ]);
};

const createTillerServiceAccount = async (userName: string) => {
    const serviceAccountName = getTillerServiceAccountForUser(userName);
    try {
        await createServiceAccount(serviceAccountName, TILLER_NAMESPACE);
        await addClusterAdmin(serviceAccountName, TILLER_NAMESPACE);
    } catch (err) {
        const message = err.output || err.message;
        if (message.indexOf("already exists") === -1) {
            throw err;
        }
    }
};

export const setupTiller = async (baseDirectory: string, userName: string) => {
    const { cert, csr, key, ca } = getTillerTLSConfig(baseDirectory);
    await createKeyFile(key, { createDirectory: true });
    await createCSRFile(key, csr);
    await signSCRFile(ca.cert, ca.key, csr, cert);
    await createTillerServiceAccount(userName);
};

export const copyHelmTLSFiles = async (baseDirectory) => {
    const helmTLSConfig = getHelmTLSConfig(baseDirectory);
    const helmHome = await getHelmHome();
    if (! existsSync(helmHome)) {
        log(`Creating helm home dir ${helmHome}`);
        await runCommand("mkdir", ["-p", helmHome]);
    }
    await copyFile(helmTLSConfig.key, `${helmHome}/key.pem`);
    await copyFile(helmTLSConfig.cert, `${helmHome}/cert.pem`);
    await copyFile(helmTLSConfig.ca.cert, `${helmHome}/ca.pem`);
};

export const setupHelm = async (baseDirectory: string) => {
    const { cert, csr, key, ca } = getHelmTLSConfig(baseDirectory);
    await createKeyFile(key, { createDirectory: true });
    await createCSRFile(key, csr);
    await signSCRFile(ca.cert, ca.key, csr, cert);
    await copyHelmTLSFiles(baseDirectory);
};

const removeTillerAdmin = async (user: string) => {
    const serviceAccountName = getTillerServiceAccountForUser(user);
    await removeClusterAdmin(serviceAccountName);
    await deleteServiceAccount(serviceAccountName, TILLER_NAMESPACE);
};

export const uninstallTiller = async (user: string) => {
    // kubectl -n kube-system delete secret tiller-secret
    // kubectl -n kube-system delete svc/tiller-deploy deploy/tiller-deploy
    await runCommand( "helm", ["reset", "--tls", "-f"]);
    await removeTillerAdmin(user);
};