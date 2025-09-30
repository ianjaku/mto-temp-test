import * as Immutable from "immutable";
import {
    AuthorizationServiceContract,
    PermissionName,
    ResourceGroup,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    Binder,
    DocumentAncestors,
    DocumentCollection,
    Language,
    Publication,
    PublicationSearchHit,
    PublicationSearchResult,
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { AncestorBuilder } from "./ancestors/ancestorBuilder";
import { Set as ImmutableSet } from "immutable";
import {
    getAllParentsFromDocumentAncestors
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import { splitEvery } from "ramda";

export function dedupePublicationSearchResult(
    publicationSearchResult: PublicationSearchResult,
): PublicationSearchResult {
    const sortedHitsByScore = [...publicationSearchResult.hits]
        .sort((a, b) => b.score - a.score);

    const foundBinderIds = new Set<string>();
    const dedupedHits: PublicationSearchHit[] = [];
    for (const hit of sortedHitsByScore) {
        if (!foundBinderIds.has(hit.publicationSummary.binderId)) {
            foundBinderIds.add(hit.publicationSummary.binderId);
            dedupedHits.push(hit);
        }
    }

    return {
        ...publicationSearchResult,
        hits: dedupedHits,
        totalHitCount: dedupedHits.length
    }
}

export function filterPublicationsByLanguages<P extends { binderId: string, language: Language }>(publications: Array<P>, languageCodes: string[]): P[] {
    const hitsAndMissesMap = publications.reduce((reduced, publication: P) => {
        const currentPublicationsForBinder = reduced.get(publication.binderId) === undefined ?
            { hits: Immutable.List<P>(), misses: Immutable.List<P>() } :
            reduced.get(publication.binderId);
        const languagePrio = languageCodes.indexOf(publication.language.iso639_1);
        if (languagePrio === -1) {
            const misses = currentPublicationsForBinder.misses.push(publication);
            return reduced.set(publication.binderId, { hits: currentPublicationsForBinder.hits, misses });
        }
        const hits = currentPublicationsForBinder.hits.push(publication);
        return reduced.set(publication.binderId, { hits, misses: currentPublicationsForBinder.misses });
    }, Immutable.Map<string, { hits: Immutable.List<P>, misses: Immutable.List<P> }>());
    const publicationsPerBinder = hitsAndMissesMap.toArray().map(hitsAndMisses => {
        const { hits, misses } = hitsAndMisses;
        return (hits.count() > 0) ?
            hits.sortBy(pub => languageCodes.indexOf(pub.language.iso639_1))
                .toArray()
                .slice(0, 1) :
            misses.sortBy(pub => !pub["isMaster"])
                .toArray()
                .slice(0, 1);
    });
    return publicationsPerBinder.flat();
}


export type Item = Binder | Publication | DocumentCollection;

export async function getAllowedItemIds(
    authorizationContract: AuthorizationServiceContract,
    permissionName: PermissionName,
    accountId: string,
    userId?: string,
    skipPublic?: boolean,
    skipCache = false,
    ignoreAclsWithRestrictionSet = false,
): Promise<ImmutableSet<string>> {
    let resourceGroups: ResourceGroup[];
    if (userId) {
        resourceGroups = await authorizationContract.findAllowedResourceGroups(
            userId, ResourceType.DOCUMENT, permissionName, skipPublic, accountId, skipCache);
    } else {
        const permissionMap = await authorizationContract.findPublicResourceGroups(
            ResourceType.DOCUMENT, [permissionName], [accountId], skipCache);
        resourceGroups = permissionMap[0].resources;
    }

    if (ignoreAclsWithRestrictionSet) {
        resourceGroups = resourceGroups.filter((resourceGroup) => !resourceGroup["resourceGroupKey"].includes("_in_"))
    }
    const allowedIds = resourceGroups.flatMap(group => group.ids);
    return ImmutableSet(allowedIds);
}

const ITEMS_CHUNK_SIZE = 100;

export async function filterItemIdsByPermission(
    itemIds: string[],
    permissionName: PermissionName,
    authorizationContract: AuthorizationServiceContract,
    ancestorBuilder: AncestorBuilder,
    accountId: string,
    userId?: string,
    skipPublic?: boolean,
    skipCache = false,
    // Item is excluded if given permission only exists on the item and not on any parent.
    ignoreItemPermissions = false,
    ignoreAclsWithRestrictionSet = false,
): Promise<Set<string>> {
    const allowedIds = await getAllowedItemIds(
        authorizationContract, permissionName, accountId, userId,
        skipPublic, skipCache, ignoreAclsWithRestrictionSet
    );
    const ancestors = await ancestorBuilder.getAncestors(itemIds);
    const documentAncestors = ancestors.toDocumentAncestors(false);
    const selectAllowedItems = (itemIds: string[]): string[] =>
        itemIds.filter(itemId => isItemIdAllowed(itemId, allowedIds, documentAncestors, ignoreItemPermissions));
    const allowedItemIds = splitEvery(ITEMS_CHUNK_SIZE, itemIds)
        .flatMap(itemsChunk => selectAllowedItems(itemsChunk));
    return new Set(allowedItemIds);
}

export function isItemIdAllowed(
    itemId: string,
    allowedDocumentIds: ImmutableSet<string>,
    ancestors: DocumentAncestors,
    // The given item is ignored, and only parents are inspected if set to true.
    ignoreItem = false,
): boolean {
    if (!ignoreItem && allowedDocumentIds.contains(itemId)) {
        return true;
    }
    const parents = getAllParentsFromDocumentAncestors(itemId, ancestors);
    return parents.some(parent => allowedDocumentIds.contains(parent));
}
