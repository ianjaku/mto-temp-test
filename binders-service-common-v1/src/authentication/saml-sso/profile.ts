import * as validator from "validator";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Logger } from "../../util/logging";
import { MicrosoftGraphApiClient } from "../../graph/microsoftApiClient";
import { getUserName } from "@binders/client/lib/clients/userservice/v1/helpers";
import { parseUserIdFromGroupsLink } from "../../graph/helpers";

export interface UserData {
    nameID: string;
    email: string;
    tenantId: string;
    displayName: string;
    firstName: string;
    lastName: string;
    groups: string[];
}

const EMAIL_KEYS = [
    "http://schemas.xmlsoap.org/claims/EmailAddress",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "email"
] as const;

const TENANTID_KEYS = [
    "http://schemas.microsoft.com/identity/claims/tenantid",
    "tenantId",
    "issuer"
] as const;

const DISPLAY_NAME_KEYS = [
    "http://schemas.microsoft.com/identity/claims/displayname",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"
] as const;

const FIRST_NAME_KEYS = [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "first name",
    "firstName",
] as const;

const LAST_NAME_KEYS = [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
    "last name",
    "lastName",
] as const;

const AZURE_AD_GRAPH_DOMAIN = "graph.windows.net";

const GROUP_LINK_KEYS = [
    "http://schemas.microsoft.com/claims/groups.link",
] as const;

const GROUP_KEYS = [
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups",
    "http://schemas.xmlsoap.org/claims/Group",
    "group",
    "groups",
] as const;

const EXTRA_GROUP_KEYS = [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/Country",
    "http://schemas.microsoft.com/ws/2005/05/identity/claims/Country"
] as const;

const UPN_KEYS = [
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn",
    "UPN"
] as const;

const NAMEID_KEYS = [
    "nameID",
] as const;

export type Claim = { [key: string]: string | string[] | undefined };

const extractProp = <T = Claim[keyof Claim]>(claim: Claim, keys: readonly string[]): T | undefined => {
    for (const key of keys) {
        if (claim[key] != null) {
            return <T>claim[key];
        }
    }
    return undefined;
}

const getEmail = (emailProp: string, upn: string, nameID: string): string | undefined => {
    if (emailProp) {
        return emailProp;
    }
    if (upn && validator.isEmail(upn)) {
        return upn;
    }
    if (nameID && validator.isEmail(nameID)) {
        return nameID;
    }
    return undefined;
}

const getGroupsIdsFromClaim = async (
    claim: Claim,
    accountId: string | undefined,
    accountServiceClient: AccountServiceClient | undefined,
    logger: Logger,
): Promise<string[]> => {
    const groupsProp: string | string[] | undefined = extractProp(claim, GROUP_KEYS);
    if (groupsProp) {
        return Array.isArray(groupsProp) ? groupsProp : [groupsProp];
    }

    const groupsLinkProp: string | undefined = extractProp<string>(claim, GROUP_LINK_KEYS);
    if (groupsLinkProp) {
        if (!groupsLinkProp.includes(AZURE_AD_GRAPH_DOMAIN)) {
            throw new Error(`getGroupsIdsFromClaim: groups.link claim prop found but it's not an Azure AD graph link: ${groupsLinkProp}`);
        }
        if (!accountId || !accountServiceClient) {
            throw new Error("getGroupsIdsFromClaim: groups.link claim prop found but no accountId or accountServiceClient provided");
        }
        const userId = parseUserIdFromGroupsLink(groupsLinkProp);
        const settings = await accountServiceClient.getAccountSettings(accountId);
        const { tenantId, enterpriseApplicationId: clientId, enterpriseApplicationGroupReadSecret: secret } = settings.sso.saml;
        const entraUsersGraphClient = MicrosoftGraphApiClient.from({ tenantId, clientId, secret }, logger);
        return entraUsersGraphClient.getUserMemberOfGroupIds(userId);
    }
    return [];
}

export const transformClaimProperties = async (
    claim: Claim,
    accountId: string | undefined,
    accountServiceClient: AccountServiceClient | undefined,
    logger: Logger,
): Promise<UserData> => {
    logger.info("Received claim", "saml-sso", claim);
    const firstName = extractProp<string>(claim, FIRST_NAME_KEYS);
    const lastName = extractProp<string>(claim, LAST_NAME_KEYS);
    const emailProp = extractProp<string>(claim, EMAIL_KEYS);
    const upn = extractProp<string>(claim, UPN_KEYS);
    const nameID = extractProp<string>(claim, NAMEID_KEYS) || upn;
    const email = getEmail(emailProp, upn, nameID);
    const displayName = extractProp<string>(claim, DISPLAY_NAME_KEYS);

    let groups: string[] = [];
    try {
        groups = await getGroupsIdsFromClaim(claim, accountId, accountServiceClient, logger);
    } catch(error) {
        logger.fatal("Failed to get groupIds from claim", "saml-sso", { errorMessage: error.message });
    }
    const extraGroup = extractProp<string>(claim, EXTRA_GROUP_KEYS);
    if (extraGroup) {
        groups.push(extraGroup);
    }

    const user = {
        nameID,
        email,
        tenantId: extractProp<string>(claim, TENANTID_KEYS),
        displayName: getUserName({ displayName, firstName, lastName, login: email }),
        firstName,
        lastName,
        groups
    }
    logger.info("Turned into user", "saml-sso", user);
    return user;
}