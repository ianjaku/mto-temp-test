import {
    buildBindersDevConfig,
    buildBindersProductionConfig,
    buildBindersStagingConfig
} from  "../../lib/bindersconfig";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import findIp from "../../lib/findIp";
import { getNamespace } from "../../lib/bindersenvironment";
import { getProductionCluster } from "../../actions/aks/cluster";
import loadConfig from "../../lib/loadConfig";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import validateConfig from "../../lib/validation";

async function validateDevConfig() {
    log("validating dev config");
    const configFilePath = `${__dirname}/../localdev/devConfig.json`;
    const devConfig = await loadConfig(configFilePath);
    const ip = await findIp(devConfig);
    const config = await buildBindersDevConfig(ip, false, "develop");
    validateConfig(config, "local");
    log("dev configuration is valid");
}

async function validateProductionConfig() {
    log("validating production config");
    const config = await buildBindersProductionConfig(getProductionCluster());
    validateConfig(config, "production");
    log("production configuration is valid");
}

async function validateStagingConfig() {
    log("validating staging config");
    const env = {
        isProduction: false,
        branch: "develop",
        commitRef: "",
        services: BINDERS_SERVICE_SPECS,
    };
    const namespace = getNamespace(env);
    const config = await buildBindersStagingConfig(namespace, env.branch);
    validateConfig(config, "staging");
    log("staging configuration is valid");
}

main(async () => {
    try {
        await validateProductionConfig();
        await validateStagingConfig();
        await validateDevConfig();
    } catch(e) {
        // eslint-disable-next-line no-console
        console.error(e);
    }
});