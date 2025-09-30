import * as validator from "validator";
import { Claim, transformClaimProperties } from "../../../src/authentication/saml-sso/profile";
import { MockProxy, mock } from "jest-mock-extended";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { Logger } from "../../../src/util/logging";
import { parseUserIdFromGroupsLink } from "../../../src/graph/helpers";

jest.mock("../../../src/graph/microsoftApiClient", () => {
    return {
        MicrosoftGraphApiClient: {
            from: jest.fn(({ tenantId, clientId, secret }) => {
                if (!tenantId || !clientId || !secret) {
                    throw new Error("Params validation error")
                }
                return ({
                    getUserMemberOfGroupIds: async () => {
                        return ["db7d9afe-190c-4f24-a49f-cca09f589cc9"];
                    }
                });
            })
        }
    }
});


const renotecClaimWithoutEmailOrUpn = {
    issuer: "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    inResponseTo: "_4dfda55654934a86a0bb",
    sessionIndex: "_976b98d6-1710-4d6a-8a48-5f3561253e00",
    nameID: "adminWE@renotec.org",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    nameQualifier: undefined,
    spNameQualifier: undefined,
    "http://schemas.microsoft.com/identity/claims/tenantid": "120b9bbf-1037-4d62-9ab5-d5ecacece725",
    "http://schemas.microsoft.com/identity/claims/objectidentifier": "6bc1e0ee-4325-4755-8211-e56bd1b337ce",
    "http://schemas.microsoft.com/identity/claims/displayname": "adminWE",
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups": [
        "29c35640-6634-4ce6-8586-eef6eb5cf82d",
        "db7d9afe-190c-4f24-a49f-cca09f589cc9",
        "9954ed05-e0f8-4121-9aa7-43a180bf1876",
        "3ba45b0b-7c3a-4ad6-8b03-eb0c9d72fb16",
        "a7bd740d-c42a-4b73-9fb4-a34d75c68993",
        "f6004e17-44c6-414c-a431-0c4f337b552a",
        "4ed63719-a399-4141-a781-e98ca00a02e2",
        "7052821f-2873-4325-95dc-9e935c563af6",
        "1eb75c23-3440-44c1-8f1b-860ee6082756",
        "db05d32b-8aa3-4a06-9718-557bbcc32a31",
        "15424330-5e42-4e26-8fb9-1ad832bec32d",
        "7e9dac30-afe2-4494-9ffb-028442070400",
        "3f11083c-9189-4a6d-87df-37b95363f71b",
        "79cd4c3d-2ba1-4682-ab15-0200fca03f0c",
        "38da7d3f-f14d-49a2-a691-79613bf148b9",
        "80bd455b-8d46-4238-b1c5-c26710dd55be",
        "b08df466-8b67-4a38-9aca-55a906d6ace3",
        "73787b77-d9f8-4c12-89b2-b08ff00e5fee",
        "83d28577-e861-46fa-a3cb-ba4aba293a61",
        "3803b27c-5b9d-4ed6-baa0-31dedccc1c90",
        "f069f6ab-c777-4489-9c43-14cd700c2ce4",
        "ec134cc8-f383-4878-8139-883570104478",
        "f06067ca-ec82-41ce-90d8-687c56b7c0b7",
        "186d5fcb-380d-4e5b-8104-4eb7f8371153",
        "1eaf47e7-5abf-4891-bb60-ddec50980b41",
        "781e3deb-5442-4e22-a147-94dc3c3517eb",
        "dd5712ef-6895-4e72-a0e8-ca9426dce81b",
        "d5a47cf5-74ce-4d3c-9568-5739311af978",
        "375bc9f5-6e55-4343-8230-5b61f08c4e4b",
        "e00fe6f5-f025-440d-a4e2-ed72b6b57f8d",
        "4b3aa0fe-974d-4da9-a062-1e728cfc0958"
    ],
    "http://schemas.microsoft.com/identity/claims/identityprovider": "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    "http://schemas.microsoft.com/claims/authnmethodsreferences": [
        "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
        "http://schemas.microsoft.com/claims/multipleauthn"
    ],
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "adminWE",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "adminWE@renotec.org"
}

const claimWithGroupsLink = {
    issuer: "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    inResponseTo: "_4dfda55654934a86a0bb",
    sessionIndex: "_976b98d6-1710-4d6a-8a48-5f3561253e00",
    nameID: "adminWE@renotec.org",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    nameQualifier: undefined,
    spNameQualifier: undefined,
    "http://schemas.microsoft.com/identity/claims/tenantid": "120b9bbf-1037-4d62-9ab5-d5ecacece725",
    "http://schemas.microsoft.com/identity/claims/objectidentifier": "6bc1e0ee-4325-4755-8211-e56bd1b337ce",
    "http://schemas.microsoft.com/identity/claims/displayname": "adminWE",
    "http://schemas.microsoft.com/claims/groups.link": "https://graph.windows.net/6b77bc9f-022f-4914-97ca-16a89921bca2/users/93aa8b1d-4da4-4c7e-883d-a8b6373e6885/getMemberObjects",
    "http://schemas.microsoft.com/identity/claims/identityprovider": "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    "http://schemas.microsoft.com/claims/authnmethodsreferences": [
        "http://schemas.microsoft.com/ws/2008/06/identity/authenticationmethod/password",
        "http://schemas.microsoft.com/claims/multipleauthn"
    ],
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname": "adminWE",
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name": "adminWE@renotec.org"
}

const claimWithGroupsLinkInUnexpectedFormat = {
    issuer: "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    inResponseTo: "_4dfda55654934a86a0bb",
    sessionIndex: "_976b98d6-1710-4d6a-8a48-5f3561253e00",
    nameID: "adminWE@renotec.org",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    nameQualifier: undefined,
    spNameQualifier: undefined,
    "http://schemas.microsoft.com/identity/claims/tenantid": "120b9bbf-1037-4d62-9ab5-d5ecacece725",
    "http://schemas.microsoft.com/identity/claims/objectidentifier": "6bc1e0ee-4325-4755-8211-e56bd1b337ce",
    "http://schemas.microsoft.com/identity/claims/displayname": "adminWE",
    "http://schemas.microsoft.com/claims/groups.link": "https://graph.windows.net/6b77bc9f-022f-4914-97ca-16a89921bca2/userz/93aa8b1d-4da4-4c7e-883d-a8b6373e6885/getMemberObjects",
}

const claimWithGroupsLinkOnUnexpectedDomain = {
    issuer: "https://sts.windows.net/120b9bbf-1037-4d62-9ab5-d5ecacece725/",
    inResponseTo: "_4dfda55654934a86a0bb",
    sessionIndex: "_976b98d6-1710-4d6a-8a48-5f3561253e00",
    nameID: "adminWE@renotec.org",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    nameQualifier: undefined,
    spNameQualifier: undefined,
    "http://schemas.microsoft.com/identity/claims/tenantid": "120b9bbf-1037-4d62-9ab5-d5ecacece725",
    "http://schemas.microsoft.com/identity/claims/objectidentifier": "6bc1e0ee-4325-4755-8211-e56bd1b337ce",
    "http://schemas.microsoft.com/identity/claims/displayname": "adminWE",
    "http://schemas.microsoft.com/claims/groups.link": "https://graph.microsoft.com/v1.0/users/30cac522-744b-4a99-9b06-c1861dabf2b8/getMemberObjects",
}

const TEST_ACCOUNTID = "aid-123-happy";
const TEST_ACCOUNTID_MISSING_SETTINGS = "aid-123-missingsettings";

describe("saml sso basic props", () => {
    it("should find the email correctly (email -> UPN -> nameID)", async () => {
        const user = await transformClaimProperties(renotecClaimWithoutEmailOrUpn as Claim, TEST_ACCOUNTID, undefined, mock<Logger>());
        expect(validator.isEmail(user.email)).toEqual(true);
    })
});

describe("saml sso groups", () => {
    let accountServiceClient: MockProxy<AccountServiceClient>;
    let logger: MockProxy<Logger>;

    beforeEach(async () => {
        accountServiceClient = mock<AccountServiceClient>();
        accountServiceClient.getAccountSettings.calledWith(TEST_ACCOUNTID).mockReturnValue({
            sso: {
                saml: {
                    tenantId: "tenantId",
                    enterpriseApplicationId: "enterpriseApplicationId",
                    enterpriseApplicationGroupReadSecret: "enterpriseApplicationGroupReadSecret",
                }
            }
        });
        accountServiceClient.getAccountSettings.calledWith(TEST_ACCOUNTID_MISSING_SETTINGS).mockReturnValue({
            sso: {
                saml: {
                    tenantId: "tenantId",
                }
            }
        });
        logger = mock<Logger>();
    });

    it("should retrieve the group ids from the claims/groups claim property if present", async () => {
        const user = await transformClaimProperties(renotecClaimWithoutEmailOrUpn as Claim, undefined, undefined, logger);
        expect(Array.isArray(user.groups)).toEqual(true);
        expect(user.groups.length).toEqual(31);
        expect(user.groups).toContain("29c35640-6634-4ce6-8586-eef6eb5cf82d");
    });

    it("should retrieve the group ids from claims/groups.link if present, by fetching them over the graph API", async () => {
        const user = await transformClaimProperties(claimWithGroupsLink as Claim, TEST_ACCOUNTID, accountServiceClient, logger);
        expect(Array.isArray(user.groups)).toEqual(true);
        expect(user.groups.length).toEqual(1);
        expect(user.groups).toContain("db7d9afe-190c-4f24-a49f-cca09f589cc9");
    });

    it("should log a fatal error if the groups.link claim prop is present but no accountId or accountServiceClient is provided", async () => {
        await transformClaimProperties(claimWithGroupsLink as Claim, undefined, undefined, logger);
        expect(logger.fatal).toHaveBeenCalledWith(
            "Failed to get groupIds from claim",
            "saml-sso",
            {
                errorMessage: "getGroupsIdsFromClaim: groups.link claim prop found but no accountId or accountServiceClient provided",
            }
        );
    });

    it("should log a fatal error if the groups.link claim prop is present but no tenantId/enterpriseApplicationId/enterpriseApplicationGroupReadSecret is found in the sso settings", async () => {
        await transformClaimProperties(claimWithGroupsLink as Claim, TEST_ACCOUNTID_MISSING_SETTINGS, accountServiceClient, logger);
        expect(logger.fatal).toHaveBeenCalledWith(
            "Failed to get groupIds from claim",
            "saml-sso",
            {
                errorMessage: "Params validation error",
            }
        );
    });

    it("should log a fatal error if the groups.link claim prop is present but is not an Azure AD graph link", async () => {
        await transformClaimProperties(claimWithGroupsLinkOnUnexpectedDomain as Claim, TEST_ACCOUNTID, accountServiceClient, logger);
        expect(logger.fatal).toHaveBeenCalledWith(
            "Failed to get groupIds from claim",
            "saml-sso",
            {
                errorMessage: "getGroupsIdsFromClaim: groups.link claim prop found but it's not an Azure AD graph link: https://graph.microsoft.com/v1.0/users/30cac522-744b-4a99-9b06-c1861dabf2b8/getMemberObjects",
            }
        );
    });

    it("should log a fatal error if the groups.link claim prop is present but a userId cannot be extracted from it", async () => {
        await transformClaimProperties(claimWithGroupsLinkInUnexpectedFormat as Claim, TEST_ACCOUNTID, accountServiceClient, logger);
        expect(logger.fatal).toHaveBeenCalledWith(
            "Failed to get groupIds from claim",
            "saml-sso",
            {
                errorMessage: "Error parsing userId from graphAPI url; Unexpected format https://graph.windows.net/6b77bc9f-022f-4914-97ca-16a89921bca2/userz/93aa8b1d-4da4-4c7e-883d-a8b6373e6885/getMemberObjects",
            }
        );
    });

});

describe("saml sso graph api helpers", () => {
    it("parses the userId from a graph API groups link", () => {
        const link = "https://graph.windows.net/tenant-123/users/user-456/getMemberObjects"
        expect(parseUserIdFromGroupsLink(link)).toEqual("user-456");
    });
})