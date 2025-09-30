import {
    AuthorizationServiceContract,
    PermissionName,
    ResourceGroup,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import {
    Item,
    hasAncestorIdsProp
} from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { uniq, without } from "ramda";
import { AncestorBuilder } from "../ancestors/ancestorBuilder";
import { AncestorItem } from "@binders/client/lib/ancestors";
import { ItemsTransformer } from "@binders/binders-service-common/lib/itemstransformers";

export class PublicNonAdvertisedFilterTransformer implements ItemsTransformer {

    constructor(
        private authorizationContract: AuthorizationServiceContract,
        private ancestorBuilder: AncestorBuilder,
        private accountId: string,
        private userId: string
    ) {}

    async items(items: Item[]): Promise<Item[]> {
        const flattenedResourceIds = await this.fetchFlattenedResourceGroups([PermissionName.VIEW], this.accountId, this.userId);
        return await this.filterPublicNonAdvertised(items, flattenedResourceIds[0]);
    }

    private async filterPublicNonAdvertised(allResults, readableElements: { id: string, isPublic?: boolean }[]) {

        const publicItemIds = readableElements.filter(({ isPublic }) => isPublic).map(({ id }) => id);
        const directReadableItemIds = readableElements.filter(({ isPublic }) => !isPublic).map(({ id }) => id);

        return await allResults.reduce(async (reducedPromise, item) => { // public ids that do not have showInOverview set, are not returned
            // if item is a root collection or is shown in overview - add it to result list
            const reduced = await reducedPromise;
            if (item["showInOverview"] || item["isRootCollection"]) {
                // return (await reduced).concat(item);
                reduced.push(item);
                return reduced;
            }
            const publicNonAdvertised = await this.isPublicNonAdvertised(
                item,
                new Set(publicItemIds),
                new Set(directReadableItemIds),
            );
            if (publicNonAdvertised) {
                return reduced;
            }
            reduced.push(item);
            return reduced;
        }, []);
    }

    private async isPublicNonAdvertised(
        item: Item,
        publicItemIds: Set<string>,
        directReadableItemIds: Set<string>,
    ) {
        const id = item["binderId"] || item.id;

        // 1. check for READ ACLs
        if (directReadableItemIds.has(id)) {
            // if the item is READable (direct ACL), it's not "public + non-advertised"
            return false;
        }

        const {ids: ancestorIds, ancestors } = await this.getAncestorIds(id, item);
        const hasReadableAncestor = ancestorIds.some(ancestorId => directReadableItemIds.has(ancestorId));
        if (hasReadableAncestor) {
            // If the item is READable (ancestor ACL), it's not "public + non-advertised"
            return false;
        }

        // 2. check for public / non-adv
        if (publicItemIds.has(id) && !item.showInOverview) {
            // on item itself
            return true;
        }

        const shouldLoadAncestors = ancestorIds.some(
            ancestorId => publicItemIds.has(ancestorId)
        );
        if (!shouldLoadAncestors) {
            // if none of the ancestors are public, the item is not "public + non-advertised"
            return false;
        }
        const allAncestorItems = await ancestors();

        const hasPublicNonAdvertisedAncestor = allAncestorItems.some(
            ancestor => publicItemIds.has(ancestor.id) && !ancestor.showInOverview
        );

        const hasPublicAdvertisedAncestor = allAncestorItems.some(
            ancestor => publicItemIds.has(ancestor.id) && ancestor.showInOverview
        );
        return hasPublicNonAdvertisedAncestor && !hasPublicAdvertisedAncestor;
    }

    private async getAncestorIds(id: string, item: Item): Promise<{ ids: string[], ancestors: () => Promise<AncestorItem[]>}> {
        const fetchAncestors = async () => {
            const ancestors = await this.ancestorBuilder.getAncestors([id]);
            return ancestors.getAllItemsFlat();
        }
        if (hasAncestorIdsProp(item)) {
            return {
                ids: item.ancestorIds,
                ancestors: fetchAncestors,
            }
        } else {
            const ancestors = await fetchAncestors();
            return {
                ids: ancestors.map(a => a.id),
                ancestors: () => Promise.resolve(ancestors),
            }
        }

    }

    private async fetchFlattenedResourceGroups(
        permissionNames: PermissionName[],
        accountId: string,
        userId?: string,
    ): Promise<Array<Array<{ id: string, isPublic?: boolean }>>> {
        const fetchUserResourceGroupArraysPromise = userId ?
            Promise.all(
                permissionNames.map(permissionName => { // better to make an endpoint to handle an array of permissions than making several requests
                    return this.authorizationContract.findAllowedResourceGroups(
                        userId,
                        ResourceType.DOCUMENT,
                        permissionName,
                        true,
                        accountId
                    );
                })
            ) :
            Promise.resolve(permissionNames.map(() => []));
        const fetchPublicResourceGroupArraysPromise = this.authorizationContract
            .findPublicResourceGroups(ResourceType.DOCUMENT, permissionNames, [accountId])
            .then(pMaps => pMaps.map(pMap => pMap.resources));
        const [userResourceGroupArrays, publicResourceGroupArrays] = await Promise.all([fetchUserResourceGroupArraysPromise, fetchPublicResourceGroupArraysPromise]);
        const flattenedPublicResourceGroups = publicResourceGroupArrays.map(this.flattenResourceGroups);
        const flattenedUserResourceGroups = userResourceGroupArrays.map(this.flattenResourceGroups);
        const result = [];
        for (let i = 0; i < flattenedPublicResourceGroups.length; i++) {
            result.push([
                ...without(flattenedUserResourceGroups[i], flattenedPublicResourceGroups[i]).map(id => { return { id, isPublic: true }; }),
                ...flattenedUserResourceGroups[i].map(id => { return { id, isPublic: false }; }),
            ]);
        }
        return result;
    }

    private flattenResourceGroups(resourceGroups: ResourceGroup[]) {
        const merged = resourceGroups.reduce((reduced, group) => reduced.concat(group.ids), []);
        return uniq(merged);
    }
}
