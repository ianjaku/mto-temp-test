import {
    IUserAction,
    IUserActionSummary,
    UserActionsFindResult,
    UserReadSessionsFilter
} from "@binders/client/lib/clients/trackingservice/v1/contract";
import { TrackingServiceClient } from "@binders/client/lib/clients/trackingservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = TrackingServiceClient.fromConfig(config, "v1", browserRequestHandler);

export const APISearchUserReadSessions = (
    userActionsFilter: UserReadSessionsFilter,
): Promise<UserActionsFindResult<IUserActionSummary>> => {
    return client.searchUserReadSessions({ ...userActionsFilter });
}

export const APIMultiInsertUserAction = (
    userActions: IUserAction[],
    accountId: string,
): Promise<void> => {
    return client.multiInsertUserAction(userActions, accountId)
}