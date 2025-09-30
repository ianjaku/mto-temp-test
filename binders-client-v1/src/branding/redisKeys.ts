export const REDIS_CSS_CACHE_VERSION = 3;
export const REDIS_CSS_PREFIX = "manualto-reader-css-";

export const redisKeys = {
    "index": "index",
    "invite": "invite",
    "reset": "reset",
    "login": "login",
}


export function getFullPrefixForFile(filename: string): string {
    return `${REDIS_CSS_PREFIX}${redisKeys[filename]}-${REDIS_CSS_CACHE_VERSION}-`;
}