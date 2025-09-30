import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { getDeployments } from "../../actions/bindersenv/deployment";
import { getProductionCluster } from "../../actions/aks/cluster";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { shortenBranchName } from "../../lib/k8s";
import { updateDeploymentEnvVar } from "../../actions/k8s/deployments";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        branch: {
            long: "branch",
            short: "b",
            description: "The branch hosting the service",
            kind: OptionType.STRING,
        },
        service: {
            long: "service",
            short: "s",
            description: "The name of the service (eg. account / binders)",
            kind: OptionType.STRING,
        },
        serviceVersion: {
            long: "serviceVersion",
            short: "v",
            description: "The optional service version",
            kind: OptionType.STRING
        },
        all: {
            long: "all",
            description: "Restart all service pods",
            kind: OptionType.BOOLEAN
        }
    };
    const parser = new CommandLineParser("restartPods", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const doIt = async () => {
    const options = getOptions();
    const { branch, clusterName, service, serviceVersion, all } = options;
    if (!all && !service) {
        throw new Error("Need to specify as service or the --all flag");
    }
    const isProduction = clusterName === getProductionCluster();
    if (!isProduction && !branch) {
        throw new Error("On staging you need to provide a branch name");
    }
    const namespace = isProduction ?
        PRODUCTION_NAMESPACE :
        shortenBranchName(branch);
    await runGetKubeCtlConfig(clusterName);
    const deployments = await getDeployments(namespace);
    const matchingServices = all ?
        deployments :
        deployments.filter( dep => {
            const { spec: depSpec } = dep;
            const nameMatches = (depSpec.name === service);
            const versionMatches = serviceVersion ? (depSpec.version === serviceVersion) : true;
            return nameMatches && versionMatches;
        });

    if (matchingServices.length === 0) {
        throw new Error("Could not find matching service.");
    }
    if (matchingServices.length > 1 && !all) {
        throw new Error("Multiple matching services.");
    }
    await matchingServices.reduce(
        async (reduced, matchingService) => {
            await reduced;
            const { activeDeployment, spec } = matchingService;
            if (!activeDeployment) {
                throw new Error("Could not find active deployment.");
            }
            const deploymentName = `${activeDeployment.branch}-${spec.name}-${spec.version}-${activeDeployment.commitRef}-deployment`;
            log(`Restarting containers in ${deploymentName}`);
            await updateDeploymentEnvVar(deploymentName, namespace, "LAST_RESTART", (new Date().getTime()).toString());
        },
        Promise.resolve(undefined)
    );
};

main(doIt);