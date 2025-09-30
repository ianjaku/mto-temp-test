
import { AccountServiceClient } from "@binders/client/lib/clients/accountservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "./handler";

const client = AccountServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export function linkFeature(accountId: string, feature: string): Promise<void> {
    return client.linkFeature(accountId, feature);
}

export function linkManyFeatures(accountId: string, features: string[]): Promise<void> {
    return client.setAccountFeatures(accountId, features);
}

export function unlinkFeature(accountId: string, feature: string): Promise<void> {
    return client.unlinkFeature(accountId, feature);
}
