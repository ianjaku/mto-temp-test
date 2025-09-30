import { AccountStoreGetters } from "../stores/zustand/account-store";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = RoutingServiceClient.fromConfig(config, "v1", browserRequestHandler, AccountStoreGetters.getActiveAccountId);

export async function getSemanticLinkById(semanticId: string, domain: string): Promise<ISemanticLink[]> {
    return await client.getSemanticLinkById(domain, semanticId);
}
