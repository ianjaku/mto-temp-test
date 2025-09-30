import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import { UserServiceClient } from "@binders/client/lib/clients/userservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

export async function getUser(userId: string): Promise<User> {
    const userClient = UserServiceClient.fromConfig(config, "v1", browserRequestHandler);
    return await userClient.getUser(userId);
}


export async function getUsers(userIds: string[]): Promise<User[]> {
    const userClient = UserServiceClient.fromConfig(config, "v1", browserRequestHandler);
    return await userClient.getUsers(userIds);
}