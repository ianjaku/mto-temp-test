import { buildAndRunCommand } from "../../lib/commands";

const runDnsZoneCommand = async (resourceGroup: string, args: string[]) => {
    await buildAndRunCommand(
        () => ({
            command: "az",
            args: [ "network", "dns", "zone", ...args, "-g", resourceGroup ]
        })
    );
};

const createZoneIfNotExists = async (resourceGroup: string, name: string) => {
    await runDnsZoneCommand(resourceGroup, ["create", "-n", name]);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const importZoneFile = async (resourceGroup: string, domain: string, zoneFile: string) => {
    const cleanDomain = domain.replace(/\.$/, "");
    await createZoneIfNotExists(resourceGroup, cleanDomain);
    // az network dns zone import -g binders-dns -n manual.to -f manual.to.zone
    const args = ["import", "-n", cleanDomain, "-f", zoneFile];
    await runDnsZoneCommand(resourceGroup, args);
};