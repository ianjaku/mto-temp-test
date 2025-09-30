import * as fs from "fs";
import { buildAndRunCommand, buildKubeCtlCommand, runCommand } from "../../lib/commands";
import { HELM_PRODUCTION_MONGO_SETUP_DIR } from "../../lib/helm";
import { getK8SSecret } from "../k8s/secrets";
import log from "../../lib/logging";
import { runHelmInstall } from "../helm/install";

const setup = async (namespace: string) => {
    const setupReleaseName = "mongo-setup";
    await runHelmInstall(".", setupReleaseName, HELM_PRODUCTION_MONGO_SETUP_DIR, undefined, namespace);
};

const getBootstrapSecretDetails = () => ({
    secretName: "bootstrap-mongo-main-service",
    key: "internal-auth-mongodb-keyfile"
});

const createMongoJoinSecret = async (mongoClusterName: string, namespace: string) => {
    const { secretName, key } = getBootstrapSecretDetails();
    const currentSecret = await getK8SSecret(secretName, namespace);
    if (currentSecret !== undefined) {
        log("Bootstrap secret already in place.");
        return;
    }
    const tempFile = `/tmp/${mongoClusterName}-seed`;
    const result = await runCommand("/usr/bin/openssl", ["rand", "-base64", "741"]);
    fs.writeFileSync(tempFile, result.output);
    await buildAndRunCommand(() => buildKubeCtlCommand([
        "create", "secret", "generic", secretName,
        `--from-file=${key}=${tempFile}`,
        "--namespace", namespace
    ]));
    fs.unlinkSync(tempFile);
};

export const setupMongoInfrastructure = async (mongoClusterName: string, namespace: string): Promise<void> => {
    await setup(namespace);
    await createMongoJoinSecret(mongoClusterName, namespace);
};