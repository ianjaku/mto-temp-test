import { User, Usergroup } from "@binders/client/lib/clients/userservice/v1/contract";
import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";

export interface Credentials {
    login: string;
    password: string;
    domain?: string;
    noAdminUsers?: UserSpecs[];
}

export interface ServiceLocations {
    editor: string;
    manage: string;
    reader: string;
}

export interface AccountUserSpecs {
    account: AccountSpecs;
    user: UserSpecs;
}

export interface UserGroupSpecs {
    name: string,
    memberLogins: string[],
}
export interface AccountSpecs {
    name: string;
    domain: string;
    features: string[];
    members: UserSpecs[];
    usergroups: UserGroupSpecs[];
    accountId: string;
}

export interface UserSpecs {
    name: string;
    login: string;
    firstName: string;
    lastName: string;
    password: string;
    isAdmin?: boolean;
    skipDefaultPermissions?: boolean;
}

export interface LanguageSpec {
    languageCode: string,
    isPublished?: boolean,
    isPrimary?: boolean,
    chunks?: [{ text: string }],
    title: string,
    semanticLinks?: string[];
}

export interface AclSpec {
    login: string;
    roleId: string;
}
export interface ItemHierarchy {
    name: string,
    type: "collection" | "document",
    languages?: LanguageSpec[];
    aclsToAssign: AclSpec[];
    children?: ItemHierarchy[],
}

export interface SeedData {
    itemHierarchy: ItemHierarchy;
    rootCollection: string;
    domain: string;
    accountId: string;
    users?: User[];
    groups?: Usergroup[];
}

export interface TestData {
    locations: ServiceLocations;
    seedData: SeedData;
    credentials: Credentials;
    clients: {
        credentials: CredentialServiceClient,
    },
}
