import * as fs from "fs";
import * as path from "path";
import {
    IVisualFormatSpec,
    UploadVisualOptions,
    Visual,
    VisualStatus,
    VisualUsage
} from "@binders/client/lib/clients/imageservice/v1/contract";
import { BackendImageServiceClient } from "../../apiclient/backendclient";
import { Config } from "@binders/client/lib/config/config";
import { minutesToMilliseconds } from "date-fns";

const SIX_MINUTES_IN_MS = minutesToMilliseconds(6);

export class TestImageFactory {

    constructor(
        private readonly config: Config,
        private readonly accountId: string
    ) { }

    /**
     * @param binderId (does not automatically put the image in this binder)
     * @param visualPathParams example: [__dirname, "myImage.png"] -> will look for a file named "myImage.png" in the same directory as your test file
     * @param options - see {@link UploadVisualOptions}, default visualUsage is {@link VisualUsage.BinderChunk}
     * @returns imageId
     */
    async uploadVisual(
        binderId: string,
        visualPathParams: string[],
        options: UploadVisualOptions = {
            visualUsage: VisualUsage.BinderChunk,
        }
    ): Promise<string> {
        const [imageId] = await this.uploadVisuals(binderId, [visualPathParams], options);
        return imageId;
    }

    private isVisualCompleted(visual: Visual): boolean {
        if (visual.status !== VisualStatus.COMPLETED) {
            return false;
        }
        if (!visual.manifestUrls || visual.manifestUrls.length === 0) {
            return false;
        }
        return [
            "ORIGINAL",
            "VIDEO_SCREENSHOT",
            "VIDEO_SCREENSHOT_BIG",
            "VIDEO_DEFAULT_LD",
        ].every(name =>
            visual.formats.some(f => f.name === name)
        );
    }

    async waitForCompleteProcessing(
        binderId: string,
        visualIds: string[],
        msPassed = 0
    ): Promise<void> {
        const client = await BackendImageServiceClient.fromConfig(this.config, "testing");
        const binderVisuals = await client.listVisuals(binderId);
        const visuals = binderVisuals.filter(v => visualIds.includes(v.id));
        const completedVisuals = visuals.filter(this.isVisualCompleted);
        if (completedVisuals.length === visualIds.length) {
            return;
        }
        if (msPassed > SIX_MINUTES_IN_MS) {
            throw new Error("Video didn't complete in 6 minutes");
        }
        // eslint-disable-next-line no-console
        console.log("waiting for video to complete processing...");
        await new Promise(resolve => setTimeout(resolve, 10000));
        await this.waitForCompleteProcessing(binderId, visualIds, msPassed + 10000);
    }

    /**
     * @param binderId (does not automatically put the image in this binder)
     * @param visualsPathParams example: <br><code>[[__dirname1, "myImage.png"], [__dirname, "myImage2.png"]]</code> <br>will look for files named "myImage1.png" and "myImage2.png" in the same directory as your test file
     * @param options - see {@link UploadVisualOptions}, default visualUsage is {@link VisualUsage.BinderChunk}
     * @returns imageId
     */
    async uploadVisuals(
        binderId: string,
        visualsPathParams: string[][],
        options: UploadVisualOptions = {
            visualUsage: VisualUsage.BinderChunk,
        }
    ): Promise<string[]> {
        const client = await BackendImageServiceClient.fromConfig(this.config, "testing");
        const attachments = visualsPathParams
            .map(pathParams => path.join(...pathParams))
            .map(fullPath => fs.createReadStream(fullPath));
        return client.uploadVisual(
            binderId,
            attachments,
            this.accountId,
            () => null,
            () => null,
            options,
        );
    }

    async getVideoFormat(
        visualId: string,
        formatName: string,
        keyFramePosition: number | null,
    ): Promise<IVisualFormatSpec | undefined> {
        const client = await BackendImageServiceClient.fromConfig(this.config, "testing");
        const visualFormatUrls = await client.composeVisualFormatUrls([visualId], {});
        return visualFormatUrls[visualId].formats.find(f =>
            f.name === formatName &&
            (keyFramePosition === null || keyFramePosition === 0 || f.keyFramePosition === keyFramePosition)
        );
    }

}
