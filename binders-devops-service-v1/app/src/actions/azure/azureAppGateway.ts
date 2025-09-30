import { buildAndRunCommand, buildAzCommand } from "../../lib/commands";
import { NetworkManagementClient } from "@azure/arm-network";
import log from "../../lib/logging";

export interface Certificate {
    name: string;
    id: string;
}

export async function listCertificates(
    client: NetworkManagementClient,
    resourceGroup: string,
    gatewayName: string,
): Promise<Certificate[]> {
    try {
        const appGateway = await client.applicationGateways.get(resourceGroup, gatewayName);

        if (!appGateway.sslCertificates) {
            return [];
        }

        return appGateway.sslCertificates
            .map(cert => ({
                name: cert.name || "",
                id: cert.id || ""
            }));
    } catch (error) {
        log("Error listing certificates:", error);
        return [];
    }
}

export async function deleteCertificate(
    client: NetworkManagementClient,
    resourceGroup: string,
    gatewayName: string,
    certName: string
): Promise<boolean> {
    try {
        const args = ["network", "application-gateway", "ssl-cert", "delete", "--name", certName, "--gateway-name", gatewayName, "--resource-group", resourceGroup]
        await buildAndRunCommand(() => buildAzCommand(args), { mute: false })
        return true;
    } catch (error) {
        log(`Error deleting certificate ${certName}:`, error);
        return false;
    }
}
