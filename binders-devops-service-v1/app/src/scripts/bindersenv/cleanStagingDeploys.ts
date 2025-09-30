import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { cleanServiceDeploy, getDeployments } from "../../actions/bindersenv/deployment";
import { getStagingCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { sequential } from "../../lib/promises";
import { shortenBranchName } from "../../lib/k8s";

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
    await runGetKubeCtlConfig(getStagingCluster());
    const namespace = shortenBranchName(branch);
    const deploys = await getDeployments(namespace);
    await sequential(d => cleanServiceDeploy(d, namespace, 0), deploys);
};

main(doIt);