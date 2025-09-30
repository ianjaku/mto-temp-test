import { buildBindersDevConfig } from "../../lib/bindersconfig";
import { createK8SSecretFromFiles } from "../k8s/secrets";
import { dumpJSON } from "../../lib/json";
import log from "../../lib/logging";
import { unlink } from "fs";

export const getDevConfigSecret = (): string => "binders-config";

export const createDevConfigSecret = async (ip: string, isProxy: boolean, currentBranch: string, shouldLoadProductionSecrets = false): Promise<void> => {
    const config = await buildBindersDevConfig(ip, isProxy, currentBranch, shouldLoadProductionSecrets);
    const configFile = "/tmp/local-dev-config.json";
    const configSecret = getDevConfigSecret();
    await dumpJSON(config, configFile);
    await createK8SSecretFromFiles(configSecret, {
        "development.json": configFile,
    }, "develop", true);
    unlink(configFile, err => {
        if (err) {
            log("Could not clean up json config");
        }
    });
};