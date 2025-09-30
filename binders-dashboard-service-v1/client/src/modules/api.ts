import {AuthType, BrowserRequestHandler} from "@binders/client/lib/clients/browserClient";

export function getBackendRequestHandler(): BrowserRequestHandler {
    return new BrowserRequestHandler(AuthType.Backend);
}