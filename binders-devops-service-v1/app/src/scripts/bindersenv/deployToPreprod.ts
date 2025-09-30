/* eslint-disable no-console */
import { BINDERS_SERVICE_SPECS, IServiceSpec } from "../../config/services";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { IBindersEnvironment, PREPROD_NAMESPACE } from "../../lib/bindersenvironment";
import {
    SERVICES_NOT_TO_DEPLOY,
    WAIT_FOR_ENVIRONMENT,
    cleanOldDeploys,
    createInfrastructure,
    createNamespace,
    createServices,
    waitForEnvironment,
    waitForTlsSecret
} from "./deploy/shared";
import { deleteK8SNamespace, getK8SNamespaces } from "../../actions/k8s/namespaces";
import { getProductionCluster } from "../../actions/aks/cluster";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { minutesToMilliseconds } from "date-fns";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { seedEnvironment } from "../../actions/bindersenv/seed";
import { shortenBranchName } from "../../lib/k8s";
import { sleep } from "../../lib/promises";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to deploy",
            kind: OptionType.STRING,
            required: true
        },
        extra: {
            long: "extra",
            short: "e",
            description: "Give the k8s pods extra memory for production restores and deploy all services",
            kind: OptionType.BOOLEAN,
            default: false
        },
        allowProdRestore: {
            long: "allowProdRestore",
            short: "p",
            description: "Allow production restore",
            kind: OptionType.BOOLEAN,
            default: false
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any>parser.parse());
    options.branch = shortenBranchName(options.branch);
    return options;
};

const NAMESPACE_CLEANUP_TIMEOUT = 120000

async function waitForNamespaceCleanup(namespace: string, timeoutInMs: number) {
    if (timeoutInMs < 0) {
        throw new Error("Timed out waiting for cleanup namesapce");
    }
    const existingNamespaces = await getK8SNamespaces();
    const nsNames = existingNamespaces.map(ns => ns.metadata.name);
    if (nsNames.includes(namespace)) {
        log(`Namespace ${namespace} still exists....`)
        await sleep(5000)
        const period = 5000
        return await waitForNamespaceCleanup(namespace, timeoutInMs - period)
    }
}

async function checkNamespace(env: IBindersEnvironment) {
    const existingNamespaces = await getK8SNamespaces();
    const nsNames = existingNamespaces.map(ns => ns.metadata.name);
    if (nsNames.includes(PREPROD_NAMESPACE)) {
        await deleteK8SNamespace(PREPROD_NAMESPACE)
        await waitForNamespaceCleanup(PREPROD_NAMESPACE, NAMESPACE_CLEANUP_TIMEOUT)
    }
    await createNamespace(env, false)
}

function excludeStaticPages(serviceSpec: IServiceSpec[]) {
    return serviceSpec.filter(s => s.name !== "static-pages")
}

main(async () => {
    const { allowProdRestore, branch, extra } = getOptions();
    const cluster = getProductionCluster();
    const isProduction = true;
    const commit = branch;
    const isMinimal = !extra;
    const env: IBindersEnvironment = {
        cluster,
        isProduction,
        branch: branch.toLowerCase(),
        commitRef: commit,
        services: excludeStaticPages(BINDERS_SERVICE_SPECS),
        isMinimal,
        useBranchAsNamespace: true,
        testProductionMode: true
    };
    if (isMinimal) {
        env.services = env.services.filter(s => !SERVICES_NOT_TO_DEPLOY.includes(s.name));
    }
    await runGetKubeCtlConfig(cluster, true);
    await checkNamespace(env);
    await createInfrastructure(env, allowProdRestore);
    const deployPlan = await createServices(env, undefined, allowProdRestore);
    await waitForTlsSecret(env, minutesToMilliseconds(5))
    await waitForEnvironment(env, WAIT_FOR_ENVIRONMENT, deployPlan);
    await seedEnvironment(env);
    await cleanOldDeploys(env);

    const urls = [
        "https://preprod-editor.manual.to",
        "https://preprod.manual.to",
        "https://preprod-manage.manual.to",
    ].join("\n  ");
    log(`Environment deployed on the following URLs:\n\n  ${urls}\n`);
});
