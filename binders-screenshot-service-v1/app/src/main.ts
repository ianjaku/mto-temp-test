import apm from "@binders/binders-service-common/lib/monitoring/apm";
// eslint-disable-next-line sort-imports
import { Media, getDimensions } from "./services/media";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Job } from "bullmq";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { SCREENSHOT_QUEUE } from "@binders/binders-service-common/lib/bullmq/queue";
import { bootstrapWorker } from "@binders/binders-service-common/lib/bullmq/worker";
import { resizeImage } from "./services/sharp";
import { startWorkerHealthServer } from "@binders/binders-service-common/lib/bullmq/healthcheck";
import { takeScreenshot } from "./services/ffmpeg";
import { uploadToBlobStorage } from "./services/azureblob";


const config = BindersConfig.get();
const category = "screenshot-worker"

interface ScreenshotInput {
    meta: Media;
    container: string;
    targetPath: string;
    tempFile: string;
    timemark: number;
}

async function handler(job: Job<ScreenshotInput>) {
    const tx = apm.startTransaction("screenshot-processing", "request");
    const logger = LoggerBuilder.fromConfig(config, "screenshot-v1", { traceId: apm.currentTraceIds["trace.id"] })

    const body = job.data;
    const { meta, container, targetPath, tempFile, timemark } = body;
    tx?.setLabel("inputFile", job.data.targetPath);
    tx?.setLabel("timemark", job.data.timemark);

    try {
        let inSeconds: number;
        if (Number.isInteger(timemark)) {
            inSeconds = timemark;
        } else {
            inSeconds = 1;
        }
        const screenshotPath = `/tmp/${tempFile}-screenshot`;
        await takeScreenshot(logger, inSeconds.toString(), screenshotPath, targetPath);
        const results = [];
        const formatNames = Object.keys(meta);
        for (const formatName of formatNames) {
            const dimensions = getDimensions(meta, formatName);
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
            };
            results.push(result);
            await uploadToBlobStorage(config, logger, image.path, container, formatName);
        }
        tx?.setOutcome("success");
        return results;
    } catch (ex) {
        tx?.setOutcome("failure");
        tx?.addLabels({
            errorType: ex.name || "UnknownError",
            errorMessage: ex.message || "No error message"
        });
        const { stack, message, name } = ex;  // Azure errors also contain the request and response objects which are huge
        logger.error("Error while taking screenshot", category, { stack, message, name });
        throw ex;
    } finally {
        tx?.end();
    }
}

const healthServer = startWorkerHealthServer("/screenshot/v1/_status/healtz", 8020);

bootstrapWorker<ScreenshotInput>(SCREENSHOT_QUEUE, handler, { concurrency: 2 })

const gracefulShutdown = async () => {
    const logger = LoggerBuilder.fromConfig(config, "screenshot-v1")
    logger.info("SIGTERM received, closing health check server", category);
    return new Promise<void>((resolve) => {
        healthServer.close(() => {
            logger.info("Health server closed successfully", category);
            resolve();
        });
        setTimeout(() => {
            logger.warn("Forced shutdown after timeout", category);
            resolve();
        }, 5000);
    }).then(() => {
        process.exit(0);
    });
};

process.once("SIGTERM", gracefulShutdown);
process.once("SIGINT", gracefulShutdown);

