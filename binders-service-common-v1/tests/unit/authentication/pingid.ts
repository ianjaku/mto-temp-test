import { Claim, transformClaimProperties } from "../../../src/authentication/saml-sso/profile";
import { Logger } from "binders-service-common-v1/src/util/logging";
import { mock } from "jest-mock-extended";

const groups = [
    "GROUP 1",
    "GROUP 2",
    "GROUP 3",
    "GROUP 4",
];

const pingIdClaim = {
    issuer: "https://fedauth.pg.com",
    inResponseTo: "_bb9fa88cdf7f99aed66a",
    sessionIndex: "CegnPTJub.m8ecaqSAnxQAxJmpR",
    nameID: "dexyz.z",
    nameIDFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified",
    nameQualifier: undefined,
    spNameQualifier: undefined,
    UPN: "upn.a",
    "last name": "Dexyz",
    "first name": "Zjos",
    tenantId: "tc9840",
    email: "dexyz.z@pg.com",
    group: groups
};


describe("pingid sso", () => {
    it("should find the properties correctly (email -> UPN -> nameID)", async () => {
        const user = await transformClaimProperties(pingIdClaim as Claim, undefined, undefined, mock<Logger>());
        expect(user.email).toEqual(pingIdClaim.email);
        expect(user.nameID).toEqual(pingIdClaim.nameID);
        expect(user.tenantId).toEqual(pingIdClaim.tenantId);
        expect(user.displayName).toEqual(`${pingIdClaim["first name"]} ${pingIdClaim["last name"]}`);
        expect(user.firstName).toEqual(pingIdClaim["first name"]);
        expect(user.lastName).toEqual(pingIdClaim["last name"]);
        expect(user.groups).toEqual(pingIdClaim.group);
    })
});