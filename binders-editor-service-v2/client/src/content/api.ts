import { ContentServiceClient } from "@binders/client/lib/clients/contentservice/v1/client";
import browserRequestHandler from "@binders/client/lib/clients/browserClient";
import { config } from "@binders/client/lib/config";

export const client = ContentServiceClient.fromConfig(config, browserRequestHandler);
