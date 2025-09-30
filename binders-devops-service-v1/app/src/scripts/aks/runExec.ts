import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runCommandInContainer } from "../../lib/bindersenvironment";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        cluster: {
            long: "cluster",
            short: "c",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        branch: {
            long: "branch",
            short: "b",
            description: "The branch or environment name",
            kind: OptionType.STRING,
            required: true
        },
        exec: {
            long: "exec",
            short: "e",
            description: "The command to exec",
            kind: OptionType.STRING,
            required: true
        },
        service: {
            long: "service",
            short: "s",
            description: "The binders service (short name)",
            kind: OptionType.STRING,
            required: true
        },
        commit: {
            long: "commit",
            description: "The commit of the active environment",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("runExec", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any> parser.parse());
    return options;
};

main( async () => {
    const { cluster, branch, commit, exec, service } = getOptions();
    const env = {
        isProduction: cluster === getProductionCluster(),
        branch: branch.toLowerCase(),
        commitRef: commit,
        services: BINDERS_SERVICE_SPECS
    };
    const serviceSpec = env.services.find(s => s.name === service);
    if (serviceSpec === undefined) {
        throw new Error(`Could not find service with name ${service}`);
    }
    await runCommandInContainer(env, serviceSpec, exec);
});