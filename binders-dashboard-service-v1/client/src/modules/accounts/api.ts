import { Account, AccountLicensing } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import config from "../../config";
import { getBackendRequestHandler } from "../api";

const backendClient = AccountServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const backendUserClient = UserServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const myClient = AccountServiceClient.fromConfig(config, "v1", browserRequestHandler);

export function APIGetMyAccounts(): Promise<Account[]> {
    return myClient.mine();
}

export function APIGetAllAccounts(): Promise<Account[]> {
    return backendClient.listAccounts();
}

export function APIGetLicensing(): Promise<AccountLicensing[]> {
    return backendClient.findExceedingLimitsLicensing();
}

export function APIFindUserDetailsForIds(userIds: string[]): Promise<User[]> {
    return backendUserClient.findUserDetailsForIds(userIds);
}
