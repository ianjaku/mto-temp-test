/* eslint-disable no-case-declarations */
import {
    ITokenAcl,
    PermissionName,
    ResourceGroup,
    ResourcePermission,
    ResourceType 
} from "./contract";
import { intersection } from "ramda";

export const TOKEN_KEY = "t";

export enum AccountAclScope {
    BRANDING = 0,
}

export interface TokenResourceGroup extends ResourceGroup {
    scopes?: AccountAclScope[],
}

const ALL_SCOPES = [AccountAclScope.BRANDING];

export default class TokenAcl implements ITokenAcl {
    constructor(public readonly rules: ResourcePermission[], public readonly scopes: AccountAclScope[] = ALL_SCOPES) {
    }

    static fromItemIds(ids: string[]): TokenAcl {
        const rules = [{
            resource: {
                type: ResourceType.DOCUMENT,
                ids,
            },
            permissions: [{
                name: PermissionName.VIEW
            }]
        }];
        return new TokenAcl(rules);
    }

    static fromAccountId(accountId: string, scopes?: AccountAclScope[]): TokenAcl {
        const rules = [{
            resource: {
                type: ResourceType.ACCOUNT,
                ids: [accountId],
            },
            permissions: [{
                name: PermissionName.VIEW
            }]
        }];
        return new TokenAcl(rules, scopes);
    }

    allows(requestedResourceGroup: TokenResourceGroup): boolean {
        const { type, ids: requestedIds, scopes: requestedScopes } = requestedResourceGroup;
        switch (type) {
            case ResourceType.ACCOUNT:
                const accountRule = this.rules.find(r => r.resource.type === ResourceType.ACCOUNT);
                const allowedAccountIds = accountRule.resource.ids;
                const [requestedAccountId] = requestedIds; // currently only 1 accountId supported
                if (!allowedAccountIds.includes(requestedAccountId)) {
                    return false;
                }
                if (!requestedScopes || !requestedScopes.length) {
                    return false;
                }
                const retainedScopes = intersection(this.scopes, requestedScopes);
                return retainedScopes.length === requestedScopes.length;
            default: // ResourceType.DOCUMENT
                const itemRule = this.rules.find(r => r.resource.type === ResourceType.DOCUMENT);
                const allowedItemIds = itemRule.resource.ids;
                for (const id of requestedIds) {
                    if (!allowedItemIds.includes(id)) {
                        return false;
                    }
                }
                return true;
        }
    }
}
