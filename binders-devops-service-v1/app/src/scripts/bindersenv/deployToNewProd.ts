/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { IBindersEnvironment, getNamespace } from "../../lib/bindersenvironment";
import {
    SERVICES_NOT_TO_DEPLOY,
    WAIT_FOR_ENVIRONMENT,
    cleanOldDeploys,
    createInfrastructure,
    createNamespace,
    createServices,
    waitForEnvironment
} from  "./deploy/shared";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getK8SNamespaces } from "../../actions/k8s/namespaces";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
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
        allowProdRestore: {
            long: "allowProdRestore",
            short: "p",
            description: "Allow production restore",
            kind: OptionType.BOOLEAN,
            default: true
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
    if (!nsNames.includes(namespace)) {
        await createNamespace(env, false)
    }
}

main(async () => {
    const { allowProdRestore, branch } = getOptions();
    const cluster = getProductionCluster();
    const isProduction = true;
    const commit = branch;
    const isMinimal = false;
    const env: IBindersEnvironment = {
        isProduction,
        cluster,
        branch: branch.toLowerCase(),
        commitRef: commit,
        services: BINDERS_SERVICE_SPECS,
        isMinimal,
        testProductionMode: true
    };
    if (isMinimal) {
        env.services = env.services.filter(s => !SERVICES_NOT_TO_DEPLOY.includes(s.name));
    }
    await runGetKubeCtlConfig(cluster, true);
    await checkNamespace(env);
    await createInfrastructure(env, allowProdRestore);
    const deployPlan = await createServices(env, undefined);
    await waitForEnvironment(env, WAIT_FOR_ENVIRONMENT, deployPlan);
    //await seedEnvironment(env);
    await cleanOldDeploys(env);
});
