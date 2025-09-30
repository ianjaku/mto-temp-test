import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { buildAndRunCommand, buildKubeCtlCommand, runGetKubeCtlConfig } from "../../lib/commands";
import { createBindersConfigSecret, getConfigSecret } from "../../lib/bindersenvironment";
import { shortenBranchName, shortenCommitRef } from "../../lib/k8s";
import { buildBindersStagingConfig } from "../../lib/bindersconfig";
import { getStagingCluster } from "../../actions/aks/cluster";
import { main } from "../../lib/program";

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
            short: "c",
            description: "The git commit to deploy",
            kind: OptionType.STRING,
        },
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};
const doIt = async () => {
    const { branch, commit } = getOptions();
    await runGetKubeCtlConfig(getStagingCluster());
    const namespace = commit ?
        shortenCommitRef(commit):
        shortenBranchName(branch);
    const shortBranch = shortenBranchName(branch);
    const bindersConfig = await buildBindersStagingConfig(namespace, shortBranch);
    await buildAndRunCommand( () => buildKubeCtlCommand(["delete", "secret", getConfigSecret(shortBranch), "-n", namespace]));
    await createBindersConfigSecret(bindersConfig, namespace, namespace);
}

main(doIt);