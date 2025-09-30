import { BackendRoutingServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { IPWhitelist } from "@binders/client/lib/clients/routingservice/v1/contract";
import { ISemanticLink } from "@binders/client/lib/clients/routingservice/v1/contract";

export class TestRoutingFactory {

    constructor(
        private readonly config: Config,
    ) { }

    public async getSemanticLinks(itemId: string): Promise<ISemanticLink[]> {
        const client = await BackendRoutingServiceClient.fromConfig(
            this.config,
            "testing"
        );
        return client.findSemanticLinks(itemId)
    }

    public async setSemanticLink(
        semanticLink: ISemanticLink,
        itemId: string,
        overrideInTrash?: boolean,
    ): Promise<void> {
        const client = await BackendRoutingServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await client.setSemanticLink(semanticLink, itemId, overrideInTrash);
    }

    public async setAccountDomain(
        accountId: string,
        domain: string,
    ): Promise<void> {
        const client = await BackendRoutingServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await client.setDomainsForAccount(accountId, [domain]);
    }

    public async saveIpWhitelist(ipWhitelist: IPWhitelist): Promise<void> {
        const client = await BackendRoutingServiceClient.fromConfig(
            this.config,
            "testing"
        );
        await client.saveIpWhitelist(ipWhitelist);
    }
}
