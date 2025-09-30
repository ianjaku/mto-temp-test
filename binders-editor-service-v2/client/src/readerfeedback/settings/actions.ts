import {
    ReaderFeedbackConfig,
    ReaderFeedbackConfigs
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import AccountStore from "../../accounts/store";
import {
    BinderRepositoryServiceClient
} from  "@binders/client/lib/clients/repositoryservice/v3/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export async function APIGetItemAndAncestorsReaderFeedbackConfigs(itemId: string): Promise<ReaderFeedbackConfigs> {
    return client.getItemAndAncestorsReaderFeedbackConfigs(itemId);
}

export async function APIUpdateReaderFeedbackConfig(
    itemId: string,
    config: ReaderFeedbackConfig,
): Promise<void> {
    await client.updateReaderFeedbackConfig(itemId, config);
}
