import { CommandLineParser, IProgramDefinition, OptionType,  } from "../../lib/optionParser";
import {
    PRODUCTION_NAMESPACE,
    createBindersConfigSecret,
    getConfigSecret
} from "../../lib/bindersenvironment";
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { buildBindersProductionConfig } from "../../lib/bindersconfig";
import { getProductionCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to deploy",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const doIt = async () => {
    const { branch } = getOptions();
    const clusterName = getProductionCluster()
    await runGetKubeCtlConfig(clusterName);
    const bindersConfig = await buildBindersProductionConfig(clusterName);
    await buildAndRunCommand( () => buildKubeCtlCommand(["delete", "secret", getConfigSecret(branch), "-n", "production"]));
    await createBindersConfigSecret(bindersConfig, "production", PRODUCTION_NAMESPACE);
};

main(doIt);