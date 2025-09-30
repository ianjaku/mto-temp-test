import { Application } from "@microsoft/microsoft-graph-types"
import { createMockFactory } from "../util"

const mockApplication: Application = {
    id: "014d790a-6f05-4590-a41e-549939389546",
    deletedDateTime: null,
    appId: "45365ff0-c4fb-40e7-8693-c731f8ee3cc6",
    applicationTemplateId: null,
    disabledByMicrosoftStatus: null,
    createdDateTime: "2018-09-27T08:15:19Z",
    displayName: "devops-pipeline",
    description: null,
    groupMembershipClaims: null,
    identifierUris: [
        "http://devops-pipeline"
    ],
    isDeviceOnlyAuthSupported: null,
    isFallbackPublicClient: null,
    notes: null,
    publisherDomain: null,
    signInAudience: "AzureADMyOrg",
    tags: [],
    tokenEncryptionKeyId: null,
    optionalClaims: null,
    addIns: [],
    api: {
        acceptMappedClaims: null,
        knownClientApplications: [],
        requestedAccessTokenVersion: null,
        oauth2PermissionScopes: [
            {
                adminConsentDescription: "Allow the application to access devops-pipeline on behalf of the signed-in user.",
                adminConsentDisplayName: "Access devops-pipeline",
                id: "e9617f81-7cdd-4d5a-b8aa-2c6b1be0e275",
                isEnabled: true,
                type: "User",
                userConsentDescription: "Allow the application to access devops-pipeline on your behalf.",
                userConsentDisplayName: "Access devops-pipeline",
                value: "user_impersonation"
            }
        ],
        preAuthorizedApplications: []
    },
    appRoles: [],
    info: {
        logoUrl: null,
        marketingUrl: null,
        privacyStatementUrl: null,
        supportUrl: null,
        termsOfServiceUrl: null
    },
    keyCredentials: [],
    parentalControlSettings: {
        countriesBlockedForMinors: [],
        legalAgeGroupRule: "Allow"
    },
    passwordCredentials: [
        {
            customKeyIdentifier: null,
            displayName: "Password friendly name",
            endDateTime: "2024-06-08T08:45:51.3975948Z",
            hint: "ZNi",
            keyId: "407e1566-2d03-4f6a-a0a7-49b0dfa9a876",
            secretText: null,
            startDateTime: "2022-06-08T08:45:51.3975948Z"
        }
    ],
    publicClient: {
        redirectUris: []
    },
    requiredResourceAccess: [],
    verifiedPublisher: {
        displayName: null,
        verifiedPublisherId: null,
        addedDateTime: null
    },
    web: {
        homePageUrl: "http://devops-pipeline",
        logoutUrl: null,
        redirectUris: [],
        implicitGrantSettings: {
            enableAccessTokenIssuance: false,
            enableIdTokenIssuance: true
        }
    },
    spa: {
        redirectUris: []
    }
}

export const mockApplicationFactory = createMockFactory(mockApplication)
