import {
    AuthorizationServiceContract,
    PermissionName,
    ResourceType
} from  "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    BinderFilter,
    CollectionFilter,
    ItemKind,
    ItemSearchResult,
    PublicationFilter
} from  "@binders/client/lib/clients/repositoryservice/v3/contract";
import { DESIRED_NUMBER_OF_RESULTS, MAX_NUMBER_OF_ITERATIONS } from "./const";
import {
    getEmptySearchResult,
    haveEnoughSearchResults,
    maybeCutSearchResultsForClient,
    mergeSearchResults,
    parseQueryLanguageRestrictions,
    sortSearchResultsByScore
} from  "./helpers";
import { BindersRepository } from "../repositories/binderrepository";
import { CollectionRepository } from "../repositories/collectionrepository";
import { ISearchParams } from "./params";
import { PublicationRepository } from "../repositories/publicationrepository";
import { ServerSideSearchOptions } from "../model";
import { flatten } from "ramda";
import { multiTransformSearchResult } from "@binders/binders-service-common/lib/itemstransformers";


export interface ISearchService {
    search(
        searchParams: ISearchParams,
        itemKinds: ItemKind[],
        requiredPermission: PermissionName,
        prioritizedScopeCollectionId?: string
    ): Promise<ItemSearchResult>;
}

export class SearchService implements ISearchService {

    constructor(
        private readonly authorizationContract: AuthorizationServiceContract,
        private readonly bindersRepository: BindersRepository,
        private readonly collectionRepository: CollectionRepository,
        private readonly publicationRepository: PublicationRepository,
    ) { }

    async search(
        searchParams: ISearchParams,
        itemKinds: ItemKind[],
        requiredPermission: PermissionName,
        prioritizedScopeCollectionId?: string
    ): Promise<ItemSearchResult> {
        if (searchParams.userId == null && requiredPermission !== PermissionName.VIEW) {
            throw new Error(`A userId is required when searching with ${PermissionName[requiredPermission]} permissions`);
        }
        const itemIdsWithRequiredPermission = await this.fetchItemIdsWithRequiredPermissions(searchParams, requiredPermission);

        let searchResults: ItemSearchResult = getEmptySearchResult();
        if (prioritizedScopeCollectionId) {
            searchResults = await this.searchUntilEnoughResults(searchParams, itemKinds, {
                hierarchicalIncludeFilters: [itemIdsWithRequiredPermission, [prioritizedScopeCollectionId]]
            });
        }
        if (haveEnoughSearchResults(searchResults)) {
            return maybeCutSearchResultsForClient(searchResults);
        }

        const outsideScopeResults = await this.searchUntilEnoughResults(searchParams, itemKinds, {
            accountId: searchParams.accountId,
            hierarchicalIncludeFilters: [itemIdsWithRequiredPermission],
            hierarchicalExcludeFilters: prioritizedScopeCollectionId ? [[prioritizedScopeCollectionId]] : [],
        });

        searchResults = mergeSearchResults(searchResults, outsideScopeResults)
        return maybeCutSearchResultsForClient(searchResults, false);
    }

    async searchUntilEnoughResults(
        searchParams: ISearchParams,
        itemKinds: ItemKind[],
        filter: CollectionFilter & BinderFilter & PublicationFilter,
    ): Promise<ItemSearchResult> {
        let allSearchResults = getEmptySearchResult();
        for (const itemKind of itemKinds)  {
            let itemKindSearchResults = getEmptySearchResult();
            let totalHitsBeforeFilters = 0;
            // Exit when we hit MAX_NUMBER_OF_ITERATIONS or when we have enough results of this kind
            for (let i = 0; i < MAX_NUMBER_OF_ITERATIONS; i++) {
                // Fetch the next page of results
                const currentSearchParams = this.setOffsetInSearchParams(searchParams, totalHitsBeforeFilters)
                let searchResults = await this.searchInRepositories(currentSearchParams, itemKind, filter);
                // Stop when there are not more possible results of this itemKind
                if (searchResults.hits.length === 0) { break; }
                totalHitsBeforeFilters += searchResults.hits.length;

                searchResults = await multiTransformSearchResult(searchResults, searchParams.transformers);
                itemKindSearchResults = mergeSearchResults(itemKindSearchResults, searchResults);

                // Break when we have reached the desired number of results
                if (itemKindSearchResults.hits.length >= DESIRED_NUMBER_OF_RESULTS) { break; }
            }
            allSearchResults = mergeSearchResults(allSearchResults, itemKindSearchResults);
        }

        const sortedResults = sortSearchResultsByScore(allSearchResults);
        return maybeCutSearchResultsForClient(sortedResults);
    }

    private setOffsetInSearchParams(
        searchParams: ISearchParams,
        pagingOffset: number
    ): ISearchParams {
        return {
            ...searchParams,
            options: {
                ...searchParams.options,
                binderSearchResultOptions: {
                    ...searchParams.options.binderSearchResultOptions,
                    pagingOffset,
                    maxResults: DESIRED_NUMBER_OF_RESULTS
                }
            }
        };
    }

    private async fetchItemIdsWithRequiredPermissions(searchParams: ISearchParams, requiredPermission: PermissionName) {
        let itemIdsWithRequiredPermission: string[];
        if (searchParams.userId != null) {
            const allowedGroups = await this.authorizationContract.findAllowedResourceGroups(
                searchParams.userId,
                ResourceType.DOCUMENT,
                requiredPermission,
                true,
                searchParams.accountId
            );
            return flatten(allowedGroups.map(g => g.ids));
        }
        // When the user has no access to anything on the account, we should show public items (this will only include public advertised items)
        if ((searchParams.userId == null || itemIdsWithRequiredPermission.length === 0) && requiredPermission === PermissionName.VIEW) {
            const permissionMaps = await this.authorizationContract.findPublicResourceGroups(
                ResourceType.DOCUMENT,
                [requiredPermission],
                [searchParams.accountId]
            );
            return flatten(permissionMaps.map(map => map.resources.map(res => res.ids)));
        }
        return [];
    }

    private async searchInRepositories(
        searchParams: ISearchParams,
        itemKind: ItemKind,
        filter: CollectionFilter & BinderFilter & PublicationFilter
    ): Promise<ItemSearchResult> {
        const { queryString, strictLanguages } = await parseQueryLanguageRestrictions(searchParams.queryString);
        
        const options: ServerSideSearchOptions = {
            ...searchParams.options.binderSearchResultOptions,
            strictLanguages,
        }

        if (itemKind === ItemKind.Binder) {
            return await this.bindersRepository.searchBinders(
                queryString,
                options,
                searchParams.accountId,
                undefined,
                filter
            );
        }
        if (itemKind === ItemKind.Collection) {
            return await this.collectionRepository.searchCollections(
                queryString,
                options,
                filter
            );
        }
        if (itemKind === ItemKind.Publication) {
            return await this.publicationRepository.searchPublications(
                queryString,
                options,
                filter
            );
        }

        throw new Error(`Unsupported itemKind: ${itemKind}`);
    }
}