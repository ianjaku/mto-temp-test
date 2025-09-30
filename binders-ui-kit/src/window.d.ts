import { IBuildInfo } from "@binders/client/lib/clients/client";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";

declare global {
    interface Window {
        bindersBranding: ReaderBranding;
        buildInfo: IBuildInfo;
    }
}