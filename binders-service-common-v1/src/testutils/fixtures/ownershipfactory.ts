import { BackendRepoServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";

export class TestOwnershipFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    async setOwner(
        docId: string,
        userOrGroupId: string,
    ): Promise<void> {
        const client = await this.repoClient();
        await client.setOwnershipForItem(docId, { ids: [userOrGroupId], type: "overridden" }, this.accountId);
    }

    private repoClient() {
        return BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
    }

}
