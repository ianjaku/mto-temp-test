import {
    QueueFactory,
    SCREENSHOT_QUEUE
} from "@binders/binders-service-common/lib/bullmq/queue";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ScreenshotResult } from "./model";
import { VideoFormatType } from "@binders/client/lib/clients/imageservice/v1/contract";

type MetaType = {
    [format: number]: {
        path: string,
        format: VideoFormatType,
        dimensions: string,
    }
};
export interface ScreenshotPayload {
    targetPath: string;
    meta: MetaType;
    tempFile: string;
    timemark: number;
    container: string;
}



export async function enqueueScreenshot(
    bindersConfig: BindersConfig,
    logger: Logger,
    payload: ScreenshotPayload
): Promise<ScreenshotResult> {
    const factory = new QueueFactory(bindersConfig, logger);
    const screenshots = factory.getQueue<ScreenshotPayload, ScreenshotResult>(SCREENSHOT_QUEUE);
    return screenshots.add("screenshots", payload) 
}
