export function safeJsonParse<T>(
    json?: string,
    logger?: { error: (msg) => unknown }
): T | null {
    try {
        return JSON.parse(json);
    } catch (e) {
        const msg = `Failed to parse JSON (error: ${e.message}): ${json}`;
        if (logger) {
            logger.error(msg);
        } else {
            // eslint-disable-next-line no-console
            console.error(msg);
        }
        return null;
    }
}