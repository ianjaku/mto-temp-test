import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { seedEnvironment } from "../../actions/bindersenv/seed";

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
        commit: {
            long: "commit",
            description: "The commit of the active environment",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("seedStaging", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options = (<any> parser.parse());
    return options;
};

main( async () => {
    const { branch, cluster, commit } = getOptions();
    await runGetKubeCtlConfig(cluster);
    const env = {
        branch: branch.toLowerCase(),
        isProduction: (cluster === getProductionCluster()),
        services: BINDERS_SERVICE_SPECS,
        commitRef: commit
    };
    return seedEnvironment(env);
});