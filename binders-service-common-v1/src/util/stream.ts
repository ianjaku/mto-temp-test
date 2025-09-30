import { Logger } from "./logging";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isStreamWritable(writableStream, logger: Logger, loggingCategory?: string): boolean {
    const { writable, closed, headersSent } = writableStream;
    const cat = loggingCategory || "is-stream-writable";
    if (writable === false) {
        logger.warn("Stream not writable; writable prop set to false", cat)
        return false;
    }
    if (closed) {
        logger.warn("Stream not writable; closed prop set to true", cat)
        return false;
    }
    if (headersSent) {
        logger.warn("Response not writable; headersSent prop set to true", cat)
        return false;
    }
    return true;
}
