import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import {
    CredentialStatusForUsers
} from "@binders/client/lib/clients/credentialservice/v1/contract";
import { IADGroupMapping } from "@binders/client/lib/clients/model";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = CredentialServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const APIGetMappedUsergroups = (accountId: string): Promise<IADGroupMapping[]> => {
    return client.getAllADGroupMappings(accountId);
}

export const APISetPassword = (
    accountId: string,
    userId: string,
    login: string,
    password: string,
): Promise<void> => {
    return client.createOrUpdateCredentialForUser(accountId, userId, login, password);
}

export const APIGetCredentialStatusForUsers = (
    accountId: string,
    userIds: string[],
): Promise<CredentialStatusForUsers> => {
    return client.getCredentialStatusForUsers(accountId, userIds);
}

export const APICreateOneTimeToken = (
    userId: string,
    days: number,
): Promise<string> => {
    return client.createOneTimeToken(userId, days, undefined);
}

export const APIUpdatePasswordByAdmin = (
    userId: string,
    password: string,
    accountId: string
): Promise<void> => client.updatePasswordByAdmin(userId, password, accountId);


export const APIExtendSession = (
    accountId: string
): Promise<boolean> => {
    return client.extendSession(accountId);
};

export const APIHasSessionExpired = (
    accountId: string
): Promise<boolean> => {
    return client.hasSessionExpired(accountId);
};