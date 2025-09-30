import { Acl, AssigneeType, IAclRestrictionSet, ResourceGroupWithKey } from "./contract";
import { TOKEN_KEY } from "./tokenacl";
import { isProduction } from "../../../util/environment";

// If given url points to the production backend and we're in a different environment, replace the host (eg when loading a logo in which the production hostname is hardcoded)
export function maybeUpdateHostInProductionUrl(url: string, imageServiceExternalLocation?: string): string {
    if (!isProduction() && url.match(/https:\/\/api\.binders\.media/) && imageServiceExternalLocation) {
        return url.replace(/https:\/\/api\.binders\.media/, imageServiceExternalLocation);
    }
    return url;
}

export const buildTokenUrl = (url: string, token: string): string => {
    if (!url) {
        return "";
    }
    if (!token || url.match(/https:\/\/[\w-]+\.azureedge\.net/)) {
        return url;
    }
    return `${url}${url.indexOf("?") >= 0 ? "&" : "?"}${TOKEN_KEY}=${token}`;
}

export function buildAclKey(roleName: string, aclRestrictionSet?: IAclRestrictionSet): string {
    const languageCodes = aclRestrictionSet?.languageCodes;
    if (!((languageCodes || []).length)) {
        return roleName;
    }
    const suffix = aclRestrictionSet ? buildRestrictionSetKeySuffix(aclRestrictionSet) : "";
    return `${roleName}${suffix}`;
}

export function buildRestrictionSetKeySuffix(aclRestrictionSet: IAclRestrictionSet): string {
    const languageCodes = aclRestrictionSet.languageCodes;
    return (languageCodes || []).length ? `_in_langCodes_${languageCodes.join(",")}` : "";
}

export function buildResourceGroupKey(resourceType: number, aclRestrictionSet?: IAclRestrictionSet): string {
    const suffix = aclRestrictionSet ? buildRestrictionSetKeySuffix(aclRestrictionSet) : "";
    return `${resourceType}${suffix}`;
}

export function isRestrictedResourceGoup(resourceGroup: ResourceGroupWithKey): boolean {
    return resourceGroup.resourceGroupKey.includes("_in_");
}

export function extractLanguagesFromResourceGroupKey(resourceGroupKey: string): string[] {
    return resourceGroupKey.includes("langCodes") ?
        resourceGroupKey.substring(resourceGroupKey.indexOf("langCodes_") + 10).split(",") :
        undefined;
}

export function buildRoleTranslationKey(roleName: string): string {
    return `Acl_Role${roleName}`;
}

export function hasPublic(acls: Acl[]): boolean {
    return acls.some(acl => acl.assignees.some(a => a.type === AssigneeType.PUBLIC));
}
