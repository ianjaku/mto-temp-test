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
    waitForEnvironment
} from "./deploy/shared";
import { shortenBranchName, shortenCommitRef } from "../../lib/k8s";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { STAGING_ALWAYS_DEPLOY_BRANCHES } from "../../lib/bitbucket";
import { createPullRequest } from "../../actions/bitbucket/api";
import { deleteK8SNamespace } from "../../actions/k8s/namespaces";
import { getBuildBlueprint } from "../../lib/pipeline";
import { getProductionCluster } from "../../actions/aks/cluster";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { seedEnvironment } from "../../actions/bindersenv/seed";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to deploy",
            kind: OptionType.STRING,
            required: true
        },
        commit: {
            long: "commit",
            description: "The commit of the active environment",
            kind: OptionType.STRING,
            required: true
        },
        cluster: {
            long: "cluster",
            short: "c",
            description: "The k8s cluster name",
            kind: OptionType.STRING,
            required: true
        },
        mockServices: {
            long: "mock-services",
            description: "Comma separated list of services to mock. Possible values are 'aicontent', 'mailer'",
            kind: OptionType.STRING,
        },
        recreateNamespace: {
            long: "recreate-namespace",
            short: "r",
            description: "Will try to delete the namespace if it already exists",
            kind: OptionType.BOOLEAN
        },
        useAdmin: {
            long: "use-admin",
            short: "a",
            description: "Use admin credentials (required atm for non-interactive envs)",
            kind: OptionType.BOOLEAN
        },
        useCustomNamespacePrefix: {
            long: "use-custom-namespace-prefix",
            description: "Will create namespace with prefix custom. This ensure that namespace won't be deleted by cronjob",
            kind: OptionType.BOOLEAN
        },
        bitbucketAccessToken: {
            long: "bitbucket-access-token",
            description: "The Bitbucket access token used to create a PR when deploying to production",
            kind: OptionType.STRING,
        }

    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any>parser.parse());
    if (options.recreateNamespace === undefined) {
        options.recreateNamespace = false;
    }
    options.fullBranch = options.branch;
    options.branch = shortenBranchName(options.branch);
    options.commit = shortenCommitRef(options.commit);
    return options;
};

main(async () => {
    const { bitbucketAccessToken, branch, cluster, commit, fullBranch, mockServices,
        recreateNamespace, useAdmin, useCustomNamespacePrefix } = getOptions();
    const isProduction = cluster === getProductionCluster()
    const isMinimal = !isProduction;
    const env: IBindersEnvironment = {
        branch: branch.toLowerCase(),
        cluster,
        commitRef: commit,
        isMinimal,
        isProduction,
        mockServices,
        services: BINDERS_SERVICE_SPECS,
        testProductionMode: false,
        useCustomNamespacePrefix,
        CI: !!process.env.CI
    };
    env.prefix = isProduction ? env.branch : getNamespace(env)
    if (isMinimal) {
        env.services = env.services.filter(s => !SERVICES_NOT_TO_DEPLOY.includes(s.name));
    }
    const skip = (process.env.SKIP_STAGING_DEPLOY === "1" && !STAGING_ALWAYS_DEPLOY_BRANCHES.includes(branch));
    if (!env.isProduction && skip) {
        log(`Skipping deploy of branch ${branch}`);
        return;
    }
    const blueprint = await getBuildBlueprint();
    await runGetKubeCtlConfig(cluster, useAdmin);
    await createNamespace(env, recreateNamespace);
    try {
        await createInfrastructure(env, false);
        const deployPlan = await createServices(env, blueprint);
        await createIngress(env);
        await waitForEnvironment(env, WAIT_FOR_ENVIRONMENT, deployPlan);
        await seedEnvironment(env);
        await cleanOldDeploys(env);
        if (env.isProduction) {
            try {
                await createPullRequest(bitbucketAccessToken, fullBranch, "develop");
            } catch (error) {
                log(error.message);
                log("Failed to create PR");
            }
        }
    } catch (e) {
        if (!env.isProduction) {
            const namespace = getNamespace(env);
            await deleteK8SNamespace(namespace);
        }
        throw e;
    }
});
