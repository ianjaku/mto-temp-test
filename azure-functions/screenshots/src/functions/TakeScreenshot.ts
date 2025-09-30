import { HttpRequest, HttpResponseInit, InvocationContext, app } from "@azure/functions";
import { setupBinary, takeScreenshot } from "../services/ffmpeg";
import { resizeImage } from "../services/sharp";
import { sendSlackNotification } from "../services/slack";
import { uploadToBlobStorage } from "../services/azureblob";

function getDimensions(meta, formatName): { height: number, width: number } {
    const { dimensions } = meta[formatName];
    if (!dimensions) {
        throw new Error(`Could not determine dimensions for format ${formatName}`);
    }
    const [width, height] = dimensions
        .split("x")
        .map(s => s.trim())
        .map(s => Math.floor(Number.parseInt(s, 10)));
    return { height, width };
}

interface ScreenshotInput {
    meta: string
    container: string
    targetPath: string
    tempFile: string
    timemark: number
}



export async function TakeScreenshot(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const body = await request.json() as ScreenshotInput
    context.log({ incomingRequest: JSON.stringify(body) })
    await setupBinary(context);
    const { meta, container, targetPath, tempFile, timemark } = body;
    try {
        let inSeconds;
        if (Number.isInteger(timemark)) {
            inSeconds = timemark;
        } else {
            inSeconds = 1;
        }
        const screenshotPath = `/tmp/${tempFile}-screenshot`;
        await takeScreenshot(context, inSeconds, screenshotPath, targetPath);
        const results = [];
        const formatNames = Object.keys(meta);
        for (const formatName of formatNames) {
            const dimensions = getDimensions(meta, formatName);
            context.log({ dimensions })
            const image = await resizeImage(screenshotPath, dimensions);
            const { format: metaFormat } = meta[formatName];
            const result = {
                Payload: {
                    format: metaFormat,
                    width: image.width,
                    height: image.height,
                    dimensions: `${image.width}:${image.height}`,
                    size: image.size,
                    formatName,
                }
            }
            results.push(result);
            context.log(`Uploading to blob storage: ${JSON.stringify(result)}`)
            await uploadToBlobStorage(context, image.path, container, formatName);
        }
        return {
            status: 200,
            body: JSON.stringify(results),
        };
    } catch (ex) {
        context.error(ex);
        await sendSlackNotification(context, ex)
        throw new Error(ex);
    }
}

app.http("TakeScreenshot", {
    methods: ["GET", "POST"],
    authLevel: "function",
    handler: TakeScreenshot
});
