import { AccountTotals } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    BinderRepositoryServiceClient
} from "@binders/client/lib/clients/repositoryservice/v3/client";
import { RoutingServiceClient } from "@binders/client/lib/clients/routingservice/v1/client";
import config from "../../config";
import { getBackendRequestHandler } from "../api";

let _accountId: string | null = null;
const getActiveAccountId = () => _accountId;
export const activateAccountId = (accountId: string) => { _accountId = accountId; }

const backendRepoClient = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    getBackendRequestHandler(),
    getActiveAccountId,
);
const backendRoutingClient = RoutingServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export const APILoadDocumentTotals = (accountId: string): Promise<AccountTotals> => {
    return backendRepoClient.getAccountTotals(accountId);
};

export const APILoadPublicDocsTotal = async (accountId: string): Promise<number> => {
    return await backendRepoClient.countAllPublicDocuments(accountId);
}

export const APILoadAccountDomain = async (accountId: string): Promise<string | undefined> => {
    const domainFilters = await backendRoutingClient.getDomainFiltersForAccounts([accountId]);
    return domainFilters[0]?.domain;
};

export const APISummarizePublicationsForAccountCsv = async (accountId: string): Promise<string> => {
    return backendRepoClient.summarizePublicationsForAccount(accountId, "csv");
}

export const APISummarizeDraftsForAccountCsv = async (accountId: string): Promise<string> => {
    return backendRepoClient.summarizeDraftsForAccount(accountId, "csv");
}
