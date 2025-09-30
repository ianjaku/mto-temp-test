import { CredentialServiceClient } from "@binders/client/lib/clients/credentialservice/v1/client";
import { CredentialStatusForUsers } from "@binders/client/lib/clients/credentialservice/v1/contract";
import { FlashMessageActions } from "@binders/client/lib/react/flashmessages/actions";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import browserHandler from "@binders/client/lib/clients/browserClient";
import { getServiceLocation } from "@binders/client/lib/config/configinstance";
import i18next from "@binders/client/lib/react/i18n";

const pathPrefix = getServiceLocation("credential") + "/credential/v1";
const serviceClient = new CredentialServiceClient(pathPrefix, browserHandler);

export function updatePassword(userId: string, login: string, oldPassword: string, newPassword: string): Promise<void> {
    return serviceClient.updatePassword(userId, login, oldPassword, newPassword).then(() => {
        FlashMessageActions.success(i18next.t(TranslationKeys.User_PasswordUpdated));
    }).catch(error => {
        FlashMessageActions.error(i18next.t(TranslationKeys.User_PasswordUpdateError, {error: error.message}));
    });
}

export function APICreateOrUpdateCredentialForUser(accountId: string, userId: string, login: string, password: string): Promise<void> {
    return serviceClient.createOrUpdateCredentialForUser(accountId, userId, login, password);
}

export function APIVerifyPassword(login: string, password: string): Promise<boolean> {
    return serviceClient.verifyPassword(login, password);
}

export function APIGetCredentialStatusForUsers(accountId: string, userIds: string[]): Promise<CredentialStatusForUsers> {
    return serviceClient.getCredentialStatusForUsers(accountId, userIds);
}

export function APIExtendSession(accountId: string): Promise<boolean> {
    return serviceClient.extendSession(accountId);
}

export function APIHasSessionExpired(accountId: string): Promise<boolean> {
    return serviceClient.hasSessionExpired(accountId);
}