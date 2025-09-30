import { Role } from "@binders/client/lib/clients/authorizationservice/v1/contract";

function isContributorRole(role: Role) { return role.name === "Contributor"; }

function isReviewerRole(role: Role) { return role.name === "Reviewer"; }

export function normalizeRoles(roles: Role[], includeContributorRole: boolean, includeReviewerRole: boolean): Role[] {
    return roles.map(role => {
        if (isContributorRole(role) && !includeContributorRole) {
            role.isInvisible = true;
        }
        if (isReviewerRole(role) && !includeReviewerRole) {
            role.isInvisible = true;
        }
        return role;
    });
}