import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { DevTypeScriptCompiler, WebAppBundler } from "../../config/services";
import { ELASTIC_CLUSTER_NAME, ElasticCompatibilityMode, createEckDevK8sResources, waitForElasticUser, } from "../../lib/eck";
import { dumpYaml, yamlStringify } from "../../lib/yaml";
import {
    isElasticClusterExists,
    maybeCleanElasticPersistentVolume,
    maybeInstallEckOperator
} from "../../actions/elastic/eck";
import { IDevConfig } from "../../actions/localdev/build";
import { createDevConfigSecret } from "../../actions/localdev/config";
import { createK8SNamespace } from "../../actions/k8s/namespaces";
import { dumpFile } from "../../lib/fs";
import findIp from "../..//lib/findIp";
import { getApmHelmValues } from "../../lib/apm";
import { getCurrentBranch } from "../../actions/git/branches";
import { getCurrentContext } from "../../actions/k8s/kubectl";
import { getK8sDevEnvironmentObjects } from "../../actions/localdev/env";
import loadConfig from "../../lib/loadConfig";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runHelmInstall } from "../../actions/helm/install";
import { runKubeCtlFile } from "../../lib/k8s";
import { setupHostPathFolders } from "../../lib/devenvironment";

const DEV_NAMESPACE = "develop"

interface UpOptions {
    compiler?: DevTypeScriptCompiler;
    elasticCompatibilityMode?: ElasticCompatibilityMode;
    extra?: boolean;
    includeCpuLimit?: boolean;
    ip?: string;
    isProxy?: boolean;
    loadProductionSecret?: boolean;
    minimalEnvironment?: boolean;
    useNoLimitsMemoryConfig?: boolean;
    webAppBundler?: WebAppBundler;
}

async function doIt(): Promise<void> {
    const configFilePath = `${__dirname}/devConfig.json`;
    const devConfig = await loadConfig(configFilePath);
    const currentBranch = await getCurrentBranch()

    const { kubeContext, hostPathFolder, includeAPM } = devConfig;

    const currentContext = await getCurrentContext();
    if (currentContext !== kubeContext) {
        throw new Error(`Not in dev setup (${currentContext}!=${kubeContext}), make sure kubectl is configured correctly`);
    }

    const options = await getOptions(devConfig);
    const {
        compiler,
        elasticCompatibilityMode,
        extra,
        ip,
        isProxy,
        loadProductionSecret,
        minimalEnvironment,
        webAppBundler,
    } = options;

    await createDevNamespace();
    await maybeCleanElasticPersistentVolume()

    const isElasticClusterAvailable = await isElasticClusterExists(ELASTIC_CLUSTER_NAME, DEV_NAMESPACE)
    if (!isElasticClusterAvailable) {
        await maybeInstallEckOperator()
        await createEckDevK8sResources(devConfig, elasticCompatibilityMode, loadProductionSecret, currentBranch, !extra)
        await waitForElasticUser(DEV_NAMESPACE)
    }
    await createDevConfigSecret(ip, isProxy, currentBranch, loadProductionSecret);
    await setupHostPathFolders(hostPathFolder);
    await createK8sResources({
        ...devConfig,
        elasticCompatibilityMode,
        minimalEnvironment,
        devTypeScriptCompiler: compiler,
        webAppBundler,
    }, options)

    if (includeAPM) {
        const helmValues = getApmHelmValues("http://elastic-apm:9201");
        const helmValuesFile = "/tmp/helm-apm-server.yaml";
        await dumpYaml(helmValues, helmValuesFile);
        await runHelmInstall("stable/apm-server", "apm-server", undefined, helmValuesFile, DEV_NAMESPACE, undefined);
    }
}

async function createDevNamespace() {
    try {
        await createK8SNamespace(DEV_NAMESPACE);
    } catch (err) {
        if (err.output && err.output.indexOf("Error from server (AlreadyExists)") > -1) {
            log("develop namespace already exists");
        } else {
            throw err;
        }
    }
}

async function getOptions(devConfig: IDevConfig): Promise<UpOptions> {
    const programDefinition: IProgramDefinition = {
        compiler: {
            long: "compiler",
            kind: OptionType.STRING,
            description: `Use the specified compiler for all services. If the compiler is not configured for a service, use tsc. Available values: ${Object.values(DevTypeScriptCompiler).join(",")}`,
        },
        elasticCompatibilityMode: {
            long: "elasticCompatibilityMode",
            description: "Based on elasticCompatibilityMode system will provision elastic cluster with desired version",
            kind: OptionType.STRING,
            default: "7"
        },
        extra: {
            long: "extra",
            short: "e",
            kind: OptionType.BOOLEAN,
            description: "Use extra resources (e.g additional elastic node)",
            default: false
        },
        includeCpuLimit: {
            long: "includeCpuLimit",
            short: "l",
            kind: OptionType.BOOLEAN,
            default: false,
            description: "Include K8s Limit range for cpu for all resources",
        },
        ip: {
            long: "ip",
            short: "n",
            description: "IP address",
            kind: OptionType.STRING
        },
        loadProductionSecret: {
            long: "loadProductionSecret",
            short: "s",
            kind: OptionType.BOOLEAN,
            description: "Load production secret",
        },
        minimalEnvironment: {
            long: "minimalEnvironment",
            short: "m",
            kind: OptionType.BOOLEAN,
            description: "Skip deploy of dashboard, devops, partner",
            default: false
        },
        useNoLimitsMemoryConfig: {
            long: "useNoLimitsMemoryConfig",
            kind: OptionType.BOOLEAN,
            description: "Do not set up production memory limits on localdev containers.",
            default: false
        },
        webAppBundler: {
            long: "webAppBundler",
            kind: OptionType.STRING,
            description: `Use the specified bundler for web services. If the bundler is not configured for a service, use vite. Available values: ${Object.values(WebAppBundler).join(",")}`,
        },
    }
    const parser = new CommandLineParser("UpOptions", programDefinition)

    const {
        compiler,
        elasticCompatibilityMode,
        extra,
        includeCpuLimit,
        ip: ipFromOptions,
        loadProductionSecret: loadProductionSecret,
        minimalEnvironment,
        useNoLimitsMemoryConfig,
        webAppBundler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = (<any>parser.parse()) as UpOptions;

    const ip = ipFromOptions || await findIp(devConfig);
    if (!ip) {
        throw new Error("Could not determine ip");
    }

    const devTypeScriptCompiler = compiler || devConfig.devTypeScriptCompiler || DevTypeScriptCompiler.Tsc;
    const compilers = Object.values(DevTypeScriptCompiler)
    if (!compilers.includes(devTypeScriptCompiler)) {
        throw new Error(`Invalid value for --compiler ${devTypeScriptCompiler}. Valid values: ${compilers.join(",")}`)
    }

    const bundlers = Object.values(WebAppBundler)
    const webAppBundlerToUse = webAppBundler || devConfig.webAppBundler || WebAppBundler.Vite;
    if (!bundlers.includes(webAppBundlerToUse)) {
        throw new Error(`Invalid value for --webAppBundler ${webAppBundlerToUse}. Valid values: ${bundlers.join(",")}`)
    }

    return {
        compiler: devTypeScriptCompiler,
        elasticCompatibilityMode,
        extra,
        includeCpuLimit,
        ip,
        isProxy: !!ip,
        loadProductionSecret: !!loadProductionSecret,
        minimalEnvironment,
        useNoLimitsMemoryConfig,
        webAppBundler: webAppBundlerToUse,
    }
}

async function createK8sResources(devConfig: IDevConfig, options: UpOptions) {
    const devEnvironmentObjects = await getK8sDevEnvironmentObjects(devConfig, options.includeCpuLimit, options.useNoLimitsMemoryConfig);
    const fileContents = devEnvironmentObjects
        .map(devEnvObj => yamlStringify(devEnvObj))
        .join("\n---\n");
    const file = "/tmp/local-dev.yaml";
    await dumpFile(file, fileContents);
    await runKubeCtlFile(file, false, "develop");
}


main(doIt);
