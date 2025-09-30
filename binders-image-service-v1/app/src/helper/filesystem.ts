import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { unlink } from "node:fs/promises";

/**
 * Attempts to delete the passed in file path, logs an error on failure to do so
 */
export async function safeDeleteFile(filePath: string, logger: Logger): Promise<void> {
    try {
        await unlink(filePath);
        logger.debug(`Deleted ${filePath}`, "fs");
    } catch (error) {
        logger.warn(`Failed to delete file ${filePath}`, "fs", {error});
    }
}