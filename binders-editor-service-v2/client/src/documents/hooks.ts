import {
    APICountAllPublicDocuments,
    APIGetChecklistsActions,
    APIGetMultiChecklistConfigs,
    APILoadItems,
    APILoadPublications,
    APIUpdateChunkVisualSettings
} from "./api";
import {
    APIGetItemAndAncestorsReaderFeedbackConfigs,
    APIUpdateReaderFeedbackConfig,
} from "../readerfeedback/settings/actions";
import {
    Binder,
    DocumentCollection,
    IChecklistAction,
    IChecklistConfig,
    IItemSearchOptions,
    PublicationFindResult,
    ReaderFeedbackConfig,
    ReaderFeedbackConfigs,
    VisualSettings
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import {
    FEATURE_COMMENTING_IN_EDITOR,
    FEATURE_READER_COMMENTING
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { IWebData, WebDataState } from "@binders/client/lib/webdata";
import { SortOrder, sortByDate } from "@binders/client/lib/util/date";
import { UseMutationResult, UseQueryResult, useMutation, useQuery } from "@tanstack/react-query";
import { useActiveAccountFeatures, useActiveAccountId } from "../accounts/hooks";
import { APIGetCommentThreads } from "../bindercomments/api";
import BinderClass from "@binders/client/lib/binders/custom/class";
import BinderStore from "./store";
import { ExtendedCommentThread } from "@binders/client/lib/clients/commentservice/v1/contract";
import { partition } from "ramda";
import { queryClient } from "../application";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

const serviceName = "@binders/binders-v3";

export const useBinderPublications = (
    binderId: string,
    activePublicationsOption: number,
    includeViews: boolean,
): UseQueryResult<PublicationFindResult[]> => {
    return useQuery({
        queryFn: async () => APILoadPublications(binderId, activePublicationsOption, includeViews),
        queryKey: [serviceName, "loadPublications", binderId],
        enabled: !!binderId,
    });
}

export const useSortedBinderPublications = (
    binderId: string | undefined,
    activePublicationsOption: number,
    includeViews: boolean,
): UseQueryResult<PublicationFindResult[]> => {
    const result = useBinderPublications(binderId, activePublicationsOption, includeViews);
    if (!result.isSuccess) {
        return result;
    }
    const publications = result.data;
    const [activePublications, inactivePublications] = partition(pub => pub.isActive, publications);
    const descSortedActivePublications = sortByDate(activePublications, pub => new Date(pub.publicationDate), SortOrder.DESC);
    const descSortedInactivePublications = sortByDate(inactivePublications, pub => new Date(pub.publicationDate), SortOrder.DESC);
    return {
        ...result,
        data: [
            ...descSortedActivePublications,
            ...descSortedInactivePublications,
        ]
    };
}

export const useMultiChecklistConfigs = (
    binderIds: string[]
): UseQueryResult<IChecklistConfig[], Error> => {
    return useQuery(
        [serviceName, "checklistconfigs", binderIds],
        async () => {
            if (binderIds.length === 0) return [];
            return APIGetMultiChecklistConfigs(binderIds)
        }
    )
}

export const useChecklistsActions = (
    itemIds: string[] | string,
): UseQueryResult<IChecklistAction[], Error> => {
    return useQuery(
        [serviceName, "checklists", "actions", itemIds],
        async () => {
            if (itemIds.length === 0) return [];
            return APIGetChecklistsActions(
                Array.isArray(itemIds) ? itemIds : [itemIds]
            );
        },
    )
}

export const useItems = (
    itemIds: string[],
    options: IItemSearchOptions
): UseQueryResult<(Binder | DocumentCollection)[]> => {
    const accountId = useActiveAccountId();
    return useQuery(
        [serviceName, "items", itemIds],
        async () => {
            if (itemIds.length === 0) return [];
            return APILoadItems(itemIds, accountId, options);
        },
    )
}

const getAllPublicDocumentsCountKey = (accountId: string) => [serviceName, "public-docs-count", accountId];
export const usePublicDocumentCount = (): UseQueryResult<number> => {
    const accountId = useActiveAccountId();
    return useQuery(
        getAllPublicDocumentsCountKey(accountId),
        async () => {
            if (accountId == null) return 0;
            return APICountAllPublicDocuments(accountId);
        }
    );
}
export const invalidatePublicDocumentCount = (accountId: string) =>
    queryClient.invalidateQueries({ queryKey: getAllPublicDocumentsCountKey(accountId) });

export const useItemAndAncestorsFeedbackConfigs = (
    itemId: string,
): UseQueryResult<ReaderFeedbackConfigs> => {
    return useQuery({
        queryFn: async () => APIGetItemAndAncestorsReaderFeedbackConfigs(itemId),
        queryKey: [serviceName, "itemAndAncestorsReaderFeedbackConfigs", itemId],
        enabled: !!itemId,
    });
}

export type UpdateReaderFeedbackConfigParams = {
    itemId: string;
    config: ReaderFeedbackConfig;
}
export const useReaderFeedbackConfigMutation = (): UseMutationResult<void, unknown, UpdateReaderFeedbackConfigParams> => {
    return useMutation(
        async params => APIUpdateReaderFeedbackConfig(params.itemId, params.config),
        {
            onSuccess: async () => {
                await queryClient.invalidateQueries([serviceName, "itemAndAncestorsReaderFeedbackConfigs"]);
            }
        });
}

export const useCommentThreads = (binderId: string): UseQueryResult<ExtendedCommentThread[]> => {
    const accountFeatures = useActiveAccountFeatures();
    const featuresCommenting = accountFeatures.includes(FEATURE_COMMENTING_IN_EDITOR) ||
        accountFeatures.includes(FEATURE_READER_COMMENTING);

    return useQuery({
        queryFn: async () => {
            if (!featuresCommenting) return [];
            return APIGetCommentThreads(binderId)
        },
        queryKey: [serviceName, "commentThreads", binderId],
        enabled: binderId != null,
    });
}

export const invalidateCommentThreads = (binderId: string): void => {
    queryClient.invalidateQueries({
        queryKey: [serviceName, "commentThreads", binderId]
    });
}

export function useActiveBinder(): BinderClass | null {
    const binder: IWebData<Binder> = useFluxStoreAsAny(BinderStore, (_prevState, store) => store.getActiveBinder());
    if (!binder) return null;
    return binder.state === WebDataState.SUCCESS ? new BinderClass(binder.data) : null;
}

export function useUpdateChunkVisualSetting(
    props: { binderId: string, chunkIdx: number, visualIdx: number },
): UseMutationResult<void> {
    return useMutation<void, unknown, Partial<VisualSettings>>(
        async (visualSettings: Partial<VisualSettings>) => {
            await APIUpdateChunkVisualSettings(
                props.binderId,
                props.chunkIdx,
                props.visualIdx,
                visualSettings,
            );
        }
    )
}
