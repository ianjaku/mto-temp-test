import log from "./logging";
import { networkInterfaces } from "os";
import { runCommand } from "./commands";

const validBridgeIp = (ip: string | undefined, dockerBridgeIpPrefix: string) => !!ip && ip.startsWith(dockerBridgeIpPrefix);
const validBridgeName = (name: string | undefined, dockerBridgeDeviceName: string) => !!name && name === dockerBridgeDeviceName;

const getIpFromIpCommand = async (dockerBridgeDeviceName: string, family: "IPv4" | "IPv6") => {
    const ipCmd = `ip a s ${dockerBridgeDeviceName} | grep inet | awk '{print $2}' | cut -d'/' -f 1`;
    const { output } = await runCommand("/bin/bash", ["-c", ipCmd]);
    const ips = output.trim().split("\n");
    if (ips.length === 1) return ips[0];
    const validIps = ips.filter(ip => ({ IPv4: ip.includes("."), IPv6: ip.includes(":") }[family]))
    if (validIps.length === 1) return validIps.at(0);
    if (validIps.length === 0) throw new Error("Could not find a valid IP.");
    throw new Error(`Could not decide on a valid IP. Too many options for family ${family}: ${validIps}`)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const findIp = async (devConfig) => {
    const { dockerBridgeIpPrefix, dockerBridgeDeviceName } = devConfig;
    const interfaces = networkInterfaces();
    const validIps = [];
    for (const ifname in interfaces) {
        const ifaceAddresses = interfaces[ifname];
        const ifaceInfoIpv4 = ifaceAddresses.find(a => a.family === "IPv4");
        const address = ifaceInfoIpv4 && ifaceInfoIpv4.address;
        if (validBridgeName(ifname, dockerBridgeDeviceName)) {
            log(`Using bridge ip address based on interface name validator: ${address}`);
            return address;
        }
        if (
            validBridgeIp(address, dockerBridgeIpPrefix)
        ) {
            validIps.push(address);
        }
    }
    if(validIps.length === 0) {
        return getIpFromIpCommand(dockerBridgeDeviceName, "IPv4");
    }
    log(`Using bridge ip address based on IP validator: ${validIps[0]}`);
    return validIps[0];
};

export default findIp;
