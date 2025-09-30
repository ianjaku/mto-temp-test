import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { copyFile, getPodDefintion } from "../../actions/k8s/pods";
import { copySshKey, getVms } from "../../actions/azure/vm";
import { dumpAndRunKubeCtl, waitForPod } from "../../lib/k8s";
import { getNodeResourceGroup } from "../../lib/aks";
import { homedir } from "os";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { runExec } from "../../actions/k8s/exec";
import { sequential } from "../../lib/promises";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        aksClusterName: {
            long: "aks-cluster-name",
            short: "n",
            description: "The aks cluster name",
            kind: OptionType.STRING,
            required: true
        },
        node: {
            long: "node",
            description: "The node number",
            kind: OptionType.INTEGER,
            required: true
        }
    };

    const parser = new CommandLineParser("setupSSHAccess", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse());
};

const copySshKeyToNode = async (aksClusterName: string, nodeNumber: string) => {
    const resourceGroup = await getNodeResourceGroup(aksClusterName);
    const vms = await getVms(resourceGroup);
    const vmNames = vms
        .map(vm => vm.name)
        .filter(n => n.endsWith(`-${nodeNumber}`));
    await sequential(
        async n => {
            log(`Copying ssh key to ${n}`);
            await copySshKey(resourceGroup, n as string);
        },
        vmNames
    );
};

const SSH_POD_NAME = "aks-ssh-pod";

const createGatewayPod = async () => {
    const podName = SSH_POD_NAME;
    const options = {
        name: podName,
        image: "kroniak/ssh-client",
        command: ["/bin/bash", "-c", "while [ 1 ] ; do sleep 60 ; done"]
    };
    const podDefinition = getPodDefintion(options);
    log("Applying gateway pod defintion");
    await dumpAndRunKubeCtl(podDefinition, "aks-ssh.yml", false);
    await waitForPod(podName);
    log("Setting up private keys in the new pod");
    await copyFile(`${homedir()}/.ssh/id_rsa`, `${podName}:/id_rsa`);
    await runExec(podName, "chmod 0600 /id_rsa");
};

const doIt = async () => {
    const { aksClusterName, node } = getOptions();
    await copySshKeyToNode(aksClusterName, node);
    await createGatewayPod();
};

main(doIt);