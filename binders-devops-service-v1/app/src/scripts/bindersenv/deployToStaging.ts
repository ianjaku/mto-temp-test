/* eslint-disable no-console */
import { BINDERS_SERVICE_SPECS, IServiceSpec } from "../../config/services";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { IBindersEnvironment, getNamespace } from "../../lib/bindersenvironment";
import {
    SERVICES_NOT_TO_DEPLOY,
    WAIT_FOR_ENVIRONMENT,
    cleanOldDeploys,
    createInfrastructure,
    createIngress,
    createNamespace,
    createServices,
    waitForEnvironment,
} from "./deploy/shared";
import { getK8SNamespaces } from "../../actions/k8s/namespaces";
import { getStagingCluster } from "../../actions/aks/cluster";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { seedEnvironment } from "../../actions/bindersenv/seed";
import { shortenBranchName } from "../../lib/k8s";

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

async function checkNamespace(env: IBindersEnvironment) {
    const namespace = getNamespace(env);
    const existingNamespaces = await getK8SNamespaces();
    const nsNames = existingNamespaces.map(ns => ns.metadata.name);
    if (nsNames.includes(namespace)) {
        log(`Namespace already exists.\n\nDelete it with\n    kubectl delete ns ${namespace}\n\nAborting...`);
        process.exit(1);
    }
}

function excludeStaticPages(serviceSpec: IServiceSpec[]) {
    return serviceSpec.filter(s => s.name !== "static-pages")
}

main(async () => {
    const { allowProdRestore, branch, extra } = getOptions();
    const cluster = getStagingCluster();
    const isProduction = false;
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
        testProductionMode: false,
        CI: false
    };
    env.prefix = getNamespace(env)
    if (isMinimal) {
        env.services = env.services.filter(s => !SERVICES_NOT_TO_DEPLOY.includes(s.name));
    }
    await runGetKubeCtlConfig(cluster, true);
    await checkNamespace(env);
    await createNamespace(env, false);
    await createIngress(env)
    await createInfrastructure(env, allowProdRestore);
    const deployPlan = await createServices(env, undefined, allowProdRestore);
    await waitForEnvironment(env, WAIT_FOR_ENVIRONMENT, deployPlan);
    await seedEnvironment(env);
    await cleanOldDeploys(env);

    const namespace = getNamespace(env);
    const urls = [
        `https://editor-${namespace}.staging.binders.media`,
        `https://manualto-${namespace}.staging.binders.media`,
        `https://manage-${namespace}.staging.binders.media`,
    ].join("\n  ");
    log(`Environment deployed on the following URLs:\n\n  ${urls}\n`);
});
