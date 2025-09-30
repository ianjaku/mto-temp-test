import { DevopsServiceClient } from "@binders/client/lib/clients/devopsservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

const client = DevopsServiceClient.fromConfig(config, "v1", browserRequestHandler);

export async function APITempLog(msg: string): Promise<void> {
    await client.tempLog(msg);
}
