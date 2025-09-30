import AccountStore from "../../../../accounts/store";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { RelabelResult } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export async function APIRelabelBinderLanguage(
    binderId: string,
    fromLanguageCode: string,
    toLanguageCode: string
): Promise<RelabelResult> {
    return client.relabelBinderLanguage(
        AccountStore.getActiveAccountId(),
        binderId,
        fromLanguageCode,
        toLanguageCode,
    );
}
