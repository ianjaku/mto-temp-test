import {
    IItemSearchOptions,
    PublicationSummary
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import AccountStore from "../../../../accounts/store";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";
import { minutesToMilliseconds } from "date-fns";
import { queryClient } from "../../../../application";

const FIVE_MINUTES_IN_MS = minutesToMilliseconds(5);

const client = BinderRepositoryServiceClient.fromConfig(
    config,
    "v3",
    browserRequestHandler,
    AccountStore.getActiveAccountId.bind(AccountStore),
);

export const invalidateBinderPublicationSummaries = async (binderId: string): Promise<void> =>
    queryClient.invalidateQueries([ "binderPublicationSummaries", binderId ]);

export const useBinderPublicationSummaries = (binderId: string, includeInactive = true): UseQueryResult<PublicationSummary[]> => {
    return useQuery({
        queryFn: async () => {
            if (binderId == null) {
                return null;
            }
            const options: IItemSearchOptions = {
                binderSearchResultOptions: {
                    maxResults: 1000,
                    includeViews: true,
                    includeChunkCount: true,
                    summary: true,
                },
                resolvePublishedBy: true,
                skipPopulateVisuals: true,
            };
            const publicationOptions = includeInactive ? {} : { isActive: 1 };
            const publications = await client.findPublications(
                binderId,
                publicationOptions,
                options
            );
            return (publications as PublicationSummary[]).map(publication => ({
                ...publication,
                publicationDate: new Date(publication.publicationDate),
                ...(publication.unpublishDate ? { unpublishDate: new Date(publication.unpublishDate) } : {})
            } as PublicationSummary));
        },
        queryKey: [ "binderPublicationSummaries", binderId, includeInactive ],
        staleTime: FIVE_MINUTES_IN_MS,
    });
};