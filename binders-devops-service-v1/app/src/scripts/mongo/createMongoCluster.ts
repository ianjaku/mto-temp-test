import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    HELM_PRODUCTION_MONGO_SERVICE_DIR,
    HELM_PRODUCTION_MONGO_SERVICE__STATIC_PV_DIR,
    HELM_STAGING_MONGO_DIR,
    HELM_STAGING_MONGO_STATIC_PV_DIR
} from "../../lib/helm";
import {
    STAGING_RESOURCE_LIMITS
} from "../../lib/bindersdeployment";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { parseEnv } from "../../lib/environment";
import { runHelmInstall } from "../../actions/helm/install";

interface CreateMongoClusterConfig {
    env: string
    namespace: string
    releaseName: string
    staticPv: boolean
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        namespace: {
            long: "namespace",
            short: "n",
            description: "The namespace in which mongo cluster will be created",
            kind: OptionType.STRING,
            required: true
        },
        releaseName: {
            long: "releaseName",
            short: "r",
            description: "The releaseName of helm chart responsible for mongo creation",
            kind: OptionType.STRING,
            required: true,
            default: "mongo-main-service"
        },
        staticPv: {
            long: "staticPv",
            short: "s",
            description: "The static option creates cluster using static persistent volumes.",
            kind: OptionType.BOOLEAN,
            default: false
        },
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
    };
    const parser = new CommandLineParser("createMongoCluster", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse()) as CreateMongoClusterConfig;
};

const installStagingCluster = async (config: CreateMongoClusterConfig) => {
    const { namespace, releaseName, staticPv } = config

    const shardDir = staticPv ? HELM_STAGING_MONGO_STATIC_PV_DIR : HELM_STAGING_MONGO_DIR;
    const { memory: { mongo } } = STAGING_RESOURCE_LIMITS;
    const extraValues = {
        "mongo.maxMemory": mongo
    }
    const result = await runHelmInstall(".", releaseName, shardDir, undefined, namespace, extraValues);
    log(result.output)
}

const installProductionCluster = async (config: CreateMongoClusterConfig) => {
    const { namespace, releaseName, staticPv } = config
    const shardDir = staticPv ? HELM_PRODUCTION_MONGO_SERVICE__STATIC_PV_DIR : HELM_PRODUCTION_MONGO_SERVICE_DIR
    const result = await runHelmInstall(".", releaseName, shardDir, undefined, namespace);
    log(result.output)
}

const doIt = async () => {
    const config = getOptions()
    const environment = parseEnv(config.env)

    if(environment === "production") {
        await installProductionCluster(config)
    } else {
        await installStagingCluster(config)
    }
}

main(doIt)