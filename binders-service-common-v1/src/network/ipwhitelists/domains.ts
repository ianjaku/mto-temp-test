import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";

export const getIPWhiteListsForDomain = async (domain: string, routingClient: RoutingServiceClient): Promise<string[]> => {
    const editorDomainRegex = /\.editor\.manual\.to$/;
    const domainToLookup = domain.replace(editorDomainRegex, ".manual.to");
    const ipwhiteList = await routingClient.getIpWhitelist(domainToLookup);
    return ipwhiteList.enabled ?
        ipwhiteList.CIDRs :
        [];
}
