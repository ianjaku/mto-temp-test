import { AuthorizationServiceContract, PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    Binder,
    BinderFilter,
    BindersRepositoryServiceContract,
    DeleteFilter,
    DocumentCollection,
    IItemSearchOptions,
    Item,
    ItemFilterFunction,
    Story
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { ItemsTransformer, multiTransformItems } from "@binders/binders-service-common/lib/itemstransformers";
import { AncestorBuilder } from "../ancestors/ancestorBuilder";
import { AncestorItem } from "@binders/client/lib/ancestors";
import { CollectionRepository } from "../repositories/collectionrepository";
import { MultiRepository } from "../repositories/multirepository";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { filterItemIdsByPermission } from "../repositoryfilters";
import moment from "moment";


export interface SoftDeletedItemsSearchResult {
    items: Array<Binder | DocumentCollection>;
    parents: { [keys: string]: AncestorItem[] };
    users: Array<User>;
}

export type PartialDeleteFilter = Omit<DeleteFilter, "show">;

export interface ITrashService {
    trashItemsTransformer: ItemsTransformer[];
    getSoftDeletedItemsForScope(
        accountId: string,
        scopeCollectionId: string,
        user: string,
        options: IItemSearchOptions,
        filter?: PartialDeleteFilter
    ) : Promise<Array<Binder | DocumentCollection>>
}

function sortFunction(a,b){  
    const dateA = moment(a.deletionTime)
    const dateB = moment(b.deletionTime)
    return dateA.isBefore(dateB)? 1 : -1;  
} 

export class TrashService implements ITrashService {
    private _trashItemsTransformers: ItemsTransformer[]
    get trashItemsTransformer(): ItemsTransformer[] {
        return this._trashItemsTransformers;
    }

    set trashItemsTransformer(transformers: ItemsTransformer[]) {
        this._trashItemsTransformers = transformers
    }

    async getSoftDeletedItemsForScope(
        accountId: string,
        scopeCollectionId: string,
        userId: string,
        options: IItemSearchOptions,
        filter?: PartialDeleteFilter
    ): Promise<Array<Binder | DocumentCollection>> {
        const descendantsMap = await this.collectionRepository.recursivelyGetDescendants(
            scopeCollectionId,
            true
        );
        const queryFilter: BinderFilter = {
            accountId,
            softDelete: {
                show: "show-deleted",
                deletedById: filter?.deletedById ?? undefined,
                dateRange: filter?.dateRange ?? undefined,
                hideRecursiveDeleteDescendants: true
            }
        };
        const {maxResults: max} = options.binderSearchResultOptions
        
        const results = await this.searchSoftDeletedByScroll(queryFilter, descendantsMap, userId, {});
        const sortedByDeletionTime = results.sort(sortFunction);
        const maxResults = sortedByDeletionTime.slice(0, max);
        return maxResults;
    }

    

    private async searchSoftDeletedByScroll(
        filter: BinderFilter,
        descendantsMap: {[key:string]: boolean},
        userId: string,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        options: IItemSearchOptions
    ): Promise<Array<Binder | DocumentCollection>> {
        let scopeResults : Item[]= [];

        const permissionFilter: ItemFilterFunction<Item> = {
            process: async (items: Array<Binder | DocumentCollection>) => {
                const allowedItemIds = await filterItemIdsByPermission(
                    items.map(item => item.id),
                    PermissionName.EDIT,
                    this.authorizationContract,
                    this.ancestorBuilder,
                    filter.accountId,
                    userId,
                    false, // skipPublic
                    true, // skipCache
                    false, // ignoreItemPermissions
                    true, // ignoreAclsWithRestrictionSet
                );
                return items.filter(item => allowedItemIds.has(item.id));
            },
            batchProcessing: true
        };
    
        const processBatch = async (esBatch) => {
            const allowedItems: Item[] = await this.multirepository.transformScrollItemsResults(
                esBatch,
                [permissionFilter as ItemFilterFunction<Story>]
            );
            const softDeletedItemsFromCurrentScope = allowedItems.filter(i => descendantsMap[i.id])
            scopeResults = [...scopeResults,...softDeletedItemsFromCurrentScope];
        }

        await this.multirepository.searchItemsViaScroll(filter,{maxResults: 9999}, processBatch)
        return multiTransformItems(scopeResults, this.trashItemsTransformer) as Promise<Array<(Binder | DocumentCollection)>>;
    }

    constructor(
        private readonly ancestorBuilder: AncestorBuilder,
        private readonly authorizationContract: AuthorizationServiceContract,
        private readonly bindersRepoContract: BindersRepositoryServiceContract,
        private readonly collectionRepository: CollectionRepository,
        private readonly multirepository: MultiRepository,
    ) { }
    searchItemsTransformer: ItemsTransformer[];
}
