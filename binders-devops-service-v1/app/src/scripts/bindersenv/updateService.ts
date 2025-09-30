import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { updateService } from "../../actions/bindersenv/service";

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
        service: {
            long: "service",
            short: "s",
            description: "The service name to update",
            kind: OptionType.STRING,
            required: true
        },
        version: {
            long: "version",
            short: "v",
            description: "The service version to update",
            kind: OptionType.STRING,
            required: true
        },
        useAdmin: {
            long: "use-admin",
            short: "a",
            description: "Use admin credentials (required atm for non-interactive envs)",
            kind: OptionType.BOOLEAN
        }
    };
    const parser = new CommandLineParser("updateService", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any> parser.parse());
    options.branch = options.branch.substr(0, 16);
    options.commit = options.branch.substr(0, 8);
    return options;
};

const doIt = async () => {
    // (env: IBindersEnvironment, serviceName: string)
    const { branch, cluster, commit, service, version, useAdmin } = getOptions();
    const env = {
        isProduction: (cluster === getProductionCluster()),
        branch: branch.toLowerCase(),
        commitRef: commit,
        services: BINDERS_SERVICE_SPECS,
        prefix: branch.toLowerCase()
    };
    await runGetKubeCtlConfig(cluster, useAdmin);
    await updateService(env, service, version);
};

main(doIt);