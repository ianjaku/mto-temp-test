import {
    FeedbackParams,
    PublicationSummary
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BackendRepoServiceClient } from "../../apiclient/backendclient";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "../../bindersconfig/binders";
import { ClientFactory } from "../../testutils/clientfactory";
import { Config } from "@binders/client/lib/config/config";

export class TestFeedbacksFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    async createFeedback(
        pub: PublicationSummary,
        feedbackParams: FeedbackParams,
        createForUserId?: string,
    ): Promise<void> {
        const client = await this.repoClient(createForUserId);
        await client.createOrUpdateFeedback(this.accountId, pub.id, feedbackParams);
    }

    private repoClient(createForUserId?: string) {
        if (createForUserId !== undefined) {
            const config = BindersConfig.get();
            const clientFactory = new ClientFactory(
                config,
                BinderRepositoryServiceClient,
                "v3"
            );
            return clientFactory.createForFrontend(createForUserId, () => this.accountId);
        }
        return BackendRepoServiceClient.fromConfig(
            this.config,
            "testing"
        );
    }

}
