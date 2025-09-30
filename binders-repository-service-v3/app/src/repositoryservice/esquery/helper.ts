import { Config } from "@binders/client/lib/config/config";
import { NodeClientHandler } from "@binders/binders-service-common/lib/apiclient/nodeclient";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";
import { buildSignConfig } from "@binders/binders-service-common/lib/tokens/jwt";

export interface ESQueryBuilderHelper {
    mapDomainToAccountIds(domain: string): Promise<string []>;
}

export class DefaultESQueryBuilderHelper implements ESQueryBuilderHelper {

    private readonly routingServiceClient: Promise<RoutingServiceContract>;

    constructor(config: Config) {
        const handlerPromise = NodeClientHandler.forUser(buildSignConfig(config), "uid-service-user");
        this.routingServiceClient = (handlerPromise.then(handler => RoutingServiceClient.fromConfig(config, "v1", handler)));
    }

    mapDomainToAccountIds(domain: string): Promise<string[]> {
        if (domain === "localhost") {
            return Promise.resolve([]);
        }
        return this.routingServiceClient.then(
            client => client.getAccountIdsForDomain(domain)
        );
    }

}