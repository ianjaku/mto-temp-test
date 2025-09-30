import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { getResourceGroupForCluster, getSubscriptionForCluster } from "./cluster";
import { getNodeResourceGroup } from "../../lib/aks";
import { setAzureSubscription } from "./setup";

const STANDARD_LOAD_BALANCER = "Standard"

const removeWhitespaces = (str: string): string => str.replace(/\s+/g, "")

export async function resolveOutboundIp(clusterName: string): Promise<string> {
    const resourceGroup = getResourceGroupForCluster(clusterName)
    const subscription = getSubscriptionForCluster(clusterName)
    await setAzureSubscription(subscription)

    if (await isStandardLoadBalancer(clusterName, resourceGroup)) {
        return resolveStandardLoadBalancerOutboudIp(clusterName, resourceGroup)
    } else {
        const nodeResourceGroup = await getNodeResourceGroup(clusterName, resourceGroup)
        return resolveBasicLoadBalancerOutboudIp(nodeResourceGroup)
    }
}

async function resolveStandardLoadBalancerOutboudIp(clusterName: string, resourceGroup: string) {
    const outboundAddressId = await getIdOfIpAddressFromNetworkProfile(clusterName, resourceGroup)
    return getIpAddress(outboundAddressId)
}

async function resolveBasicLoadBalancerOutboudIp(resourceGroup: string) {
    const outboundAddressId = await getIdOfIpAddressFromLoadBalancer("kubernetes", resourceGroup)
    return getIpAddress(outboundAddressId)
}

async function getIpAddress(id: string) {
    const args = ["network", "public-ip", "show", "--ids", id, "--query", "ipAddress", "--output", "tsv"]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    return removeWhitespaces(output)
}

async function getIdOfIpAddressFromLoadBalancer(loadBalancerName: string, resourceGroup: string) {
    const args = ["network", "lb", "frontend-ip", "list", "--resource-group", resourceGroup, "--lb-name", loadBalancerName, "--query", "[0].publicIpAddress.id", "--output", "tsv"]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    return removeWhitespaces(output)
}

async function getIdOfIpAddressFromNetworkProfile(clusterName: string, resourceGroup: string) {
    const args = ["aks", "show", "--resource-group", resourceGroup, "--name", clusterName, "--query", "networkProfile.loadBalancerProfile.effectiveOutboundIPs[].id", "--output", "tsv"]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    return removeWhitespaces(output)
}

async function isStandardLoadBalancer(clusterName: string, resourceGroup: string): Promise<boolean> {
    const args = ["aks", "show", "--resource-group", resourceGroup, "--name", clusterName, "--query", "networkProfile.loadBalancerSku", "--output", "tsv"]
    const { output } = await buildAndRunCommand(() => buildAzCommand(args), { mute: true });
    return removeWhitespaces(output) === STANDARD_LOAD_BALANCER
}