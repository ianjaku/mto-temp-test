
import { AuthorizationServiceClient } from "@binders/client/lib/clients/authorizationservice/v1/client";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "./handler";

const authClient = AuthorizationServiceClient.fromConfig(config, "v1", getBackendRequestHandler());
const userClient = UserServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function loadAccountAdmins(accountId: string): Promise<{ admins: string[]; adminGroupId?: string; }> {
    const adminGroup = await authClient.getAdminGroup(accountId);
    if (!adminGroup) {
        return { admins: await authClient.getAccountAdmins(accountId) }
    }
    const groupDetails = await userClient.getGroupMembers(accountId, adminGroup, {});
    return { admins: groupDetails.members.map(({ id }) => id), adminGroupId: adminGroup };
}

export async function addAccountAdmin(
    accountId: string,
    userId: string,
    groupId: string
): Promise<string[]> {
    await userClient.addGroupMember(accountId, groupId, userId)
    const groupDetails = await userClient.getGroupMembers(accountId, groupId, {});
    return groupDetails.members.map(({ id }) => id);
}

export async function removeAccountAdmin(
    accountId: string,
    userId: string,
    groupId: string
): Promise<string[]> {
    await userClient.removeGroupMember(accountId, groupId, userId);
    const groupDetails = await userClient.getGroupMembers(accountId, groupId, {});
    return groupDetails.members.map(({ id }) => id);
}
