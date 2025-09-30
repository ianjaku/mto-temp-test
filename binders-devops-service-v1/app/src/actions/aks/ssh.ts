import { Command } from "../../lib/commands";
import { getNodeResourceGroup } from "../../lib/aks";
import { getVmIps } from "../azure/vm";

const getIp = async (aksClusterName, node) => {
    const resourceGroup = await getNodeResourceGroup(aksClusterName);
    const vms = await getVmIps(resourceGroup);
    const suffix = `-${node}`;
    const vm = vms.find(r => r.virtualMachine.name.endsWith(suffix));
    if (vm === undefined) {
        throw new Error("Could not find node vm.");
    }
    const ip = vm.virtualMachine.network.privateIpAddresses[0];
    if (ip === undefined) {
        throw new Error("Could not find node ip.");
    }
    return ip;
};

const SSH_POD_NAME = "aks-ssh-pod";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getSSHCommand = async (aksClusterName, node): Promise<Command> => {
    const ip = await getIp(aksClusterName, node);
    return new Command(
        "kubectl",
        [
            "exec", "-it", SSH_POD_NAME,  "--",
            "ssh", "-i", `id_rsa azureuser@${ip}`
        ]
    );
};