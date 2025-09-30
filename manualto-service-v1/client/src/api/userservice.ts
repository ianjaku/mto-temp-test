import { User, UserPreferences } from "@binders/client/src/clients/userservice/v1/contract";
import { AccountStoreGetters } from "../stores/zustand/account-store";
import { Application } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = UserServiceClient.fromConfig(
    config,
    "v1",
    browserRequestHandler,
    AccountStoreGetters.getActiveAccountId,
);

export { getUserPreferences } from "../binders/loader"

export function sendMePasswordResetLink(logins: string, domain: string): Promise<void> {
    return client.sendMePasswordResetLink(logins, Application.READER, domain);
}

export async function setAllowAnalyticsCookies(userId: string, acknowledgementCookies: boolean): Promise<UserPreferences> {
    return client.savePreferences(userId, { acknowledgementCookies });
}

export function APIGetDeviceTargetIds(accountId: string, deviceUserId: string): Promise<string[]> {
    return client.getDeviceTargetIds(accountId, deviceUserId, true);
}

export function APIGetUsers(userIds: string[]): Promise<User[]> {
    return client.getUsers(userIds);
}

